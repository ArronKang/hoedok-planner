// 시험 소속 관계. 모든 할 일/트랙은 어느 시험을 위한 것인지에 묶인다.
// 할 일에 시험을 직접 지정하지 않으면(자동), 그 과목을 포함하는 시험 중
// 할 일 날짜 이후 가장 가까운 시험에 속한 것으로 본다. 'none'이면 시험과 무관.

export function sortExams(exams) {
  return [...exams].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function autoExamFor(subjectId, date, examsSorted) {
  if (!subjectId || !date) return null;
  for (const e of examsSorted) {
    if (e.date >= date && (e.subjectIds || []).includes(subjectId)) return e;
  }
  return null;
}

export function resolveExamId(task, examsSorted, examById) {
  if (task.examId === 'none') return null;
  if (task.examId) return examById && !examById.has(task.examId) ? null : task.examId;
  const e = autoExamFor(task.subjectId, task.date, examsSorted);
  return e ? e.id : null;
}

export const EXAM_KINDS = {
  mid: { label: '중간고사', short: '중간', naesin: true },
  final: { label: '기말고사', short: '기말', naesin: true },
  mock: { label: '모의고사', short: '모의', naesin: false },
  other: { label: '기타 시험', short: '시험', naesin: false },
};

export function isNaesinExam(exam) {
  return !!(exam && EXAM_KINDS[exam.kind] && EXAM_KINDS[exam.kind].naesin);
}

/** 같은 종류 계열(내신/모의)에서 바로 이전 시험 */
export function previousExam(exam, examsSorted) {
  const naesin = isNaesinExam(exam);
  let prev = null;
  for (const e of examsSorted) {
    if (e.id === exam.id) break;
    if (isNaesinExam(e) === naesin && e.kind !== 'other') prev = e;
  }
  return prev;
}
