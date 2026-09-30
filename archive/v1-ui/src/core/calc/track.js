// 회독 트랙 진행률과 진도 현황 숫자 (예측 없이 사실 수치만)
//
// 선형 트랙: sections = [{ id, name, textbookId?, pageFrom?, pageTo?, manualPages(보정값), completed }]
//   섹션 진행(쪽) = completed ? 전체 : clamp(manualPages + 완료한 연결 할 일의 쪽수, 0, 전체)
//   통합 진행률 = Σ완료 쪽 ÷ Σ전체 쪽 (쪽 범위가 없는 섹션은 다른 섹션의 평균 분량으로 취급)
// 격자 트랙: grid = { passages:[{id,name}], rounds:[{id,name}], cells:{ 'pid:rid': 'o'|'t'|'x'|'' } }
//   칸 값: 직접 표시한 값이 우선, 없으면 완료한 연결 할 일에 포함된 칸은 'o'
//   'o' 잘됨, 't' 애매(△), 'x' 약함(✕). 표시가 있으면 한 것으로 센다.

import { clamp, roundHalfUp } from '../num.js';
import { diffDays } from '../date.js';

export function sectionSize(sec) {
  const a = sec && sec.pageFrom;
  const b = sec && sec.pageTo;
  if (typeof a !== 'number' || typeof b !== 'number' || !isFinite(a) || !isFinite(b) || b < a) return null;
  return b - a + 1;
}

export function taskPages(task) {
  if (typeof task.pageFrom !== 'number' || typeof task.pageTo !== 'number' || task.pageTo < task.pageFrom) return 0;
  return task.pageTo - task.pageFrom + 1;
}

/** 완료된 할 일의 섹션별 쪽수 합 */
export function donePagesBySection(tasks) {
  const m = new Map();
  for (const t of tasks) {
    if (t.status !== 'done' || !t.sectionId) continue;
    const p = taskPages(t);
    if (p) m.set(t.sectionId, (m.get(t.sectionId) || 0) + p);
  }
  return m;
}

/** 완료된 할 일이 덮는 격자 칸 */
export function doneCells(tasks) {
  const s = new Set();
  for (const t of tasks) if (t.status === 'done' && Array.isArray(t.cells)) for (const c of t.cells) s.add(c);
  return s;
}

export function statusOf(done, size) {
  if (size > 0 && done >= size - 1e-9) return 'done';
  if (done > 0) return 'doing';
  return 'todo';
}

export function linearProgress(sections = [], pagesMap = new Map()) {
  const sizes = sections.map(sectionSize);
  const known = sizes.filter((s) => s != null);
  const avg = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 1;
  let total = 0;
  let done = 0;
  let pagesTotal = 0;
  let pagesDone = 0;
  let unsized = 0;
  const rows = sections.map((sec, i) => {
    const size = sizes[i];
    const weight = size != null ? size : avg;
    let d;
    if (sec.completed) d = weight;
    else if (size != null) d = clamp((sec.manualPages || 0) + (pagesMap.get(sec.id) || 0), 0, size);
    else d = 0;
    total += weight;
    done += d;
    if (size != null) {
      pagesTotal += size;
      pagesDone += d;
    } else unsized++;
    return { id: sec.id, size, weight, done: d, pct: weight ? d / weight : 0, status: statusOf(d, weight) };
  });
  const counts = { done: 0, doing: 0, todo: 0 };
  for (const r of rows) counts[r.status]++;
  return {
    form: 'linear',
    rows,
    total,
    done,
    pct: total ? done / total : 0,
    unit: '쪽',
    amountTotal: pagesTotal,
    amountDone: pagesDone,
    unsized,
    counts,
  };
}

export const CELL_CYCLE = ['', 'o', 't', 'x'];

export function cellKey(passageId, roundId) {
  return `${passageId}:${roundId}`;
}

export function cellValue(grid, key, covered) {
  const cells = (grid && grid.cells) || {};
  if (Object.prototype.hasOwnProperty.call(cells, key)) return cells[key] || '';
  return covered && covered.has(key) ? 'o' : '';
}

export function nextCellValue(v) {
  const i = CELL_CYCLE.indexOf(v || '');
  return CELL_CYCLE[(i + 1) % CELL_CYCLE.length];
}

export function gridProgress(grid, covered = new Set()) {
  const passages = (grid && grid.passages) || [];
  const rounds = (grid && grid.rounds) || [];
  let done = 0;
  const roundDone = rounds.map(() => 0);
  const rows = passages.map((p) => {
    let weak = 0;
    const marks = rounds.map((r, ri) => {
      const v = cellValue(grid, cellKey(p.id, r.id), covered);
      if (v) {
        done++;
        roundDone[ri]++;
      }
      if (v === 't' || v === 'x') weak++;
      return v;
    });
    return { id: p.id, name: p.name, marks, weak };
  });
  const total = passages.length * rounds.length;
  const counts = { done: 0, doing: 0, todo: 0 };
  const roundRows = rounds.map((r, i) => {
    const st = statusOf(roundDone[i], passages.length);
    counts[st]++;
    return { id: r.id, name: r.name, done: roundDone[i], size: passages.length, status: st };
  });
  return {
    form: 'grid',
    rows,
    rounds: roundRows,
    total,
    done,
    pct: total ? done / total : 0,
    unit: '지문',
    amountTotal: total,
    amountDone: done,
    unsized: 0,
    counts,
  };
}

/** 트랙 하나의 진행 요약 (선형/격자 공통 형태) */
export function trackProgress(track, tasks = []) {
  if (!track) return null;
  if (track.form === 'grid') return gridProgress(track.grid, doneCells(tasks));
  return linearProgress(track.sections || [], donePagesBySection(tasks));
}

/**
 * 진도 현황 숫자 4종 — 판단 없이 나란히 보여줄 사실 수치.
 * ① 남은 분량 ② 남은 일수(오늘 포함, 시험 전날까지) ③ 지금까지 일평균 처리량 ④ 남은 분량 ÷ 남은 일수
 */
export function progressNumbers({ remaining, done, startDate, examDate, today }) {
  const daysLeft = examDate ? Math.max(0, diffDays(today, examDate)) : null;
  const elapsed = startDate ? Math.max(1, diffDays(startDate, today) + 1) : null;
  return {
    remaining: Math.max(0, roundHalfUp(remaining, 1)),
    daysLeft,
    elapsed,
    avgPerDay: elapsed ? roundHalfUp(done / elapsed, 1) : null,
    requiredPerDay: daysLeft ? roundHalfUp(Math.max(0, remaining) / daysLeft, 1) : null,
  };
}
