// 상태 · 계산 · 동작 (프로토타입 v3)
import { createStore } from '../../../src/lib/ui.js';
import { addDays, diffDays, weekday, logicalToday } from '../../../src/core/date.js';

export { addDays, diffDays, weekday };

const KEY = 'hoedok-proto-3';
export const uid = () => Math.random().toString(36).slice(2, 10);
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const P = (v) => `${Math.round((v || 0) * 100)}%`;
export const fmt = (v, d = 1) => {
  if (v == null || !isFinite(v)) return '–';
  const r = Math.round(v * 10 ** d) / 10 ** d;
  return Number.isInteger(r) ? String(r) : r.toFixed(d);
};
export const WD = ['일', '월', '화', '수', '목', '금', '토'];
export const md = (k) => `${+k.slice(5, 7)}/${+k.slice(8)}`;
export const mdw = (k) => `${+k.slice(5, 7)}월 ${+k.slice(8)}일 ${WD[weekday(k)]}요일`;
export const mdws = (k) => `${+k.slice(5, 7)}월 ${+k.slice(8)}일 (${WD[weekday(k)]})`;
export const minutes = (m) => {
  if (!m) return '0분';
  const h = Math.floor(m / 60), r = Math.round(m % 60);
  return h ? (r ? `${h}시간 ${r}분` : `${h}시간`) : `${r}분`;
};
/** 받침에 따라 은/는, 을/를, 이/가 */
export const josa = (w, a, b) => {
  const c = w.charCodeAt(w.length - 1);
  return w + (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? a : b);
};

// ─────────── 기본 선택지 ───────────

/** 과목 색은 색상(hue)만 고른다. 채도와 밝기는 디자인이 정한다 → 어떤 조합이든 어울림 */
export const HUES = [14, 36, 72, 150, 182, 204, 226, 262, 300, 340];

export const SUBJECT_PRESETS = [
  { name: '공통국어', h: 300, books: ['자습서', '평가문제집'] },
  { name: '공통수학', h: 226, books: ['개념원리', '쎈', '일품'] },
  { name: '공통영어', h: 262, books: ['교과서', '변형문제'] },
  { name: '한국사', h: 36, books: ['교과서', '문제집'] },
  { name: '통합사회', h: 14, books: ['자습서', '평가문제집', '심화문제집'] },
  { name: '통합과학', h: 150, books: ['교과서', '문제집', '기출문제집'] },
  { name: '과학탐구실험', h: 182, books: ['교과서'] },
  { name: '정보', h: 204, books: ['교과서', '문제집'] },
];
// 시험 범위 쪽수 기본값 (중간고사 범위 정도). 처음 설정에서 바로 고칠 수 있다.
export const BOOK_PAGES = { 자습서: [1, 60], 교과서: [1, 70], 평가문제집: [1, 40], 개념원리: [1, 50], 쎈: [1, 50], 일품: [1, 36], 기출문제집: [1, 30], 변형문제: [1, 30], 문제집: [1, 40], 심화문제집: [1, 36], '학교 프린트': [1, 20] };
export const BOOK_SUGGEST = ['자습서', '교과서', '평가문제집', '개념원리', '쎈', '문제집', '기출문제집', '심화문제집', '학교 프린트'];
export const bookKind = (name) => (/교과서|자습서|개념|프린트|요약|노트/.test(name) ? '개념' : '문제');

export const ROUTINES = [
  { id: 'mine', name: '개념 → 문제 → 개념 → 심화', desc: '개념책 한 번, 문제집 한 번, 다시 개념, 마지막에 어려운 문제집' },
  { id: 'each', name: '한 권씩 차례로', desc: '넣은 교재를 순서대로 한 번씩' },
  { id: 'twice', name: '모든 교재 두 바퀴', desc: '넣은 교재를 순서대로 두 번씩' },
];

