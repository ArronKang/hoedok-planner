import { test, eq, approx, ok } from './harness.js';
import { roundHalfUp, fmtSigned, fmtNum, toNum } from '../src/core/num.js';
import { contribution, computeRecord, achievementFromRaw, rankPercent, lostBreakdown, weightedAverageGrade, diffFromAvg } from '../src/core/calc/naesin.js';
import { addDays, diffDays, weekday, logicalToday, monthMatrix, addMonths, ddayLabel, minutesLabel, rangeKeys, startOfWeek, timeToMin } from '../src/core/date.js';

// ---------------- 숫자 ----------------

test('반올림: 부동소수 오차 흡수', () => {
  eq(roundHalfUp(92.4 * 0.3, 2), 27.72);
  eq(roundHalfUp(1.005, 2), 1.01);
  eq(roundHalfUp(90.63, 0), 91);
  eq(roundHalfUp(97.5, 0), 98);
  eq(roundHalfUp(-1.005, 2), -1.01);
  eq(roundHalfUp(2.675, 2), 2.68);
});

test('표시: 부호/숫자 파싱', () => {
  eq(fmtSigned(2.28, 2, true), '+2.28');
  eq(fmtSigned(-3.09, 2, true), '−3.09');
  eq(fmtSigned(-1, 2, true), '−1.00');
  eq(fmtSigned(0), '±0');
  eq(fmtNum(18.456, 1), '18.5');
  eq(toNum(' 92.40 '), 92.4);
  eq(toNum(''), null);
  eq(toNum('abc'), null);
});

// ---------------- 내신 ----------------

// 예시 과목 (지어낸 점수): 지필 두 번 + 수행 세 가지 = 90.63
const 예시 = [
  { id: 'e1', kind: 'exam', name: '1차 시험', weight: 30, max: 100, score: 92.4 },
  { id: 'e2', kind: 'exam', name: '2차 시험', weight: 30, max: 100, score: 89.7 },
  { id: 'p1', kind: 'perf', name: '보고서 쓰기', weight: 20, max: 20, score: 17 },
  { id: 'p2', kind: 'perf', name: '발표', weight: 10, max: 10, score: 9 },
  { id: 'p3', kind: 'perf', name: '포트폴리오', weight: 10, max: 10, score: 10 },
];

test('내신: 예시 과목 합계 = 90.63, 원점수 91', () => {
  const r = computeRecord(예시);
  eq(r.total, 90.63);
  eq(r.raw, 91);
  eq(r.weightSum, 100);
  eq(r.remainingWeight, 0);
  eq(r.complete, true);
  eq(r.contributions.e1, 27.72);
  eq(r.contributions.e2, 26.91);
  eq(r.contributions.p1, 17);
});

test('내신: 중간고사만 본 시점 (진행 중, 남은 반영 70%)', () => {
  const partial = 예시.map((e) => (e.id === 'e1' ? e : { ...e, score: null }));
  const r = computeRecord(partial);
  eq(r.complete, false);
  eq(r.total, null);
  eq(r.raw, null);
  eq(r.runningTotal, 27.72);
  eq(r.scoredWeight, 30);
  eq(r.remainingWeight, 70);
});

test('내신: 수행평가 만점≠반영비율이면 환산', () => {
  eq(contribution({ weight: 20, max: 100, score: 85 }), 17);
  eq(contribution({ weight: 15, max: 50, score: 37.5 }), 11.25);
  eq(contribution({ weight: 30, max: 100, score: null }), null);
  eq(contribution({ weight: 30, max: 0, score: 10 }), null);
});

test('내신: 반영비율 합계가 100이 아니면 그대로 보고', () => {
  const r = computeRecord([
    { id: 'a', kind: 'exam', weight: 30, max: 100, score: 90 },
    { id: 'b', kind: 'perf', weight: 60, max: 60, score: 50 },
  ]);
  eq(r.weightSum, 90);
  eq(r.total, 77);
});

