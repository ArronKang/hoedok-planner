// 내신 성적 계산 (NEIS 성적표 구조 기준)
//
// 평가요소(element): { id, kind: 'exam'(정기시험/지필) | 'perf'(수행평가), name, weight(반영비율 %),
//   max(만점), score(받은 점수 | null), examId?(연결된 시험), rank?, tie?(동석차수), enrolled?, avg? }
//
// 환산점수 = 받은점수 ÷ 만점 × 반영비율 (소수 셋째 자리에서 반올림 → 둘째 자리)
//   - 정기시험(만점 100, 반영 30%): 92.40 → 27.72
//   - 수행평가는 보통 만점 = 반영비율이라 받은 점수가 그대로 들어간다 (17/20×20 = 17)
// 합계 = Σ 환산점수 (소수 둘째 자리)
// 원점수 = 합계를 소수 첫째 자리에서 반올림한 정수 (모든 평가요소 점수가 입력됐을 때만)
// 석차등급은 동석차 처리 규칙 때문에 계산하지 않는다 → 학교 확정값을 입력받는다.

import { roundHalfUp } from '../num.js';

export const ACHIEVEMENT_LEVELS = ['A', 'B', 'C', 'D', 'E'];
export const DEFAULT_THRESHOLDS = [90, 80, 70, 60];

const isNum = (v) => typeof v === 'number' && isFinite(v);

/** 한 평가요소의 환산점수. 점수 미입력이면 null */
export function contribution(el) {
  if (!el || !isNum(el.score) || !isNum(el.max) || el.max <= 0 || !isNum(el.weight)) return null;
  return roundHalfUp((el.score / el.max) * el.weight, 2);
}

/** 한 평가요소에서 잃은 점수 (반영비율 − 환산점수). 점수 미입력이면 null */
export function lostOf(el) {
  const c = contribution(el);
  if (c == null) return null;
  return roundHalfUp(el.weight - c, 2);
}

const toHundredths = (x) => Math.round(x * 100);

/**
 * 과목 기록 계산.
 * @returns {{ total:number|null, runningTotal:number, raw:number|null, weightSum:number,
 *   scoredWeight:number, remainingWeight:number, complete:boolean, contributions:Object }}
 */
export function computeRecord(elements = []) {
  let totalH = 0;
  let weightSum = 0;
  let scoredWeight = 0;
  let scoredCount = 0;
  const contributions = {};
  for (const el of elements) {
    const w = isNum(el.weight) ? el.weight : 0;
    weightSum += w;
    const c = contribution(el);
    contributions[el.id] = c;
    if (c != null) {
      totalH += toHundredths(c);
      scoredWeight += w;
      scoredCount++;
    }
  }
  const complete = elements.length > 0 && scoredCount === elements.length;
  const runningTotal = totalH / 100;
  const total = complete ? runningTotal : null;
  return {
    total,
    runningTotal,
    raw: complete ? roundHalfUp(runningTotal, 0) : null,
    weightSum: roundHalfUp(weightSum, 2),
    scoredWeight: roundHalfUp(scoredWeight, 2),
    remainingWeight: roundHalfUp(weightSum - scoredWeight, 2),
    complete,
    contributions,
  };
}

/** 원점수 → 성취도 (기본 90/80/70/60). 사용자가 나중에 수정할 수 있다. */
export function achievementFromRaw(raw, thresholds = DEFAULT_THRESHOLDS) {
  if (!isNum(raw)) return null;
  for (let i = 0; i < thresholds.length; i++) if (raw >= thresholds[i]) return ACHIEVEMENT_LEVELS[i];
  return ACHIEVEMENT_LEVELS[thresholds.length];
}

/**
 * 석차 백분율(상위 %). 동석차가 있으면 중간석차 = 석차 + (동석차수 − 1) ÷ 2 를 쓴다.
 */
export function rankPercent(rank, enrolled, tie = 1) {
  if (!isNum(rank) || !isNum(enrolled) || enrolled <= 0 || rank <= 0) return null;
  const t = isNum(tie) && tie >= 1 ? tie : 1;
  return roundHalfUp(((rank + (t - 1) / 2) / enrolled) * 100, 2);
}

/** 평가요소별 감점 분해 */
export function lostBreakdown(elements = []) {
  const items = [];
  let examH = 0;
  let perfH = 0;
  for (const el of elements) {
    const lost = lostOf(el);
    items.push({ id: el.id, name: el.name, kind: el.kind, weight: el.weight, lost });
    if (lost != null) {
      if (el.kind === 'exam') examH += toHundredths(lost);
      else perfH += toHundredths(lost);
    }
  }
  return { items, exam: examH / 100, perf: perfH / 100, total: (examH + perfH) / 100 };
}

/**
 * 학점 가중 평균 등급 = Σ(등급 × 학점) ÷ Σ학점.
 * 성취도만 나오는 과목(체육·예술·과학탐구실험 등)과 등급 미확정 과목은 제외.
 * records: [{ category: 'grade'|'achievement', credits, rankGrade }]
 */
export function weightedAverageGrade(records = []) {
  let num = 0;
  let den = 0;
  let count = 0;
  for (const r of records) {
    if (r.category === 'achievement') continue;
    if (!isNum(r.rankGrade) || !isNum(r.credits) || r.credits <= 0) continue;
    num += r.rankGrade * r.credits;
    den += r.credits;
    count++;
  }
  if (!den) return { avg: null, credits: 0, count: 0 };
  return { avg: roundHalfUp(num / den, 2), credits: den, count };
}

/** 과목평균 대비 차이 (내 점수 − 평균) */
export function diffFromAvg(score, avg) {
  if (!isNum(score) || !isNum(avg)) return null;
  return roundHalfUp(score - avg, 2);
}
