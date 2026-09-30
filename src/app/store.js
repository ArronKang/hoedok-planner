// 한 덩어리 자료(core.js) ↔ IndexedDB 레코드(src/data/db.js)
// - 저장: 자료가 바뀔 때마다(commit·설정 변경) 레코드마다 JSON을 비교해 바뀐 것만 쓴다.
//   → 화면 코드는 프로토타입 그대로 두고, 동기화는 레코드 단위(나중에 고친 쪽이 이김)로 된다.
// - 다른 탭·다른 기기에서 온 변경: 바뀐 레코드만 자료에 바꿔 끼운다.
// - 화면 설정(디자인·글자 등)은 이 기기의 localStorage에만 둔다.
import * as db from '../data/db.js';
import * as C from './core.js';

const DEVICE_KEY = 'hoedok.device.v1';
/** 자료 안의 목록 → 저장소 표 이름 */
const TABLE = { subjects: 'subjects', tasks: 'tasks', pastExams: 'exams', semesters: 'semesters' };
const KEYS = Object.keys(TABLE);

const saved = Object.fromEntries(KEYS.map((k) => [k, new Map()])); // id → 마지막으로 저장한 JSON
let savedMeta = '';
let savedDevice = '';
let lastV = -1;
let lastPrefs = null;
let scheduled = false;
let ready = false;
let storageOk = true;

const strip = (r) => {
  const { updatedAt, createdAt, deleted, ...o } = r;
  return o;
};
const toRec = (key, o, i) => (key === 'subjects' ? { ...o, order: i } : o);
const fromRec = (key, r) => {
  const o = strip(r);
  if (key === 'subjects') delete o.order;
  return o;
};

function metaRec() {
  const d = C.D(), p = C.PR();
  return { id: 'main', onboarded: !!d.onboarded, exam: d.exam || null, lastExam: d.lastExam || null, study: Object.fromEntries(C.STUDY_PREFS.map((k) => [k, p[k]])) };
}
const devicePrefs = () => Object.fromEntries(C.DEVICE_PREFS.map((k) => [k, C.PR()[k]]));
function loadDevice() {
  try {
    return JSON.parse(localStorage.getItem(DEVICE_KEY) || 'null') || {};
  } catch {
    return {};
  }
}
export const isStorageOk = () => storageOk;

function readAll() {
  const byCreated = (a, b) => (a.createdAt || 0) - (b.createdAt || 0);
  return {
    subjects: [...db.all('subjects')].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((r) => fromRec('subjects', r)),
    tasks: [...db.all('tasks')].sort(byCreated).map((r) => fromRec('tasks', r)),
    pastExams: [...db.all('exams')].sort(byCreated).map((r) => fromRec('pastExams', r)),
    semesters: [...db.all('semesters')].sort((a, b) => (a.id < b.id ? -1 : 1)).map((r) => fromRec('semesters', r)),
  };
}

function snapshot() {
  const d = C.D();
  for (const key of KEYS) {
    saved[key].clear();
    (d[key] || []).forEach((o, i) => saved[key].set(o.id, JSON.stringify(toRec(key, o, i))));
  }
  savedMeta = JSON.stringify(metaRec());
  savedDevice = JSON.stringify(devicePrefs());
}

/** 앱 시작: 저장소를 열고 자료를 채운다. 저장소를 못 쓰는 환경이면 이 화면에서만 쓰도록 계속한다. */
export async function initStore() {
  const dev = loadDevice();
  try {
    await db.initDB();
  } catch (e) {
    console.error('저장소를 열 수 없음', e);
    storageOk = false;
    C.hydrate({}, dev);
    return;
  }
  const meta = db.get('meta', 'main');
  C.hydrate({ ...readAll(), onboarded: !!(meta && meta.onboarded), exam: (meta && meta.exam) || null, lastExam: (meta && meta.lastExam) || null }, { ...dev, ...((meta && meta.study) || {}) });
  snapshot();
  lastV = C.store.get().v;
  lastPrefs = C.PR();
  ready = true;
  C.store.subscribe(onStore);
  db.subscribe(onDb);
  const bye = () => {
    persistNow();
    db.flushNow();
  };
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && bye());
  window.addEventListener('pagehide', bye);
}

function onStore(s) {
  if (s.v === lastV && s.prefs === lastPrefs) return; // 화면 상태만 바뀐 경우
  lastV = s.v;
  lastPrefs = s.prefs;
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(persistNow);
}

/** 바뀐 레코드만 저장 */
export function persistNow() {
  scheduled = false;
  if (!ready) return;
  const d = C.D();
  for (const key of KEYS) {
    const t = TABLE[key], sv = saved[key], seen = new Set();
    (d[key] || []).forEach((o, i) => {
      if (!o || !o.id) return;
      seen.add(o.id);
      const j = JSON.stringify(toRec(key, o, i));
      if (sv.get(o.id) === j) return;
      sv.set(o.id, j);
      db.put(t, JSON.parse(j));
    });
    for (const id of [...sv.keys()])
      if (!seen.has(id)) {
        sv.delete(id);
        db.remove(t, id);
      }
  }
  const m = JSON.stringify(metaRec());
  if (m !== savedMeta) {
    savedMeta = m;
    db.put('meta', JSON.parse(m));
  }
  const dv = JSON.stringify(devicePrefs());
  if (dv !== savedDevice) {
    savedDevice = dv;
    try {
      localStorage.setItem(DEVICE_KEY, dv);
    } catch {
      /* 저장 공간이 막힌 환경 */
    }
  }
}

/** 저장소가 바뀌었다는 알림: 내가 쓴 것이면 그대로, 다른 곳에서 온 것이면 자료에 반영 */
function onDb(changed) {
  if (!ready) return;
  const d = C.D();
  const remoteTasks = new Set();
  let dirty = false;
  for (const key of KEYS) {
    const t = TABLE[key];
    if (!changed.has(t)) continue;
    const sv = saved[key];
    const recs = db.all(t);
    const ids = new Set();
    let list = d[key] || [];
    const idx = new Map(list.map((o, i) => [o.id, i]));
    let reorder = false;
    for (const r of recs) {
      ids.add(r.id);
      const j = JSON.stringify(strip(r));
      if (sv.get(r.id) === j) continue;
      sv.set(r.id, j);
      dirty = true;
      const o = fromRec(key, r);
      if (idx.has(r.id)) list[idx.get(r.id)] = o;
      else list.push(o);
      if (key === 'tasks') remoteTasks.add(r.id);
      if (key === 'subjects') reorder = true;
    }
    for (const id of [...sv.keys()])
      if (!ids.has(id)) {
        sv.delete(id);
        list = list.filter((x) => x.id !== id);
        dirty = true;
      }
    if (reorder) {
      const ord = new Map(recs.map((r) => [r.id, r.order ?? 0]));
      list = [...list].sort((a, b) => (ord.get(a.id) ?? 1e9) - (ord.get(b.id) ?? 1e9));
    }
    d[key] = list;
  }
  if (changed.has('meta')) {
    const r = db.get('meta', 'main');
    if (r) {
      const j = JSON.stringify(strip(r));
      if (j !== savedMeta) {
        savedMeta = j;
        d.onboarded = !!r.onboarded;
        d.exam = r.exam || null;
        d.lastExam = r.lastExam || null;
        if (r.study) C.setPrefs(r.study);
        dirty = true;
      }
    }
  }
  if (!dirty) return;
  if (remoteTasks.size) C.reconcile(remoteTasks);
  C.commit();
}