export function buildStages(books, routine = 'mine') {
  const c = books.filter((b) => b.kind === '개념');
  const p = books.filter((b) => b.kind === '문제');
  let seq;
  if (routine === 'mine') {
    seq = c[0] && p[0] ? [c[0], p[0], c[0], p[1] || p[0]] : c[0] ? [c[0], c[1] || c[0]] : [p[0], p[1] || p[0]];
    seq = seq.filter(Boolean);
    const used = new Set(seq.map((b) => b.id));
    for (const b of books) if (!used.has(b.id)) seq.push(b);
  } else if (routine === 'each') seq = [...books];
  else seq = [...books, ...books];
  return seq.map((b, i) => ({ id: uid(), name: `${i + 1}회독 · ${b.name}`, bookId: b.id, from: b.from, to: b.to, upto: null }));
}

export const MOVE_REASONS = ['시간이 모자랐어요', '계획이 많았어요', '집중이 안 됐어요', '급한 일이 생겼어요', '필요 없어졌어요'];

// ─────────── 상태 ───────────

function blank() {
  return {
    v: 0,
    data: { onboarded: false, exam: null, subjects: [], tasks: [], pastExams: [], semesters: [] },
    prefs: {
      theme: 'paper', mode: 'light', size: 'md', density: 'normal', hand: 'right',
      group: 'subject', doneBottom: false,
      show: { dday: true, summary: true, overdue: true },
      legend: true, lowest: true, recent: true,
      avail: [300, 180, 180, 180, 180, 180, 300], rest: [], dayStart: 4, pace: 3,
      padAside: 'progress', listWidth: 'normal',
    },
    ui: { tab: 'today', day: null, stacks: { today: [], progress: [], grades: [] }, sheet: null, ob: 0, open: {}, toast: null, dev: 'pad' },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const b = blank();
    return { ...b, data: { ...b.data, ...s.data }, prefs: { ...b.prefs, ...s.prefs, show: { ...b.prefs.show, ...((s.prefs || {}).show || {}) } } };
  } catch {
    return null;
  }
}

export const store = createStore(load() || blank());
let saveTimer;
store.subscribe((s) => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ data: s.data, prefs: s.prefs }));
    } catch {
      /* 저장 공간 막힘 */
    }
  }, 120);
});

export const D = () => store.get().data;
export const PR = () => store.get().prefs;
export const UI = () => store.get().ui;
export const commit = () => store.set((s) => ({ ...s, v: s.v + 1 }));
export const setUI = (patch) => store.set((s) => ({ ...s, ui: { ...s.ui, ...patch } }));
export const setPrefs = (patch) => store.set((s) => ({ ...s, prefs: { ...s.prefs, ...patch } }));
export const today = () => logicalToday(PR().dayStart);
export const viewDay = () => UI().day || today();

let toastTimer;
export function toast(msg, undo) {
  clearTimeout(toastTimer);
  setUI({ toast: { msg, undo, id: uid() } });
  toastTimer = setTimeout(() => setUI({ toast: null }), undo ? 5500 : 2800);
}
/** 되돌리기: 바꾸기 전 자료를 통째로 기억해 둔다 */
export function withUndo(msg, fn) {
  const snap = JSON.stringify(D());
  const r = fn();
  commit();
  toast(typeof msg === 'function' ? msg() : msg, () => {
    store.set((s) => ({ ...s, data: JSON.parse(snap), v: s.v + 1 }));
    setUI({ toast: null });
  });
  return r;
}

// ─────────── 화면 이동 ───────────

export function go(tab) {
  setUI({ tab, sheet: null });
}
/** reset=true: 목록에서 고를 때(처음부터), false: 자세히 화면 안에서 한 단계 더 들어갈 때 */
export function push(tab, entry, reset = false) {
  const st = UI().stacks;
  const next = reset ? [entry] : [...st[tab], entry];
  setUI({ tab, stacks: { ...st, [tab]: next }, sheet: null });
}
export function pop(tab) {
  const st = UI().stacks;
  setUI({ stacks: { ...st, [tab]: st[tab].slice(0, -1) } });
}
export const top = (tab) => {
  const s = UI().stacks[tab];
  return s[s.length - 1] || null;
};
export const isPadDev = () => UI().dev === 'pad';
export const openSheet = (sheet) => setUI({ sheet });
export const closeSheet = () => setUI({ sheet: null });

