// 로컬 우선 저장소: 모든 레코드를 메모리(Map)에 올려 두고 IndexedDB에 기록한다.
// - 화면은 메모리에서 동기적으로 읽는다 (데이터가 작아서 충분히 빠르다).
// - 쓰기는 마이크로태스크 단위로 묶어 한 트랜잭션에 저장하고, 동기화 대기열(outbox)에 올린다.
// - 삭제는 톰스톤(deleted: true)으로 남겨 다른 기기에 전파한다.

import { openDB, reqP, txDone } from './idb.js';

// 과목(교재·단계 포함) / 할 일 / 지난 시험 / 학기(과목 성적 포함) / 설정 한 건(main) / 사진 정보 / 반복 규칙
export const TABLES = ['subjects', 'tasks', 'exams', 'semesters', 'meta', 'attachments', 'repeats'];

const DB_NAME = 'hoedok-planner';
// 2: 반복 규칙(repeats) 표 추가
const DB_VERSION = 2;

let idb = null;
const mem = {};
const versions = {};
const listCache = {};
const outbox = new Map(); // 't/id' -> updatedAt
const subs = new Set();
let pending = new Map(); // 't/id' -> { t, rec, ob }
let outboxDeletes = new Set();
let writeScheduled = false;
let notifyScheduled = false;
let changed = new Set();
let capture = null;
let bc = null;
let lastWriteError = null;

for (const t of TABLES) {
  mem[t] = new Map();
  versions[t] = 0;
}

export function isReady() {
  return !!idb;
}

export async function initDB() {
  let from = 0;
  idb = await openDB(DB_NAME, DB_VERSION, (db, oldVersion) => {
    from = oldVersion;
    for (const t of TABLES) if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: 'id' });
    if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'k' });
    if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
  });
  idb.onversionchange = () => {
    idb.close();
    location.reload();
  };
  // 옛 버전은 모르는 표의 기록을 받고도 버리고 지나갔다 → 다음 동기화는 처음부터 다시 받는다
  if (from > 0 && from < DB_VERSION) await kvSet('sync:lastFull', 0);
  await loadAll();
  if (typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel('study-planner-db');
    bc.onmessage = (e) => onBroadcast(e.data);
  }
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch {
    /* 무시 */
  }
}

async function loadAll() {
  const tx = idb.transaction([...TABLES, 'outbox'], 'readonly');
  const res = await Promise.all([...TABLES.map((t) => reqP(tx.objectStore(t).getAll())), reqP(tx.objectStore('outbox').getAll())]);
  TABLES.forEach((t, i) => {
    mem[t].clear();
    for (const r of res[i]) mem[t].set(r.id, r);
    versions[t]++;
  });
  outbox.clear();
  for (const o of res[TABLES.length]) outbox.set(o.k, o.updatedAt);
  for (const t of TABLES) changed.add(t);
  scheduleNotify();
}

// ---------- 읽기 ----------

export function get(t, id) {
  const r = mem[t].get(id);
  return r && !r.deleted ? r : undefined;
}

export function getRaw(t, id) {
  return mem[t].get(id);
}

export function all(t) {
  const c = listCache[t];
  if (c && c.v === versions[t]) return c.arr;
  const arr = [];
  for (const r of mem[t].values()) if (!r.deleted) arr.push(r);
  listCache[t] = { v: versions[t], arr };
  return arr;
}

export function rawAll(t) {
  return [...mem[t].values()];
}

export function version(...ts) {
  return ts.map((t) => versions[t]).join('.');
}

/**
 * 테이블 버전이 바뀔 때만 다시 계산하는 셀렉터. 인자가 있으면 인자별로 캐시한다.
 */
export function selector(tables, fn) {
  let key = null;
  let cache = new Map();
  return (...args) => {
    const v = version(...tables);
    if (v !== key) {
      key = v;
      cache = new Map();
    }
    const ak = args.length ? args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join('|') : '';
    if (cache.has(ak)) return cache.get(ak);
    const val = fn(...args);
    cache.set(ak, val);
    return val;
  };
}

// ---------- 쓰기 ----------

function scheduleWrite() {
  if (writeScheduled) return;
  writeScheduled = true;
  queueMicrotask(flushWrites);
}

