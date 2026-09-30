import { test, eq, approx, ok } from './harness.js';
import { roundHalfUp, fmtSigned, fmtNum, toNum } from '../src/core/num.js';
import { contribution, computeRecord, achievementFromRaw, rankPercent, lostBreakdown, weightedAverageGrade, diffFromAvg } from '../src/core/calc/naesin.js';
import { addDays, diffDays, weekday, logicalToday, monthMatrix, addMonths, ddayLabel, minutesLabel, rangeKeys, startOfWeek, timeToMin } from '../src/core/date.js';
import { linearProgress, gridProgress, progressNumbers, trackProgress, sectionSize, cellValue, nextCellValue } from '../src/core/calc/track.js';
import { allocate, linearUnits, gridUnits, chunkTitle } from '../src/core/calc/distribute.js';
import { planOutcomes, summarize, reasonCounts, estVsActual } from '../src/core/calc/stats.js';
import { resolveExamId, sortExams, previousExam } from '../src/core/calc/exam.js';

// ---------------- 숫자 ----------------

// ---------------- 회독 트랙 ----------------

const secs = [
  { id: 's1', name: '개념 1회독', pageFrom: 1, pageTo: 100 },
  { id: 's2', name: '기본문제 2회독', pageFrom: 1, pageTo: 50, manualPages: 10 },
  { id: 's3', name: '개념 3회독', pageFrom: 1, pageTo: 100 },
];

test('트랙: 페이지 가중 진행률', () => {
  const p = linearProgress(secs, new Map([['s1', 100], ['s3', 25]]));
  eq(p.total, 250);
  eq(p.done, 135);
  approx(p.pct, 0.54);
  eq(p.rows.map((r) => r.status), ['done', 'doing', 'doing']);
  eq(p.counts, { done: 1, doing: 2, todo: 0 });
  eq(p.amountTotal - p.amountDone, 115);
});

test('트랙: 완료 표시/보정값 클램프/쪽 미지정 섹션', () => {
  const p = linearProgress(
    [
      { id: 'a', pageFrom: 1, pageTo: 10, completed: true },
      { id: 'b', pageFrom: 1, pageTo: 30, manualPages: 50 },
      { id: 'c' },
    ],
    new Map(),
  );
  eq(p.rows[0].done, 10);
  eq(p.rows[1].done, 30);
  eq(p.rows[2].weight, 20); // 평균 분량
  eq(p.unsized, 1);
  approx(p.pct, 40 / 60);
  eq(sectionSize({ pageFrom: 5, pageTo: 4 }), null);
});

test('트랙: 격자 진행률과 약한 지문', () => {
  const grid = {
    passages: [
      { id: 'p1', name: '1강-1' },
      { id: 'p2', name: '1강-2' },
    ],
    rounds: [
      { id: 'r1', name: '해석' },
      { id: 'r2', name: '어법' },
    ],
    cells: { 'p1:r1': 'o', 'p2:r1': 'x', 'p2:r2': 't', 'p1:r2': '' },
  };
  const g = gridProgress(grid, new Set(['p1:r2']));
  eq(g.total, 4);
  eq(g.done, 3); // p1:r2는 직접 지운 값('')이 우선
  eq(g.rows[1].weak, 2);
  eq(g.rounds.map((r) => r.status), ['done', 'doing']);
  eq(cellValue(grid, 'p9:r1', new Set(['p9:r1'])), 'o');
  eq(nextCellValue(''), 'o');
  eq(nextCellValue('x'), '');
});

test('트랙: 할 일 완료가 진행률에 반영', () => {
  const track = { form: 'linear', sections: secs };
  const tasks = [
    { status: 'done', sectionId: 's1', pageFrom: 1, pageTo: 40 },
    { status: 'todo', sectionId: 's1', pageFrom: 41, pageTo: 60 },
    { status: 'done', sectionId: 's3', pageFrom: 1, pageTo: 10 },
  ];
  const p = trackProgress(track, tasks);
  eq(p.rows[0].done, 40);
  eq(p.rows[2].done, 10);
});

test('진도 현황 숫자: 남은 분량/남은 일수/일평균/필요 처리량', () => {
  const n = progressNumbers({ remaining: 312, done: 148, startDate: '2026-09-21', examDate: '2026-10-10', today: '2026-09-28' });
  eq(n.remaining, 312);
  eq(n.daysLeft, 12);
  eq(n.elapsed, 8);
  eq(n.avgPerDay, 18.5);
  eq(n.requiredPerDay, 26);
});