// ─────────── 계산 ───────────

export const pages = (s) => Math.max(0, s.to - s.from + 1);
export const done = (s) => (s.upto == null ? 0 : clamp(s.upto - s.from + 1, 0, pages(s)));
export const status = (s) => (pages(s) && done(s) >= pages(s) ? 'done' : done(s) > 0 ? 'doing' : 'todo');
export const tot = (sub) => sub.stages.reduce((a, s) => a + pages(s), 0);
export const dn = (sub) => sub.stages.reduce((a, s) => a + done(s), 0);
export const pct = (sub) => (tot(sub) ? dn(sub) / tot(sub) : 0);
export const curStage = (sub) => sub.stages.find((s) => status(s) === 'doing') || sub.stages.find((s) => status(s) === 'todo') || null;
export const bookOf = (sub, s) => sub.books.find((b) => b.id === s.bookId) || null;
export const subById = (id) => D().subjects.find((s) => s.id === id) || null;
export const stageById = (sub, id) => (sub ? sub.stages.find((s) => s.id === id) : null);
export const daysLeft = () => (D().exam ? Math.max(0, diffDays(today(), D().exam.date)) : 0);
export const overall = () => {
  const t = D().subjects.reduce((a, s) => a + tot(s), 0);
  const d = D().subjects.reduce((a, s) => a + dn(s), 0);
  return { t, d, p: t ? d / t : 0 };
};

/** 진도 숫자 4개 (사실 수치만) */
export function facts(sub) {
  const ex = D().exam;
  const rem = tot(sub) - dn(sub);
  const dl = daysLeft();
  const elapsed = ex ? Math.max(1, diffDays(ex.start, today()) + 1) : 1;
  return { rem, dl, avg: dn(sub) / elapsed, per: dl ? rem / dl : null, elapsed };
}

export function logAdd(sub, day, n) {
  if (!n) return;
  sub.log = sub.log || {};
  sub.log[day] = Math.max(0, (sub.log[day] || 0) + n);
}

/** 구간별: 첫 개념책(없으면 첫 교재)의 쪽을 다섯 구간으로 나눠 몇 번 봤는지 */
export const PARTS = 5;
export const refBook = (sub) => sub.books.find((b) => b.kind === '개념') || sub.books[0] || null;
export function partLabels(sub) {
  const b = refBook(sub);
  if (!b) return [];
  const len = b.to - b.from + 1;
  return Array.from({ length: PARTS }, (_, i) => `${b.from + Math.floor((i * len) / PARTS)}–${b.from + Math.floor(((i + 1) * len) / PARTS) - 1}`);
}
const ov = (a1, b1, a2, b2) => Math.max(0, Math.min(b1, b2) - Math.max(a1, a2));
export function share(sub, s, i) {
  const b = bookOf(sub, s);
  if (!b) return null;
  const bl = b.to - b.from + 1;
  const a = (s.from - b.from) / bl, e = (s.to - b.from + 1) / bl;
  const lo = i / PARTS, hi = (i + 1) / PARTS;
  if (ov(lo, hi, a, e) <= 1e-9) return null;
  return ov(lo, hi, a, a + (pages(s) ? done(s) / pages(s) : 0) * (e - a)) / (hi - lo);
}
export const counts = (sub) => Array.from({ length: PARTS }, (_, i) => sub.stages.reduce((a, s) => a + (share(sub, s, i) || 0), 0));
export function lowest(sub) {
  const c = counts(sub);
  if (!sub.stages.length) return [];
  const mn = Math.min(...c), mx = Math.max(...c);
  if (mx - mn < 0.3) return [];
  return c.map((v, i) => (v - mn < 0.3 ? i : -1)).filter((i) => i >= 0);
}

// ─────────── 할 일 ───────────