async function flushWrites() {
  writeScheduled = false;
  if (!idb) return;
  const batch = pending;
  const dels = outboxDeletes;
  pending = new Map();
  outboxDeletes = new Set();
  if (!batch.size && !dels.size) return;
  try {
    const tx = idb.transaction([...TABLES, 'outbox'], 'readwrite');
    for (const { t, rec, ob, weak } of batch.values()) {
      const os = tx.objectStore(t);
      if (weak) {
        // 저절로 만든 레코드: 같은 기기의 다른 탭이 이미 써 둔 것(체크한 기록 등)이 있으면 그대로 둔다
        const g = os.get(rec.id);
        g.onsuccess = () => {
          if (!g.result) os.put(rec);
        };
      } else os.put(rec);
      if (ob) tx.objectStore('outbox').put({ k: `${t}/${rec.id}`, t, id: rec.id, updatedAt: rec.updatedAt });
    }
    for (const k of dels) if (!batch.has(k) || !batch.get(k).ob) tx.objectStore('outbox').delete(k);
    await txDone(tx);
    lastWriteError = null;
    if (bc) bc.postMessage({ keys: [...batch.keys()] });
  } catch (e) {
    lastWriteError = e;
    console.error('저장 실패', e);
    for (const [k, v] of batch) if (!pending.has(k)) pending.set(k, v);
    setTimeout(scheduleWrite, 1000);
  }
}

export function getWriteError() {
  return lastWriteError;
}

/** 대기 중인 쓰기를 즉시 저장 (앱이 백그라운드로 갈 때) */
export function flushNow() {
  if (pending.size || outboxDeletes.size) return flushWrites();
  return Promise.resolve();
}

function touch(t) {
  versions[t]++;
  changed.add(t);
  scheduleNotify();
}

function scheduleNotify() {
  if (notifyScheduled) return;
  notifyScheduled = true;
  queueMicrotask(() => {
    notifyScheduled = false;
    const c = changed;
    changed = new Set();
    for (const fn of [...subs]) {
      try {
        fn(c);
      } catch (e) {
        console.error(e);
      }
    }
  });
}

export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

/**
 * 레코드 저장(추가/교체). updatedAt은 항상 증가한다.
 * weak: 앱이 저절로 만든 새 레코드(반복 할 일). 가장 오래된 시각(1)으로 저장해서
 * 다른 기기에서 사람이 고친 같은 레코드를 절대 덮어쓰지 않게 한다.
 */
export function put(t, rec, { weak = false } = {}) {
  if (!mem[t]) throw new Error('unknown table ' + t);
  if (!rec || !rec.id) throw new Error('record without id');
  const key = `${t}/${rec.id}`;
  const prev = mem[t].get(rec.id);
  if (capture && !capture.has(key)) capture.set(key, { t, id: rec.id, before: prev });
  const now = Date.now();
  const updatedAt = weak && !prev ? 1 : Math.max(now, prev ? (prev.updatedAt || 0) + 1 : 0);
  const next = { ...rec, updatedAt };
  next.createdAt = rec.createdAt || (prev && prev.createdAt) || now;
  if (!next.deleted) delete next.deleted;
  mem[t].set(rec.id, next);
  outbox.set(key, updatedAt);
  pending.set(key, { t, rec: next, ob: true, weak: weak && !prev });
  scheduleWrite();
  touch(t);
  return next;
}

export function update(t, id, patch) {
  const cur = mem[t].get(id);
  if (!cur) return undefined;
  const p = typeof patch === 'function' ? patch(cur) : patch;
  return put(t, { ...cur, ...p });
}

export function remove(t, id) {
  const cur = mem[t].get(id);
  if (!cur || cur.deleted) return;
  put(t, { ...cur, deleted: true });
}

// ---------- 되돌리기 ----------

export function beginCapture() {
  capture = new Map();
}

export function endCapture() {
  const c = capture;
  capture = null;
  return c ? [...c.values()] : [];
}

export function restore(entries) {
  for (const { t, id, before } of entries) {
    if (before) put(t, { ...before, deleted: before.deleted || undefined });
    else {
      const cur = mem[t].get(id);
      if (cur && !cur.deleted) put(t, { ...cur, deleted: true });
    }
  }
}

// ---------- 동기화용 ----------

export function pendingCount() {
  return outbox.size;
}

