// 도메인 쓰기 동작
import { put, update, remove, get, all, blobPut } from './db.js';
import { uid } from '../core/id.js';
import {
  today,
  subjects,
  subjectOf,
  availability,
  prefs,
  trackId,
  naesinId,
  mockId,
  isAbsoluteMockSubject,
  SUBJECT_COLORS,
  exams as examsSorted,
} from './model.js';
import { templateById } from '../core/templates.js';
import { achievementFromRaw, computeRecord } from '../core/calc/naesin.js';

// ---------- 설정 ----------

export function setPrefs(patch) {
  const cur = get('settings', 'prefs') || { id: 'prefs' };
  put('settings', { ...cur, ...patch, id: 'prefs' });
}

export function setAvailability(patch) {
  const cur = get('settings', 'availability') || { id: 'availability', ...availability() };
  put('settings', { ...cur, ...patch, id: 'availability' });
}

export function setDayOverride(date, minutes) {
  if (minutes == null) remove('dayOverrides', date);
  else put('dayOverrides', { id: date, date, minutes });
}

// ---------- 과목 ----------

export function nextSubjectColor() {
  const used = new Set(subjects().map((s) => s.color));
  const c = SUBJECT_COLORS.find((x) => !used.has(x.hex));
  return (c || SUBJECT_COLORS[subjects().length % SUBJECT_COLORS.length]).hex;
}

export function addSubject(data) {
  const list = subjects();
  const order = list.length ? Math.max(...list.map((s) => s.order ?? 0)) + 1 : 0;
  return put('subjects', {
    id: uid(),
    name: (data.name || '').trim() || '새 과목',
    credits: data.credits ?? null,
    group: data.group || '',
    color: data.color || nextSubjectColor(),
    category: data.category || 'grade',
    template: data.template || null,
    order,
  });
}

export function saveSubject(id, patch) {
  return update('subjects', id, patch);
}

export function subjectInUse(id) {
  return (
    all('tasks').some((t) => t.subjectId === id) ||
    all('tracks').some((t) => t.subjectId === id) ||
    all('naesin').some((r) => r.subjectId === id) ||
    all('mock').some((r) => r.subjectId === id)
  );
}

/** 기록이 있는 과목은 보관(목록에서 숨김), 없으면 삭제 */
export function deleteSubject(id) {
  if (subjectInUse(id)) {
    update('subjects', id, { archived: true });
    return 'archived';
  }
  remove('subjects', id);
  for (const t of all('textbooks')) if (t.subjectId === id) remove('textbooks', t.id);
  return 'deleted';
}

export function reorderSubjects(ids) {
  ids.forEach((id, i) => {
    const s = get('subjects', id);
    if (s && s.order !== i) update('subjects', id, { order: i });
  });
}

// ---------- 교재 ----------

export function addTextbook(subjectId, name, totalPages) {
  return put('textbooks', { id: uid(), subjectId, name: (name || '').trim() || '교재', totalPages: totalPages ?? null });
}

export function saveTextbook(id, patch) {
  return update('textbooks', id, patch);
}

export function deleteTextbook(id) {
  remove('textbooks', id);
}

// ---------- 학기 ----------

export function addSemester({ year, grade, term }) {
  const id = `${year}-${term}`;
  const s = put('semesters', { id, year, grade, term });
  if (!prefs().currentSemesterId) setPrefs({ currentSemesterId: id });
  return s;
}

export function defaultSemesterGuess(dateKey) {
  const [y, m] = dateKey.split('-').map(Number);
  const term = m >= 3 && m <= 8 ? 1 : 2;
  const year = m <= 2 ? y - 1 : y;
  return { year, term };
}

// ---------- 시험 ----------

export function addExam(data) {
  const e = put('exams', {
    id: uid(),
    kind: data.kind || 'mid',
    name: data.name || '시험',
    date: data.date,
    semesterId: data.semesterId || null,
    subjectIds: data.subjectIds || [],
    scopes: data.scopes || {},
    mock: data.mock || null,
  });
  if (e.semesterId && (e.kind === 'mid' || e.kind === 'final')) linkExamToElements(e);
  return e;
}

export function saveExam(id, patch) {
  const e = update('exams', id, patch);
  if (e && e.semesterId && (e.kind === 'mid' || e.kind === 'final')) linkExamToElements(e);
  return e;
}

