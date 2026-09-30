// 계획 실행 통계 — 있는 기록만 집계한다 (판단 문구 없음)
//
// 할 일 한 개가 어떤 날짜에 '계획되어 있었던' 기록을 하루 단위 결과로 펼친다.
//   - moves: [{ from, to, at, reason? }] 중 from 날짜 → '미룸'
//   - 현재 날짜 → 완료 'done' / 버림 'dropped' / 지난 날인데 미완료 'missed' / 오늘 이후 미완료는 제외
// 실행률 = 완료 ÷ (완료 + 미룸 + 버림 + 미처리)

export function planOutcomes(tasks, { from = null, to = null, today }) {
  const out = [];
  const inRange = (d) => (!from || d >= from) && (!to || d <= to);
  for (const t of tasks) {
    if (t.deleted) continue;
    for (const m of t.moves || []) {
      if (inRange(m.from)) out.push({ task: t, date: m.from, outcome: 'postponed', reason: m.reason || null });
    }
    if (!t.date || !inRange(t.date)) continue;
    if (t.status === 'done') out.push({ task: t, date: t.date, outcome: 'done' });
    else if (t.status === 'dropped') out.push({ task: t, date: t.date, outcome: 'dropped', reason: t.dropReason || null });
    else if (t.date < today) out.push({ task: t, date: t.date, outcome: 'missed' });
  }
  return out;
}

export function summarize(outcomes) {
  const s = { planned: 0, done: 0, postponed: 0, dropped: 0, missed: 0, rate: null };
  for (const o of outcomes) {
    s.planned++;
    s[o.outcome]++;
  }
  s.rate = s.planned ? s.done / s.planned : null;
  return s;
}

export function groupSummaries(outcomes, keyFn) {
  const groups = new Map();
  for (const o of outcomes) {
    const k = keyFn(o);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(o);
  }
  const res = new Map();
  for (const [k, list] of groups) res.set(k, summarize(list));
  return res;
}

export function reasonCounts(outcomes) {
  const m = new Map();
  for (const o of outcomes) {
    if (o.outcome !== 'postponed' && o.outcome !== 'dropped') continue;
    const r = o.reason || '이유 없음';
    const cur = m.get(r) || { reason: r, postponed: 0, dropped: 0, total: 0 };
    cur[o.outcome]++;
    cur.total++;
    m.set(r, cur);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

/** 예상 vs 실제 소요시간: 둘 다 기록된 완료 할 일만 */
export function estVsActual(tasks, { from = null, to = null } = {}) {
  const items = [];
  for (const t of tasks) {
    if (t.deleted || t.status !== 'done') continue;
    if (from && t.date < from) continue;
    if (to && t.date > to) continue;
    if (typeof t.estMinutes === 'number' && typeof t.actualMinutes === 'number' && t.estMinutes > 0) {
      items.push({ task: t, est: t.estMinutes, actual: t.actualMinutes });
    }
  }
  const est = items.reduce((s, i) => s + i.est, 0);
  const actual = items.reduce((s, i) => s + i.actual, 0);
  return { items, count: items.length, est, actual, ratio: est ? actual / est : null };
}

/** 가장 많이 미뤄진 할 일 */
export function mostPostponed(tasks, limit = 5) {
  return tasks
    .filter((t) => !t.deleted && (t.moves || []).length > 0)
    .sort((a, b) => (b.moves || []).length - (a.moves || []).length)
    .slice(0, limit);
}