test('진도 현황 숫자: 시험 당일/지난 시험', () => {
  const n = progressNumbers({ remaining: 10, done: 0, startDate: '2026-10-10', examDate: '2026-10-10', today: '2026-10-10' });
  eq(n.daysLeft, 0);
  eq(n.requiredPerDay, null);
  eq(n.avgPerDay, 0);
  const m = progressNumbers({ remaining: 5, done: 5, startDate: '2026-10-01', examDate: '2026-10-05', today: '2026-10-08' });
  eq(m.daysLeft, 0);
});

// ---------------- 자동 배분 ----------------

test('배분: 선형 남은 쪽 단위 (완료/예정 제외)', () => {
  const u = linearUnits(
    [
      { id: 'a', pageFrom: 10, pageTo: 19, manualPages: 2 },
      { id: 'b', pageFrom: 1, pageTo: 5, completed: true },
      { id: 'c' },
    ],
    new Map([['a', 3]]),
    new Map([['a', 1]]),
  );
  eq(u.map((x) => x.n), [16, 17, 18, 19]);
});

test('배분: 가용 시간 안에서 비례 배분 + 남은 분량 보고', () => {
  const q1 = { key: 'math', pace: 3, units: Array.from({ length: 60 }, (_, i) => ({ sectionId: 's', n: i + 1 })) };
  const q2 = { key: 'soc', pace: 2, units: Array.from({ length: 30 }, (_, i) => ({ sectionId: 't', n: i + 1 })) };
  const days = [
    { date: '2026-09-28', capacity: 120 },
    { date: '2026-09-29', capacity: 0 },
    { date: '2026-09-30', capacity: 60 },
  ];
  const r = allocate({ days, queues: [q1, q2], mode: 'fit' });
  // 총 작업량 180+60=240분, 가용 180분
  ok(r.load['2026-09-28'] <= 120, '첫날 가용 초과 없음');
  ok(!r.load['2026-09-29'], '가용 0인 날은 비움');
  ok(r.load['2026-09-30'] <= 60);
  const assigned = r.chunks.reduce((s, c) => s + c.units.length, 0);
  eq(assigned + r.leftover.math + r.leftover.soc, 90);
  ok(r.leftover.math + r.leftover.soc > 0, '넘치는 분량은 남은 것으로 보고');
  // 쪽 번호는 이어진다
  const mathChunks = r.chunks.filter((c) => c.key === 'math');
  eq(mathChunks[0].units[0].n, 1);
  eq(mathChunks[1].units[0].n, mathChunks[0].units[mathChunks[0].units.length - 1].n + 1);
});

test('배분: 모두 들어가면 남는 분량 0', () => {
  const q = { key: 'k', pace: 5, units: Array.from({ length: 10 }, (_, i) => ({ sectionId: 's', n: i + 1 })) };
  const r = allocate({ days: [{ date: 'd1', capacity: 30 }, { date: 'd2', capacity: 30 }], queues: [q] });
  eq(r.leftover.k, 0);
  eq(r.load.d1, 30);
  eq(r.load.d2, 20);
});

test('배분: 섹션 경계에서 조각을 나눔', () => {
  const units = [
    { sectionId: 'a', n: 9 },
    { sectionId: 'a', n: 10 },
    { sectionId: 'b', n: 1 },
    { sectionId: 'b', n: 2 },
  ];
  const r = allocate({ days: [{ date: 'd1', capacity: 100 }], queues: [{ key: 'k', pace: 1, units }] });
  eq(r.chunks.length, 2);
  eq(chunkTitle(r.chunks[0], '개념'), '개념 p.9–10');
  eq(chunkTitle(r.chunks[1], '문제'), '문제 p.1–2');
});

test('배분: 균등 모드 (가용 시간 초과 허용)', () => {
  const q = { key: 'k', pace: 10, units: Array.from({ length: 7 }, (_, i) => ({ sectionId: 's', n: i + 1 })) };
  const r = allocate({ days: [{ date: 'd1', capacity: 10 }, { date: 'd2', capacity: 0 }, { date: 'd3', capacity: 10 }], queues: [q], mode: 'even' });
  eq(r.leftover.k, 0);
  eq(r.load.d1, 40);
  eq(r.load.d3, 30);
  ok(!r.load.d2);
});

