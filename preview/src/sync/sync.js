// 동기화 엔진: 이 기기 변경분 올리기(push) → 서버 변경분 받기(pull) → 첨부 올리기
// 충돌은 레코드 단위로 '나중에 고친 쪽'이 이긴다 (client_updated_at 비교).
// 미리 보기는 같은 계정이어도 서버의 기록 공간이 따로다 (src/env.js SPACE).
// 예시 기록을 보는 동안(meta.demo)은 아무것도 올리거나 받지 않는다 → 예시가 계정에 섞이지 않는다.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { createClient } from './supabase.js';
import { saveSecret, loadSecret, deleteSecret, SECURE_KV_KEYS } from './secure-store.js';
import { syncState } from './state.js';
import { getSyncSettings, setSyncSettings } from './settings.js';
import { SPACE, OTHER_SPACE } from '../env.js';
import { subscribe, pendingItems, ackPushed, applyRemote, pendingCount, kvGet, kvSet, wipeLocal, rawAll, update, blobGet, flushNow, get, requeueAll } from '../data/db.js';
import { setRemoteLoader } from '../data/attachments.js';

const PAGE = 1000;
const PUSH_BATCH = 200;
const OVERLAP = 50; // 늦게 커밋된 행을 놓치지 않도록 커서를 조금 겹쳐 읽는다
const FULL_EVERY = 24 * 3600 * 1000;
/** 이만큼 못 맞추면 설정 단추에 점을 찍는다 */
export const STALE_AFTER = 12 * 3600 * 1000;

let client = null;
let timer = null;
let running = false;
let again = false;
let started = false;
let hold = false; // 화면을 새로 열기 직전: 아무것도 하지 않는다

export function getConfig() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY, builtIn: true };
  const d = getSyncSettings();
  if (d && d.url && d.key) return { url: d.url, key: d.key, builtIn: false };
  return null;
}

export function humanError(e) {
  const m = String((e && e.message) || e || '');
  const st = e && e.status;
  if (e && e.name === 'TypeError') return '서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.';
  if (/Invalid login credentials|User not found/i.test(m)) return '이메일이나 비밀번호가 맞지 않아요.';
  if (/Email not confirmed/i.test(m)) return '가입 확인 메일의 링크를 먼저 눌러 주세요.';
  if (/Signups not allowed|signup.*disabled/i.test(m)) return '이 서버는 새 가입을 받지 않아요. 서버 관리 화면(Supabase)에서 계정을 만들어 주세요.';
  if (/Email logins are disabled|provider.*disabled/i.test(m)) return '서버에서 이메일 로그인이 꺼져 있어요.';
  if (/already registered|already exists/i.test(m)) return '이미 가입된 이메일이에요. 로그인해 주세요.';
  if (/at least 6|Password should/i.test(m)) return '비밀번호는 6자 이상이어야 해요.';
  if (/invalid.*email|Unable to validate email/i.test(m)) return '이메일 형식을 확인해 주세요.';
  if (/Invalid API key|No API key/i.test(m)) return '서버 키가 맞지 않아요. 서버 설정의 공개 키를 확인해 주세요.';
  if (/refresh.*token|Invalid Refresh Token|Refresh Token Not Found/i.test(m)) return '로그인이 풀렸어요. 다시 로그인해 주세요.';
  if (st === 404 || /Could not find the (table|function)|does not exist/i.test(m)) return '서버에 동기화용 표가 없어요. 안내의 SQL을 실행했는지 확인해 주세요.';
  if (/permission denied/i.test(m)) return '서버의 권한 설정이 맞지 않아요. 안내의 SQL을 다시 실행해 주세요.';
  if (/rate limit|too many/i.test(m) || st === 429) return '요청이 너무 잦아요. 잠시 뒤에 다시 해 주세요.';
  if (st >= 500) return '서버가 잠시 응답하지 않아요. 조금 뒤에 저절로 다시 맞춰요.';
  return m || '알 수 없는 오류가 생겼어요.';
}

function userOf(u) {
  return u ? { id: u.id, email: u.email } : null;
}