/** 시험 삭제: 딸린 트랙·모의고사 점수·오답·회고도 함께 지운다 (되돌리기 가능) */
export function deleteExam(id) {
  remove('exams', id);
  for (const t of all('tracks')) if (t.examId === id) remove('tracks', t.id);
  for (const m of all('mock')) if (m.examId === id) remove('mock', m.id);
  for (const w of all('wrongs')) if (w.examId === id) remove('wrongs', w.id);
  const r = get('reviews', id);
  if (r) remove('reviews', id);
  for (const t of all('tasks')) if (t.examId === id) update('tasks', t.id, { examId: undefined });
  for (const n of all('naesin')) {
    if ((n.elements || []).some((el) => el.examId === id)) {
      update('naesin', n.id, { elements: n.elements.map((el) => (el.examId === id ? { ...el, examId: null } : el)) });
    }
  }
}

/** 내신 시험을 등록하면 그 학기 과목 기록의 n차 지필에 자동 연결 (중간=1차, 기말=2차) */
function linkExamToElements(exam) {
  const idx = exam.kind === 'mid' ? 0 : 1;
  for (const rec of all('naesin')) {
    if (rec.semesterId !== exam.semesterId) continue;
    if (!(exam.subjectIds || []).includes(rec.subjectId)) continue;
    const els = rec.elements || [];
    if (els.some((el) => el.examId === exam.id)) continue;
    const examEls = els.filter((el) => el.kind === 'exam');
    const target = examEls[idx];
    if (target && !target.examId) {
      update('naesin', rec.id, { elements: els.map((el) => (el.id === target.id ? { ...el, examId: exam.id } : el)) });
    }
  }
}

// ---------- 할 일 ----------

export function addTask(data) {
  const t = put('tasks', {
    id: uid(),
    title: (data.title || '').trim(),
    subjectId: data.subjectId || null,
    date: data.date || today(),
    status: 'todo',
    importance: data.importance || 0,
    repeatTotal: data.repeatTotal || null,
    repeatDone: 0,
    dueDate: data.dueDate || null,
    estMinutes: data.estMinutes ?? null,
    actualMinutes: null,
    startTime: data.startTime || null,
    memo: data.memo || '',
    attachmentIds: [],
    moves: [],
    examId: data.examId,
    trackId: data.trackId || null,
    sectionId: data.sectionId || null,
    pageFrom: data.pageFrom ?? null,
    pageTo: data.pageTo ?? null,
    cells: data.cells || null,
    auto: !!data.auto,
  });
  return t;
}

export function saveTask(id, patch) {
  return update('tasks', id, patch);
}

function setDone(t, done) {
  if (done) return { status: 'done', doneAt: Date.now(), repeatDone: t.repeatTotal ? t.repeatTotal : t.repeatDone };
  return { status: 'todo', doneAt: null };
}

/** 체크 버튼: 반복 할 일은 한 칸씩 올라가고, 다 채운 상태에서 누르면 한 칸 내려간다 */
export function tapCheck(id) {
  const t = get('tasks', id);
  if (!t) return;
  if (t.status === 'dropped') {
    update('tasks', id, { status: 'todo', dropReason: null });
    return;
  }
  const total = t.repeatTotal && t.repeatTotal > 1 ? t.repeatTotal : 0;
  if (!total) {
    update('tasks', id, setDone(t, t.status !== 'done'));
    return;
  }
  const done = t.repeatDone || 0;
  if (done >= total) update('tasks', id, { repeatDone: total - 1, status: 'todo', doneAt: null });
  else if (done + 1 >= total) update('tasks', id, { repeatDone: total, status: 'done', doneAt: Date.now() });
  else update('tasks', id, { repeatDone: done + 1 });
}

export function completeTask(id) {
  const t = get('tasks', id);
  if (!t || t.status === 'done') return;
  update('tasks', id, setDone(t, true));
}

/**
 * 날짜 이동. 이미 도래한 날(오늘 이전/오늘)의 할 일을 뒤로 옮기면 '미룸' 기록을 남긴다.
 */
export function moveTask(id, toDate, reason = null) {
  const t = get('tasks', id);
  if (!t || !toDate || toDate === t.date) return;
  const now = today();
  const patch = { date: toDate };
  if (t.date && t.date <= now && toDate > t.date && t.status !== 'done') {
    patch.moves = [...(t.moves || []), { from: t.date, to: toDate, at: Date.now(), reason }];
  }
  if (t.status === 'dropped') {
    patch.status = 'todo';
    patch.dropReason = null;
  }
  update('tasks', id, patch);
}

export function dropTask(id, reason = null) {
  update('tasks', id, { status: 'dropped', dropReason: reason, droppedAt: Date.now() });
}

