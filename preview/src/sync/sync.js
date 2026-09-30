// 동기화 엔진: 이 기기 변경분 올리기(push) → 서버 변경분 받기(pull) → 첨부 올리기
// 충돌은 레코드 단위로 '나중에 고친 쪽'이 이긴다 (client_updated_at 비교).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { createClient } from './supabase.js';
import { saveSecret, loadSecret, deleteSecret, SECURE_KV_KEYS } from './secure-store.js';
import { syncState } from './state.js';
import { getSyncSettings, setSyncSettings } from './settings.js';
import { subscribe, pendingItems, ackPushed, applyRemote, pendingCount, kvGet, kvSet, wipeLocal, rawAll, update, blobGet, flushNow } from '../data/db.js';
import { setRemoteLoader } from '../data/attachments.js';

const PAGE = 1000;
const PUSH_BATCH = 200;
const OVERLAP = 50; // 늦게 커밋된 행을 놓치지 않도록 커서를 조금 겹쳐 읽는다
const FULL_EVERY = 24 * 3600 * 1000;

let client = null;
let timer = null;
let running = false;
let again = false;
let started = false;

export function getConfig() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY, builtIn: true };
  const d = getSyncSettings();
  if (d && d.url && d.key) return { url: d.url, key: d.key, builtIn: false };
  return null;
}

export function humanError(e) {
  const m = String((e && e.message) || e || '');
  if (e && e.name === 'TypeError') return '서버에 연결할 수 없습니다. 인터넷 연결이나 서버 주소를 확인하세요.';
  if (/Invalid login credentials/i.test(m)) return '이메일 또는 비밀번호가 맞지 않습니다.';
  if (/Email not confirmed/i.test(m)) return '가입 확인 메일의 링크를 먼저 눌러 주세요.';
  if (/already registered|already exists/i.test(m)) return '이미 가입된 이메일입니다. 로그인하세요.';
  if (/at least 6|Password should/i.test(m)) return '비밀번호는 6자 이상이어야 합니다.';
  if (/invalid.*email|Unable to validate email/i.test(m)) return '이메일 형식을 확인하세요.';
  if (/Invalid API key|No API key/i.test(m)) return '서버 키가 올바르지 않습니다. 설정의 키를 확인하세요.';
  if (/refresh.*token|Invalid Refresh Token|Refresh Token Not Found/i.test(m)) return '로그인이 만료되었습니다. 다시 로그인하세요.';
  if (e && e.status === 404) return '서버에 동기화용 테이블/함수가 없습니다. 안내 문서의 SQL을 실행했는지 확인하세요.';
  if (/rate limit/i.test(m)) return '요청이 너무 잦습니다. 잠시 뒤 다시 시도하세요.';
  return m || '알 수 없는 오류';
}

function userOf(u) {
  return u ? { id: u.id, email: u.email } : null;
}

async function setup() {
  const cfg = getConfig();
  syncState.set({ configured: !!cfg, user: null });
  client = null;
  if (!cfg) return;
  client = createClient(cfg);
  client.onSession = (s) => {
    if (s) saveSecret('session', s).catch(() => {});
    else deleteSecret('session').catch(() => {});
    syncState.set({ user: s ? userOf(s.user) : null });
  };
  const sess = await loadSecret('session');
  if (sess) {
    client.setSession(sess);
  }
}

export async function initSync() {
  await setup();
  setRemoteLoader(downloadAttachment);
  if (started) return;
  started = true;
  subscribe(() => {
    syncState.set({ pending: pendingCount() });
    schedule(1500);
  });
  window.addEventListener('online', () => schedule(0));
  window.addEventListener('offline', () => syncState.set({ status: 'offline' }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') schedule(0);
    else {
      flushNow();
      schedule(0);
    }
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') schedule(0);
  }, 45000);
  syncState.set({ pending: pendingCount() });
  schedule(300);
}

export async function reconfigure(cfg) {
  setSyncSettings({ url: cfg.url, key: cfg.key });
  if (client && client.session) await client.signOut();
  await setup();
  schedule(0);
}

export function schedule(delay = 0) {
  clearTimeout(timer);
  timer = setTimeout(() => syncNow(), delay);
}

/** 로그인 후: 이 기기에 다른 계정의 데이터가 있으면 알려 준다 */
export async function ownerStatus(user) {
  const owner = await kvGet('sync:owner');
  if (!owner) return 'new';
  return owner === user.id ? 'same' : 'different';
}

async function adopt(user, { wipe }) {
  if (wipe) await wipeLocal({ keepKv: [...SECURE_KV_KEYS, 'secret:session'] });
  await kvSet('sync:owner', user.id);
  await kvSet('sync:cursor', 0);
  await kvSet('sync:lastFull', 0);
}

/**
 * 로그인.
 * - 이 기기에 다른 계정의 기록이 있으면 confirmWipe()로 물어본 뒤 지운다.
 * - 이 기기에서 처음 로그인하는데 기록이 있으면 chooseNew()로 'merge'(합치기) / 'replace'(계정 기록만) / null(취소)을 묻는다.
 * @returns {{ user, wiped }} wiped=true면 이 기기 기록을 지웠으니 화면을 새로 여는 게 안전하다
 */