/** 예시 기록을 보는 중인가 (store.js가 meta에 적어 둔다) */
const demoNow = () => {
  const m = get('meta', 'main');
  return !!(m && m.demo);
};

async function setup() {
  const cfg = getConfig();
  syncState.set({ configured: !!cfg, builtIn: !!(cfg && cfg.builtIn), user: null });
  client = null;
  if (!cfg) return;
  client = createClient(cfg);
  client.onSession = (s) => {
    if (s) saveSecret('session', s).catch(() => {});
    else deleteSecret('session').catch(() => {});
    syncState.set({ user: s ? userOf(s.user) : null });
  };
  const [sess, lost, lastOk, first] = await Promise.all([loadSecret('session'), kvGet('sync:lost'), kvGet('sync:lastOk'), kvGet('sync:first')]);
  syncState.set({ lost: !!lost && !sess, lastSync: lastOk || null, first: !!first && !!sess });
  if (sess) client.setSession(sess);
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

/** 로그인·가입 직후: 다음 동기화가 끝나면 무엇을 받아 왔는지 한 줄로 알린다 (main.js) */
async function signedIn(user, { reloading = false } = {}) {
  await kvSet('sync:lost', false);
  await kvSet('sync:first', true); // 기록을 지우고 화면을 새로 열어도 알림이 나가게
  syncState.set({ user: userOf(user), error: null, lost: false, first: true });
  // 기록을 지웠으면 부른 쪽이 화면을 새로 연다 → 맞추기는 새로 연 뒤에 (알림이 사라지지 않게)
  if (reloading) hold = true;
  else schedule(0);
}

/**
 * 로그인.
 * - 예시 기록을 보는 중이면 confirmDemo()로 물은 뒤 예시를 지우고 계정 기록을 받는다 (합치기 없음).
 * - 이 기기에 다른 계정의 기록이 있으면 confirmWipe()로 물어본 뒤 지운다.
 * - 이 기기에서 처음 로그인하는데 기록이 있으면 chooseNew()로 'merge'(합치기) / 'replace'(계정 기록만) / null(취소)을 묻는다.
 * @returns {{ user, wiped }} wiped=true면 이 기기 기록을 지웠으니 화면을 새로 여는 게 안전하다
 */
export async function signIn(email, password, { confirmWipe, chooseNew, confirmDemo } = {}) {
  if (!client) throw new Error('서버 설정이 필요해요');
  const user = await client.signIn(email.trim(), password);
  let wiped = false;
  const cancel = async () => {
    await client.signOut();
    throw new Error('로그인을 취소했어요');
  };
  if (demoNow()) {
    const ok = confirmDemo ? await confirmDemo() : false;
    if (!ok) await cancel();
    await adopt(user, { wipe: true });
    wiped = true;
  } else {
    const st = await ownerStatus(user);
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
  }
  if (!wiped) {
    // 이 기기 기록을 모두 다시 올리고 서버 기록도 처음부터 받는다 (서버가 비었거나 바뀌었어도 맞춰지게)
    requeueAll();
    await kvSet('sync:cursor', 0);
    await kvSet('sync:lastFull', 0);
  }
  if (client.session) await saveSecret('session', client.session).catch(() => {});
  await signedIn(user, { reloading: wiped });
  return { user, wiped };
}

export async function signUp(email, password) {
  if (!client) throw new Error('서버 설정이 필요해요');
  if (demoNow()) throw new Error('예시를 보는 중에는 가입할 수 없어요. 설정 › 예시 끝내기를 먼저 해 주세요.');
  const r = await client.signUp(email.trim(), password);
  if (!r.needsConfirm && r.user) {
    const st = await ownerStatus(r.user);
    if (st !== 'same') await adopt(r.user, { wipe: false });
    await signedIn(r.user);
  }
  return r;
}

export async function recoverPassword(email) {
  if (!client) throw new Error('서버 설정이 필요해요');
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
  await kvSet('sync:lost', false);
  if (wipe) {
    await wipeLocal({ keepKv: SECURE_KV_KEYS });
    await kvSet('sync:owner', null);
  }
  syncState.set({ user: null, status: 'idle', error: null, lost: false, first: false });
}

export async function syncNow({ full = false } = {}) {
  if (hold) return false;
  if (!client || !client.session) {
    syncState.set({ pending: pendingCount() });
    return false;
  }
  if (demoNow()) {
    syncState.set({ status: 'demo', pending: pendingCount() });
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
    const pushed = await push();
    const lastFull = (await kvGet('sync:lastFull')) || 0;
    const doFull = full || Date.now() - lastFull > FULL_EVERY;
    const pulled = await pull(doFull);
    if (doFull) await kvSet('sync:lastFull', Date.now());
    await syncAttachments(uid);
    const now = Date.now();
    await kvSet('sync:lastOk', now);
    const done = { status: 'ok', lastSync: now, error: null, pending: pendingCount() };
    if (syncState.get().first) {
      await kvSet('sync:first', false);
      Object.assign(done, { first: false, firstDone: { at: now, pulled, pushed } });
    }
    syncState.set(done);
    return true;
  } catch (e) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    syncState.set({ status: offline ? 'offline' : 'error', error: humanError(e), pending: pendingCount() });
    if (e && e.status === 400 && /refresh/i.test(String(e.message))) {
      // 서버가 로그인을 끊었다 (비밀번호를 바꿨거나 오래 안 씀) → 다시 로그인할 때까지 설정 단추에 점
      await client.signOut();
      await kvSet('sync:lost', true);
      syncState.set({ lost: true, first: false });
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

/** @returns 올린 레코드 수 */
async function push() {
  let n = 0;
  for (let guard = 0; guard < 100; guard++) {
    const items = pendingItems(PUSH_BATCH);
    if (!items.length) return n;
    const payload = items.map(({ t, id, rec }) => ({
      tbl: SPACE + t,
      id,
      data: rec,
      deleted: !!rec.deleted,
      client_updated_at: rec.updatedAt,
    }));
    await client.rpc('sync_push', { items: payload });
    ackPushed(items);
    n += items.length;
    if (items.length < PUSH_BATCH) return n;
  }
  return n;
}

/** @returns 표마다 받아 온(지우지 않은) 레코드 수 */
async function pull(full) {
  let cursor = full ? 0 : (await kvGet('sync:cursor')) || 0;
  let from = full ? 0 : Math.max(0, cursor - OVERLAP);
  const got = {};
  const filter = SPACE ? { prefix: SPACE } : { skip: OTHER_SPACE };
  for (let guard = 0; guard < 1000; guard++) {
    const rows = (await client.selectRecords(from, PAGE, filter)) || [];
    for (const r of rows) {
      const rev = Number(r.rev);
      if (rev > cursor) cursor = rev;
      if (rev > from) from = rev;
      // 서버가 거르지 못한 경우에도 다른 공간의 기록은 받지 않는다
      const tbl = String(r.tbl || '');
      if (SPACE ? !tbl.startsWith(SPACE) : tbl.startsWith(OTHER_SPACE)) continue;
      const t = tbl.slice(SPACE.length);
      const rec = { ...(r.data || {}), id: r.id, updatedAt: Number(r.client_updated_at) };
      if (r.deleted) rec.deleted = true;
      else delete rec.deleted;
      if (applyRemote(t, rec) && !r.deleted) got[t] = (got[t] || 0) + 1;
    }
    if (rows.length < PAGE) break;
  }
  await kvSet('sync:cursor', cursor);
  return got;
}

/** 사진 보관 위치: 계정 폴더 안, 미리 보기는 그 안의 preview/ */
const objPath = (uid, id) => `${uid}/${SPACE ? 'preview/' : ''}${id}`;

async function syncAttachments(uid) {
  if (!uid) return;
  for (const att of rawAll('attachments')) {
    const path = objPath(uid, att.id);
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
  return client.download(objPath(uid, att.id));
}

export function isSignedIn() {
  return !!(client && client.session);
}

/** 설정 단추에 점을 찍을 일인가: 로그인이 풀렸거나, 오래 못 맞추고 있을 때만 */
export function needsAttention(s = syncState.get()) {
  if (s.lost) return true;
  return !!(s.user && s.status === 'error' && (!s.lastSync || Date.now() - s.lastSync > STALE_AFTER));
}