test('배분: 격자 단위와 제목', () => {
  const grid = {
    passages: [
      { id: 'p1', name: '1강-1' },
      { id: 'p2', name: '1강-2' },
      { id: 'p3', name: '1강-3' },
    ],
    rounds: [{ id: 'r1', name: '해석' }],
  };
  const u = gridUnits(grid, (k) => k === 'p1:r1');
  eq(u.map((x) => x.cell), ['p2:r1', 'p3:r1']);
  eq(chunkTitle({ units: u }, '1회독 · 해석'), '1회독 · 해석 · 1강-2–1강-3 (2지문)');
});

// ---------------- 실행 통계 ----------------

test('통계: 계획 결과 펼치기와 실행률', () => {
  const tasks = [
    { id: 1, date: '2026-09-27', status: 'done' },
    { id: 2, date: '2026-09-28', status: 'todo', moves: [{ from: '2026-09-26', to: '2026-09-27', reason: '시간 부족' }, { from: '2026-09-27', to: '2026-09-28' }] },
    { id: 3, date: '2026-09-26', status: 'dropped', dropReason: '필요 없어짐' },
    { id: 4, date: '2026-09-25', status: 'todo' },
    { id: 5, date: '2026-09-30', status: 'todo' },
  ];
  const o = planOutcomes(tasks, { from: '2026-09-25', to: '2026-09-30', today: '2026-09-28' });
  const s = summarize(o);
  // 완료 1 + 미룸 2 + 버림 1 + 미처리 1 (오늘·미래 미완료는 제외)
  eq(s.planned, 5);
  eq(s.done, 1);
  eq(s.postponed, 2);
  eq(s.dropped, 1);
  eq(s.missed, 1);
  approx(s.rate, 1 / 5);
  const rc = reasonCounts(o);
  eq(rc.find((r) => r.reason === '시간 부족').postponed, 1);
  eq(rc.find((r) => r.reason === '필요 없어짐').dropped, 1);
  eq(rc.find((r) => r.reason === '이유 없음').postponed, 1);
});

test('통계: 예상 vs 실제', () => {
  const r = estVsActual([
    { status: 'done', date: '2026-09-28', estMinutes: 30, actualMinutes: 45 },
    { status: 'done', date: '2026-09-28', estMinutes: 60, actualMinutes: 50 },
    { status: 'done', date: '2026-09-28', estMinutes: 20 },
    { status: 'todo', date: '2026-09-28', estMinutes: 20, actualMinutes: 10 },
  ]);
  eq(r.count, 2);
  eq(r.est, 90);
  eq(r.actual, 95);
});

// ---------------- 시험 소속 ----------------

test('시험 소속: 자동 = 날짜 이후 그 과목의 가장 가까운 시험', () => {
  const exams = sortExams([
    { id: 'mock', kind: 'mock', date: '2026-10-15', subjectIds: ['kor', 'math'] },
    { id: 'mid', kind: 'mid', date: '2026-10-10', subjectIds: ['math', 'soc'] },
    { id: 'fin', kind: 'final', date: '2026-12-10', subjectIds: ['math', 'soc', 'kor'] },
  ]);
  const byId = new Map(exams.map((e) => [e.id, e]));
  eq(resolveExamId({ subjectId: 'math', date: '2026-10-01' }, exams, byId), 'mid');
  eq(resolveExamId({ subjectId: 'kor', date: '2026-10-01' }, exams, byId), 'mock');
  eq(resolveExamId({ subjectId: 'math', date: '2026-10-11' }, exams, byId), 'mock');
  eq(resolveExamId({ subjectId: 'soc', date: '2026-10-11' }, exams, byId), 'fin');
  eq(resolveExamId({ subjectId: 'soc', date: '2026-10-01', examId: 'none' }, exams, byId), null);
  eq(resolveExamId({ subjectId: 'soc', date: '2026-10-01', examId: 'fin' }, exams, byId), 'fin');
  eq(resolveExamId({ subjectId: 'soc', date: '2026-10-01', examId: 'gone' }, exams, byId), null);
  eq(previousExam(exams[2], exams).id, 'mid');
  eq(previousExam(exams[1], exams), null);
});
