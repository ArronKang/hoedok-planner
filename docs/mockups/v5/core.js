// 상태 · 계산 · 동작 (프로토타입 v5 — v4 + 날짜별 공부 시간 · 예상/실제 시간 · 내신 흐름 · 백업 · 사진)
import { createStore } from '../../../src/lib/ui.js';
import { addDays, diffDays, weekday, logicalToday } from '../../../src/core/date.js';
import { computeRecord } from '../../../src/core/calc/naesin.js';

export { addDays, diffDays, weekday };

const KEY = 'hoedok-proto-5';
const OLD_KEYS = ['hoedok-proto-4', 'hoedok-proto-3'];
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

/** psg=true: 지문별로 세는 과목. 단계마다 채운 지문 번호를 따로 기억한다 */
export function buildStages(books, routine = 'mine', psg = false) {
  return buildStages0(books, routine).map((s) => (psg ? { ...s, marks: [] } : s));
}
function buildStages0(books, routine) {
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

/** 틀린 이유 (5가지 고정) */
export const WRONG = ['개념', '실수', '시간 부족', '안 한 범위', '처음 보는 유형'];

export const EXAM_NAMES = ['1학기 중간고사', '1학기 기말고사', '2학기 중간고사', '2학기 기말고사', '모의고사'];
export const kindOfName = (n) => (n.includes('모의') ? 'mock' : n.includes('기말') ? 'final' : 'mid');

// ─────────── 상태 ───────────

function blank() {
  return {
    v: 0,
    data: { onboarded: false, exam: null, lastExam: null, subjects: [], tasks: [], pastExams: [], semesters: [] },
    prefs: {
      theme: 'paper', mode: 'light', size: 'md', density: 'normal', hand: 'right',
      group: 'subject', doneBottom: false,
      show: { dday: true, summary: true, overdue: true },
      legend: true, lowest: true, recent: true,
      avail: [300, 180, 180, 180, 180, 180, 300], rest: [], dayStart: 4, pace: 3, dayMin: {},
      padAside: 'progress', listWidth: 'normal',
    },
    ui: { tab: 'today', day: null, stacks: { today: [], progress: [], grades: [] }, sheet: null, ob: 0, open: {}, toast: null, dev: 'pad' },
  };
}

function load() {
  try {
    // 이 버전 기록이 없으면 바로 전 버전에서 쓰던 기록을 이어받는다
    const raw = [KEY, ...OLD_KEYS].map((k) => localStorage.getItem(k)).find(Boolean);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const b = blank();
    const prefs = { ...b.prefs, ...s.prefs, show: { ...b.prefs.show, ...((s.prefs || {}).show || {}) } };
    if (prefs.group === 'flat') prefs.group = 'due';
    return { ...b, data: { ...b.data, ...s.data }, prefs };
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

// 쪽으로 세는 과목(기본)과 지문으로 세는 과목. 계산은 같고 '한 칸'의 이름만 다르다.
export const isPsg = (sub) => !!sub && sub.unit === 'passage';
export const unitOf = (sub) => (isPsg(sub) ? '지문' : '쪽');
/** 번호 목록을 짧게: [3,4,5,8] → '3–5, 8' */
export function compress(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    let j = i;
    while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
    out.push(i === j ? `${list[i]}` : `${list[i]}–${list[j]}`);
    i = j;
  }
  return out.join(', ');
}
/** 할 일에 붙는 범위 표기: p.3–10 / p.12 / 지문 3–5 / 지문 4, 7 */
export const rng = (sub, a, b, units) =>
  isPsg(sub) ? `지문 ${units ? compress(units) : a === b ? a : `${a}–${b}`}` : a === b ? `p.${a}` : `p.${a}–${b}`;
/** 할 일이 다루는 번호들 (지문별은 건너뛴 번호가 있을 수 있다) */
export const unitsOf = (t) => t.units || Array.from({ length: t.to - t.from + 1 }, (_, i) => t.from + i);
export const trng = (t) => rng(subById(t.subjectId), t.from, t.to, t.units);
/** 단계에 붙는 범위 표기: 3–10쪽 / 지문 1–8 */
export const span = (sub, a, b) => (isPsg(sub) ? `지문 ${a}–${b}` : `${a}–${b}쪽`);
export const amount = (sub, n) => (isPsg(sub) ? `${n}지문` : `${n}쪽`);

export const pages = (s) => Math.max(0, s.to - s.from + 1);
export const done = (s) =>
  s.marks ? s.marks.filter((u) => u >= s.from && u <= s.to).length : s.upto == null ? 0 : clamp(s.upto - s.from + 1, 0, pages(s));
export const isMarked = (s, u) => (s.marks ? s.marks.includes(u) : s.upto != null && u >= s.from && u <= s.upto);
export function markRange(s, a, b, on = true) {
  const set = new Set(s.marks || []);
  for (let u = a; u <= b; u++) on ? set.add(u) : set.delete(u);
  s.marks = [...set].sort((x, y) => x - y);
}
export const status = (s) => (pages(s) && done(s) >= pages(s) ? 'done' : done(s) > 0 ? 'doing' : 'todo');
export const tot = (sub) => sub.stages.reduce((a, s) => a + pages(s), 0);
export const dn = (sub) => sub.stages.reduce((a, s) => a + done(s), 0);
export const pct = (sub) => (tot(sub) ? dn(sub) / tot(sub) : 0);
export const curStage = (sub) => sub.stages.find((s) => status(s) === 'doing') || sub.stages.find((s) => status(s) === 'todo') || null;
export const bookOf = (sub, s) => sub.books.find((b) => b.id === s.bookId) || null;
export const subById = (id) => D().subjects.find((s) => s.id === id) || null;
export const stageById = (sub, id) => (sub ? sub.stages.find((s) => s.id === id) : null);
// ─ 시험 / 끝낼 날 ─
// exam.kind: 'mid' | 'final' | 'mock' | 'goal'(시험 없이 끝낼 날만 정한 기간)
export const isGoal = (ex = D().exam) => !!ex && ex.kind === 'goal';
/** '시험' 또는 '끝낼 날' — 화면 문구에 쓴다 */
export const endWord = () => (isGoal() ? '끝낼 날' : '시험');
/** 나눠 넣을 마지막 날 다음 날: 시험은 전날까지, 끝낼 날은 그날까지 */
export const planEnd = (ex) => (ex.kind === 'goal' ? addDays(ex.date, 1) : ex.date);
export const lastPlanDay = (ex) => addDays(planEnd(ex), -1);
export const examDay = () => !!D().exam && today() >= D().exam.date;
export const daysLeft = () => {
  const ex = D().exam;
  return ex ? Math.max(0, diffDays(today(), planEnd(ex))) : 0;
};
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
  if (isPsg(sub)) return lowestPsg(sub).list;
  const c = counts(sub);
  if (!sub.stages.length) return [];
  const mn = Math.min(...c), mx = Math.max(...c);
  if (mx - mn < 0.3) return [];
  return c.map((v, i) => (v - mn < 0.3 ? i : -1)).filter((i) => i >= 0);
}

/** 지문별: 교재 하나의 지문마다 몇 번 봤나 (그 교재를 쓰는 단계 중 채운 수) */
export function psgCounts(sub, book) {
  const st = sub.stages.filter((s) => s.bookId === book.id);
  const out = [];
  for (let u = book.from; u <= book.to; u++) out.push({ u, n: st.filter((s) => isMarked(s, u)).length });
  return out;
}
/** 가장 적게 본 지문 (첫 교재 기준, 차이가 한 번 이상일 때만) */
export function lowestPsg(sub) {
  const b = sub.books[0];
  if (!b || !sub.stages.length) return { book: null, list: [] };
  const c = psgCounts(sub, b);
  const mn = Math.min(...c.map((x) => x.n)), mx = Math.max(...c.map((x) => x.n));
  if (mx - mn < 1) return { book: b, list: [] };
  return { book: b, list: c.filter((x) => x.n === mn).map((x) => x.u) };
}
/** '가장 적게 본 곳' 한 줄 문구 */
export function lowestText(sub) {
  if (isPsg(sub)) {
    const { book, list } = lowestPsg(sub);
    return list.length ? `${book.name} 지문 ${list.slice(0, 6).join(', ')}${list.length > 6 ? ' …' : ''}` : '';
  }
  const low = lowest(sub);
  return low.length ? `${refBook(sub).name} ${low.map((i) => partLabels(sub)[i]).join(', ')}쪽` : '';
}

// ─────────── 할 일 ───────────

export const taskStage = (t) => (t.kind === 'track' ? stageById(subById(t.subjectId), t.stageId) : null);
export const taskPages = (t) => (t.kind === 'track' ? (t.units ? t.units.length : t.to - t.from + 1) : 0);
/** 여러 과목의 양 합치기: 쪽과 지문은 따로 센다 → { p: 쪽, q: 지문, text: '120쪽 · 14지문' } */
export function mix(items) {
  let p = 0, q = 0;
  for (const [sub, n] of items) isPsg(sub) ? (q += n) : (p += n);
  return { p, q, text: [p || !q ? `${p}쪽` : null, q ? `${q}지문` : null].filter(Boolean).join(' · ') };
}
export const paceOf = (sub) => (sub && sub.pace) || (isPsg(sub) ? 10 : PR().pace);
/** 예상 시간(분): 직접 고른 값이 있으면 그것, 없으면 진도 할 일은 분량 × 걸리는 시간 */
export const taskMinutes = (t) => t.est || (t.kind === 'track' ? taskPages(t) * paceOf(subById(t.subjectId)) : 0);
export const tasksOn = (day) => D().tasks.filter((t) => t.date === day);
export const overdue = () => D().tasks.filter((t) => t.status === 'todo' && !t.closed && t.date < today());
/** 할 일이 어느 시험(또는 끝낼 날) 준비였나 */
export const belongs = (t, ex) => (t.examId ? t.examId === ex.id : t.date >= ex.start && t.date < planEnd(ex));

/** 그날 공부 가능 시간(분): 그날만 바꾼 값이 있으면 그것, 없으면 요일 기본값 (쉬는 요일은 0) */
export function capacity(d) {
  const p = PR();
  const o = (p.dayMin || {})[d];
  if (typeof o === 'number') return o;
  const w = weekday(d);
  return p.rest.includes(w) ? 0 : p.avail[w] || 0;
}
export const weekdayCap = (d) => {
  const p = PR();
  const w = weekday(d);
  return p.rest.includes(w) ? 0 : p.avail[w] || 0;
};
export const isDayChanged = (d) => typeof (PR().dayMin || {})[d] === 'number';
/** 그날만 공부 가능 시간 바꾸기. null이면 요일 기본값으로 돌아간다 */
export function setDayCap(d, min) {
  const dm = { ...(PR().dayMin || {}) };
  if (min == null || min === weekdayCap(d)) delete dm[d];
  else dm[d] = min;
  // 지난 날짜 기록은 필요 없으니 정리
  const td = today();
  for (const k of Object.keys(dm)) if (k < addDays(td, -30)) delete dm[k];
  setPrefs({ dayMin: dm });
}

export function studyDays(from, to) {
  const out = [];
  for (let d = from; d < to; d = addDays(d, 1)) {
    const c = capacity(d);
    if (c > 0) out.push({ d, w: c });
  }
  return out;
}

/** 할 일들의 예상 시간 합 */
export const plannedMinutes = (list) => list.filter((t) => t.status !== 'dropped').reduce((a, t) => a + taskMinutes(t), 0);

/** 남은 분량을 시험 전날(끝낼 날은 그날)까지 나눠 할 일로 만든다. 공부 가능 시간이 긴 날에 더 많이. */
export function planSubject(sub, from = today(), data = D()) {
  const ex = data.exam;
  if (!ex) return 0;
  data.tasks = data.tasks.filter((t) => !(t.kind === 'track' && t.subjectId === sub.id && t.status === 'todo' && t.date >= from && !t.manual && !t.hist));
  const units = [];
  for (const s of sub.stages) for (let p = s.from; p <= s.to; p++) if (!isMarked(s, p)) units.push([s.id, p]);
  const days = studyDays(from, planEnd(ex));
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
        cur = { id: uid(), kind: 'track', examId: ex.id, date: day.d, subjectId: sub.id, stageId: sid, from: pg, to: pg, status: 'todo', moves: [] };
        data.tasks.push(cur);
        made++;
      } else {
        // 지문별 과목은 이미 채운 지문을 건너뛴다 → 번호가 끊기면 번호 목록을 따로 기억 (지문 4, 7)
        if (pg !== cur.to + 1) cur.units = cur.units || unitsOf(cur);
        cur.to = pg;
        if (cur.units) cur.units.push(pg);
      }
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
  const days = studyDays(from, clone.exam ? planEnd(clone.exam) : from);
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
      if (st.marks) st.marks = t.prevMarks ?? st.marks.filter((u) => !unitsOf(t).includes(u));
      else st.upto = t.prevUpto ?? null;
      logAdd(sub, t.doneDay || today(), done(st) - b);
    }
    if (t.reps > 1) t.repDone = t.reps - 1;
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
  // 여러 번 하는 일: 누를 때마다 한 번씩 올라가고, 다 하면 끝
  if (t.reps > 1 && (t.repDone || 0) + 1 < t.reps) {
    t.repDone = (t.repDone || 0) + 1;
    commit();
    toast(`${t.repDone}/${t.reps}번 했어요`);
    return;
  }
  if (t.reps > 1) t.repDone = t.reps;
  let msg = null;
  if (st && !t.hist) {
    const before = pct(sub), b = done(st);
    if (st.marks) {
      t.prevMarks = [...st.marks];
      for (const u of unitsOf(t)) markRange(st, u, u);
    } else {
      t.prevUpto = st.upto;
      st.upto = Math.max(st.upto ?? st.from - 1, t.to);
    }
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
  const all = unitsOf(t);
  const did = all.filter((u) => u <= upto);
  const left = all.filter((u) => u > upto);
  const list = (a) => (a.length === a[a.length - 1] - a[0] + 1 ? null : a); // 이어진 번호면 목록은 필요 없다
  if (did.length) {
    const b = done(st);
    if (st.marks) {
      t.prevMarks = [...st.marks];
      for (const u of did) markRange(st, u, u);
    } else {
      t.prevUpto = st.upto;
      st.upto = Math.max(st.upto ?? st.from - 1, upto);
    }
    logAdd(sub, today(), done(st) - b);
    t.to = did[did.length - 1];
    t.units = list(did);
    t.status = 'done';
    t.doneDay = today();
  }
  if (left.length && rest === 'tomorrow') {
    const d = addDays(t.date > today() ? t.date : today(), 1);
    if (!did.length) {
      moveTask(id, d);
    } else data.tasks.push({ id: uid(), kind: 'track', examId: t.examId, date: d, subjectId: t.subjectId, stageId: t.stageId, from: left[0], to: left[left.length - 1], units: list(left), status: 'todo', moves: [{ from: t.date, to: d, reason: null }] });
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

/** 지문별 과목: 칸 하나를 채우거나 비운다. 범위가 다 채워진 할 일은 저절로 체크된다. */
export function toggleCell(sub, st, u) {
  const on = !isMarked(st, u);
  markRange(st, u, u, on);
  logAdd(sub, today(), on ? 1 : -1);
  for (const t of D().tasks) {
    if (t.kind !== 'track' || t.stageId !== st.id || t.status !== 'todo' || t.hist) continue;
    const us = unitsOf(t);
    if (us.every((x) => isMarked(st, x))) {
      t.status = 'done';
      t.doneDay = today();
      t.prevMarks = st.marks.filter((x) => !us.includes(x));
    }
  }
}

/** '쎈 p.20-35' 처럼 적으면 그 교재의 단계에 연결한다. 지문별 과목은 '지문 3-5'만 적어도 된다. */
export function parseLink(text, sub) {
  if (!sub || !text) return null;
  const m = text.match(/(?:p\.?\s*|지문\s*)?(\d+)\s*(?:[-~–]|부터)\s*(\d+)\s*(?:쪽|p|번)?/i);
  let book = sub.books.find((b) => text.includes(b.name));
  if (!book && isPsg(sub) && /지문/.test(text)) {
    const cs = curStage(sub);
    book = (cs && bookOf(sub, cs)) || sub.books[0];
  }
  if (!m || !book) return null;
  const from = +m[1], to = +m[2];
  if (!(to >= from)) return null;
  const st = sub.stages.find((s) => s.bookId === book.id && status(s) !== 'done' && from >= s.from && from <= s.to) || sub.stages.find((s) => s.bookId === book.id && status(s) !== 'done');
  if (!st) return null;
  return { stage: st, from: clamp(from, st.from, st.to), to: clamp(to, st.from, st.to) };
}

export function addTask({ title, subjectId, date, link, est }) {
  const examId = D().exam ? D().exam.id : null;
  const t = link
    ? { id: uid(), kind: 'track', manual: true, examId, date, subjectId, stageId: link.stage.id, from: link.from, to: link.to, status: 'todo', moves: [], note: title }
    : { id: uid(), kind: 'free', examId, date, subjectId, title, status: 'todo', moves: [], est: est || null };
  D().tasks.push(t);
  return t;
}

/** 오늘 화면 정렬: 마감순 / 시간순 (없으면 뒤로, 같으면 중요도 높은 것 먼저) */
const byPri = (a, b) => (b.pri || 0) - (a.pri || 0);
export function sortTasks(list, mode) {
  const o = { todo: 0, done: PR().doneBottom ? 2 : 0, dropped: 3 };
  const st = (a, b) => (o[a.status] ?? 0) - (o[b.status] ?? 0);
  if (mode === 'due') return [...list].sort((a, b) => st(a, b) || cmpNull(a.due, b.due) || byPri(a, b));
  if (mode === 'time') return [...list].sort((a, b) => st(a, b) || cmpNull(a.at, b.at) || byPri(a, b));
  return [...list].sort((a, b) => st(a, b) || (a.kind === 'track' ? 0 : 1) - (b.kind === 'track' ? 0 : 1) || byPri(a, b));
}
const cmpNull = (x, y) => (x && y ? (x < y ? -1 : x > y ? 1 : 0) : x ? -1 : y ? 1 : 0);

// ─────────── 시험이 끝난 뒤 ───────────

const TERM = (name) => (/2학기/.test(name) ? 2 : 1);

/** 학기 찾기 (없으면 null) — 화면에서 쓰는 읽기 전용 */
export function findSemester(ex) {
  if (ex && (ex.kind === 'mid' || ex.kind === 'final')) return D().semesters.find((s) => s.id === `${ex.date.slice(0, 4)}-${TERM(ex.name)}`) || null;
  const list = [...D().semesters].sort((a, b) => (a.id < b.id ? -1 : 1));
  return list[list.length - 1] || null;
}
/** 학기 찾기, 없으면 만들기 — 학년은 같은 해의 다른 학기에서 가져온다 */
export function ensureSemester(ex) {
  const found = findSemester(ex);
  if (found) return found;
  const date = ex ? ex.date : today();
  const y = date.slice(0, 4);
  const term = ex ? TERM(ex.name) : +date.slice(5, 7) >= 8 ? 2 : 1;
  const same = D().semesters.find((s) => s.id.startsWith(y + '-'));
  const g = same && same.label.match(/(\d)학년/);
  const sem = { id: `${y}-${term}`, label: g ? `${g[1]}학년 ${term}학기` : `${y}년 ${term}학기`, records: [] };
  D().semesters.push(sem);
  D().semesters.sort((a, b) => (a.id < b.id ? -1 : 1));
  return sem;
}
/** 지금 성적 계산에 쓰는 학기 */
export const curSemester = () => findSemester(D().exam);

const DEFAULT_ELEMS = () => [
  { id: uid(), kind: 'exam', name: '1차 지필', weight: 30, max: 100, score: null },
  { id: uid(), kind: 'exam', name: '2차 지필', weight: 30, max: 100, score: null },
  { id: uid(), kind: 'perf', name: '수행평가', weight: 40, max: 40, score: null },
];
export const ACH_ONLY = /과학탐구실험|체육|음악|미술|예술/;
export const findRecord = (sem, sub) => (sem ? sem.records.find((r) => r.subject === sub.name) || null : null);
/** 과목 성적 기록 찾기, 없으면 지난 학기 구성을 복사하거나 기본 틀로 만든다 */
export function ensureRecord(sem, sub) {
  const had = findRecord(sem, sub);
  if (had) return had;
  const prev = [...D().semesters].reverse().flatMap((s) => s.records).find((x) => x.subject === sub.name);
  const r = {
    id: uid(),
    subject: sub.name,
    h: sub.h,
    credits: prev ? prev.credits : 4,
    category: prev ? prev.category : ACH_ONLY.test(sub.name) ? 'achievement' : 'grade',
    elements: prev ? prev.elements.map((e) => ({ id: uid(), kind: e.kind, name: e.name, weight: e.weight, max: e.max, score: null })) : DEFAULT_ELEMS(),
    final: {},
  };
  sem.records.push(r);
  return r;
}
/** 시험 하나가 성적표의 어느 지필 항목인지: 중간 = 첫 지필, 기말 = 둘째 지필 */
export function examEl(rec, e) {
  if (e.elem) {
    const x = rec.elements.find((el) => el.name === e.elem);
    if (x) return x;
  }
  const ex = rec.elements.filter((el) => el.kind === 'exam');
  return ex[e.kind === 'final' ? Math.min(1, ex.length - 1) : 0] || null;
}
/** 아직 점수가 안 나온 비중(%) — 점수를 하나라도 적었을 때만 */
export function remainingWeight(sub) {
  const r = findRecord(curSemester(), sub);
  if (!r || r.category !== 'grade' || !r.elements.some((e) => e.score != null)) return null;
  const c = computeRecord(r.elements);
  return c.remainingWeight > 0 ? { rem: c.remainingWeight, rec: r } : null;
}

function studyOf(sub, ex) {
  const td = today();
  let planned = 0, fin = 0, moved = 0;
  for (const t of D().tasks) {
    if (t.subjectId !== sub.id || !belongs(t, ex)) continue;
    moved += (t.moves || []).length;
    if (t.date > td && t.status === 'todo') continue;
    planned++;
    if (t.status === 'done') fin++;
  }
  return { progress: pct(sub), planDone: planned ? fin / planned : 0, planned, moved };
}

/**
 * 시험 정리: 공부한 기록을 그 시험에 고정하고, 점수는 성적 계산에 넣고,
 * 남은 진도 할 일은 치운다. (자유롭게 넣은 할 일은 그대로)
 * scores: { [subjectId]: { score, avg, rank, enrolled } } / mock: { [과목명]: [원점수, 백분위, 등급] }
 */
export function closeExam({ scores = {}, mock = null } = {}) {
  const data = D();
  const ex = data.exam;
  if (!ex) return;
  const td = today();
  if (ex.kind !== 'goal') {
    const past = { id: ex.id, name: ex.name, kind: ex.kind, date: ex.date, study: {}, snap: {}, ranks: {}, wrong: {}, note: '' };
    if (ex.kind === 'mock') past.mock = mock || {};
    else {
      const sem = ensureSemester(ex);
      past.semester = sem.id;
      for (const sub of data.subjects) {
        const v = scores[sub.id];
        if (!v || v.score == null) continue;
        const rec = ensureRecord(sem, sub);
        const el = examEl(rec, past);
        if (el) {
          el.score = Math.min(el.max, v.score);
          if (v.avg != null) el.avg = v.avg;
        }
        if (v.rank && v.enrolled) past.ranks[sub.name] = [v.rank, v.enrolled];
      }
    }
    for (const sub of data.subjects) {
      if (!sub.stages.length) continue;
      past.study[sub.name] = studyOf(sub, ex);
      past.snap[sub.name] = sub.stages.map((s) => ({ name: s.name, f: pages(s) ? done(s) / pages(s) : 0 }));
    }
    data.pastExams.push(past);
  }
  data.tasks = data.tasks.filter((t) => !(t.kind === 'track' && t.status === 'todo' && t.date >= td && !t.hist && belongs(t, ex)));
  for (const t of data.tasks) {
    if (t.kind !== 'track' || !belongs(t, ex)) continue;
    t.hist = true; // 지난 시험 기록: 다시 눌러도 새 진도에 영향 없음
    if (t.status === 'todo') t.closed = true;
  }
  data.lastExam = { name: ex.name, kind: ex.kind, date: ex.date };
  data.exam = null;
}

/** 다음 시험 이름·날짜 짐작 (사용자가 바로 고칠 수 있게 채워 두는 값) */
export function nextGuess() {
  const td = today();
  const n = (D().lastExam && D().lastExam.name) || '';
  const pick = (name, days) => ({ name, kind: kindOfName(name), date: addDays(td, days) });
  if (/1학기 중간/.test(n)) return pick('1학기 기말고사', 45);
  if (/1학기 기말/.test(n)) return pick('2학기 중간고사', 70);
  if (/2학기 중간/.test(n)) return pick('2학기 기말고사', 45);
  if (/2학기 기말/.test(n)) return pick('1학기 중간고사', 100);
  const m = +td.slice(5, 7);
  return pick(m >= 3 && m <= 5 ? '1학기 중간고사' : m >= 6 && m <= 7 ? '1학기 기말고사' : m >= 8 && m <= 10 ? '2학기 중간고사' : '2학기 기말고사', 30);
}

/** 다음 범위 기본값: 쪽은 지난 범위 바로 다음부터 같은 길이, 지문은 1번부터 같은 개수 */
export function shiftScopes() {
  for (const sub of D().subjects)
    for (const b of sub.books) {
      const len = b.to - b.from + 1;
      if (isPsg(sub)) {
        b.from = 1;
        b.to = len;
      } else {
        b.from = b.to + 1;
        b.to = b.to + len;
      }
    }
}

/** 다음 시험 시작: 과목·교재·단계 구성은 그대로, 범위만 새로. 진도는 처음부터. */
export function startNext(next) {
  const data = D();
  data.exam = { id: uid(), name: next.name, kind: next.kind, date: next.date, start: today() };
  for (const sub of data.subjects) {
    sub.stages = sub.stages
      .filter((s) => sub.books.some((b) => b.id === s.bookId))
      .map((s) => {
        const b = bookOf(sub, s);
        const n = { ...s, from: b.from, to: b.to, upto: null };
        if (s.marks) n.marks = [];
        return n;
      });
    if (!sub.stages.length && sub.books.length) sub.stages = buildStages(sub.books, sub.routine || 'mine', isPsg(sub));
  }
}

/** 틀린 이유 개수: 문항 번호로 적었으면 그걸 세고, 아니면 적은 개수 */
export function wrongCounts(w) {
  const c = Object.fromEntries(WRONG.map((r) => [r, 0]));
  if (!w) return c;
  if ((w.items || []).length) {
    for (const it of w.items) if (it.r) c[it.r]++;
  } else for (const r of WRONG) c[r] = (w.counts || {})[r] || 0;
  return c;
}
export const wrongText = (w) => {
  const c = wrongCounts(w);
  return WRONG.filter((r) => c[r]).map((r) => `${r} ${c[r]}`).join(' · ');
};

/** 과목 성적 계산 방법 열기 (지금 학기 기록이 없으면 먼저 만든다) */
export function openGradeSetup(subId) {
  const sub = subById(subId);
  const ex = D().exam;
  const sem = ensureSemester(ex && (ex.kind === 'mid' || ex.kind === 'final') ? ex : null);
  const r = ensureRecord(sem, sub);
  commit();
  openSheet({ type: 'gradeSetup', sem: sem.id, rec: r.id });
}

/** 과목 단위를 쪽 ↔ 지문으로 바꾼다. 단계는 같은 공부 순서로 새로 만든다(진도는 처음부터). */
export function setUnit(sub, unit, n = 12) {
  if ((sub.unit || 'page') === unit) return;
  sub.unit = unit;
  if (unit === 'passage') for (const b of sub.books) (b.from = 1), (b.to = n);
  sub.pace = null;
  sub.stages = buildStages(sub.books, sub.routine || 'mine', unit === 'passage');
  if (D().exam) planSubject(sub, today());
}

/** 한 주 돌아보기 (사실만) */
export function weekStats(end = today()) {
  const from = addDays(end, -6);
  const inR = (d) => d >= from && d <= end;
  const out = { from, end, planned: 0, done: 0, moved: 0, dropped: 0, missed: 0, bySub: {}, reasons: {}, est: 0, pages: 0, time: { n: 0, est: 0, actual: 0, bySub: {} } };
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
      // 걸린 시간을 적은 일만 예상과 비교한다
      if (t.actual) {
        const e = taskMinutes(t);
        const o = (out.time.bySub[t.subjectId] = out.time.bySub[t.subjectId] || { n: 0, est: 0, actual: 0 });
        for (const x of [out.time, o]) {
          x.n++;
          x.est += e;
          x.actual += t.actual;
        }
      }
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

// ─────────── 파일로 내보내기 / 불러오기 ───────────

const STUDY_PREFS = ['avail', 'rest', 'dayStart', 'pace', 'dayMin'];
export const BACKUP_APP = 'hoedok-planner';

/** 공부 자료 전체 + 공부 시간 설정. 화면 설정(디자인 등)과 사진은 넣지 않는다. */
export function backupObject() {
  const p = PR();
  return { app: BACKUP_APP, format: 1, exportedAt: new Date().toISOString(), data: D(), study: Object.fromEntries(STUDY_PREFS.map((k) => [k, p[k]])) };
}
export function backupFileName() {
  return `회독플래너-백업-${today()}.json`;
}
/** 파일 내용을 읽어 확인. 이 앱 파일이 아니면 오류 */
export function readBackup(text) {
  let o;
  try {
    o = JSON.parse(text);
  } catch {
    throw new Error('파일을 읽을 수 없어요. 이 앱에서 내보낸 파일인지 확인해 주세요.');
  }
  if (!o || o.app !== BACKUP_APP || !o.data || !Array.isArray(o.data.subjects)) throw new Error('이 앱에서 내보낸 백업 파일이 아니에요.');
  const d = o.data;
  return {
    obj: o,
    counts: { subjects: d.subjects.length, tasks: (d.tasks || []).length, exams: (d.pastExams || []).length, semesters: (d.semesters || []).length },
    exportedAt: o.exportedAt,
  };
}
export function applyBackup(o) {
  const b = blank();
  store.set((s) => ({ ...s, v: s.v + 1, data: { ...b.data, ...o.data }, prefs: { ...s.prefs, ...(o.study || {}) }, ui: { ...s.ui, stacks: { today: [], progress: [], grades: [] }, day: null } }));
}

// ─────────── 내신 흐름 ───────────

/** 학기 이름을 짧게: '1학년 2학기' → '1-2', '2026년 2학기' → '26-2' */
export function semShort(sem) {
  const g = sem.label.match(/(\d)학년\s*(\d)학기/);
  if (g) return `${g[1]}-${g[2]}`;
  return `${sem.id.slice(2, 4)}-${sem.id.slice(5)}`;
}
/** 한 과목의 지필 점수 흐름 (100점 기준으로 맞춤). 내 점수와 과목평균 */
export function naesinSeries(name) {
  const pts = [];
  for (const sem of [...D().semesters].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const r = sem.records.find((x) => x.subject === name);
    if (!r || r.category !== 'grade') continue;
    for (const el of r.elements.filter((e) => e.kind === 'exam'))
      if (el.score != null && el.max) pts.push({ label: `${semShort(sem)} ${el.name.replace(/\s*지필/, '')}`, v: Math.round((el.score / el.max) * 1000) / 10, avg: el.avg != null ? Math.round((el.avg / el.max) * 1000) / 10 : null, sem: sem.id, rec: r.id });
  }
  return pts;
}
/** 지필 점수가 하나라도 있는 과목 이름들 */
export function naesinSubjects() {
  const names = new Set();
  for (const sem of D().semesters) for (const r of sem.records) if (r.category === 'grade' && r.elements.some((e) => e.kind === 'exam' && e.score != null)) names.add(r.subject);
  const order = (n) => {
    const i = D().subjects.findIndex((s) => s.name === n);
    return i < 0 ? 99 : i;
  };
  return [...names].sort((a, b) => order(a) - order(b));
}

/** 체험용: 지금 시험을 오늘로 당겨 '시험이 끝난 뒤' 흐름을 바로 볼 수 있게 */
export function jumpToExamDay() {
  const ex = D().exam;
  if (!ex) return false;
  ex.date = today();
  commit();
  return true;
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
  const mk = (name, books, ups, unit) => {
    const sub = newSubjectFor(data, name);
    if (unit) sub.unit = unit;
    sub.books = books.map(([n, f, t, k]) => ({ id: uid(), name: n, kind: k || bookKind(n), from: f, to: t }));
    sub.stages = buildStages(sub.books, 'mine', unit === 'passage');
    sub.stages.forEach((s, i) => {
      const u = ups[i];
      if (s.marks) s.marks = u === 'all' ? Array.from({ length: pages(s) }, (_, k) => s.from + k) : u || [];
      else s.upto = u == null ? null : u === 'all' ? s.to : s.from + u - 1;
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
  mk('공통영어', [['교과서 본문', 1, 8, '개념'], ['부교재 지문', 1, 16, '문제']], ['all', [1, 2, 3, 5, 6, 8, 9, 10, 11, 12], [1, 2, 3], []], 'passage');
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
      // 걸린 시간은 일부만 적은 것으로 (예상과 비교해 보기용)
      else data.tasks.push({ ...base, date: d, status: 'done', doneDay: d, actual: k % 3 === 0 ? [30, 25, 20][k % 9 === 0 ? 0 : k % 2] : k % 4 === 1 ? 15 : undefined });
    }
  }
  store.set({ ...b, data, prefs: keep, ui: { ...b.ui, dev: UI().dev } });
  planAll(T);
  const soc = data.subjects[0], eng = data.subjects[2];
  const exId = data.exam.id;
  data.tasks.push({ id: uid(), kind: 'free', examId: exId, date: addDays(T, -1), subjectId: soc.id, title: '평가문제집 틀린 문제 다시 풀기', status: 'todo', moves: [], est: 30 });
  data.tasks.push({ id: uid(), kind: 'free', examId: exId, date: T, subjectId: soc.id, title: '수행평가 보고서 개요 쓰기', status: 'todo', moves: [], est: 40, due: addDays(T, 3), pri: 3, at: '21:00' });
  data.tasks.push({ id: uid(), kind: 'free', examId: exId, date: T, subjectId: eng.id, title: '영단어 Day 12 외우기', status: 'todo', moves: [], est: 20, reps: 3, repDone: 1, at: '07:40' });

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
  // 지금 학기: 통합사회 수행평가 두 개는 이미 점수가 나옴 → 아직 안 나온 비중 70%
  const sem2 = { id: `${T.slice(0, 4)}-2`, label: '1학년 2학기', records: [] };
  sem2.records.push({ id: uid(), subject: '통합사회', h: S('통합사회').h, credits: 4, category: 'grade', final: {}, elements: [['exam', '1차 지필', 30, 100, null], ['exam', '2차 지필', 30, 100, null], ['perf', '보고서 쓰기', 20, 20, 18], ['perf', '발표', 10, 10, null], ['perf', '포트폴리오', 10, 10, 10]].map(([kind, nm, w, max, score]) => ({ id: uid(), kind, name: nm, weight: w, max, score })) });
  data.semesters = [sem, sem2];

  const study = (a) => Object.fromEntries(a.map(([n, p, e, pl, mv]) => [n, { progress: p, planDone: e, planned: pl, moved: mv }]));
  const snap = (list) => list.map(([name, f]) => ({ name, f }));
  data.lastExam = { name: '1학기 기말고사', kind: 'final', date: '2026-07-03' };
  data.pastExams = [
    {
      id: 'ex-final1', name: '1학기 기말고사', kind: 'final', date: '2026-07-03', semester: '2026-1', elem: '2차 지필',
      study: study([['통합사회', 0.96, 0.84, 38, 4], ['공통국어', 0.71, 0.64, 33, 9], ['공통수학', 0.88, 0.76, 41, 6], ['공통영어', 0.92, 0.86, 29, 2], ['한국사', 0.8, 0.7, 24, 5], ['통합과학', 0.63, 0.58, 36, 11]]),
      ranks: { 통합사회: [6, 245], 공통국어: [31, 245], 공통수학: [27, 245], 공통영어: [15, 245], 한국사: [40, 245], 통합과학: [58, 245] },
      snap: {
        공통국어: snap([['1회독 · 자습서', 1], ['2회독 · 평가문제집', 1], ['3회독 · 자습서', 0.42], ['4회독 · 평가문제집', 0]]),
        통합과학: snap([['1회독 · 교과서', 1], ['2회독 · 문제집', 0.8], ['3회독 · 교과서', 0.2], ['4회독 · 기출문제집', 0]]),
      },
      wrong: { 공통국어: { counts: { 개념: 1, 실수: 1, '안 한 범위': 3 } }, 통합과학: { counts: { 개념: 2, '안 한 범위': 2, '처음 보는 유형': 1 } }, 공통수학: { counts: { 실수: 2, '시간 부족': 1 } } },
      note: '국어 3회독을 못 끝낸 채로 봤다. 과학은 기출 유형을 거의 못 봄.',
    },
    { id: 'ex-m9', name: '9월 모의고사', kind: 'mock', date: '2026-09-03', mock: { 공통국어: [86, 91, 2], 공통수학: [84, 93, 2], 공통영어: [91, null, 1], 한국사: [43, null, 1], 통합사회: [46, 95, 1], 통합과학: [41, 84, 3] }, study: study([['공통국어', 0.55, 0.6, 12, 3], ['공통수학', 0.62, 0.7, 14, 2], ['통합과학', 0.4, 0.5, 10, 4]]),
      wrong: { 공통수학: { items: [{ n: 14, r: '실수' }, { n: 21, r: '처음 보는 유형' }, { n: 29, r: '시간 부족' }, { n: 30, r: '시간 부족' }] }, 통합과학: { items: [{ n: 7, r: '개념' }, { n: 12, r: '개념' }, { n: 18, r: '실수' }, { n: 23, r: '처음 보는 유형' }] } } },
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
