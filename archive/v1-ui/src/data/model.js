// 도메인 읽기 도우미 (메모리 저장소에서 동기적으로 계산)
import { all, get, selector } from './db.js';
import { logicalToday, weekday, diffDays, addDays } from '../core/date.js';
import { sortExams, resolveExamId } from '../core/calc/exam.js';
import { trackProgress } from '../core/calc/track.js';
import { computeRecord } from '../core/calc/naesin.js';

// ---------- 과목 색 ----------

export const SUBJECT_COLORS = [
  { id: 'blue', hex: '#4c6fff', name: '파랑' },
  { id: 'orange', hex: '#ff8a3d', name: '주황' },
  { id: 'mint', hex: '#17bfa0', name: '민트' },
  { id: 'pink', hex: '#ff5fa2', name: '분홍' },
  { id: 'green', hex: '#62c23a', name: '연두' },
  { id: 'violet', hex: '#9b6bff', name: '보라' },
  { id: 'yellow', hex: '#f2c200', name: '노랑' },
  { id: 'sky', hex: '#2fa7f0', name: '하늘' },
  { id: 'red', hex: '#f0524f', name: '빨강' },
  { id: 'brown', hex: '#b07d56', name: '갈색' },
  { id: 'olive', hex: '#9da11f', name: '올리브' },
  { id: 'slate', hex: '#7688a0', name: '회청' },
];

export function hexToRgba(hex, a) {
  const h = (hex || '#7688a0').replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (x) => x + x) : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** 과목색을 CSS 변수로: --sc(점), --sc-soft(칩 배경), --hl0~2(형광펜) */
export function subjectVars(subject) {
  const hex = (subject && subject.color) || '#7688a0';
  return {
    '--sc': hex,
    '--sc-soft': hexToRgba(hex, 0.14),
    '--hl0': hexToRgba(hex, 0.08),
    '--hl1': hexToRgba(hex, 0.5),
    '--hl2': hexToRgba(hex, 0.3),
  };
}

// ---------- 설정 문서 ----------

export const DEFAULT_WEEKDAYS = [300, 180, 180, 180, 180, 180, 300]; // 일~토 (분)

export function availability() {
  const a = get('settings', 'availability');
  return {
    weekdays: (a && a.weekdays) || DEFAULT_WEEKDAYS,
    blocks: (a && a.blocks) || [],
  };
}

export function prefs() {
  const p = get('settings', 'prefs');
  return { dayStartHour: 4, currentSemesterId: null, onboarded: false, ...(p || {}) };
}

export function today(now = Date.now()) {
  return logicalToday(prefs().dayStartHour, new Date(now));
}

/** 그날 공부 가능 시간(분): 날짜별 예외 > 요일 기본값 */
export function capacityFor(date) {
  const o = get('dayOverrides', date);
  if (o && typeof o.minutes === 'number') return o.minutes;
  return availability().weekdays[weekday(date)] || 0;
}

export function fixedBlocksFor(date) {
  const wd = weekday(date);
  return availability().blocks.filter((b) => (b.days || []).includes(wd));
}

// ---------- 과목 / 교재 ----------

export const subjects = selector(['subjects'], () =>
  [...all('subjects')].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'ko')),
);

export const activeSubjects = selector(['subjects'], () => subjects().filter((s) => !s.archived));

export const subjectMap = selector(['subjects'], () => new Map(all('subjects').map((s) => [s.id, s])));

export function subjectOf(id) {
  return subjectMap().get(id) || null;
}

export const textbooksBySubject = selector(['textbooks'], () => {
  const m = new Map();
  for (const t of all('textbooks')) {
    if (!m.has(t.subjectId)) m.set(t.subjectId, []);
    m.get(t.subjectId).push(t);
  }
  for (const list of m.values()) list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return m;
});

export function textbooksOf(subjectId) {
  return textbooksBySubject().get(subjectId) || [];
}

// ---------- 학기 ----------

export const semesters = selector(['semesters'], () =>
  [...all('semesters')].sort((a, b) => a.year - b.year || a.grade - b.grade || a.term - b.term),
);

export function semesterLabel(s) {
  if (!s) return '';
  return `${s.grade}학년 ${s.term}학기`;
}

export function currentSemester() {
  const id = prefs().currentSemesterId;
  const list = semesters();
  return (id && list.find((s) => s.id === id)) || list[list.length - 1] || null;
}

// ---------- 시험 ----------

export const exams = selector(['exams'], () => sortExams(all('exams')));
export const examMap = selector(['exams'], () => new Map(all('exams').map((e) => [e.id, e])));

export function upcomingExams(t) {
  return exams().filter((e) => e.date >= t);
}

export function pastExams(t) {
  return exams()
    .filter((e) => e.date < t)
    .reverse();
}

export function daysUntil(exam, t) {
  return diffDays(t, exam.date);
}

// ---------- 할 일 ----------

export const tasksByDate = selector(['tasks'], () => {
  const m = new Map();
  for (const t of all('tasks')) {
    if (!t.date) continue;
    if (!m.has(t.date)) m.set(t.date, []);
    m.get(t.date).push(t);
  }
  return m;
});