export const taskStage = (t) => (t.kind === 'track' ? stageById(subById(t.subjectId), t.stageId) : null);
export const taskPages = (t) => (t.kind === 'track' ? t.to - t.from + 1 : 0);
export const taskMinutes = (t) => (t.kind === 'track' ? taskPages(t) * (subById(t.subjectId)?.pace || PR().pace) : t.est || 0);
export const tasksOn = (day) => D().tasks.filter((t) => t.date === day);
export const overdue = () => D().tasks.filter((t) => t.status === 'todo' && t.date < today());

export function studyDays(from, to) {
  const p = PR();
  const out = [];
  for (let d = from; d < to; d = addDays(d, 1)) {
    const w = weekday(d);
    if (p.rest.includes(w) || !p.avail[w]) continue;
    out.push({ d, w: p.avail[w] });
  }
  return out;
}

/** 남은 쪽을 시험 전날까지 나눠 할 일로 만든다. 공부 가능 시간이 긴 날에 더 많이. */
export function planSubject(sub, from = today(), data = D()) {
  const ex = data.exam;
  if (!ex) return 0;
  data.tasks = data.tasks.filter((t) => !(t.kind === 'track' && t.subjectId === sub.id && t.status === 'todo' && t.date >= from && !t.manual && !t.hist));
  const units = [];
  for (const s of sub.stages) for (let p = s.upto == null ? s.from : s.upto + 1; p <= s.to; p++) units.push([s.id, p]);
  const days = studyDays(from, ex.date);
  if (!units.length || !days.length) return 0;
  const W = days.reduce((a, x) => a + x.w, 0);
  let acc = 0, idx = 0, made = 0;
  for (let di = 0; di < days.length; di++) {
    const day = days[di];
    acc += day.w;
    let end = Math.round((units.length * acc) / W);
    // 단계가 바뀌는 곳에서 새 단계 몇 쪽만 붙는 자투리는 다음 날로 넘긴다
    if (di < days.length - 1 && end > idx) {
      let b = -1;
      for (let i = idx + 1; i < end; i++) if (units[i][0] !== units[i - 1][0]) b = i;
      if (b > idx && end - b < 3) end = b;
    }
    const chunk = units.slice(idx, end);
    idx = end;
    let cur = null;
    for (const [sid, pg] of chunk) {
      if (!cur || cur.stageId !== sid) {
        cur = { id: uid(), kind: 'track', date: day.d, subjectId: sub.id, stageId: sid, from: pg, to: pg, status: 'todo', moves: [] };
        data.tasks.push(cur);
        made++;
      } else cur.to = pg;
    }
  }
  return made;
}
export function planAll(from = today(), data = D()) {
  let n = 0;
  for (const sub of data.subjects) n += planSubject(sub, from, data);
  return n;
}
/** 미리 보기용: 복사본에서 나눠 보고 결과만 돌려준다 (실제 자료는 그대로) */
export function previewPlan(from = today(), onlySub = null) {
  const clone = JSON.parse(JSON.stringify(D()));
  for (const sub of clone.subjects) if (!onlySub || sub.id === onlySub) planSubject(sub, from, clone);
  const tasks = clone.tasks.filter((t) => t.kind === 'track' && t.status === 'todo' && t.date >= from && !t.manual && !t.hist && (!onlySub || t.subjectId === onlySub));
  const days = studyDays(from, clone.exam ? clone.exam.date : from);
  return { tasks, days, subjects: clone.subjects };
}