export function undropTask(id) {
  update('tasks', id, { status: 'todo', dropReason: null, droppedAt: null });
}

/** 방금 한 미룸/버림에 이유를 붙인다 */
export function setOutcomeReason(id, reason) {
  const t = get('tasks', id);
  if (!t) return;
  if (t.status === 'dropped') {
    update('tasks', id, { dropReason: reason });
    return;
  }
  const moves = t.moves || [];
  if (!moves.length) return;
  update('tasks', id, { moves: moves.map((m, i) => (i === moves.length - 1 ? { ...m, reason } : m)) });
}

export function deleteTask(id) {
  const t = get('tasks', id);
  if (!t) return;
  remove('tasks', id);
  for (const aid of t.attachmentIds || []) if (get('attachments', aid)) remove('attachments', aid);
}

export function duplicateTask(id, dates) {
  const t = get('tasks', id);
  if (!t) return [];
  return dates.map((d) =>
    addTask({
      ...t,
      date: d,
      examId: t.examId,
      trackId: null,
      sectionId: null,
      pageFrom: null,
      pageTo: null,
      cells: null,
      auto: false,
    }),
  );
}

// ---------- 첨부 이미지 ----------

async function compressImage(file, maxDim = 1600, quality = 0.82) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) throw new Error('압축 실패');
    return { blob, w, h };
  } catch {
    return { blob: file, w: null, h: null };
  }
}

export async function addAttachment(taskId, file) {
  const { blob, w, h } = await compressImage(file);
  const id = uid();
  await blobPut(id, blob);
  put('attachments', { id, taskId, mime: blob.type || 'image/jpeg', size: blob.size, w, h, uploaded: false });
  const t = get('tasks', taskId);
  if (t) update('tasks', taskId, { attachmentIds: [...(t.attachmentIds || []), id] });
  return id;
}

export function removeAttachment(taskId, attId) {
  remove('attachments', attId);
  const t = get('tasks', taskId);
  if (t) update('tasks', taskId, { attachmentIds: (t.attachmentIds || []).filter((x) => x !== attId) });
}

// ---------- 트랙 ----------

function sectionsFromTemplate(tpl) {
  return (tpl.sections || []).map((name) => ({ id: uid(8), name, textbookId: null, pageFrom: null, pageTo: null, manualPages: 0, completed: false }));
}

function gridFromTemplate(tpl) {
  return { passages: [], rounds: (tpl.rounds || []).map((name) => ({ id: uid(8), name })), cells: {} };
}

export function createTrack(examId, subjectId, { templateId = null, form = null } = {}) {
  const id = trackId(examId, subjectId);
  const existing = get('tracks', id);
  if (existing) return existing;
  const subj = subjectOf(subjectId);
  const tpl = templateById(templateId || (subj && subj.template) || 'basic');
  const f = form || (tpl ? tpl.form : 'linear');
  return put('tracks', {
    id,
    examId,
    subjectId,
    form: f,
    startDate: today(),
    pace: f === 'grid' ? 10 : 3,
    sections: f === 'linear' && tpl && tpl.form === 'linear' ? sectionsFromTemplate(tpl) : [],
    grid: f === 'grid' ? (tpl && tpl.form === 'grid' ? gridFromTemplate(tpl) : { passages: [], rounds: [], cells: {} }) : null,
  });
}

export function saveTrack(id, patch) {
  return update('tracks', id, patch);
}

export function applyTemplate(id, templateId) {
  const tr = get('tracks', id);
  const tpl = templateById(templateId);
  if (!tr || !tpl) return;
  if (tpl.form === 'grid') {
    const grid = tr.grid || { passages: [], rounds: [], cells: {} };
    update('tracks', id, { form: 'grid', grid: { ...grid, rounds: [...grid.rounds, ...gridFromTemplate(tpl).rounds] } });
  } else {
    update('tracks', id, { form: 'linear', sections: [...(tr.sections || []), ...sectionsFromTemplate(tpl)] });
  }
}

/** 다른 시험 트랙의 구성(섹션/지문·회독)을 복사한다. 진행 기록은 비운다. */
export function copyTrackStructure(targetId, sourceId, { examId, subjectId } = {}) {
  const src = get('tracks', sourceId);
  if (!src) return null;
  let tr = get('tracks', targetId);
  if (!tr && examId && subjectId) tr = createTrack(examId, subjectId, { form: src.form });
  if (!tr) return null;
  const sections = (src.sections || []).map((s) => ({ ...s, id: uid(8), manualPages: 0, completed: false }));
  const grid = src.grid
    ? { passages: (src.grid.passages || []).map((p) => ({ ...p })), rounds: (src.grid.rounds || []).map((r) => ({ ...r })), cells: {} }
    : null;
  return update('tracks', tr.id, { form: src.form, sections, grid, pace: src.pace || tr.pace });
}

