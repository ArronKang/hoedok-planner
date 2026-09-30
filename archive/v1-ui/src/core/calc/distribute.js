// 자동 배분: 트랙의 남은 분량(쪽/칸)을 날짜별 가용 시간에 맞춰 나눈다.
// 예측이나 권고는 하지 않는다. 결과(배분된 분량/못 넣은 분량)를 사실대로 돌려줄 뿐이다.
//
// queues: [{ key, pace(단위당 분), units: [{ sectionId, n?(쪽 번호), cell?(칸 키), label? }] }]
// days:   [{ date, capacity(새 할 일에 쓸 수 있는 분) }]
// mode:   'fit'  — 가용 시간 안에서만 채운다 (남는 분량은 leftover로 보고)
//         'even' — 가용 시간이 있는 날(없으면 모든 날)에 균등하게 나눈다 (초과 가능)

export function allocate({ days, queues, mode = 'fit' }) {
  const rem = queues.map((q) => q.units.length);
  const perDay = days.map(() => queues.map(() => 0));

  if (mode === 'even') {
    let idx = days.map((d, i) => i).filter((i) => days[i].capacity > 0);
    if (!idx.length) idx = days.map((d, i) => i);
    if (idx.length) {
      queues.forEach((q, t) => {
        const n = rem[t];
        const base = Math.floor(n / idx.length);
        let extra = n % idx.length;
        idx.forEach((di) => {
          perDay[di][t] = base + (extra > 0 ? 1 : 0);
          if (extra > 0) extra--;
        });
        rem[t] = 0;
      });
    }
  } else {
    days.forEach((day, di) => {
      const C = Math.max(0, day.capacity || 0);
      if (C <= 0) return;
      const active = queues.map((q, t) => t).filter((t) => rem[t] > 0 && queues[t].pace > 0);
      if (!active.length) return;
      const Mtot = active.reduce((s, t) => s + rem[t] * queues[t].pace, 0);
      let used = 0;
      const counts = perDay[di];
      for (const t of active) {
        const share = (C * rem[t] * queues[t].pace) / Mtot;
        const c = Math.min(rem[t], Math.floor(share / queues[t].pace + 1e-9));
        counts[t] = c;
        used += c * queues[t].pace;
      }
      // 남은 시간은 남은 작업량이 가장 큰 트랙부터 한 단위씩 채운다
      for (;;) {
        let best = -1;
        let bestWork = -1;
        for (const t of active) {
          if (counts[t] >= rem[t] || queues[t].pace > C - used + 1e-9) continue;
          const work = (rem[t] - counts[t]) * queues[t].pace;
          if (work > bestWork) {
            bestWork = work;
            best = t;
          }
        }
        if (best < 0) break;
        counts[best]++;
        used += queues[best].pace;
      }
      for (const t of active) rem[t] -= counts[t];
    });
  }

  // 단위를 날짜별로 잘라서 같은 섹션끼리 묶는다
  const ptr = queues.map(() => 0);
  const chunks = [];
  days.forEach((day, di) => {
    queues.forEach((q, t) => {
      const n = perDay[di][t];
      if (!n) return;
      const units = q.units.slice(ptr[t], ptr[t] + n);
      ptr[t] += n;
      let run = null;
      for (const u of units) {
        if (!run || run.sectionId !== u.sectionId) {
          run = { date: day.date, key: q.key, sectionId: u.sectionId, units: [] };
          chunks.push(run);
        }
        run.units.push(u);
      }
    });
  });
  for (const c of chunks) {
    const q = queues.find((x) => x.key === c.key);
    c.minutes = Math.round(c.units.length * q.pace);
  }
  const leftover = {};
  queues.forEach((q, t) => (leftover[q.key] = q.units.length - ptr[t]));
  const load = {};
  for (const c of chunks) load[c.date] = (load[c.date] || 0) + c.minutes;
  return { chunks, leftover, load };
}

/**
 * 선형 트랙의 남은 쪽 단위 목록.
 * doneMap: 섹션별 완료 쪽수, plannedMap: 섹션별 이미 잡혀 있는(미완료) 할 일 쪽수.
 * 쪽은 섹션 앞부분부터 차례로 한다고 보고 이어지는 번호를 만든다.
 */
export function linearUnits(sections, doneMap = new Map(), plannedMap = new Map(), include = null) {
  const units = [];
  for (const sec of sections) {
    if (include && !include.has(sec.id)) continue;
    if (sec.completed) continue;
    if (typeof sec.pageFrom !== 'number' || typeof sec.pageTo !== 'number' || sec.pageTo < sec.pageFrom) continue;
    const size = sec.pageTo - sec.pageFrom + 1;
    const done = Math.max(0, Math.min(size, (sec.manualPages || 0) + (doneMap.get(sec.id) || 0)));
    const planned = plannedMap.get(sec.id) || 0;
    for (let p = sec.pageFrom + done + planned; p <= sec.pageTo; p++) units.push({ sectionId: sec.id, n: p });
  }
  return units;
}

/** 격자 트랙의 남은 칸 목록 (회독 순서 → 지문 순서) */
export function gridUnits(grid, isDone, isPlanned = () => false, include = null) {
  const units = [];
  for (const r of grid.rounds || []) {
    if (include && !include.has(r.id)) continue;
    for (const p of grid.passages || []) {
      const key = `${p.id}:${r.id}`;
      if (isDone(key) || isPlanned(key)) continue;
      units.push({ sectionId: r.id, cell: key, label: p.name });
    }
  }
  return units;
}

/** 배분 조각 → 할 일 제목 */
export function chunkTitle(chunk, sectionName) {
  const u = chunk.units;
  if (u[0].cell) {
    const a = u[0].label;
    const b = u[u.length - 1].label;
    return u.length > 1 ? `${sectionName} · ${a}–${b} (${u.length}지문)` : `${sectionName} · ${a}`;
  }
  const a = u[0].n;
  const b = u[u.length - 1].n;
  return a === b ? `${sectionName} p.${a}` : `${sectionName} p.${a}–${b}`;
}