/** 체크: 진도에 연결된 할 일이면 그 단계의 '어디까지'가 저절로 올라간다 */
export function toggleTask(id) {
  const t = D().tasks.find((x) => x.id === id);
  if (!t) return;
  const sub = subById(t.subjectId);
  const st = taskStage(t);
  if (t.status === 'done') {
    if (st && !t.hist) {
      const b = done(st);
      st.upto = t.prevUpto ?? null;
      logAdd(sub, t.doneDay || today(), done(st) - b);
    }
    t.status = 'todo';
    commit();
    return;
  }
  if (t.status === 'dropped') {
    t.status = 'todo';
    t.dropReason = null;
    commit();
    return;
  }
  let msg = null;
  if (st && !t.hist) {
    const before = pct(sub), b = done(st);
    t.prevUpto = st.upto;
    st.upto = Math.max(st.upto ?? st.from - 1, t.to);
    logAdd(sub, today(), done(st) - b);
    msg = `${sub.name} 진도 ${P(before)} → ${P(pct(sub))}`;
  }
  t.status = 'done';
  t.doneDay = today();
  commit();
  if (msg) toast(msg);
}

/** 일부만 했을 때: 한 곳까지 반영하고, 남은 쪽은 내일로 넘기거나 버린다 */
export function partialTask(id, upto, rest) {
  const data = D();
  const t = data.tasks.find((x) => x.id === id);
  const sub = subById(t.subjectId);
  const st = taskStage(t);
  if (!st) return;
  const origTo = t.to;
  if (upto >= t.from) {
    const b = done(st);
    t.prevUpto = st.upto;
    st.upto = Math.max(st.upto ?? st.from - 1, upto);
    logAdd(sub, today(), done(st) - b);
    t.to = upto;
    t.status = 'done';
    t.doneDay = today();
  }
  const restFrom = Math.max(upto + 1, t.from);
  if (restFrom <= origTo && rest === 'tomorrow') {
    const d = addDays(t.date > today() ? t.date : today(), 1);
    if (upto < t.from) {
      moveTask(id, d);
    } else data.tasks.push({ id: uid(), kind: 'track', date: d, subjectId: t.subjectId, stageId: t.stageId, from: restFrom, to: origTo, status: 'todo', moves: [{ from: t.date, to: d, reason: null }] });
  }
}

export function moveTask(id, to, reason = null) {
  const t = D().tasks.find((x) => x.id === id);
  if (!t || to === t.date) return;
  if (t.date <= today() && to > t.date) t.moves = [...(t.moves || []), { from: t.date, to, reason }];
  t.date = to;
  if (t.status === 'dropped') t.status = 'todo';
}
export function dropTask(id, reason = null) {
  const t = D().tasks.find((x) => x.id === id);
  if (t) {
    t.status = 'dropped';
    t.dropReason = reason;
  }
}
export function setReason(id, reason) {
  const t = D().tasks.find((x) => x.id === id);
  if (!t) return;
  if (t.status === 'dropped') t.dropReason = reason;
  else if ((t.moves || []).length) t.moves[t.moves.length - 1].reason = reason;
}
export function deleteTask(id) {
  const data = D();
  data.tasks = data.tasks.filter((t) => t.id !== id);
}

/** 단계에 몇 쪽까지 했는지 직접 적기. 이미 잡힌 할 일도 맞춰 준다. */
export function recordStage(sub, st, upto) {
  const b = done(st);
  st.upto = upto < st.from ? null : Math.min(upto, st.to);
  logAdd(sub, today(), done(st) - b);
  const u = st.upto ?? st.from - 1;
  for (const t of D().tasks) {
    if (t.kind !== 'track' || t.stageId !== st.id || t.status !== 'todo' || t.hist) continue;
    if (t.to <= u) {
      t.status = 'done';
      t.doneDay = today();
      t.prevUpto = t.from - 1;
    } else if (t.from <= u) t.from = u + 1;
  }
}

/** '쎈 p.20-35' 처럼 적으면 그 교재의 단계에 연결한다 */
export function parseLink(text, sub) {
  if (!sub || !text) return null;
  const m = text.match(/(?:p\.?\s*)?(\d+)\s*(?:[-~–]|부터)\s*(\d+)\s*(?:쪽|p)?/i);
  const book = sub.books.find((b) => text.includes(b.name));
  if (!m || !book) return null;
  const from = +m[1], to = +m[2];
  if (!(to >= from)) return null;
  const st = sub.stages.find((s) => s.bookId === book.id && status(s) !== 'done' && from >= s.from && from <= s.to) || sub.stages.find((s) => s.bookId === book.id && status(s) !== 'done');
  if (!st) return null;
  return { stage: st, from: clamp(from, st.from, st.to), to: clamp(to, st.from, st.to) };
}