export function pendingItems(limit = 500) {
  const out = [];
  for (const [k, updatedAt] of outbox) {
    const i = k.indexOf('/');
    const t = k.slice(0, i);
    const id = k.slice(i + 1);
    const rec = mem[t] && mem[t].get(id);
    if (!rec) {
      outbox.delete(k);
      outboxDeletes.add(k);
      continue;
    }
    out.push({ t, id, updatedAt, rec });
    if (out.length >= limit) break;
  }
  if (outboxDeletes.size) scheduleWrite();
  return out;
}

/** 서버 반영이 끝난 항목을 대기열에서 뺀다 (그 사이 다시 바뀐 것은 남긴다) */
export function ackPushed(items) {
  for (const { t, id, updatedAt } of items) {
    const k = `${t}/${id}`;
    if (outbox.get(k) === updatedAt) {
      outbox.delete(k);
      outboxDeletes.add(k);
    }
  }
  scheduleWrite();
}

/** 서버에서 받은 레코드 반영. 로컬이 더 새로우면 무시한다. */
export function applyRemote(t, rec) {
  if (!mem[t] || !rec || !rec.id) return false;
  const prev = mem[t].get(rec.id);
  if (prev && (prev.updatedAt || 0) > (rec.updatedAt || 0)) return false;
  if (prev && prev.updatedAt === rec.updatedAt && JSON.stringify(prev) === JSON.stringify(rec)) return false;
  const k = `${t}/${rec.id}`;
  mem[t].set(rec.id, rec);
  pending.set(k, { t, rec, ob: false });
  if (outbox.has(k) && outbox.get(k) <= (rec.updatedAt || 0)) {
    outbox.delete(k);
    outboxDeletes.add(k);
  }
  scheduleWrite();
  touch(t);
  return true;
}

async function onBroadcast(data) {
  if (!data || !Array.isArray(data.keys) || !idb) return;
  const tx = idb.transaction([...TABLES, 'outbox'], 'readonly');
  const jobs = data.keys.map(async (k) => {
    const i = k.indexOf('/');
    const t = k.slice(0, i);
    const id = k.slice(i + 1);
    if (!mem[t]) return;
    const [rec, ob] = await Promise.all([reqP(tx.objectStore(t).get(id)), reqP(tx.objectStore('outbox').get(k))]);
    if (rec) {
      mem[t].set(id, rec);
      touch(t);
    }
    if (ob) outbox.set(k, ob.updatedAt);
    else outbox.delete(k);
  });
  await Promise.all(jobs);
}

// ---------- 키-값 / 첨부 바이너리 (동기화 대상 아님) ----------

export async function kvGet(key) {
  const tx = idb.transaction('kv', 'readonly');
  return reqP(tx.objectStore('kv').get(key));
}

export async function kvSet(key, val) {
  const tx = idb.transaction('kv', 'readwrite');
  tx.objectStore('kv').put(val, key);
  await txDone(tx);
}

export async function kvDel(key) {
  const tx = idb.transaction('kv', 'readwrite');
  tx.objectStore('kv').delete(key);
  await txDone(tx);
}

export async function blobGet(id) {
  const tx = idb.transaction('blobs', 'readonly');
  return reqP(tx.objectStore('blobs').get(id));
}

export async function blobPut(id, blob) {
  const tx = idb.transaction('blobs', 'readwrite');
  tx.objectStore('blobs').put(blob, id);
  await txDone(tx);
}

export async function blobDel(id) {
  const tx = idb.transaction('blobs', 'readwrite');
  tx.objectStore('blobs').delete(id);
  await txDone(tx);
}

// ---------- 백업 / 초기화 ----------

export function exportData() {
  const tables = {};
  for (const t of TABLES) tables[t] = all(t);
  return { app: 'hoedok-planner-raw', format: 1, exportedAt: new Date().toISOString(), tables };
}

/** 이 기기의 모든 데이터 삭제 (서버는 그대로) */
export async function wipeLocal({ keepKv = [] } = {}) {
  const keep = {};
  for (const k of keepKv) keep[k] = await kvGet(k);
  const tx = idb.transaction([...TABLES, 'outbox', 'kv', 'blobs'], 'readwrite');
  for (const s of [...TABLES, 'outbox', 'kv', 'blobs']) tx.objectStore(s).clear();
  for (const k of keepKv) if (keep[k] !== undefined) tx.objectStore('kv').put(keep[k], k);
  await txDone(tx);
  pending = new Map();
  outboxDeletes = new Set();
  outbox.clear();
  for (const t of TABLES) {
    mem[t].clear();
    touch(t);
  }
}