export function tasksOn(date) {
  return tasksByDate().get(date) || [];
}

/** 지난 날짜에 남아 있는 미완료 할 일 */
export const overdueTasks = selector(['tasks'], (t) =>
  all('tasks')
    .filter((x) => x.status === 'todo' && x.date && x.date < t)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
);

export function plannedMinutes(date) {
  let s = 0;
  for (const t of tasksOn(date)) if (t.status !== 'dropped' && typeof t.estMinutes === 'number') s += t.estMinutes;
  return s;
}

export const tasksBySection = selector(['tasks'], () => {
  const m = new Map();
  for (const t of all('tasks')) {
    if (!t.sectionId) continue;
    if (!m.has(t.sectionId)) m.set(t.sectionId, []);
    m.get(t.sectionId).push(t);
  }
  return m;
});

export const tasksByTrack = selector(['tasks'], () => {
  const m = new Map();
  for (const t of all('tasks')) {
    if (!t.trackId) continue;
    if (!m.has(t.trackId)) m.set(t.trackId, []);
    m.get(t.trackId).push(t);
  }
  return m;
});

/** 할 일이 속한 시험 id (자동 포함) */
export function taskExamId(task) {
  return resolveExamId(task, exams(), examMap());
}

export const tasksByExam = selector(['tasks', 'exams'], () => {
  const m = new Map();
  for (const t of all('tasks')) {
    const e = taskExamId(t);
    if (!e) continue;
    if (!m.has(e)) m.set(e, []);
    m.get(e).push(t);
  }
  return m;
});

// ---------- 트랙 ----------

export function trackId(examId, subjectId) {
  return `${examId}:${subjectId}`;
}

export function trackOf(examId, subjectId) {
  return get('tracks', trackId(examId, subjectId)) || null;
}

export const tracksByExam = selector(['tracks'], () => {
  const m = new Map();
  for (const t of all('tracks')) {
    if (!m.has(t.examId)) m.set(t.examId, []);
    m.get(t.examId).push(t);
  }
  return m;
});

export function tracksOf(examId) {
  return tracksByExam().get(examId) || [];
}

export const progressOfTrack = selector(['tracks', 'tasks'], (id) => {
  const tr = get('tracks', id);
  if (!tr) return null;
  return trackProgress(tr, tasksByTrack().get(id) || []);
});

/** 시험 전체 진행률 = 과목 트랙 진행률의 평균 */
export function examProgress(examId) {
  const list = tracksOf(examId);
  const ps = list.map((t) => progressOfTrack(t.id)).filter((p) => p && p.total > 0);
  if (!ps.length) return null;
  return ps.reduce((s, p) => s + p.pct, 0) / ps.length;
}

// ---------- 성적 ----------

export function naesinId(semesterId, subjectId) {
  return `${semesterId}:${subjectId}`;
}

export const naesinBySemester = selector(['naesin'], () => {
  const m = new Map();
  for (const r of all('naesin')) {
    if (!m.has(r.semesterId)) m.set(r.semesterId, []);
    m.get(r.semesterId).push(r);
  }
  return m;
});

export function naesinOf(semesterId) {
  const list = naesinBySemester().get(semesterId) || [];
  const sm = subjectMap();
  return [...list].sort((a, b) => {
    const sa = sm.get(a.subjectId);
    const sb = sm.get(b.subjectId);
    return ((sa && sa.order) ?? 0) - ((sb && sb.order) ?? 0);
  });
}

export const computedNaesin = selector(['naesin'], (id) => {
  const r = get('naesin', id);
  return r ? computeRecord(r.elements || []) : null;
});

/** 시험(중간/기말)에 연결된 평가요소 찾기 */
export function examElement(examId, subjectId) {
  const e = get('exams', examId);
  if (!e || !e.semesterId) return null;
  const rec = get('naesin', naesinId(e.semesterId, subjectId));
  if (!rec) return null;
  return (rec.elements || []).find((el) => el.examId === examId) || null;
}

/** 과목의 남은 반영비율 (학기 기록 기준) */
export function remainingWeight(semesterId, subjectId) {
  const rec = get('naesin', naesinId(semesterId, subjectId));
  if (!rec || !(rec.elements || []).length) return null;
  return computeRecord(rec.elements).remainingWeight;
}

export function mockId(examId, subjectId) {
  return `${examId}:${subjectId}`;
}

export const mockByExam = selector(['mock'], () => {
  const m = new Map();
  for (const r of all('mock')) {
    if (!m.has(r.examId)) m.set(r.examId, []);
    m.get(r.examId).push(r);
  }
  return m;
});

export function wrongsOf(examId, subjectId) {
  return get('wrongs', `${examId}:${subjectId}`) || null;
}

export function reviewOf(examId) {
  return get('reviews', examId) || null;
}

// ---------- 기타 ----------

export function isAbsoluteMockSubject(name = '') {
  return /영어|한국사/.test(name);
}

export function nextDays(t, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(addDays(t, i));
  return out;
}