export function addTask({ title, subjectId, date, link, est }) {
  const t = link
    ? { id: uid(), kind: 'track', manual: true, date, subjectId, stageId: link.stage.id, from: link.from, to: link.to, status: 'todo', moves: [], note: title }
    : { id: uid(), kind: 'free', date, subjectId, title, status: 'todo', moves: [], est: est || null };
  D().tasks.push(t);
  return t;
}

/** 한 주 돌아보기 (사실만) */
export function weekStats(end = today()) {
  const from = addDays(end, -6);
  const inR = (d) => d >= from && d <= end;
  const out = { planned: 0, done: 0, moved: 0, dropped: 0, missed: 0, bySub: {}, reasons: {}, est: 0, pages: 0 };
  const bump = (sid, k) => {
    const o = (out.bySub[sid] = out.bySub[sid] || { planned: 0, done: 0 });
    o[k]++;
  };
  for (const t of D().tasks) {
    for (const m of t.moves || []) {
      if (!inR(m.from)) continue;
      out.planned++;
      out.moved++;
      bump(t.subjectId, 'planned');
      const r = m.reason || '이유 안 적음';
      out.reasons[r] = (out.reasons[r] || 0) + 1;
    }
    if (!inR(t.date)) continue;
    if (t.status === 'done') {
      out.planned++;
      out.done++;
      bump(t.subjectId, 'planned');
      bump(t.subjectId, 'done');
    } else if (t.status === 'dropped') {
      out.planned++;
      out.dropped++;
      bump(t.subjectId, 'planned');
      const r = t.dropReason || '이유 안 적음';
      out.reasons[r] = (out.reasons[r] || 0) + 1;
    } else if (t.date < today()) {
      out.planned++;
      out.missed++;
      bump(t.subjectId, 'planned');
    }
  }
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  out.days = days.map((d) => ({ d, pages: D().subjects.reduce((a, s) => a + ((s.log || {})[d] || 0), 0) }));
  out.pages = out.days.reduce((a, x) => a + x.pages, 0);
  return out;
}

// ─────────── 처음 설정 ───────────

export function newSubject(name, h) {
  const pre = SUBJECT_PRESETS.find((p) => p.name === name);
  const used = new Set(D().subjects.map((s) => s.h));
  const hue = h ?? (pre && !used.has(pre.h) ? pre.h : HUES.find((x) => !used.has(x)) ?? HUES[D().subjects.length % HUES.length]);
  return { id: uid(), name, h: hue, books: [], stages: [], routine: 'mine', log: {} };
}
export function newBook(name) {
  const r = BOOK_PAGES[name] || [1, 50];
  return { id: uid(), name, kind: bookKind(name), from: r[0], to: r[1] };
}

export function resetAll() {
  const keep = PR();
  const b = blank();
  store.set({ ...b, prefs: keep, ui: { ...b.ui, dev: UI().dev } });
}

// ─────────── 예시 자료 ───────────

