// 상태 · 계산 · 동작 — 화면 설계는 docs/mockups/v5와 같다.
// 저장(IndexedDB)과 동기화는 store.js가 맡는다. 이 파일은 DOM·저장소 없이도 돌아간다(테스트용).
import { createStore } from '../lib/ui.js';
import { addDays, diffDays, weekday, logicalToday } from '../core/date.js';
import { computeRecord } from '../core/calc/naesin.js';

export { addDays, diffDays, weekday };

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
/** 시각 표시: 설정에 따라 '21:00' 또는 '오후 9:00' */
export const clock = (hm) => {
  if (!hm) return '';
  if (store.get().prefs.clock !== '12') return hm;
  const [h, m] = hm.split(':').map(Number);
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`;
};
/** 받침에 따라 은/는, 을/를, 이/가 */
export const josa = (w, a, b) => {
  const c = w.charCodeAt(w.length - 1);
  return w + (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? a : b);
};
/** 으로/로: '20쪽' → '20쪽으로', '12' → '12로', '30' → '30으로' (ㄹ 받침은 '로') */
export function ro(w) {
  const s = String(w);
  const c = s.slice(-1);
  const code = c.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const j = (code - 0xac00) % 28;
    return s + (j === 0 || j === 8 ? '로' : '으로');
  }
  return s + ('036'.includes(c) ? '으로' : '로');
}

// ─────────── 기본 선택지 ───────────

/** 과목 색은 색상(hue)만 고른다. 채도와 밝기는 디자인이 정한다 → 어떤 조합이든 어울림 */
export const HUES = [14, 36, 72, 150, 182, 204, 226, 262, 300, 340];

export const SUBJECT_PRESETS = [
  { name: '공통국어', h: 300, books: ['자습서', '평가문제집'] },
  { name: '공통수학', h: 226, books: ['개념원리', '쎈', '일품'] },
  // 영어 교과서는 단원(1-1, 1-2…)으로, 변형문제는 지문 번호로 세는 경우가 많다
  { name: '공통영어', h: 262, books: ['교과서', '변형문제'], units: { 교과서: 'ch', 변형문제: 'psg' } },
  { name: '한국사', h: 36, books: ['교과서', '문제집'] },
  { name: '통합사회', h: 14, books: ['자습서', '평가문제집', '심화문제집'] },
  { name: '통합과학', h: 150, books: ['교과서', '문제집', '기출문제집'] },
  { name: '과학탐구실험', h: 182, books: ['교과서'] },
  { name: '정보', h: 204, books: ['교과서', '문제집'] },
];
// 시험 범위 쪽수 기본값 (중간고사 범위 정도). 처음 설정에서 바로 고칠 수 있다.
export const BOOK_PAGES = { 자습서: [1, 60], 교과서: [1, 70], 평가문제집: [1, 40], 개념원리: [1, 50], 쎈: [1, 50], 일품: [1, 36], 기출문제집: [1, 30], 변형문제: [1, 30], 문제집: [1, 40], 심화문제집: [1, 36], '학교 프린트': [1, 20] };
export const BOOK_SUGGEST = ['자습서', '교과서', '평가문제집', '개념원리', '쎈', '문제집', '기출문제집', '심화문제집', '학교 프린트', '인강', '부교재 지문', '모의고사 기출'];
/** 과목에 맞는 교재 제안 (국어에 '쎈'을 권하지 않게) */
export function suggestBooks(subName) {
  const pre = SUBJECT_PRESETS.find((p) => p.name === subName);
  const by = /수학/.test(subName)
    ? ['교과서', '개념원리', '쎈', '일품', '기출문제집', '인강']
    : /영어/.test(subName)
      ? ['교과서', '부교재 지문', '변형문제', '모의고사 기출', '단어장', '인강']
      : /국어|문학|독서|언어/.test(subName)
        ? ['교과서', '자습서', '평가문제집', '문제집', '기출문제집', '학교 프린트', '인강']
        : ['교과서', '자습서', '평가문제집', '문제집', '기출문제집', '학교 프린트', '인강'];
  return [...new Set([...(pre ? pre.books : []), ...by])];
}
export const bookKind = (name) => (/교과서|자습서|개념|프린트|요약|노트|인강|강의/.test(name) ? '개념' : '문제');
/** 이름으로 짐작하는 단위 (바로 바꿀 수 있다) */
export const BOOK_UNIT = { 인강: ['lec', 1, 20], '부교재 지문': ['psg', 1, 16], '모의고사 기출': ['set', 1, 5] };
export const guessUnit = (name) => (BOOK_UNIT[name] ? BOOK_UNIT[name][0] : /인강|강의/.test(name) ? 'lec' : /지문|부교재/.test(name) ? 'psg' : /모의고사|기출 ?회/.test(name) ? 'set' : null);

/** 단원 이름 만들기: 큰 단원 시작 번호·개수 × 작은 단원 개수 → '1-1', '1-2' … (small이 0이면 '1', '2' …) */
export function genLabels(start, big, small) {
  const out = [];
  for (let i = 0; i < big; i++) {
    if (!small) out.push(String(start + i));
    else for (let j = 1; j <= small; j++) out.push(`${start + i}-${j}`);
  }
  return out;
}
/** 단원 이름이 genLabels로 만든 모양이면 그 값 ({ start, big, small }), 아니면 null */
export function labelsShape(labels) {
  if (!labels || !labels.length) return null;
  const ms = labels.map((l) => l.match(/^(\d+)(?:-(\d+))?$/));
  if (!ms.every(Boolean)) return null;
  const start = +ms[0][1];
  const small = ms[0][2] ? Math.max(...ms.map((m) => +m[2] || 0)) : 0;
  const big = new Set(ms.map((m) => m[1])).size;
  const again = genLabels(start, big, small);
  return again.length === labels.length && again.every((l, i) => l === labels[i]) ? { start, big, small } : null;
}
/** 단원 이름 목록 → 고치기 쉬운 글: 끝 숫자만 이어지는 것은 '1-1~1-4'로 줄인다 (parseLabels로 되돌리면 같다) */
export function labelsText(labels) {
  const out = [];
  for (let i = 0; i < labels.length; i++) {
    const m = labels[i].match(/^(.*?)(\d+)$/);
    let j = i;
    if (m)
      while (j + 1 < labels.length) {
        const n = labels[j + 1].match(/^(.*?)(\d+)$/);
        if (!n || n[1] !== m[1] || +n[2] !== +m[2] + (j + 1 - i) || String(+n[2]) !== n[2]) break;
        j++;
      }
    out.push(j - i >= 2 ? `${labels[i]}~${labels[j]}` : labels.slice(i, j + 1).join(', '));
    i = j;
  }
  return out.join(', ');
}
/**
 * 적은 글 → 단원 이름 목록. 쉼표·줄바꿈으로 나누고, '1-1~1-4' · 'L1~L3' 처럼 끝 숫자만 다른 범위는 펼친다.
 * 예: '1-1~1-3, 2-1~2-2, 쉬어가기' → 1-1, 1-2, 1-3, 2-1, 2-2, 쉬어가기
 */
export function parseLabels(text) {
  const out = [];
  for (const raw of String(text || '').split(/[,\n，、]+/)) {
    const part = raw.trim();
    if (!part) continue;
    const m = part.match(/^(.*?)(\d+)\s*[~∼〜]\s*(.*?)(\d+)$/);
    if (m && (m[3] === '' || m[3] === m[1]) && +m[4] >= +m[2] && +m[4] - +m[2] < 200) {
      for (let k = +m[2]; k <= +m[4]; k++) out.push(`${m[1]}${k}`);
    } else out.push(part.slice(0, 24));
    if (out.length >= 300) break;
  }
  return out.slice(0, 300);
}

export const ROUTINES = [
  { id: 'mine', name: '개념 → 문제 → 개념 → 심화', desc: '개념책 한 번, 문제집 한 번, 다시 개념, 마지막에 어려운 문제집' },
  { id: 'each', name: '한 권씩 차례로', desc: '넣은 교재를 순서대로 한 번씩' },
  { id: 'twice', name: '모든 교재 두 바퀴', desc: '넣은 교재를 순서대로 두 번씩' },
];

/**
 * 공부 순서대로 단계를 만든다. 칸 교재(지문·문제·강·회·단원)의 단계는 채운 칸 번호를 따로 기억한다(marks).
 * psg: 예전 기록용 — 교재에 단위가 없을 때 과목이 '지문으로 세기'였는지
 */
export function buildStages(books, routine = 'mine', psg = false) {
  return buildStages0(books, routine).map((s) => {
    const b = books.find((x) => x.id === s.bookId);
    return unitDef((b && b.unit) || (psg ? 'psg' : 'page')).cell ? { ...s, marks: [] } : s;
  });
}
/** 과목의 교재로 단계 만들기 */
export const stagesFor = (sub, routine) => buildStages(sub.books, routine || sub.routine || 'mine', sub.unit === 'passage');
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

/** 이 기기에 저장해 두는 화면 설정 (앱을 열자마자 쓰려고). 그중 LOOK_PREFS는 계정으로 기기끼리도 맞춘다. */
export const DEVICE_PREFS = ['theme', 'mode', 'size', 'font', 'density', 'hand', 'group', 'doneBottom', 'show', 'legend', 'lowest', 'recent', 'padAside', 'listWidth', 'motion', 'motionView', 'accent', 'bold', 'tabStyle', 'tabLabels', 'startTab', 'lastTab', 'weekStart', 'clock', 'ddayStyle', 'pctStyle', 'rowEst', 'doneMode', 'haptic'];

/** 계정으로 기기끼리 맞추는 화면 설정 (베타 2.0). 태블릿 칸 배치·마지막 탭처럼 기기마다 다른 것은 뺀다 */
export const LOOK_PREFS = ['theme', 'mode', 'size', 'font', 'bold', 'motion', 'group', 'doneMode', 'doneBottom', 'show', 'weekStart', 'clock', 'startTab', 'haptic'];
/** 테마는 색만 6가지 (모양은 하나). 예전 테마·강조 색은 가까운 새 테마로 읽는다 */
export const THEMES = ['base', 'warm', 'forest', 'ocean', 'lavender', 'ink'];
const OLD_THEME = { paper: 'warm', crisp: 'ink', soft: 'base' };
const ACCENT_THEME = { green: 'forest', teal: 'ocean', blue: 'base', indigo: 'lavender', purple: 'lavender', ink: 'ink', rose: 'warm', orange: 'warm' };
/** 예전 설정 값 → 지금 값 (기록은 고쳐 쓰지 않고 읽을 때) */
export function migratePrefs(p) {
  const o = { ...p };
  if (o.theme && !THEMES.includes(o.theme)) o.theme = (o.accent && ACCENT_THEME[o.accent]) || OLD_THEME[o.theme] || 'base';
  if (o.accent && o.accent !== 'theme') o.accent = 'theme';
  if (o.motion === 'slow' || o.motion === 'fast') o.motion = 'normal';
  if (o.font && o.font !== 'pretendard') o.font = 'pretendard'; // 디자인 규칙: 글꼴은 하나
  return o;
}

export function blank() {
  return {
    v: 0,
    // demo: 예시 기록을 보는 중 (이 동안은 동기화하지 않는다 — 예시가 계정에 섞이지 않게)
    data: { onboarded: false, demo: false, exam: null, lastExam: null, subjects: [], tasks: [], pastExams: [], semesters: [], repeats: [] },
    prefs: {
      theme: 'base', mode: 'auto', size: 'md', font: 'pretendard', density: 'normal', hand: 'right',
      group: 'subject', doneBottom: false,
      show: { dday: true, summary: true, overdue: true, due: true },
      legend: true, lowest: true, recent: true,
      avail: [300, 180, 180, 180, 180, 180, 300], rest: [], dayStart: 4, pace: 3, dayMin: {},
      padAside: 'progress', listWidth: 'normal',
      // 움직임: null = 아직 고른 적 없음 → 기기의 '동작 줄이기'를 따른다 (motion.js)
      motion: null, motionView: true,
      // 화면 (베타 1.0): 강조 색 · 굵은 글씨 · 탭 막대 · 앱을 열면 볼 화면 · 달력 첫 요일 · 시각 표시 · D-day 모양 ·
      // 진도 숫자(%/분량) · 할 일 줄의 예상 시간 · 끝낸 일(그대로/아래로/숨기기) · 진동
      accent: 'theme', bold: false, tabStyle: 'auto', tabLabels: true, startTab: 'today', lastTab: 'today', weekStart: 0, clock: '24', ddayStyle: 'd', pctStyle: 'pct', rowEst: false, doneMode: null, haptic: true,
    },
    ui: { tab: 'today', day: null, stacks: { today: [], progress: [], grades: [] }, sheet: null, ob: 0, open: {}, toast: null, dev: 'pad' },
  };
}

export const store = createStore(blank());

/** 저장소에서 읽은 자료로 채운다 (앱 시작, 다른 기기에서 온 변경) */
export function hydrate(data, prefs) {
  const b = blank();
  store.set((s) => ({
    ...s,
    v: s.v + 1,
    data: { ...b.data, ...data },
    prefs: migratePrefs({ ...b.prefs, ...s.prefs, ...prefs, show: { ...b.prefs.show, ...((prefs || {}).show || s.prefs.show) } }),
  }));
}

export const D = () => store.get().data;
export const isDemo = () => !!store.get().data.demo;
/** 예시 표시(demo)가 생기기 전에 연 예시도 알아본다: 예시에만 있는 고정 id (진짜 기록의 id는 무작위 8글자) */
export const looksLikeDemo = (d) => !!(d.demo || (d.exam && d.exam.id === 'ex-now') || (d.pastExams || []).some((e) => e.id === 'ex-final1'));
export const PR = () => store.get().prefs;
export const UI = () => store.get().ui;
export const commit = () => store.set((s) => ({ ...s, v: s.v + 1 }));
export const setUI = (patch) => store.set((s) => ({ ...s, ui: { ...s.ui, ...patch } }));
export const setPrefs = (patch) => store.set((s) => ({ ...s, prefs: { ...s.prefs, ...patch } }));
export const today = () => logicalToday(PR().dayStart);
export const viewDay = () => UI().day || today();

let toastTimer;
/** 아래에 잠깐 뜨는 알림. undo가 있으면 단추 하나(기본 '되돌리기', label로 바꿀 수 있음) */
export function toast(msg, undo, label, ms) {
  clearTimeout(toastTimer);
  setUI({ toast: { msg, undo, label, id: uid() } });
  toastTimer = setTimeout(() => setUI({ toast: null }), ms || (undo ? 5500 : 2800));
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
  if (PR().startTab === 'last' && PR().lastTab !== tab) setPrefs({ lastTab: tab }); // '마지막으로 본 화면'으로 열기
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

// ─ 단위 (교재마다) ─
// 교재마다 세는 단위가 다르다. 쪽은 읽는 순서대로 '어디까지'(stage.upto),
// 지문·문제·강·회·단원은 칸을 골라 채운다(stage.marks — 건너뛰며 보므로).
// 단원은 '1-1, 1-2'처럼 이름을 붙일 수 있다(book.labels). 번호 u는 언제나 from…to의 정수이고 이름은 labels[u-1].
// 예전 기록: 교재에 단위가 없으면 과목의 '지문으로 세기'(sub.unit === 'passage')를 따른다 → 고쳐 쓰지 않고 읽을 때 해석.
export const UNITS = [
  { id: 'page', name: '쪽', cell: false, desc: '쪽수로 · 읽은 데까지' },
  { id: 'psg', name: '지문', cell: true, pace: 10, desc: '지문 번호마다 칸' },
  { id: 'q', name: '문제', cell: true, pace: 3, desc: '문제 번호마다 칸' },
  { id: 'lec', name: '강', cell: true, pace: 40, desc: '인강·수업 회차' },
  { id: 'set', name: '회', cell: true, pace: 60, desc: '모의고사·기출 회차' },
  { id: 'ch', name: '단원', cell: true, pace: 30, desc: '1-1, 1-2처럼 이름으로' },
];
export const unitDef = (id) => UNITS.find((u) => u.id === id) || UNITS[0];
const legacyUnit = (sub) => (sub && sub.unit === 'passage' ? 'psg' : 'page');
/** 교재의 단위 id */
export const bookUnit = (sub, b) => (b && b.unit) || legacyUnit(sub);
/** 칸을 골라 채우는 교재인가 (쪽이 아님) */
export const isCell = (sub, b) => unitDef(bookUnit(sub, b)).cell;
/** 단계의 단위 id (교재가 지워진 단계는 칸 기록이 있으면 지문처럼) */
export function stageUnit(sub, s) {
  const b = sub && s ? sub.books.find((x) => x.id === s.bookId) : null;
  return b ? bookUnit(sub, b) : s && s.marks ? 'psg' : 'page';
}
/** 과목에 쓰는 단위들 (교재 순서대로, 겹치지 않게) */
export const unitsUsed = (sub) => [...new Set(sub.stages.map((s) => stageUnit(sub, s)))];
/** 과목 하나의 단위 — 섞였으면 null */
export const soleUnit = (sub) => {
  const u = unitsUsed(sub);
  return u.length === 1 ? u[0] : u.length ? null : bookUnit(sub, sub.books[0]);
};
/** 숫자 뒤에 붙이는 짧은 단위 ('12쪽', '3개') */
export const unitShort = (k) => (k === 'ch' ? '개' : unitDef(k).name);
/** 단위 이름 하나 ('쪽'·'지문'…) — 섞인 과목은 '칸' */
export const unitWord = (k) => (k ? unitDef(k).name : '칸');

/** 번호 목록을 짧게: [3,4,5,8] → '3–5, 8' */
export function compress(list) {
  return runsOf(list).map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ');
}
/** 이어진 번호끼리 묶기: [3,4,5,8] → [[3,5],[8,8]] */
export function runsOf(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    let j = i;
    while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
    out.push([list[i], list[j]]);
    i = j;
  }
  return out;
}
/** 칸 하나에 쓰는 짧은 이름: 3 / 1-1 */
export const itemShort = (b, u) => (b && b.labels && b.labels[u - 1]) || String(u);
/** 칸 하나의 이름: 3쪽 / 지문 3 / 3번 / 3강 / 3회 / 1-1 */
export function itemName(sub, b, u) {
  const lb = b && b.labels && b.labels[u - 1];
  if (lb) return lb;
  const k = bookUnit(sub, b);
  return k === 'page' ? `${u}쪽` : k === 'psg' ? `지문 ${u}` : k === 'q' ? `${u}번` : k === 'lec' ? `${u}강` : k === 'set' ? `${u}회` : `${u}단원`;
}
const wrapUnit = (k, r) => (k === 'page' ? `p.${r}` : k === 'psg' ? `지문 ${r}` : k === 'q' ? `문제 ${r}` : k === 'lec' ? `${r}강` : k === 'set' ? `${r}회` : `${r}단원`);
/** 할 일에 붙는 범위: p.3–10 / 지문 4, 7 / 문제 1–20 / 3–5강 / 1-1 ~ 1-3 (units: 건너뛴 번호가 있을 때 번호 목록) */
export function rangeText(sub, b, a, z, units) {
  const L = b && b.labels;
  if (L) {
    const nm = (u) => L[u - 1] || String(u);
    const parts = (units ? runsOf(units) : [[a, z]]).map(([x, y]) => (x === y ? nm(x) : `${nm(x)} ~ ${nm(y)}`));
    return parts.length > 3 ? `${parts.slice(0, 3).join(', ')} 외 ${parts.length - 3}곳` : parts.join(', ');
  }
  return wrapUnit(bookUnit(sub, b), units ? compress(units) : a === z ? `${a}` : `${a}–${z}`);
}
/** 단계 범위: 3–10쪽 / 지문 1–8 / 1-1 ~ 4-3 */
export function spanText(sub, b, a, z) {
  const L = b && b.labels;
  if (L) return a === z ? L[a - 1] || String(a) : `${L[a - 1] || a} ~ ${L[z - 1] || z}`;
  const k = bookUnit(sub, b);
  return k === 'page' ? `${a}–${z}쪽` : wrapUnit(k, `${a}–${z}`);
}
/** 분량: 12쪽 / 3지문 / 20문제 / 2강 / 1회 / 단원 3개 (short: 좁은 칸용 '3개') */
export function amountText(k, n, short = false) {
  if (k === 'ch') return short ? `${n}개` : `단원 ${n}개`;
  return `${n}${unitDef(k).name}`;
}
/** 할 일이 다루는 번호들 (칸 교재는 건너뛴 번호가 있을 수 있다) */
export const unitsOf = (t) => t.units || Array.from({ length: t.to - t.from + 1 }, (_, i) => t.from + i);
/** 진도 할 일의 단위 id */
export const taskUnit = (t) => (t.kind === 'track' ? stageUnit(subById(t.subjectId), taskStage(t)) : null);
export function trng(t) {
  const sub = subById(t.subjectId);
  const st = taskStage(t);
  return rangeText(sub, st ? bookOf(sub, st) : null, t.from, t.to, t.units);
}
/** 단위마다 합치기: [[단위, 개수]] → { page: 120, psg: 14 } */
export function tally(items) {
  const m = {};
  for (const [k, n] of items) if (n) m[k] = (m[k] || 0) + n;
  return m;
}
/** '120쪽 · 14지문' (UNITS 순서). 비었으면 empty */
export function tallyText(m, empty = '0쪽', short = false) {
  const parts = UNITS.filter((u) => m[u.id]).map((u) => amountText(u.id, m[u.id], short));
  return parts.length ? parts.join(' · ') : empty;
}
/** 과목의 전체·한 분량 (단위마다) */
export const totU = (sub) => tally(sub.stages.map((s) => [stageUnit(sub, s), pages(s)]));
export const dnU = (sub) => tally(sub.stages.map((s) => [stageUnit(sub, s), done(s)]));
/** 진도 할 일들의 분량 (단위마다) */
export const taskTally = (list) => tally(list.filter((t) => t.kind === 'track').map((t) => [taskUnit(t), taskPages(t)]));

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
/** 한 칸에 걸리는 시간(분): 교재에 정한 값 → (예전) 과목에 정한 값 → 단위 기본값 (쪽은 설정의 쪽당 시간) */
export function paceOfBook(sub, b) {
  if (b && b.pace) return b.pace;
  const k = bookUnit(sub, b);
  if (sub && sub.pace && k === legacyUnit(sub)) return sub.pace;
  return unitDef(k).pace || PR().pace;
}
/**
 * 진도 비율: 단위가 하나면 개수 그대로(120쪽 중 60쪽 = 50%),
 * 단위가 섞이면 걸리는 시간으로 무게를 준다 (1쪽과 1강을 같은 하나로 세지 않게).
 */
function weighed(pairs) {
  const mixed = new Set(pairs.map(([sub, s]) => stageUnit(sub, s))).size > 1;
  let a = 0, b = 0;
  for (const [sub, s] of pairs) {
    const w = mixed ? paceOfBook(sub, bookOf(sub, s)) : 1;
    a += done(s) * w;
    b += pages(s) * w;
  }
  return b ? a / b : 0;
}
export const pct = (sub) => weighed(sub.stages.map((s) => [sub, s]));
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
/** 전 과목: 비율(단위가 섞이면 시간 무게) + 단위마다 전체·한 분량 */
export const overall = () => {
  const subs = D().subjects;
  const all = {}, fin = {};
  for (const s of subs) {
    for (const [k, n] of Object.entries(totU(s))) all[k] = (all[k] || 0) + n;
    for (const [k, n] of Object.entries(dnU(s))) fin[k] = (fin[k] || 0) + n;
  }
  return { p: weighed(subs.flatMap((sub) => sub.stages.map((s) => [sub, s]))), all, fin };
};

/** 남은 분량을 시간으로 (분) */
export const remMinutes = (sub) => sub.stages.reduce((a, s) => a + (pages(s) - done(s)) * paceOfBook(sub, bookOf(sub, s)), 0);
const doneMinutes = (sub) => sub.stages.reduce((a, s) => a + done(s) * paceOfBook(sub, bookOf(sub, s)), 0);

/**
 * 진도 숫자 4개 (사실 수치만). 단위가 하나면 그 단위로,
 * 섞였으면(쪽 + 지문 등) 하루 평균·하루씩 나누면을 예상 시간으로 (단위를 더할 수 없으므로).
 */
export function facts(sub) {
  const ex = D().exam;
  const k = soleUnit(sub);
  const rem = tot(sub) - dn(sub);
  const dl = daysLeft();
  const elapsed = ex ? Math.max(1, diffDays(ex.start, today()) + 1) : 1;
  if (k) return { unit: k, rem, dl, avg: dn(sub) / elapsed, per: dl ? rem / dl : null, elapsed };
  const remT = tally(sub.stages.map((s) => [stageUnit(sub, s), pages(s) - done(s)]));
  const rm = remMinutes(sub);
  return { unit: null, rem, remT, dl, avgMin: doneMinutes(sub) / elapsed, perMin: dl ? rm / dl : null, elapsed };
}

/** 날마다 한 양 기록: log는 모든 단위 합(그래프용), logk는 단위마다 (합계 글자용) */
export function logAdd(sub, day, n, k) {
  if (!n) return;
  sub.log = sub.log || {};
  sub.log[day] = Math.max(0, (sub.log[day] || 0) + n);
  if (!k) return;
  sub.logk = sub.logk || {};
  const o = { ...(sub.logk[day] || {}) };
  o[k] = Math.max(0, (o[k] || 0) + n);
  if (!o[k]) delete o[k];
  sub.logk[day] = o;
}
/** 그날 한 양 (단위마다). 단위를 적기 전의 기록은 과목의 예전 단위로 */
export function logTally(sub, day) {
  const k = sub.logk && sub.logk[day];
  if (k && Object.keys(k).length) return k;
  const n = (sub.log || {})[day] || 0;
  return n ? { [soleUnit(sub) || legacyUnit(sub)]: n } : {};
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
/** 쪽 교재: 가장 적게 본 구간 번호들 (차이가 0.3번 넘을 때만) */
export function lowest(sub) {
  const c = counts(sub);
  if (!sub.stages.length) return [];
  const mn = Math.min(...c), mx = Math.max(...c);
  if (mx - mn < 0.3) return [];
  return c.map((v, i) => (v - mn < 0.3 ? i : -1)).filter((i) => i >= 0);
}

/** 칸 교재: 칸마다 몇 번 봤나 (그 교재를 쓰는 단계 중 채운 수) */
export function psgCounts(sub, book) {
  const st = sub.stages.filter((s) => s.bookId === book.id);
  const out = [];
  for (let u = book.from; u <= book.to; u++) out.push({ u, n: st.filter((s) => isMarked(s, u)).length });
  return out;
}
/** 칸 교재에서 가장 적게 본 칸 (기준 교재, 차이가 한 번 이상일 때만) */
export function lowestPsg(sub) {
  const b = refBook(sub);
  if (!b || !sub.stages.length || !isCell(sub, b)) return { book: b, list: [] };
  const c = psgCounts(sub, b);
  if (!c.length) return { book: b, list: [] };
  const mn = Math.min(...c.map((x) => x.n)), mx = Math.max(...c.map((x) => x.n));
  if (mx - mn < 1) return { book: b, list: [] };
  return { book: b, list: c.filter((x) => x.n === mn).map((x) => x.u) };
}
/** '가장 적게 본 곳' 한 줄 문구 — 기준 교재(첫 개념책)가 칸 교재면 칸 이름, 쪽 교재면 쪽 구간 */
export function lowestText(sub) {
  const rb = refBook(sub);
  if (!rb) return '';
  if (isCell(sub, rb)) {
    const { list } = lowestPsg(sub);
    if (!list.length) return '';
    const names = list.slice(0, 6).map((u) => itemName(sub, rb, u));
    return `${rb.name} ${names.join(', ')}${list.length > 6 ? ' …' : ''}`;
  }
  const low = lowest(sub);
  return low.length ? `${rb.name} ${low.map((i) => partLabels(sub)[i]).join(', ')}쪽` : '';
}

// ─────────── 할 일 ───────────

export const taskStage = (t) => (t.kind === 'track' ? stageById(subById(t.subjectId), t.stageId) : null);
export const taskPages = (t) => (t.kind === 'track' ? (t.units ? t.units.length : t.to - t.from + 1) : 0);
/** 진도 할 일 한 칸에 걸리는 시간 (그 교재 기준) */
const taskPace = (t) => {
  const sub = subById(t.subjectId);
  const st = taskStage(t);
  return paceOfBook(sub, st ? bookOf(sub, st) : null);
};
/** 예상 시간(분): 직접 고른 값이 있으면 그것, 없으면 진도 할 일은 분량 × 걸리는 시간 */
export const taskMinutes = (t) => t.est || (t.kind === 'track' ? taskPages(t) * taskPace(t) : 0);
export const tasksOn = (day) => D().tasks.filter((t) => t.date === day);
/** 지난 날 못 끝낸 일. 반복하는 일은 밀리지 않고 그날 기록으로만 남는다 (매일 하는 일이 쌓이면 보기 싫어지므로) */
export const overdue = () => D().tasks.filter((t) => t.status === 'todo' && !t.closed && !t.rep && t.date < today());

/** 마감이 가까운 일: 안 끝낸 일 중 마감이 오늘~3일 뒤인데 오늘보다 뒤 날짜에 잡아 둔 것 (오늘 목록에는 안 보이므로) */
export const DUE_SOON = 3;
export function dueSoon() {
  const td = today(), lim = addDays(td, DUE_SOON);
  return D()
    .tasks.filter((t) => t.status === 'todo' && t.due && t.due >= td && t.due <= lim && t.date > td)
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.date < b.date ? -1 : 1));
}
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

/** 아직 할 일로 만들지 않은 앞날의 반복하는 일 예상 시간 (2주보다 먼 날) */
export function pendingRepeatMinutes(d, data = D(), ids = null) {
  const rules = data.repeats || [];
  if (!rules.length) return 0;
  const have = ids || new Set(data.tasks.map((t) => t.id));
  return rules.reduce((a, r) => a + (repOn(r, d, data) && !have.has(repId(r, d)) ? r.est || 0 : 0), 0);
}
/** 그날 이미 잡힌 시간(분): 직접 넣은 일 + 반복하는 일. 저절로 나눈 진도 할 일은 뺀다 */
export function fixedMinutes(d, data = D(), ids = null) {
  let m = 0;
  for (const t of data.tasks) if (t.date === d && t.status !== 'dropped' && (t.kind === 'free' || t.manual)) m += taskMinutes(t);
  return m + pendingRepeatMinutes(d, data, ids);
}
/** 나눌 날과 무게: 공부 가능 시간에서 그날 이미 잡힌 시간을 뺀 만큼. 모든 날이 꽉 차 있으면 원래 시간대로 */
export function planDays(from, to, data = D()) {
  const days = studyDays(from, to);
  const ids = new Set(data.tasks.map((t) => t.id));
  const adj = days.map((x) => ({ d: x.d, w: Math.max(0, x.w - fixedMinutes(x.d, data, ids)) }));
  return adj.some((x) => x.w > 0) ? adj.filter((x) => x.w > 0) : days;
}

/**
 * 남은 분량을 시험 전날(끝낼 날은 그날)까지 나눠 할 일로 만든다.
 * 그날 남는 시간(공부 가능 시간 − 직접 넣은 일·반복하는 일)이 긴 날에 더 많이.
 */
export function planSubject(sub, from = today(), data = D()) {
  const ex = data.exam;
  if (!ex) return 0;
  data.tasks = data.tasks.filter((t) => !(t.kind === 'track' && t.subjectId === sub.id && t.status === 'todo' && t.date >= from && !t.manual && !t.hist));
  // 칸마다 걸리는 시간이 무게: 1강(40분)과 1쪽(3분)을 같은 하나로 나누지 않게
  const units = [];
  for (const s of sub.stages) {
    const w = paceOfBook(sub, bookOf(sub, s));
    for (let p = s.from; p <= s.to; p++) if (!isMarked(s, p)) units.push([s.id, p, w]);
  }
  const days = planDays(from, planEnd(ex), data);
  if (!units.length || !days.length) return 0;
  const W = days.reduce((a, x) => a + x.w, 0);
  // 무게가 모두 같으면 개수로 (지금까지와 똑같이), 다르면 누적 시간이 그날 몫에 가장 가까운 곳까지
  const even = units.every((u) => u[2] === units[0][2]);
  const cw = [0];
  if (!even) for (const u of units) cw.push(cw[cw.length - 1] + u[2]);
  const Wt = even ? 0 : cw[cw.length - 1];
  let acc = 0, idx = 0, made = 0;
  for (let di = 0; di < days.length; di++) {
    const day = days[di];
    acc += day.w;
    let end;
    if (even) end = Math.round((units.length * acc) / W);
    else if (di === days.length - 1) end = units.length;
    else {
      const target = (Wt * acc) / W;
      end = idx;
      while (end < units.length && Math.abs(cw[end + 1] - target) <= Math.abs(cw[end] - target)) end++;
    }
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
  // 나눌 날 = 진도 할 일이 들어갈 수 있는 날 (직접 넣은 일로 꽉 찬 날은 빠진다)
  const days = clone.exam ? planDays(from, planEnd(clone.exam), clone) : [];
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
      logAdd(sub, t.doneDay || today(), done(st) - b, stageUnit(sub, st));
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
    logAdd(sub, today(), done(st) - b, stageUnit(sub, st));
    msg = `${sub.name} 진도 ${P(before)} → ${P(pct(sub))}`;
  }
  t.status = 'done';
  t.doneDay = today();
  commit();
  if (msg) toast(msg);
}

/**
 * 일부만 했을 때: 한 만큼 반영하고, 남은 것은 내일로 넘기거나 버린다.
 * 쪽은 '어디까지'(upto), 칸 교재는 한 칸을 골라서(picked: 번호 목록) — 건너뛴 칸도 맞게.
 */
export function partialTask(id, upto, rest, picked = null) {
  const data = D();
  const t = data.tasks.find((x) => x.id === id);
  const sub = subById(t.subjectId);
  const st = taskStage(t);
  if (!st) return;
  const all = unitsOf(t);
  const did = picked && st.marks ? all.filter((u) => picked.includes(u)) : all.filter((u) => u <= upto);
  const left = all.filter((u) => !did.includes(u));
  const list = (a) => (a.length === a[a.length - 1] - a[0] + 1 ? null : a); // 이어진 번호면 목록은 필요 없다
  if (did.length) {
    const b = done(st);
    if (st.marks) {
      t.prevMarks = [...st.marks];
      for (const u of did) markRange(st, u, u);
    } else {
      t.prevUpto = st.upto;
      st.upto = Math.max(st.upto ?? st.from - 1, did[did.length - 1]);
    }
    logAdd(sub, today(), done(st) - b, stageUnit(sub, st));
    t.from = did[0];
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
  const t = data.tasks.find((x) => x.id === id);
  // 반복하는 일을 지우면 그날만 빠진다 (다시 만들지 않게 기억)
  const r = t && t.rep && repeatById(t.rep);
  if (r) r.skip = [...(r.skip || []).filter((d) => d >= today()), t.repDay || t.date];
  data.tasks = data.tasks.filter((x) => x.id !== id);
}

// ─────────── 반복하는 할 일 ───────────
// 규칙 = { id, subjectId, title, days: [요일 0~6], start, skip: [뺀 날], est?, pri?, at?, reps? }
// 할 일은 오늘부터 2주 앞까지만 만들어 둔다. 번호는 '규칙번호.날짜'
// → 두 기기가 따로 만들어도 같은 할 일 하나가 된다.

export const REPEAT_AHEAD = 14;
/** 반복하는 일에서 바꾸면 그 뒤 날짜의 반복에도 같이 바뀌는 칸 (메모·사진·마감일·걸린 시간은 그날 것만) */
export const REP_FIELDS = ['title', 'est', 'pri', 'at', 'reps'];
export const repeatById = (id) => (D().repeats || []).find((r) => r.id === id) || null;
export const repId = (r, d) => `${r.id}.${d}`;
const repOn = (r, d, data) => d >= r.start && r.days.includes(weekday(d)) && !(r.skip || []).includes(d) && data.subjects.some((s) => s.id === r.subjectId);
const keepsStuff = (t) => !!(t.memo || (t.photos || []).length || t.due);
/** '매일' / '월·수·금' */
export const daysText = (days) => (days.length === 7 ? '매일' : [1, 2, 3, 4, 5, 6, 0].filter((w) => days.includes(w)).map((w) => WD[w]).join('·'));

/** 반복 규칙마다 오늘부터 2주 앞까지 빠진 날을 채운다. 만든 개수를 돌려준다. */
export function fillRepeats(data = D(), from = today()) {
  const rules = data.repeats || [];
  if (!rules.length) return 0;
  const have = new Set(data.tasks.map((t) => t.id));
  let n = 0;
  for (const r of rules)
    for (let i = 0; i < REPEAT_AHEAD; i++) {
      const d = addDays(from, i);
      const id = repId(r, d);
      if (have.has(id) || !repOn(r, d, data)) continue;
      const ex = data.exam;
      const t = { id, kind: 'free', rep: r.id, repDay: d, gen: true, examId: ex && d < planEnd(ex) ? ex.id : null, date: d, subjectId: r.subjectId, title: r.title, status: 'todo', moves: [] };
      for (const k of REP_FIELDS) if (k !== 'title' && r[k]) t[k] = r[k];
      data.tasks.push(t);
      have.add(id);
      n++;
    }
  return n;
}

/**
 * 할 일을 반복하게 한다. days: 요일 목록(빈 목록 = 그만하기).
 * 이미 반복하는 일이면 요일만 바꾼다. 할 일 번호가 바뀔 수 있어 새 번호를 돌려준다.
 */
export function setRepeat(taskId, days) {
  const data = D();
  const t = data.tasks.find((x) => x.id === taskId);
  if (!t || t.kind !== 'free') return taskId;
  const td = today();
  const r0 = t.rep && repeatById(t.rep);
  const ds = [...new Set(days)].sort((a, b) => a - b);
  if (!ds.length) {
    if (r0) stopRepeat(r0.id);
    return taskId;
  }
  if (r0) {
    r0.days = ds;
    // 새 요일에 안 맞는 앞날의 반복은 치운다 (메모·사진·마감을 붙인 것은 둔다)
    data.tasks = data.tasks.filter((x) => !(x.rep === r0.id && x.id !== t.id && x.status === 'todo' && x.date > td && !ds.includes(weekday(x.repDay || x.date)) && !keepsStuff(x)));
    fillRepeats(data);
    return t.id;
  }
  const r = { id: uid(), subjectId: t.subjectId, title: t.title, days: ds, start: t.date < td ? td : t.date, skip: [] };
  for (const k of REP_FIELDS) if (k !== 'title' && t[k]) r[k] = t[k];
  data.repeats = [...(data.repeats || []), r];
  // 이 할 일이 그날의 반복이 된다
  t.id = repId(r, t.date);
  t.rep = r.id;
  t.repDay = t.date;
  fillRepeats(data);
  return t.id;
}

/**
 * 반복 그만하기: 규칙을 지우고 내일부터의 반복을 치운다. 오늘 것과 지난 기록은 남는다.
 * keepId: 지금 보고 있는 할 일 — 오늘 이후라면 보통 할 일로 되돌린다.
 */
export function stopRepeat(ruleId, keepId = null) {
  const data = D();
  const td = today();
  data.repeats = (data.repeats || []).filter((r) => r.id !== ruleId);
  data.tasks = data.tasks.filter((x) => !(x.rep === ruleId && x.id !== keepId && x.status === 'todo' && x.date > td && !keepsStuff(x)));
  // 남겨 둔 앞날 것(메모 등을 붙인 것)은 보통 할 일이 된다
  for (const x of data.tasks)
    if (x.rep === ruleId && (x.date > td || (x.id === keepId && x.date >= td))) {
      delete x.rep;
      delete x.repDay;
      delete x.gen;
    }
}

/** 할 일 칸 하나 바꾸기. 반복하는 일이면 이름·시간·중요도 등은 그 뒤 날짜의 반복에도 같이 바꾼다. */
export function editTask(t, k, v) {
  t[k] = v;
  const r = t.rep && REP_FIELDS.includes(k) && repeatById(t.rep);
  if (!r) return;
  if (v == null || v === '') delete r[k];
  else r[k] = v;
  for (const x of D().tasks)
    if (x.rep === r.id && x.id !== t.id && x.status === 'todo' && x.date > t.date) {
      if (v == null || v === '') delete x[k];
      else x[k] = v;
      if (k === 'reps') x.repDone = Math.min(x.repDone || 0, Math.max(0, (v || 1) - 1));
    }
}

/** 단계에 몇 쪽까지 했는지 직접 적기. 이미 잡힌 할 일도 맞춰 준다. */
export function recordStage(sub, st, upto) {
  const b = done(st);
  st.upto = upto < st.from ? null : Math.min(upto, st.to);
  logAdd(sub, today(), done(st) - b, stageUnit(sub, st));
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

/** 칸 교재: 칸 하나를 채우거나 비운다. 범위가 다 채워진 할 일은 저절로 체크된다. */
export function toggleCell(sub, st, u) {
  const on = !isMarked(st, u);
  markRange(st, u, u, on);
  logAdd(sub, today(), on ? 1 : -1, stageUnit(sub, st));
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

/**
 * 적은 글에서 진도 범위를 찾아 그 교재의 단계에 연결한다.
 * '쎈 p.20-35' · '지문 3-5' · '문제 1~20' · '3-5강' · '1-1~1-3'(단원 이름) 처럼 적으면 된다.
 * 교재 이름이 없어도 그 단위를 쓰는 교재가 하나뿐이면 그 교재로.
 */
export function parseLink(text, sub) {
  if (!sub || !text) return null;
  let book = [...sub.books].sort((a, b) => b.name.length - a.name.length).find((b) => text.includes(b.name));
  const byName = !!book;
  if (!book) {
    // 단위 말로 찾기: '지문' '문제' '강' '회' / 'p' '쪽'
    const want = /지문/.test(text) ? 'psg' : /문제|번/.test(text) ? 'q' : /\d\s*강/.test(text) ? 'lec' : /\d\s*회/.test(text) ? 'set' : /p\.?\s*\d|\d\s*쪽/i.test(text) ? 'page' : null;
    const same = want ? sub.books.filter((b) => bookUnit(sub, b) === want) : [];
    if (same.length === 1) book = same[0];
    else if (same.length > 1) {
      const cs = curStage(sub);
      book = (cs && same.find((b) => b.id === cs.bookId)) || same[0];
    }
  }
  // 단원 이름(1-1 등)은 이름 그대로 찾는다 — 숫자 범위로 읽으면 '1-1'이 1쪽이 되므로 먼저
  const named = (book ? [book] : sub.books).filter((b) => b.labels && b.labels.length);
  for (const b of named) {
    const hits = [];
    const sorted = b.labels.map((l, i) => [l, i + 1]).sort((x, y) => y[0].length - x[0].length);
    let rest = text;
    for (const [l, u] of sorted) {
      const at = rest.indexOf(l);
      if (at >= 0 && l) {
        hits.push([at, u]);
        rest = rest.slice(0, at) + ' '.repeat(l.length) + rest.slice(at + l.length);
      }
    }
    if (!hits.length) continue;
    hits.sort((x, y) => x[0] - y[0]);
    const us = hits.map((h) => h[1]);
    const from = Math.min(us[0], us[us.length - 1]), to = Math.max(us[0], us[us.length - 1]);
    const r = linkTo(sub, b, from, to);
    if (r) return r;
  }
  if (!book) return null;
  // 범위(20-35) → 앞에 단위가 붙은 한 칸(p.20, 지문 3) → 뒤에 단위가 붙은 한 칸(3강)은 교재 이름이 있을 때만
  const m = text.match(/(?:p\.?\s*|지문\s*|문제\s*)?(\d+)\s*(?:[-~–]|부터)\s*(\d+)\s*(?:쪽|p|번|강|회)?/i) || text.match(/(?:p\.?\s*|지문\s*|문제\s*)(\d+)()/i) || (byName ? text.match(/(\d+)\s*(?:쪽|번|강|회)()/) : null);
  if (!m) return null;
  const from = +m[1], to = m[2] ? +m[2] : +m[1];
  if (!(to >= from)) return null;
  return linkTo(sub, book, from, to);
}
/** 교재의 범위 → 그 범위를 다루는 (안 끝난) 단계 */
function linkTo(sub, book, from, to) {
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

/** 끝낸 일을 어떻게 둘까: 'stay' 그 자리에 / 'bottom' 아래로 / 'hide' 숨기기 (예전 설정 doneBottom도 읽는다) */
export const doneMode = () => PR().doneMode || (PR().doneBottom ? 'bottom' : 'stay');

/** 오늘 화면 정렬: 마감순 / 시간순 (없으면 뒤로, 같으면 중요도 높은 것 먼저) */
const byPri = (a, b) => (b.pri || 0) - (a.pri || 0);
export function sortTasks(list, mode) {
  const o = { todo: 0, done: doneMode() === 'stay' ? 0 : 2, dropped: 3 };
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
    // 시험 뒤로 잡아 둔 직접 넣은 일·반복하는 일은 이 시험 소속이 아니다 → 날짜로 다음 시험에 들어가게
    if (t.kind === 'free' && t.status === 'todo' && t.date >= td && t.examId === ex.id) t.examId = null;
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

/**
 * 다음 범위 기본값 (바로 고칠 수 있게 채워 두는 값):
 * 쪽·문제·강·회는 지난 범위 바로 다음부터 같은 길이, 지문은 1번부터 같은 개수(시험마다 새 지문),
 * 단원은 '1-1…2-3' 다음 '3-1…4-3'처럼 큰 단원 번호를 넘긴다 (이름이 그런 꼴일 때만).
 */
export function shiftScopes() {
  for (const sub of D().subjects)
    for (const b of sub.books) {
      const k = bookUnit(sub, b);
      const len = b.to - b.from + 1;
      if (k === 'ch') {
        const L = b.labels;
        const ms = L && L.map((l) => l.match(/^(\D*)(\d+)(-\d+)?$/));
        if (ms && ms.every(Boolean)) {
          const bigs = ms.map((m) => +m[2]);
          const step = Math.max(...bigs) - Math.min(...bigs) + 1;
          b.labels = ms.map((m) => `${m[1]}${+m[2] + step}${m[3] || ''}`);
        }
      } else if (k === 'psg') {
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
    if (!sub.stages.length && sub.books.length) sub.stages = stagesFor(sub);
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

/** 한 주 돌아보기 (사실만) */
export const weekStats = (end = today()) => periodStats(addDays(end, -6), end);

/** 기간 돌아보기 (사실만): 한 주, 또는 시험 준비를 시작한 날부터 오늘까지 */
export function periodStats(from, end) {
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
  const days = Array.from({ length: diffDays(from, end) + 1 }, (_, i) => addDays(from, i));
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
/** 새 교재. unit을 주지 않으면 이름으로 짐작(인강 → 강 …), 그래도 모르면 쪽 */
export function newBook(name, unit) {
  const k = unit || guessUnit(name) || 'page';
  const r = (BOOK_UNIT[name] && BOOK_UNIT[name][0] === k ? BOOK_UNIT[name].slice(1) : null) || (k === 'page' ? BOOK_PAGES[name] : null) || (k === 'page' ? [1, 50] : k === 'psg' ? [1, 12] : k === 'q' ? [1, 40] : k === 'lec' ? [1, 20] : k === 'set' ? [1, 5] : [1, 6]);
  const b = { id: uid(), name, kind: bookKind(name), unit: k, from: r[0], to: r[1] };
  if (k === 'ch') {
    b.labels = genLabels(1, 2, 3);
    b.from = 1;
    b.to = b.labels.length;
  }
  return b;
}
/** 한 칸에 걸리는 시간 고르기 (단위마다 어울리는 값만) */
export const PACE_OPTS = { page: [2, 3, 5, 8], psg: [5, 10, 15, 20], q: [1, 2, 3, 5], lec: [20, 30, 40, 60], set: [40, 60, 80, 100], ch: [15, 30, 45, 60] };

/** 범위 칸 하나를 바꿨을 때 다른 쪽 맞추기: 시작 > 끝(또는 끝 < 시작)이면 같은 길이만큼 함께 옮긴다 */
export function fitRange(from, to, which, n, min = 1) {
  const len = Math.max(0, to - from);
  if (which === 'from') return n <= to ? [n, to] : [n, n + len];
  return n >= from ? [from, n] : [Math.max(min, n - len), n];
}

/** 단계 범위 바꾸기 (교재 범위 안에서). 한 진도는 새 범위 안의 것만 남는다 */
export function setStageRange(s, from, to) {
  s.from = from;
  s.to = to;
  if (s.marks) s.marks = s.marks.filter((u) => u >= from && u <= to);
  else if (s.upto != null) s.upto = s.upto < from ? null : Math.min(s.upto, to);
}

/** 과목 기본 교재 (영어 교과서는 단원으로 등) */
export function presetBook(subName, bookName) {
  const pre = SUBJECT_PRESETS.find((p) => p.name === subName);
  return newBook(bookName, pre && pre.units ? pre.units[bookName] : undefined);
}
/** 과목에 교재를 더할 때 단위: 이름으로 짐작, 아니면 그 과목에서 가장 많이 쓰는 단위 */
export function bookFor(sub, name) {
  if (guessUnit(name)) return newBook(name);
  const pre = SUBJECT_PRESETS.find((p) => p.name === sub.name);
  if (pre && pre.units && pre.units[name]) return newBook(name, pre.units[name]);
  const used = sub.books.map((b) => bookUnit(sub, b));
  const common = used.sort((a, b) => used.filter((x) => x === b).length - used.filter((x) => x === a).length)[0];
  return newBook(name, common === 'ch' ? 'page' : common || 'page');
}

/**
 * 교재 범위 바꾸기: 그 교재를 쓰는 단계도 함께 바꾼다 (전에는 교재만 바뀌고 단계는 옛 범위 그대로였다).
 * 한 진도는 새 범위 안이면 그대로 둔다. 교재 전체를 쓰던 단계는 새 범위 전체로.
 */
export function setBookRange(sub, b, from, to) {
  const of = b.from, ot = b.to;
  b.from = from;
  b.to = to;
  for (const s of sub.stages) {
    if (s.bookId !== b.id) continue;
    const whole = s.from === of && s.to === ot;
    let nf = whole ? from : Math.max(from, s.from);
    let nt = whole ? to : Math.min(to, s.to);
    if (nf > nt) (nf = from), (nt = to);
    s.from = nf;
    s.to = nt;
    if (s.marks) s.marks = s.marks.filter((u) => u >= nf && u <= nt);
    else if (s.upto != null) s.upto = s.upto < nf ? null : Math.min(s.upto, nt);
  }
}

/** 단원 이름 바꾸기: 채운 칸은 이름으로 찾아 옮긴다 (가운데에 하나 끼워 넣어도 맞게) */
export function setBookLabels(sub, b, labels) {
  const old = b.labels || null;
  const nameOf = (u) => (old ? old[u - 1] : String(u));
  const n = labels.length;
  if (!n) return;
  b.labels = labels;
  b.from = 1;
  b.to = n;
  for (const s of sub.stages) {
    if (s.bookId !== b.id) continue;
    const had = new Set((s.marks || []).map(nameOf));
    s.from = 1;
    s.to = n;
    s.marks = labels.map((l, i) => (had.has(l) ? i + 1 : 0)).filter(Boolean);
    s.upto = null;
  }
}

/**
 * 교재 단위 바꾸기. 적어 둔 진도는 옮길 수 있으면 옮긴다:
 * 쪽 → 칸: 읽은 데까지를 칸으로 / 칸 → 쪽: 처음부터 이어서 채운 데까지 / 칸 ↔ 칸: 그대로.
 * 단원 이름은 단원일 때만 둔다.
 */
export function setBookUnit(sub, b, unit) {
  const was = bookUnit(sub, b);
  if (was === unit) return;
  const wasCell = unitDef(was).cell, cell = unitDef(unit).cell;
  b.unit = unit;
  if (unit !== 'ch') delete b.labels;
  delete b.pace; // 걸리는 시간은 단위마다 다르다 → 새 단위 기본값으로
  for (const s of sub.stages) {
    if (s.bookId !== b.id) continue;
    if (wasCell && !cell) {
      const m = new Set(s.marks || []);
      let u = s.from - 1;
      while (u < s.to && m.has(u + 1)) u++;
      s.upto = u >= s.from ? u : null;
      delete s.marks;
    } else if (!wasCell && cell) {
      s.marks = [];
      if (s.upto != null) for (let u = s.from; u <= Math.min(s.upto, s.to); u++) s.marks.push(u);
      s.upto = null;
    }
  }
}

// ─────────── 파일로 내보내기 / 불러오기 ───────────

/** 공부 설정: 기기끼리 공유한다 */
export const STUDY_PREFS = ['avail', 'rest', 'dayStart', 'pace', 'dayMin'];
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

/**
 * 다른 기기에서 '끝냈다'고 온 진도 할 일이 이 기기 진도 칸에 안 채워져 있으면 채운다.
 * (두 기기에서 따로 체크하면 과목 기록은 나중 것 하나만 남으므로)
 */
export function reconcile(taskIds) {
  let n = 0;
  for (const t of D().tasks) {
    if (!taskIds.has(t.id) || t.kind !== 'track' || t.status !== 'done' || t.hist) continue;
    const st = taskStage(t);
    if (!st) continue;
    if (st.marks) {
      for (const u of unitsOf(t))
        if (!isMarked(st, u)) {
          markRange(st, u, u);
          n++;
        }
    } else if ((st.upto ?? st.from - 1) < t.to) {
      st.upto = t.to;
      n++;
    }
  }
  return n;
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
  data.demo = true;
  data.exam = { id: 'ex-now', name: '2학기 중간고사', kind: 'mid', date: addDays(T, 11), start: addDays(T, -9) };
  // books: [이름, 시작, 끝, 개념/문제, 단위, 단원 이름]
  const mk = (name, books, ups) => {
    const sub = newSubjectFor(data, name);
    sub.books = books.map(([n, f, t, k, unit, labels]) => {
      const b = { id: uid(), name: n, kind: k || bookKind(n), unit: unit || 'page', from: f, to: t };
      if (labels) b.labels = labels;
      return b;
    });
    sub.stages = buildStages(sub.books, 'mine');
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
  mk('공통영어', [['교과서 본문', 1, 8, '개념', 'ch', genLabels(1, 2, 4)], ['부교재 지문', 1, 16, '문제', 'psg']], ['all', [1, 2, 3, 5, 6, 8, 9, 10, 11, 12], [1, 2, 3], []]);
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
  // 다른 날로 잡아 둔 수행평가 → '마감이 가까운 일' 한 줄
  data.tasks.push({ id: uid(), kind: 'free', examId: exId, date: addDays(T, 2), subjectId: data.subjects[4].id, title: '실험 보고서 마무리', status: 'todo', moves: [], est: 40, due: addDays(T, 3) });
  // 반복하는 일: 월·수·금 수학 오답 정리
  data.repeats = [{ id: 'rep-demo', subjectId: data.subjects[1].id, title: '오답 노트 정리', days: [1, 3, 5], start: addDays(T, -14), skip: [], est: 30 }];
  fillRepeats(data);

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