export function addSection(id, data = {}) {
  const tr = get('tracks', id);
  if (!tr) return null;
  const sec = { id: uid(8), name: data.name || `${(tr.sections || []).length + 1}회독`, textbookId: data.textbookId || null, pageFrom: data.pageFrom ?? null, pageTo: data.pageTo ?? null, manualPages: 0, completed: false };
  update('tracks', id, { sections: [...(tr.sections || []), sec] });
  return sec;
}

export function saveSection(id, sectionId, patch) {
  const tr = get('tracks', id);
  if (!tr) return;
  update('tracks', id, { sections: tr.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)) });
}

export function removeSection(id, sectionId) {
  const tr = get('tracks', id);
  if (!tr) return;
  update('tracks', id, { sections: tr.sections.filter((s) => s.id !== sectionId) });
}

export function reorderSections(id, orderedIds) {
  const tr = get('tracks', id);
  if (!tr) return;
  const byId = new Map(tr.sections.map((s) => [s.id, s]));
  update('tracks', id, { sections: orderedIds.map((x) => byId.get(x)).filter(Boolean) });
}

// 격자
function gridOf(tr) {
  return tr.grid || { passages: [], rounds: [], cells: {} };
}

export function addPassages(id, names) {
  const tr = get('tracks', id);
  if (!tr) return;
  const g = gridOf(tr);
  update('tracks', id, { grid: { ...g, passages: [...g.passages, ...names.map((name) => ({ id: uid(8), name }))] } });
}

export function savePassage(id, pid, name) {
  const tr = get('tracks', id);
  const g = gridOf(tr);
  update('tracks', id, { grid: { ...g, passages: g.passages.map((p) => (p.id === pid ? { ...p, name } : p)) } });
}

export function removePassage(id, pid) {
  const tr = get('tracks', id);
  const g = gridOf(tr);
  const cells = { ...g.cells };
  for (const k of Object.keys(cells)) if (k.startsWith(pid + ':')) delete cells[k];
  update('tracks', id, { grid: { ...g, passages: g.passages.filter((p) => p.id !== pid), cells } });
}

export function addRound(id, name) {
  const tr = get('tracks', id);
  const g = gridOf(tr);
  update('tracks', id, { grid: { ...g, rounds: [...g.rounds, { id: uid(8), name: name || `${g.rounds.length + 1}회독` }] } });
}

export function saveRound(id, rid, name) {
  const tr = get('tracks', id);
  const g = gridOf(tr);
  update('tracks', id, { grid: { ...g, rounds: g.rounds.map((r) => (r.id === rid ? { ...r, name } : r)) } });
}

export function removeRound(id, rid) {
  const tr = get('tracks', id);
  const g = gridOf(tr);
  const cells = { ...g.cells };
  for (const k of Object.keys(cells)) if (k.endsWith(':' + rid)) delete cells[k];
  update('tracks', id, { grid: { ...g, rounds: g.rounds.filter((r) => r.id !== rid), cells } });
}

export function reorderRounds(id, orderedIds) {
  const tr = get('tracks', id);
  const g = gridOf(tr);
  const byId = new Map(g.rounds.map((r) => [r.id, r]));
  update('tracks', id, { grid: { ...g, rounds: orderedIds.map((x) => byId.get(x)).filter(Boolean) } });
}

export function setCell(id, key, value) {
  const tr = get('tracks', id);
  const g = gridOf(tr);
  update('tracks', id, { grid: { ...g, cells: { ...g.cells, [key]: value } } });
}

// ---------- 내신 ----------

export function ensureNaesin(semesterId, subjectId) {
  const id = naesinId(semesterId, subjectId);
  const cur = get('naesin', id);
  if (cur) return cur;
  const s = subjectOf(subjectId);
  return put('naesin', {
    id,
    semesterId,
    subjectId,
    credits: s ? s.credits : null,
    category: s ? s.category : 'grade',
    elements: [],
    final: {},
  });
}

export function saveNaesin(id, patch) {
  return update('naesin', id, patch);
}