export function loadDemo() {
  const T = today();
  const keep = PR();
  const b = blank();
  const data = b.data;
  data.onboarded = true;
  data.exam = { id: 'ex-now', name: '2학기 중간고사', kind: 'mid', date: addDays(T, 11), start: addDays(T, -9) };
  const mk = (name, books, ups) => {
    const sub = newSubjectFor(data, name);
    sub.books = books.map(([n, f, t, k]) => ({ id: uid(), name: n, kind: k || bookKind(n), from: f, to: t }));
    sub.stages = buildStages(sub.books, 'mine');
    sub.stages.forEach((s, i) => {
      const u = ups[i];
      s.upto = u == null ? null : u === 'all' ? s.to : s.from + u - 1;
    });
    let seed = sub.h + 7;
    for (let d = 13; d >= 1; d--) {
      seed = (seed * 37 + 11) % 97;
      sub.log[addDays(T, -d)] = seed % 6 === 0 ? 0 : 3 + (seed % 11);
    }
    data.subjects.push(sub);
    return sub;
  };
  mk('통합사회', [['자습서', 8, 96], ['평가문제집', 1, 40], ['심화문제집', 1, 36]], ['all', 30]);
  mk('공통수학', [['개념원리', 1, 38], ['쎈', 1, 52], ['일품', 1, 34]], ['all', 'all', 10]);
  mk('공통영어', [['교과서', 1, 48], ['변형문제', 1, 30]], ['all', 20]);
  mk('공통국어', [['자습서', 1, 40], ['평가문제집', 1, 30]], [29]);
  mk('통합과학', [['교과서', 1, 42], ['문제집', 1, 40], ['기출문제집', 1, 30]], ['all', 9]);
  mk('한국사', [['교과서', 1, 36], ['문제집', 1, 30]], ['all', 'all', 11]);

  // 지난 한 주 기록 (돌아보기용)
  let k = 0;
  for (let i = 7; i >= 1; i--) {
    const d = addDays(T, -i);
    for (const sub of data.subjects.slice(0, 4)) {
      k++;
      const st = sub.stages[0];
      const base = { id: uid(), kind: 'track', hist: true, subjectId: sub.id, stageId: st.id, from: st.from, to: st.from + 5, moves: [] };
      if (k % 6 === 0) data.tasks.push({ ...base, date: addDays(d, 1), status: 'done', doneDay: addDays(d, 1), moves: [{ from: d, to: addDays(d, 1), reason: MOVE_REASONS[k % 3] }] });
      else if (k % 11 === 0) data.tasks.push({ ...base, date: d, status: 'dropped', dropReason: MOVE_REASONS[4] });
      else data.tasks.push({ ...base, date: d, status: 'done', doneDay: d });
    }
  }
  store.set({ ...b, data, prefs: keep, ui: { ...b.ui, dev: UI().dev } });
  planAll(T);
  const soc = data.subjects[0], eng = data.subjects[2];
  data.tasks.push({ id: uid(), kind: 'free', date: addDays(T, -1), subjectId: soc.id, title: '평가문제집 틀린 문제 다시 풀기', status: 'todo', moves: [], est: 30 });
  data.tasks.push({ id: uid(), kind: 'free', date: T, subjectId: soc.id, title: '수행평가 보고서 개요 쓰기', status: 'todo', moves: [], est: 40, due: addDays(T, 3) });
  data.tasks.push({ id: uid(), kind: 'free', date: T, subjectId: eng.id, title: '영단어 Day 12 외우기', status: 'done', doneDay: T, moves: [], est: 20 });

  // 지난 시험과 성적
  const S = (n) => data.subjects.find((s) => s.name === n);
  const sem = { id: '2026-1', label: '1학년 1학기', records: [] };
  const rec = (name, credits, cat, els, fin) => sem.records.push({ id: uid(), subject: name, h: S(name) ? S(name).h : 182, credits, category: cat, elements: els.map(([kind, nm, w, max, score, avg]) => ({ id: uid(), kind, name: nm, weight: w, max, score, avg })), final: fin });
  rec('통합사회', 4, 'grade', [['exam', '1차 지필', 30, 100, 92.4, 68.5], ['exam', '2차 지필', 30, 100, 89.7, 69.1], ['perf', '보고서 쓰기', 20, 20, 17], ['perf', '발표', 10, 10, 9], ['perf', '포트폴리오', 10, 10, 10]], { rankGrade: 1, rank: 14, enrolled: 245, avg: 70.2 });
  rec('공통국어', 4, 'grade', [['exam', '1차 지필', 35, 100, 88.5, 67.9], ['exam', '2차 지필', 35, 100, 90.2, 68.4], ['perf', '수행 합계', 30, 30, 27]], { rankGrade: 2, rank: 31, enrolled: 245, avg: 70.1 });
  rec('공통수학', 4, 'grade', [['exam', '1차 지필', 35, 100, 84, 58.3], ['exam', '2차 지필', 35, 100, 89, 61.2], ['perf', '수행 합계', 30, 30, 26]], { rankGrade: 2, rank: 27, enrolled: 245, avg: 64.8 });
  rec('공통영어', 4, 'grade', [['exam', '1차 지필', 30, 100, 95, 71.6], ['exam', '2차 지필', 30, 100, 93, 72.5], ['perf', '수행 합계', 40, 40, 37]], { rankGrade: 1, rank: 15, enrolled: 245, avg: 74.3 });
  rec('한국사', 3, 'grade', [['exam', '1차 지필', 35, 100, 90, 70.4], ['exam', '2차 지필', 35, 100, 86, 69.9], ['perf', '수행 합계', 30, 30, 28]], { rankGrade: 2, rank: 40, enrolled: 245, avg: 72.2 });
  rec('통합과학', 4, 'grade', [['exam', '1차 지필', 35, 100, 78, 64.1], ['exam', '2차 지필', 35, 100, 85, 66.1], ['perf', '수행 합계', 30, 30, 25]], { rankGrade: 3, rank: 58, enrolled: 245, avg: 68.0 });
  rec('과학탐구실험', 1, 'achievement', [['perf', '실험 보고서', 100, 100, 92]], { achievement: 'A' });
  data.semesters = [sem];

  const study = (a) => Object.fromEntries(a.map(([n, p, e, pl, mv]) => [n, { progress: p, planDone: e, planned: pl, moved: mv }]));
  data.pastExams = [
    {
      id: 'ex-final1', name: '1학기 기말고사', kind: 'final', date: '2026-07-03', semester: '2026-1', elem: '2차 지필',
      study: study([['통합사회', 0.96, 0.84, 38, 4], ['공통국어', 0.71, 0.64, 33, 9], ['공통수학', 0.88, 0.76, 41, 6], ['공통영어', 0.92, 0.86, 29, 2], ['한국사', 0.8, 0.7, 24, 5], ['통합과학', 0.63, 0.58, 36, 11]]),
      ranks: { 통합사회: [6, 245], 공통국어: [31, 245], 공통수학: [27, 245], 공통영어: [15, 245], 한국사: [40, 245], 통합과학: [58, 245] },
    },
    { id: 'ex-m9', name: '9월 모의고사', kind: 'mock', date: '2026-09-03', mock: { 공통국어: [86, 91, 2], 공통수학: [84, 93, 2], 공통영어: [91, null, 1], 한국사: [43, null, 1], 통합사회: [46, 95, 1], 통합과학: [41, 84, 3] }, study: study([['공통국어', 0.55, 0.6, 12, 3], ['공통수학', 0.62, 0.7, 14, 2], ['통합과학', 0.4, 0.5, 10, 4]]) },
    { id: 'ex-m6', name: '6월 모의고사', kind: 'mock', date: '2026-06-04', mock: { 공통국어: [82, 86, 3], 공통수학: [80, 90, 2], 공통영어: [88, null, 2], 한국사: [44, null, 1], 통합사회: [44, 92, 2], 통합과학: [38, 79, 3] } },
    { id: 'ex-m3', name: '3월 모의고사', kind: 'mock', date: '2026-03-26', mock: { 공통국어: [78, 82, 3], 공통수학: [72, 85, 3], 공통영어: [84, null, 2], 한국사: [40, null, 2], 통합사회: [42, 88, 2], 통합과학: [35, 74, 4] } },
  ];
  store.set((s) => ({ ...s, ui: { ...s.ui, tab: 'today', day: null } }));
  commit();
}

function newSubjectFor(data, name) {
  const pre = SUBJECT_PRESETS.find((p) => p.name === name);
  return { id: uid(), name, h: pre ? pre.h : HUES[data.subjects.length % HUES.length], books: [], stages: [], routine: 'mine', log: {} };
}