export async function signIn(email, password, { confirmWipe, chooseNew } = {}) {
  if (!client) throw new Error('서버 설정이 필요합니다');
  const user = await client.signIn(email.trim(), password);
  const st = await ownerStatus(user);
  let wiped = false;
  const cancel = async () => {
    await client.signOut();
    throw new Error('로그인을 취소했습니다');
  };
  if (st === 'different') {
    const ok = confirmWipe ? await confirmWipe() : false;
    if (!ok) await cancel();
    await adopt(user, { wipe: true });
    wiped = true;
  } else if (st === 'new') {
    const choice = chooseNew ? await chooseNew() : 'merge';
    if (!choice) await cancel();
    await adopt(user, { wipe: choice === 'replace' });
    wiped = choice === 'replace';
  }
  if (client.session) await saveSecret('session', client.session).catch(() => {});
  syncState.set({ user: userOf(user), error: null });
  schedule(0);
  return { user, wiped };
}

export async function signUp(email, password) {
  if (!client) throw new Error('서버 설정이 필요합니다');
  const r = await client.signUp(email.trim(), password);
  if (!r.needsConfirm && r.user) {
    const st = await ownerStatus(r.user);
    if (st !== 'same') await adopt(r.user, { wipe: false });
    syncState.set({ user: userOf(r.user) });
    schedule(0);
  }
  return r;
}

export async function recoverPassword(email) {
  if (!client) throw new Error('서버 설정이 필요합니다');
  await client.recover(email.trim());
}

/** 로그아웃. wipe=true면 이 기기의 데이터도 지운다 (서버 데이터는 그대로) */
export async function signOut({ wipe = false } = {}) {
  if (!client) return;
  if (!wipe) {
    try {
      await syncNow();
    } catch {
      /* 무시 */
    }
  }
  await client.signOut();
  if (wipe) {
    await wipeLocal({ keepKv: SECURE_KV_KEYS });
    await kvSet('sync:owner', null);
  }
  syncState.set({ user: null, status: 'idle', error: null });
}

export async function syncNow({ full = false } = {}) {
  if (!client || !client.session) {
    syncState.set({ pending: pendingCount() });
    return false;
  }
  if (running) {
    again = true;
    return false;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    syncState.set({ status: 'offline', pending: pendingCount() });
    return false;
  }
  running = true;
  syncState.set({ status: 'syncing' });
  try {
    const owner = await kvGet('sync:owner');
    const uid = client.session.user && client.session.user.id;
    if (!owner && uid) await kvSet('sync:owner', uid);
    await push();
    const lastFull = (await kvGet('sync:lastFull')) || 0;
    const doFull = full || Date.now() - lastFull > FULL_EVERY;
    await pull(doFull);
    if (doFull) await kvSet('sync:lastFull', Date.now());
    await syncAttachments(uid);
    syncState.set({ status: 'ok', lastSync: Date.now(), error: null, pending: pendingCount() });
    return true;
  } catch (e) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    syncState.set({ status: offline ? 'offline' : 'error', error: humanError(e), pending: pendingCount() });
    if (e && e.status === 400 && /refresh/i.test(String(e.message))) {
      await client.signOut();
    }
    return false;
  } finally {
    running = false;
    if (again) {
      again = false;
      schedule(800);
    }
  }
}

async function push() {
  for (let guard = 0; guard < 100; guard++) {
    const items = pendingItems(PUSH_BATCH);
    if (!items.length) return;
    const payload = items.map(({ t, id, rec }) => ({
      tbl: t,
      id,
      data: rec,
      deleted: !!rec.deleted,
      client_updated_at: rec.updatedAt,
    }));
    await client.rpc('sync_push', { items: payload });
    ackPushed(items);
    if (items.length < PUSH_BATCH) return;
  }
}

async function pull(full) {
  let cursor = full ? 0 : (await kvGet('sync:cursor')) || 0;
  let from = full ? 0 : Math.max(0, cursor - OVERLAP);
  for (let guard = 0; guard < 1000; guard++) {
    const rows = (await client.selectRecords(from, PAGE)) || [];
    for (const r of rows) {
      const rec = { ...(r.data || {}), id: r.id, updatedAt: Number(r.client_updated_at) };
      if (r.deleted) rec.deleted = true;
      else delete rec.deleted;
      applyRemote(r.tbl, rec);
      const rev = Number(r.rev);
      if (rev > cursor) cursor = rev;
      if (rev > from) from = rev;
    }
    if (rows.length < PAGE) break;
  }
  await kvSet('sync:cursor', cursor);
}

async function syncAttachments(uid) {
  if (!uid) return;
  for (const att of rawAll('attachments')) {
    const path = `${uid}/${att.id}`;
    if (att.deleted) {
      if (att.uploaded && !att.purged) {
        try {
          await client.removeObject(path);
        } catch {
          /* 다음에 다시 시도 */
          continue;
        }
        update('attachments', att.id, { purged: true });
      }
      continue;
    }
    if (att.uploaded) continue;
    const blob = await blobGet(att.id);
    if (!blob) continue;
    await client.upload(path, blob);
    update('attachments', att.id, { uploaded: true });
  }
}

async function downloadAttachment(att) {
  if (!client || !client.session) return null;
  const uid = (await kvGet('sync:owner')) || (client.session.user && client.session.user.id);
  if (!uid) return null;
  return client.download(`${uid}/${att.id}`);
}

export function isSignedIn() {
  return !!(client && client.session);
}