test('내신: 감점 분해 (1차 −2.28 / 2차 −3.09 / 수행 −4.00)', () => {
  const b = lostBreakdown(예시);
  eq(b.items.find((i) => i.id === 'e1').lost, 2.28);
  eq(b.items.find((i) => i.id === 'e2').lost, 3.09);
  eq(b.perf, 4);
  eq(b.exam, 5.37);
  eq(b.total, 9.37);
  approx(100 - computeRecord(예시).total, b.total, 1e-9);
});

test('내신: 성취도 자동 채움 90/80/70/60', () => {
  eq(achievementFromRaw(97), 'A');
  eq(achievementFromRaw(90), 'A');
  eq(achievementFromRaw(89), 'B');
  eq(achievementFromRaw(70), 'C');
  eq(achievementFromRaw(60), 'D');
  eq(achievementFromRaw(59), 'E');
  eq(achievementFromRaw(null), null);
});

test('내신: 석차 백분율 (동석차 → 중간석차)', () => {
  eq(rankPercent(12, 240), 5);
  eq(rankPercent(12, 240, 3), 5.42); // (12 + 1) / 240 = 5.4166…
  eq(rankPercent(1, 0), null);
  eq(rankPercent(null, 100), null);
});

test('내신: 학점 가중 평균 등급 (성취도 과목 제외)', () => {
  const r = weightedAverageGrade([
    { category: 'grade', credits: 4, rankGrade: 1 },
    { category: 'grade', credits: 4, rankGrade: 2 },
    { category: 'grade', credits: 3, rankGrade: 3 },
    { category: 'achievement', credits: 2, rankGrade: 5 },
    { category: 'grade', credits: 4, rankGrade: null },
  ]);
  eq(r.avg, 1.91); // (4+8+9)/11 = 1.909…
  eq(r.credits, 11);
  eq(r.count, 3);
  eq(weightedAverageGrade([]).avg, null);
});

test('내신: 평균 대비', () => {
  eq(diffFromAvg(92.4, 71.25), 21.15);
  eq(diffFromAvg(null, 70), null);
});

// ---------------- 날짜 ----------------

test('날짜: 더하기/차이/요일', () => {
  eq(addDays('2026-09-28', 3), '2026-10-01');
  eq(addDays('2026-03-01', -1), '2026-02-28');
  eq(addDays('2028-03-01', -1), '2028-02-29');
  eq(diffDays('2026-09-28', '2026-10-10'), 12);
  eq(diffDays('2026-10-10', '2026-09-28'), -12);
  eq(weekday('2026-09-28'), 1); // 월
  eq(rangeKeys('2026-09-29', '2026-10-02'), ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
  eq(startOfWeek('2026-10-01'), '2026-09-27');
  eq(timeToMin('19:30'), 1170);
});

test('날짜: 하루 기준 시각(새벽 4시) 적용', () => {
  eq(logicalToday(4, new Date(2026, 8, 29, 1, 30)), '2026-09-28');
  eq(logicalToday(4, new Date(2026, 8, 29, 4, 0)), '2026-09-29');
  eq(logicalToday(0, new Date(2026, 8, 29, 0, 10)), '2026-09-29');
});

test('날짜: 달력 행렬', () => {
  const w = monthMatrix('2026-09');
  eq(w[0][0], '2026-08-30');
  eq(w[0][2], '2026-09-01');
  ok(w.length >= 5);
  eq(w[w.length - 1][6] >= '2026-09-30', true);
  eq(addMonths('2026-12', 1), '2027-01');
  eq(addMonths('2026-01', -1), '2025-12');
});

test('날짜: 라벨', () => {
  eq(ddayLabel(12), 'D-12');
  eq(ddayLabel(0), 'D-DAY');
  eq(ddayLabel(-2), 'D+2');
  eq(minutesLabel(160), '2시간 40분');
  eq(minutesLabel(45), '45분');
  eq(minutesLabel(180), '3시간');
});