export function addElement(recId, kind) {
  const rec = get('naesin', recId);
  if (!rec) return null;
  const els = rec.elements || [];
  const n = els.filter((e) => e.kind === kind).length + 1;
  const el =
    kind === 'exam'
      ? { id: uid(8), kind, name: `${n}차 지필`, weight: 30, max: 100, score: null, examId: autoExamLink(rec, n - 1) }
      : { id: uid(8), kind, name: `수행평가 ${n}`, weight: 10, max: 10, score: null };
  update('naesin', recId, { elements: [...els, el] });
  return el;
}

function autoExamLink(rec, idx) {
  const kind = idx === 0 ? 'mid' : idx === 1 ? 'final' : null;
  if (!kind) return null;
  const e = examsSorted().find((x) => x.semesterId === rec.semesterId && x.kind === kind && (x.subjectIds || []).includes(rec.subjectId));
  return e ? e.id : null;
}

export function saveElement(recId, elId, patch) {
  const rec = get('naesin', recId);
  if (!rec) return;
  update('naesin', recId, { elements: rec.elements.map((e) => (e.id === elId ? { ...e, ...patch } : e)) });
  autoAchievement(recId);
}

export function removeElement(recId, elId) {
  const rec = get('naesin', recId);
  if (!rec) return;
  update('naesin', recId, { elements: rec.elements.filter((e) => e.id !== elId) });
  autoAchievement(recId);
}

export function reorderElements(recId, orderedIds) {
  const rec = get('naesin', recId);
  if (!rec) return;
  const byId = new Map(rec.elements.map((e) => [e.id, e]));
  update('naesin', recId, { elements: orderedIds.map((x) => byId.get(x)).filter(Boolean) });
}

/** 평가 구성(이름·반영비율·만점)만 복사 — 점수와 석차는 비운다 */
export function copyElementsFrom(recId, fromRecId) {
  const src = get('naesin', fromRecId);
  if (!src) return;
  const rec = get('naesin', recId);
  const els = (src.elements || []).map((e) => ({ id: uid(8), kind: e.kind, name: e.name, weight: e.weight, max: e.max, score: null, examId: null }));
  let examIdx = 0;
  for (const e of els) if (e.kind === 'exam') e.examId = autoExamLink(rec, examIdx++);
  update('naesin', recId, { elements: els });
}

export function saveFinal(recId, patch) {
  const rec = get('naesin', recId);
  if (!rec) return;
  const final = { ...(rec.final || {}), ...patch };
  if ('achievement' in patch) final.achievementManual = patch.achievement != null;
  update('naesin', recId, { final });
  if ('achievement' in patch && patch.achievement == null) autoAchievement(recId);
}

/** 성취도는 원점수로 자동 채움 (사용자가 직접 고른 값이 있으면 유지) */
function autoAchievement(recId) {
  const rec = get('naesin', recId);
  if (!rec) return;
  const f = rec.final || {};
  if (f.achievementManual) return;
  const raw = computeRecord(rec.elements || []).raw;
  const a = rec.category === 'achievement' ? f.achievement ?? null : achievementFromRaw(raw);
  if ((f.achievement ?? null) !== a) update('naesin', recId, { final: { ...f, achievement: a } });
}

// ---------- 모의고사 ----------

export function ensureMock(examId, subjectId) {
  const id = mockId(examId, subjectId);
  const cur = get('mock', id);
  if (cur) return cur;
  const s = subjectOf(subjectId);
  return put('mock', { id, examId, subjectId, absolute: isAbsoluteMockSubject(s ? s.name : ''), raw: null, standard: null, percentile: null, grade: null });
}

export function saveMock(id, patch) {
  return update('mock', id, patch);
}

// ---------- 오답 / 회고 ----------

export function addWrong(examId, subjectId, item) {
  const id = `${examId}:${subjectId}`;
  const cur = get('wrongs', id) || { id, examId, subjectId, items: [] };
  const it = { id: uid(8), no: item.no ?? null, cause: item.cause || null };
  put('wrongs', { ...cur, items: [...(cur.items || []), it] });
  return it;
}

export function saveWrong(examId, subjectId, itemId, patch) {
  const id = `${examId}:${subjectId}`;
  const cur = get('wrongs', id);
  if (!cur) return;
  update('wrongs', id, { items: cur.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) });
}

export function removeWrong(examId, subjectId, itemId) {
  const id = `${examId}:${subjectId}`;
  const cur = get('wrongs', id);
  if (!cur) return;
  update('wrongs', id, { items: cur.items.filter((i) => i.id !== itemId) });
}

export function setReview(examId, note) {
  const cur = get('reviews', examId);
  if (!note && !cur) return;
  put('reviews', { ...(cur || {}), id: examId, examId, note });
}
