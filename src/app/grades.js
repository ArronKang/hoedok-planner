// 성적: 겉에는 시험 목록. 시험을 누르면 '공부한 것 ↔ 결과'를 나란히. 더 들어가면 과목별 계산·틀린 이유·흐름.
import { html } from '../lib/html.js';
import { useState, useRef } from '../lib/ui.js';
import * as C from './core.js';
import { Icon, Sheet, hue, Seg, Stepper } from './kit.js';
import { computeRecord, lostBreakdown, rankPercent, weightedAverageGrade, achievementFromRaw } from '../core/calc/naesin.js';

const { D, UI, openSheet, closeSheet, commit, withUndo, toast, P, fmt, mdws, today } = C;

const hOf = (name) => (D().subjects.find((s) => s.name === name) || C.SUBJECT_PRESETS.find((p) => p.name === name) || { h: 182 }).h;
const semOf = (id) => D().semesters.find((s) => s.id === id);
const examOf = (id) => D().pastExams.find((e) => e.id === id);
const signed = (v, d = 1) => (v == null || isNaN(v) ? '–' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmt(Math.abs(v), d)}`);
const row = (label, small, fn) => html`<button class="set-row" onClick=${fn}><span class="l"><b>${label}</b>${small ? html`<small>${small}</small>` : null}</span><${Icon} n="right" s=${18} /></button>`;

function semAvg(sem) {
  return weightedAverageGrade(sem.records.map((r) => ({ category: r.category, credits: r.credits, rankGrade: r.final.rankGrade })));
}

export function GradesHome() {
  const ex = D().exam;
  const past = [...D().pastExams].sort((a, b) => (a.date < b.date ? 1 : -1));
  const sel = UI().stacks.grades[0];
  const cur = (v, id) => (C.isPadDev() && sel && sel.view === v && sel.id === id ? 'true' : 'false');
  const sems = D().semesters.filter((s) => s.records.length);
  return html`<div class="screen">
    <header class="head">
      <div class="t"><h1>성적</h1></div>
      <button class="ib" aria-label="성적 메뉴" onClick=${() => openSheet({ type: 'gradesMenu' })}><${Icon} n="more" /></button>
    </header>
    <div class="scroll"><div class="body">
      ${!past.length && !sems.length
        ? html`<div class="empty"><h3>아직 적은 성적이 없어요</h3><p>시험이 끝나면 여기서 점수를 적어요. 그 시험을 위해 공부한 기록과 나란히 보여 드려요.</p></div>`
        : null}
      <div>
        <div class="sec-title" style="margin-top:4px">시험</div>
        ${ex && !C.isGoal(ex)
          ? C.examDay()
            ? html`<button class="lrow" onClick=${() => openSheet({ type: 'cycle' })}><span class="nm"><b>${ex.name}</b><small>시험 날이 됐어요 · 끝나면 결과 적기</small></span><span class="chev"><${Icon} n="right" s=${18} /></span></button>`
            : html`<div class="lrow off"><span class="nm"><b>${ex.name}</b><small>${mdws(ex.date)} · 시험이 끝나면 점수를 적어요</small></span><span class="v muted">D-${C.daysLeft()}</span></div>`
          : null}
        ${past.map((e) => {
          let v, small;
          if (e.kind === 'mock') {
            const g = Object.values(e.mock || {}).map((x) => x[2]).filter((x) => x != null);
            v = g.length ? `${fmt(g.reduce((a, b) => a + b, 0) / g.length)}등급` : '–';
            small = g.length ? '과목 평균' : '점수 안 적음';
          } else {
            const sem = semOf(e.semester);
            const diffs = (sem ? sem.records : []).map((r) => C.examEl(r, e)).filter((el) => el && el.score != null && el.avg != null).map((el) => el.score - el.avg);
            v = diffs.length ? signed(diffs.reduce((a, b) => a + b, 0) / diffs.length) : '–';
            small = diffs.length ? '과목평균보다' : '점수 안 적음';
          }
          return html`<button class="lrow" key=${e.id} aria-current=${cur('exam', e.id)} onClick=${() => C.push('grades', { view: 'exam', id: e.id }, true)}>
            <span class="nm"><b>${e.name}</b><small>${mdws(e.date)}</small></span>
            <span class="v">${v}<small>${small}</small></span><span class="chev"><${Icon} n="right" s=${18} /></span>
          </button>`;
        })}
      </div>
      ${sems.length
        ? html`<div>
            <div class="sec-title">학기 성적</div>
            ${[...sems].reverse().map((s) => {
              const a = semAvg(s);
              return html`<button class="lrow" key=${s.id} aria-current=${cur('semester', s.id)} onClick=${() => C.push('grades', { view: 'semester', id: s.id }, true)}>
                <span class="nm"><b>${s.label}</b><small>${s.records.length}과목 · ${a.avg == null ? '등급 나오기 전' : '학점 가중 평균'}</small></span>
                <span class="v">${a.avg == null ? '–' : fmt(a.avg, 2)}<small>등급</small></span><span class="chev"><${Icon} n="right" s=${18} /></span>
              </button>`;
            })}
          </div>`
        : null}
    </div></div>
  </div>`;
}

function Back({ label, onClick }) {
  return onClick ? html`<button class="back" onClick=${onClick}><${Icon} n="left" s=${20} />${label}</button>` : null;
}

/** 시험 리포트: 그 시험을 위해 공부한 것 ↔ 결과 */
export function ExamReport({ id, back }) {
  const e = examOf(id);
  if (!e) return html`<div class="placeholder">시험을 골라 주세요</div>`;
  const mock = e.kind === 'mock';
  const sem = !mock && semOf(e.semester);
  const rows = mock
    ? Object.entries(e.mock || {}).map(([name, [raw, pctile, grade]]) => ({ name, study: (e.study || {})[name], raw, pctile, grade }))
    : (sem ? sem.records : []).filter((r) => r.category === 'grade').map((r) => {
        const el = C.examEl(r, e);
        const rk = (e.ranks || {})[r.subject];
        return { name: r.subject, study: (e.study || {})[r.subject], score: el ? el.score : null, avg: el ? el.avg : null, rp: rk ? rankPercent(rk[0], rk[1]) : null, rec: r };
      });
  // 점수를 안 적은 과목도 공부 기록이 있으면 줄에 보인다
  if (!mock) for (const name of Object.keys(e.study || {})) if (!rows.some((r) => r.name === name)) rows.push({ name, study: e.study[name], score: null });
  const order = (n) => {
    const i = D().subjects.findIndex((s) => s.name === n);
    return i < 0 ? 99 : i;
  };
  rows.sort((a, b) => order(a.name) - order(b.name));
  const prev = [...D().pastExams].filter((x) => x.kind === e.kind && x.date < e.date).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const more = UI().open['rep-' + id];
  const toNaesin = (r) => {
    if (r.rec) return C.push('grades', { view: 'naesin', sem: e.semester, rec: r.rec.id });
    const sub = D().subjects.find((s) => s.name === r.name);
    if (!sub || !sem) return;
    const rec = C.ensureRecord(sem, sub);
    commit();
    C.push('grades', { view: 'naesin', sem: sem.id, rec: rec.id });
  };
  return html`<div class="screen"><div class="scroll">
    <div class="head" style="flex-direction:column;align-items:stretch">
      <${Back} label="성적" onClick=${back} />
      <span class="kicker">${mdws(e.date)}</span><h1>${e.name}</h1>
    </div>
    <div class="body">
      <p class="sub" style="margin:0">과목마다 이 시험을 위해 공부한 기록과 결과를 나란히 놓았어요. 판단은 직접 해 보세요.</p>
      ${rows.length
        ? html`<div class="card pad">
            <div class="pair">
              <span class="h">과목</span><span class="h">공부한 것</span><span class="h">결과</span>
              ${rows.map((r) => {
                const s = r.study;
                const noScore = !mock && r.score == null;
                const resFrac = mock ? (r.pctile != null ? r.pctile / 100 : (10 - r.grade) / 9) : (r.score || 0) / 100;
                return [
                  html`<span class="sep" key=${r.name + 's'}></span>`,
                  html`<span class="sn hue" key=${r.name + 'n'} style=${hue(hOf(r.name))} onClick=${!mock ? () => toNaesin(r) : undefined}><span class="dot"></span>${r.name.replace('공통', '')}</span>`,
                  html`<span class="cell2 hue st" key=${r.name + 'a'} style=${hue(hOf(r.name))}>
                    ${s
                      ? html`<span class="t2"><b>${P(s.progress)}</b>진도</span><span class="hb"><i style=${{ width: `${s.progress * 100}%` }}></i></span><span class="t2">계획 ${s.planned}개 중 ${P(s.planDone)} 끝냄 · ${s.moved}번 미룸</span>`
                      : html`<span class="t2">기록 없음</span>`}
                  </span>`,
                  noScore
                    ? html`<button class="cell2 linkcell rs" key=${r.name + 'b'} onClick=${() => toNaesin(r)}><span class="t2">점수 안 적음</span><span class="t2 go">적기 ›</span></button>`
                    : html`<span class="cell2 rs" key=${r.name + 'b'}>
                        ${mock
                          ? html`<span class="t2"><b>${r.grade}</b>등급 · 원점수 ${r.raw}${r.pctile != null ? ` · 백분위 ${r.pctile}` : ''}</span>`
                          : html`<span class="t2"><b>${fmt(r.score)}</b>점${r.avg != null ? ` · 평균보다 ${signed(r.score - r.avg)}` : ''}</span>`}
                        <span class="hb res"><i style=${{ width: `${resFrac * 100}%` }}></i></span>
                        <span class="t2">${mock ? (r.pctile != null ? '막대: 백분위' : '막대: 등급 (절대평가)') : r.rp != null ? `석차 상위 ${fmt(r.rp)}%` : ''}</span>
                      </span>`,
                ];
              })}
            </div>
          </div>`
        : html`<p class="muted">적은 결과가 없어요.</p>`}

      <div>
        <div class="sec-title">틀린 이유<em>적어 두면 시험마다 쌓여요</em></div>
        <div class="set-list">${rows.map((r) => html`<button key=${r.name} class="set-row hue" style=${hue(hOf(r.name))} onClick=${() => openSheet({ type: 'wrong', ex: e.id, name: r.name })}>
          <span class="dot"></span><span class="l"><b>${r.name}</b><small>${C.wrongText((e.wrong || {})[r.name]) || '안 적음'}</small></span><${Icon} n="right" s=${18} />
        </button>`)}</div>
      </div>

      <div>
        <span class="label">한 줄 회고</span>
        <textarea class="input" rows="2" key=${'note' + e.id} defaultValue=${e.note || ''} placeholder="이번 시험을 한 줄로 남겨 두기" onChange=${(ev) => {
          e.note = ev.target.value;
          commit();
        }}></textarea>
      </div>

      <button class="more-toggle" onClick=${() => C.setUI({ open: { ...UI().open, ['rep-' + id]: !more } })}>${mock ? (prev ? `직전 모의고사(${prev.name})와 비교 · 과목별 흐름` : '과목별 흐름') : e.kind === 'final' ? '같은 학기 중간고사와 비교' : '같은 학기 다른 시험과 비교'}<span class="caret">${more ? '▴' : '▾'}</span></button>
      ${more ? (mock ? html`<${MockCompare} e=${e} prev=${prev} />` : sem ? html`<${NaesinCompare} sem=${sem} />` : null) : null}
    </div>
  </div></div>`;
}

function MockCompare({ e, prev }) {
  const mocks = [...D().pastExams].filter((x) => x.kind === 'mock' && x.mock).sort((a, b) => (a.date < b.date ? -1 : 1));
  const names = Object.keys(e.mock || {});
  const [pick, setPick] = useState(names[0]);
  if (!names.length) return null;
  const abs = e.mock[pick][1] == null;
  const pts = mocks.map((m) => ({ label: m.name.replace(' 모의고사', ''), v: m.mock[pick] ? (abs ? m.mock[pick][2] : m.mock[pick][1]) : null }));
  return html`<div class="stack">
    ${prev && prev.mock
      ? html`<table class="tbl"><thead><tr><th>과목</th><th class="r">${prev.name.replace(' 모의고사', '')}</th><th class="r">${e.name.replace(' 모의고사', '')}</th><th class="r">등급 변화</th></tr></thead><tbody>
          ${names.map((n) => {
            const a = prev.mock[n], b = e.mock[n];
            const d = a && b ? a[2] - b[2] : null;
            return html`<tr key=${n}><td>${n}</td><td class="r n">${a ? `${a[2]}등급` : '–'}</td><td class="r n">${b[2]}등급</td><td class=${'r n ' + (d > 0 ? 'up' : d < 0 ? 'dn' : '')}>${d == null ? '–' : d === 0 ? '같음' : `${Math.abs(d)}등급 ${d > 0 ? '올림' : '내림'}`}</td></tr>`;
          })}
        </tbody></table>`
      : null}
    <div class="sec-title">과목별 흐름</div>
    <div class="chips">${names.map((n) => html`<button key=${n} class="chip hue" style=${hue(hOf(n))} aria-pressed=${pick === n ? 'true' : 'false'} onClick=${() => setPick(n)}>${n}</button>`)}</div>
    <div class="hue" style=${hue(hOf(pick))}><${Line} pts=${pts} max=${abs ? 9 : 100} min=${abs ? 1 : Math.max(0, Math.min(...pts.filter((p) => p.v != null).map((p) => p.v)) - 15)} invert=${abs} unit=${abs ? '등급' : ''} /></div>
    <p class="hint">${abs ? '절대평가 과목이라 등급으로 그렸어요. 위로 갈수록 좋은 등급이에요.' : '백분위예요. 위로 갈수록 높아요.'}</p>
  </div>`;
}

/** pts: [{label, v, avg?}] — avg가 있으면 점선으로 같이 그린다 */
function Line({ pts, min, max, invert, unit }) {
  // 휴대폰은 좁게 그려서 글자가 줄어들지 않게 한다
  const W = C.isPadDev() ? 520 : 340, H = C.isPadDev() ? 190 : 170, L = 34, R = 18, T = 26, B = 28;
  const xs = (i) => L + (pts.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (pts.length - 1));
  const ys = (v) => {
    const f = (v - min) / (max - min || 1);
    return invert ? T + f * (H - T - B) : H - B - f * (H - T - B);
  };
  const ticks = invert ? [1, 3, 5, 7, 9] : [min, Math.round((min + max) / 2), max].map((x) => Math.round(x));
  const valid = pts.map((p, i) => [p, i]).filter(([p]) => p.v != null);
  const avgs = pts.map((p, i) => [p, i]).filter(([p]) => p.avg != null);
  return html`<div class="chart"><svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label="흐름 그래프">
    ${ticks.map((t) => html`<g key=${t}><line class="gl" x1=${L} x2=${W - R} y1=${ys(t)} y2=${ys(t)} /><text class="ax" x=${L - 8} y=${ys(t) + 4} text-anchor="end">${t}</text></g>`)}
    ${avgs.length ? html`<path class="ln avg" d=${avgs.map(([p, i], k) => `${k ? 'L' : 'M'}${xs(i)} ${ys(p.avg)}`).join('')} />` : null}
    ${avgs.map(([p, i]) => html`<circle key=${'a' + i} class="pt avg" cx=${xs(i)} cy=${ys(p.avg)} r="3.5" />`)}
    <path class="ln" d=${valid.map(([p, i], k) => `${k ? 'L' : 'M'}${xs(i)} ${ys(p.v)}`).join('')} />
    ${valid.map(([p, i]) => html`<g key=${i}><circle class="pt" cx=${xs(i)} cy=${ys(p.v)} r="5" /><text class="lb" x=${xs(i)} y=${ys(p.v) - 10} text-anchor="middle">${p.v}${unit}</text></g>`)}
    ${pts.map((p, i) => html`<text key=${'x' + i} class="ax" x=${xs(i)} y=${H - 8} text-anchor="middle">${p.label}</text>`)}
  </svg></div>`;
}

function NaesinCompare({ sem }) {
  const recs = sem.records.filter((r) => r.category === 'grade');
  return html`<div class="stack">
    <button class="linkrow-btn" onClick=${() => openSheet({ type: 'naesinTrend' })}>과목마다 시험 점수 흐름 보기 ›</button>
    <p class="hint" style="margin:0">같은 학기 1차 지필(중간)과 2차 지필(기말)이에요.</p>
    <table class="tbl"><thead><tr><th>과목</th><th class="r">1차</th><th class="r">2차</th><th class="r">변화</th></tr></thead><tbody>
      ${recs.map((r) => {
        const a = C.examEl(r, { kind: 'mid' }), b = C.examEl(r, { kind: 'final' });
        const sa = a && a.score, sb = b && b !== a ? b.score : null;
        const d = sa != null && sb != null ? sb - sa : null;
        return html`<tr key=${r.id}><td>${r.subject}</td><td class="r n">${sa != null ? fmt(sa) : '–'}</td><td class="r n">${sb != null ? fmt(sb) : '–'}</td><td class=${'r n ' + (d > 0 ? 'up' : d < 0 ? 'dn' : '')}>${signed(d)}</td></tr>`;
      })}
    </tbody></table>
  </div>`;
}

/** 학기 성적 */
export function SemesterPage({ id, back }) {
  const sem = semOf(id);
  const [naming, setNaming] = useState(false);
  if (!sem) return html`<div class="placeholder">학기를 골라 주세요</div>`;
  const a = semAvg(sem);
  return html`<div class="screen"><div class="scroll">
    <div class="head" style="flex-direction:column;align-items:stretch">
      <${Back} label="성적" onClick=${back} />
      <span class="kicker">학기 성적</span>
      ${naming
        ? html`<form class="row" onSubmit=${(e) => {
            e.preventDefault();
            const v = e.target.elements.nm.value.trim();
            if (v) sem.label = v;
            commit();
            setNaming(false);
          }}><input class="input" name="nm" defaultValue=${sem.label} aria-label="학기 이름" style="font-size:1.2em;font-weight:650" /><button class="btn pri" type="submit">저장</button></form>
          <p class="hint">예: 1학년 2학기. 그래프에는 '1-2'처럼 짧게 보여요.</p>`
        : html`<div class="row"><h1>${sem.label}</h1><button class="btn sm quiet" onClick=${() => setNaming(true)}>이름 바꾸기</button></div>`}
    </div>
    <div class="overall"><span class="big">${a.avg == null ? '–' : fmt(a.avg, 2)}<small>등급</small></span><span class="meta">학점 가중 평균<br />등급 나오는 <b>${a.count}</b>과목 · <b>${a.credits}</b>학점</span></div>
    <div class="body">
      <table class="tbl"><thead><tr><th>과목</th><th class="r">학점</th><th class="r">합계</th><th class="r">원점수</th><th class="r">성취도</th><th class="r">등급</th></tr></thead><tbody>
        ${sem.records.map((r) => {
          const c = computeRecord(r.elements);
          return html`<tr class="click" key=${r.id} onClick=${() => C.push('grades', { view: 'naesin', sem: sem.id, rec: r.id })}>
            <td><span class="row hue" style=${hue(r.h)}><span class="dot"></span>${r.subject}</span></td>
            <td class="r n">${r.credits}</td><td class="r n">${c.total == null ? (c.scoredWeight ? html`<span class="muted">${fmt(c.runningTotal, 2)}…</span>` : '–') : c.total.toFixed(2)}</td><td class="r n">${c.raw ?? '–'}</td>
            <td class="r">${r.final.achievement || achievementFromRaw(c.raw) || '–'}</td><td class="r n">${r.category === 'achievement' ? '–' : r.final.rankGrade ?? '–'}</td>
          </tr>`;
        })}
      </tbody></table>
      <p class="hint">과목을 누르면 평가 항목마다 점수를 적고 합계가 어떻게 나왔는지 볼 수 있어요. 등급은 학교에서 받은 값을 적어요. 합계 뒤 …는 아직 점수가 다 나오지 않았다는 뜻이에요.</p>
    </div>
  </div></div>`;
}

/** 과목 한 개의 내신 계산 (평가 항목 → 합계 → 원점수) */
export function NaesinPage({ sem: semId, rec: recId, back }) {
  const sem = semOf(semId);
  const r = sem && sem.records.find((x) => x.id === recId);
  if (!r) return html`<div class="placeholder">과목을 골라 주세요</div>`;
  const c = computeRecord(r.elements);
  const lost = lostBreakdown(r.elements);
  const lmx = Math.max(0.01, ...lost.items.map((i) => i.lost || 0));
  const rp = r.final.rank && r.final.enrolled ? rankPercent(r.final.rank, r.final.enrolled) : null;
  const setScore = (el, v) => {
    const n = v === '' ? null : Number(v);
    el.score = n == null || isNaN(n) ? null : Math.min(el.max, Math.max(0, n));
    commit();
  };
  return html`<div class="screen hue" style=${hue(r.h)}><div class="scroll">
    <div class="head" style="flex-direction:column;align-items:stretch">
      <${Back} label="뒤로" onClick=${back} />
      <span class="kicker">${sem.label} · ${r.credits}학점</span><h1>${r.subject}</h1>
    </div>
    <div class="body">
      <div class="card pad">
        <div class="elem h"><span>평가 항목</span><span class="c">반영</span><span class="c">만점</span><span class="c">받은 점수</span><span class="c">환산</span></div>
        ${r.elements.map((el) => html`<div class="elem" key=${el.id}>
          <span>${el.name}<span class="kind">${el.kind === 'exam' ? '지필' : '수행'}${el.avg != null ? ` · 과목평균 ${el.avg}` : ''}</span></span>
          <span class="c">${el.weight}%</span><span class="c">${el.max}</span>
          <input class="input" inputmode="decimal" key=${'s' + el.id} defaultValue=${el.score == null ? '' : String(el.score)} aria-label=${el.name + ' 받은 점수'} onChange=${(e) => setScore(el, e.target.value)} />
          <span class="c">${c.contributions[el.id] == null ? '–' : c.contributions[el.id].toFixed(2)}</span>
        </div>`)}
        <div class="total-line">
          <div>합계<b>${c.total == null ? fmt(c.runningTotal, 2) : c.total.toFixed(2)}</b></div>
          <div>원점수<b>${c.raw ?? '–'}</b></div>
          <div>반영 비율 합<b>${fmt(c.weightSum, 0)}%</b></div>
          ${c.remainingWeight > 0 ? html`<div>아직 점수가 안 나온 비중<b>${fmt(c.remainingWeight, 0)}%</b></div>` : null}
        </div>
        ${c.weightSum !== 100 ? html`<p class="hint">반영 비율을 더하면 ${c.weightSum}%예요.</p>` : null}
        <button class="btn sm quiet" style="margin-top:10px" onClick=${() => openSheet({ type: 'gradeSetup', sem: sem.id, rec: r.id })}>평가 항목·반영 비율 고치기</button>
      </div>

      <div class="card pad">
        <div class="sec-title" style="margin-top:0">학교에서 받은 값</div>
        ${r.category === 'achievement'
          ? html`<div class="row"><span class="grow">성취도</span><${Seg} label="성취도" value=${r.final.achievement} onChange=${(v) => {
              r.final.achievement = v;
              commit();
            }} options=${['A', 'B', 'C', 'P'].map((x) => [x, x])} /></div>`
          : html`
            <div class="row" style="margin-bottom:10px"><span class="grow">석차등급</span><${Seg} label="석차등급" value=${r.final.rankGrade} onChange=${(v) => {
              r.final.rankGrade = v;
              commit();
            }} options=${[1, 2, 3, 4, 5].map((x) => [x, `${x}`])} /></div>
            <div class="kv"><span class="k">석차</span><span class="v num">${r.final.rank ?? '–'} / ${r.final.enrolled ?? '–'}명${rp != null ? ` · 상위 ${fmt(rp)}%` : ''}</span></div>
            <div class="kv"><span class="k">성취도</span><span class="v">${achievementFromRaw(c.raw) || '–'} <span class="muted small">(원점수 90·80·70·60 기준)</span></span></div>
            <div class="kv"><span class="k">과목평균</span><span class="v num">${r.final.avg ?? '–'}</span></div>`}
      </div>

      ${r.category === 'grade' && lost.items.some((i) => i.lost != null)
        ? html`<div class="card pad">
            <div class="sec-title" style="margin-top:0">어디서 점수를 잃었나<em>합계 −${fmt(lost.total, 2)}점</em></div>
            <div class="lost">${lost.items.filter((i) => i.lost != null).map((i) => html`<div class="r" key=${i.id}><span>${i.name}</span><span class="hb"><i style=${{ width: `${((i.lost || 0) / lmx) * 100}%` }}></i></span><span class="num n">−${(i.lost || 0).toFixed(2)}</span></div>`)}</div>
            <p class="hint">지필 −${lost.exam.toFixed(2)} · 수행 −${lost.perf.toFixed(2)}</p>
          </div>`
        : null}
    </div>
  </div></div>`;
}

export function GradesMenu() {
  return html`<${Sheet} title="성적">
    <div class="set-list">
      ${row('모의고사 결과 적기', '원점수·백분위·등급', () => openSheet({ type: 'mockEntry' }))}
      ${row('내신 흐름', '시험마다 내 점수와 과목평균', () => openSheet({ type: 'naesinTrend' }))}
      ${row('틀린 이유 모아 보기', '시험마다 적은 이유를 합쳐서', () => openSheet({ type: 'wrongStats' }))}
    </div>
    <p class="hint">내신은 학기 성적 › 과목을 눌러 평가 항목마다 적어요.</p>
  <//>`;
}

export function MockEntrySheet() {
  const names = D().subjects.map((s) => s.name);
  // 적은 값은 다시 그리지 않고 바로 기억한다 (마지막 칸을 적고 곧바로 저장해도 빠지지 않게)
  const vals = useRef({}).current;
  const [name, setName] = useState(`${+today().slice(5, 7)}월 모의고사`);
  const set = (n, i, v) => (vals[n] = Object.assign([null, null, null], vals[n] || [], { [i]: v === '' || isNaN(Number(v)) ? null : Number(v) }));
  return html`<${Sheet} title="모의고사 결과 적기" tall footer=${html`<button class="btn" onClick=${closeSheet}>취소</button><button class="btn pri" onClick=${() => {
    const mock = {};
    for (const n of names) if (vals[n] && vals[n][2]) mock[n] = vals[n];
    if (!Object.keys(mock).length) return toast('등급을 하나 이상 적어 주세요');
    D().pastExams.push({ id: C.uid(), name, kind: 'mock', date: today(), mock, wrong: {}, note: '' });
    commit();
    closeSheet();
    toast(`${name}을 저장했어요`);
  }}>저장</button>`}>
    <span class="label">시험 이름</span>
    <input class="input" value=${name} onInput=${(e) => setName(e.target.value)} />
    <span class="label">과목마다 <span class="muted" style="font-weight:500">— 영어·한국사는 원점수와 등급만</span></span>
    <${MockTable} names=${names} set=${set} />
  <//>`;
}

export function MockTable({ names, set }) {
  return html`<table class="tbl"><thead><tr><th>과목</th><th class="r">원점수</th><th class="r">백분위</th><th class="r">등급</th></tr></thead><tbody>
    ${names.map((n) => {
      const abs = /영어|한국사/.test(n);
      return html`<tr key=${n}><td>${n}</td>
        <td class="r"><input class="input pg" inputmode="numeric" aria-label=${n + ' 원점수'} onChange=${(e) => set(n, 0, e.target.value)} /></td>
        <td class="r">${abs ? html`<span class="muted">–</span>` : html`<input class="input pg" inputmode="numeric" aria-label=${n + ' 백분위'} onChange=${(e) => set(n, 1, e.target.value)} />`}</td>
        <td class="r"><input class="input pg" inputmode="numeric" aria-label=${n + ' 등급'} onChange=${(e) => set(n, 2, e.target.value)} /></td></tr>`;
    })}
  </tbody></table>`;
}

// ─────────── 내신 흐름 ───────────

export function NaesinTrendSheet() {
  const names = C.naesinSubjects();
  const [pick, setPick] = useState(names[0] || null);
  const pts = pick ? C.naesinSeries(pick) : [];
  const sems = [...D().semesters].sort((a, b) => (a.id < b.id ? -1 : 1)).map((s) => [s, semAvg(s)]).filter(([, a]) => a.avg != null);
  const vals = pts.flatMap((p) => [p.v, p.avg]).filter((x) => x != null);
  const lo = vals.length ? Math.max(0, Math.floor((Math.min(...vals) - 8) / 10) * 10) : 0;
  return html`<${Sheet} title="내신 흐름" tall>
    ${!names.length
      ? html`<div class="empty"><h3>아직 적은 지필 점수가 없어요</h3><p>시험이 끝나고 점수를 적으면 시험마다 흐름이 쌓여요.</p></div>`
      : html`
        <div class="chips" style="margin-bottom:12px">${names.map((n) => html`<button key=${n} class="chip hue" style=${hue(hOf(n))} aria-pressed=${pick === n ? 'true' : 'false'} onClick=${() => setPick(n)}>${n}</button>`)}</div>
        <div class="hue" style=${hue(hOf(pick))}>
          <div class="legend2"><span><i class="me"></i>내 점수</span><span><i class="av"></i>과목평균</span></div>
          <${Line} pts=${pts} min=${lo} max=${100} unit="" />
        </div>
        <table class="tbl" style="margin-top:8px"><thead><tr><th>시험</th><th class="r">내 점수</th><th class="r">과목평균</th><th class="r">차이</th></tr></thead><tbody>
          ${pts.map((p) => html`<tr key=${p.label}><td>${p.label}</td><td class="r n">${fmt(p.v)}</td><td class="r n">${p.avg == null ? '–' : fmt(p.avg)}</td><td class=${'r n ' + (p.avg == null ? '' : p.v >= p.avg ? 'up' : 'dn')}>${p.avg == null ? '–' : signed(p.v - p.avg)}</td></tr>`)}
        </tbody></table>
        <p class="hint">1-1은 1학년 1학기예요. 만점이 100점이 아니면 100점 기준으로 바꿔서 그렸어요.</p>
        ${sems.length
          ? html`<div class="sec-title">학기마다 평균 등급<em>학점 가중</em></div>
              <table class="tbl"><tbody>${sems.map(([s, a]) => html`<tr key=${s.id}><td>${s.label}</td><td class="r n">${fmt(a.avg, 2)}등급</td></tr>`)}</tbody></table>`
          : null}`}
  <//>`;
}

// ─────────── 틀린 이유 ───────────

const qCount = (name) => (/국어|영어/.test(name) ? 45 : /수학/.test(name) ? 30 : /한국사/.test(name) ? 20 : 25);

export function WrongSheet({ ex, name }) {
  const e = examOf(ex);
  if (!e) return null;
  const mock = e.kind === 'mock';
  const w = (e.wrong || {})[name] || {};
  const my = () => {
    e.wrong = e.wrong || {};
    return (e.wrong[name] = e.wrong[name] || { counts: {}, items: [] });
  };
  const c = C.wrongCounts(w);
  const items = [...(w.items || [])].sort((a, b) => a.n - b.n);
  const miss = ((e.snap || {})[name] || []).filter((s) => s.f < 1);
  return html`<${Sheet} title=${`${name} · 틀린 이유`} tall footer=${html`<button class="btn pri" onClick=${closeSheet}>다 됐어요</button>`}>
    <div class="hue" style=${hue(hOf(name))}>
      ${mock
        ? html`<p class="sub" style="margin:0 0 10px">틀린 문항 번호를 누르고, 번호마다 이유를 골라 주세요.</p>
            <div class="numgrid">${Array.from({ length: qCount(name) }, (_, i) => i + 1).map((n) => {
              const on = items.some((x) => x.n === n);
              return html`<button key=${n} class="num" aria-pressed=${on ? 'true' : 'false'} onClick=${() => {
                const m = my();
                m.items = on ? m.items.filter((x) => x.n !== n) : [...(m.items || []), { n, r: null }];
                commit();
              }}>${n}</button>`;
            })}</div>
            ${items.map((it) => html`<div class="wr" key=${it.n}>
              <b class="num">${it.n}번</b>
              <div class="chips">${C.WRONG.map((r) => html`<button key=${r} class="chip hue" aria-pressed=${it.r === r ? 'true' : 'false'} onClick=${() => {
                const m = my();
                const x = m.items.find((y) => y.n === it.n);
                x.r = x.r === r ? null : r;
                commit();
              }}>${r}</button>`)}</div>
            </div>`)}`
        : html`<p class="sub" style="margin:0 0 10px">이유마다 몇 문제였는지 적어 주세요. 모르면 비워 둬도 돼요.</p>
            <div class="set-list">${C.WRONG.map((r) => html`<div class="set-row" key=${r}>
              <span class="l"><b>${r}</b></span>
              <${Stepper} label=${r + ' 개수'} value=${c[r]} step=${1} min=${0} max=${40} fmtv=${(v) => `${v}개`} onChange=${(v) => {
                const m = my();
                m.counts = { ...(m.counts || {}), [r]: v };
                commit();
              }} />
            </div>`)}</div>`}
      <p class="result">합계 <b>${C.WRONG.reduce((a, r) => a + c[r], 0)}</b>개</p>
      ${c['안 한 범위'] && miss.length
        ? html`<div class="card pad" style="margin-top:12px">
            <div class="sec-title" style="margin-top:0">시험 볼 때 덜 끝난 단계</div>
            ${miss.map((s) => html`<div class="kv" key=${s.name}><span class="k">${s.name}</span><span class="v num">${P(s.f)}</span></div>`)}
          </div>`
        : null}
    </div>
  <//>`;
}

export function WrongStatsSheet() {
  const [pick, setPick] = useState('all');
  const exams = [...D().pastExams].filter((e) => e.wrong && Object.keys(e.wrong).length).sort((a, b) => (a.date < b.date ? 1 : -1));
  const names = [...new Set(exams.flatMap((e) => Object.keys(e.wrong)))];
  const sum = (e) => {
    const t = Object.fromEntries(C.WRONG.map((r) => [r, 0]));
    for (const [n, w] of Object.entries(e.wrong)) {
      if (pick !== 'all' && n !== pick) continue;
      const c = C.wrongCounts(w);
      for (const r of C.WRONG) t[r] += c[r];
    }
    return t;
  };
  const total = Object.fromEntries(C.WRONG.map((r) => [r, exams.reduce((a, e) => a + sum(e)[r], 0)]));
  const all = C.WRONG.reduce((a, r) => a + total[r], 0);
  const mx = Math.max(1, ...C.WRONG.map((r) => total[r]));
  return html`<${Sheet} title="틀린 이유 모아 보기" tall>
    ${!exams.length
      ? html`<div class="empty"><h3>아직 적은 이유가 없어요</h3><p>성적 › 시험을 눌러 과목마다 틀린 이유를 적으면 여기에 쌓여요.</p></div>`
      : html`
        <div class="chips" style="margin-bottom:14px">
          <button class="chip" aria-pressed=${pick === 'all' ? 'true' : 'false'} onClick=${() => setPick('all')}>전 과목</button>
          ${names.map((n) => html`<button key=${n} class="chip hue" style=${hue(hOf(n))} aria-pressed=${pick === n ? 'true' : 'false'} onClick=${() => setPick(n)}>${n}</button>`)}
        </div>
        <div class="sec-title" style="margin-top:0">모든 시험 합계<em>${all}개</em></div>
        <div class="lost">${C.WRONG.map((r) => html`<div class="r" key=${r}><span>${r}</span><span class="hb"><i style=${{ width: `${(total[r] / mx) * 100}%`, background: 'var(--ink-2)' }}></i></span><span class="num n">${total[r]}개${all ? html`<small class="muted"> ${P(total[r] / all)}</small>` : null}</span></div>`)}</div>
        <div class="sec-title">시험마다</div>
        ${exams.map((e) => {
          const t = sum(e);
          const txt = C.WRONG.filter((r) => t[r]).map((r) => `${r} ${t[r]}`).join(' · ');
          return html`<div class="kv" key=${e.id}><span class="k">${e.name}</span><span class="v">${txt || html`<span class="muted">–</span>`}</span></div>`;
        })}`}
  <//>`;
}

// ─────────── 성적 계산 방법 ───────────

export function GradeSetupSheet({ sem: semId, rec: recId }) {
  const sem = semOf(semId);
  const r = sem && sem.records.find((x) => x.id === recId);
  if (!r) return html`<${Sheet} title="성적 계산 방법"><p class="muted">기록을 찾을 수 없어요.</p><//>`;
  const sumW = r.elements.reduce((a, e) => a + (+e.weight || 0), 0);
  const upd = (el, k, v) => {
    const n = Number(v);
    if (k === 'name') el.name = v.trim() || el.name;
    else if (!isNaN(n) && n > 0) el[k] = n;
    commit();
  };
  const add = (kind) => {
    const exN = r.elements.filter((e) => e.kind === 'exam').length;
    r.elements.push(kind === 'exam' ? { id: C.uid(), kind, name: `${exN + 1}차 지필`, weight: 30, max: 100, score: null } : { id: C.uid(), kind, name: '수행평가', weight: 10, max: 10, score: null });
    commit();
  };
  return html`<${Sheet} title=${`${r.subject} 성적 계산 방법`} tall wide footer=${html`<button class="btn pri" onClick=${closeSheet}>다 됐어요</button>`}>
    <p class="sub" style="margin:0 0 12px">${sem.label} 기준이에요. 다음 학기에는 이 구성을 그대로 가져와요.</p>
    <div class="set-list">
      <div class="set-row"><span class="l"><b>학점</b><small>성적표 과목명 옆 괄호 숫자</small></span>
        <${Stepper} label="학점" value=${r.credits} step=${1} min=${1} max=${8} fmtv=${(v) => `${v}학점`} onChange=${(v) => {
          r.credits = v;
          commit();
        }} />
      </div>
      <div class="set-row"><span class="l"><b>성적이 나오는 방식</b><small>성취도만 나오는 과목은 평균 등급에서 빠져요</small></span>
        <${Seg} label="성적 방식" value=${r.category} onChange=${(v) => {
          r.category = v;
          commit();
        }} options=${[['grade', '등급까지'], ['achievement', '성취도만']]} />
      </div>
    </div>
    <div class="sec-title" style="margin-top:22px">평가 항목<em>반영 비율 합 ${fmt(sumW, 1)}%</em></div>
    <div class="gel h"><span>이름</span><span>종류</span><span class="c">반영 비율</span><span class="c">만점</span><span></span></div>
    ${r.elements.map((el) => html`<div class="gel" key=${el.id}>
      <input class="input nm" key=${'n' + el.id + el.name} defaultValue=${el.name} aria-label="항목 이름" onChange=${(e) => upd(el, 'name', e.target.value)} />
      <select class="input" aria-label="종류" onChange=${(e) => {
        el.kind = e.target.value;
        commit();
      }}><option value="exam" selected=${el.kind === 'exam'}>지필</option><option value="perf" selected=${el.kind === 'perf'}>수행</option></select>
      <label class="fld"><input class="input pg" inputmode="decimal" key=${'w' + el.id + el.weight} defaultValue=${String(el.weight)} aria-label=${el.name + ' 반영 비율'} onChange=${(e) => upd(el, 'weight', e.target.value)} /><span>%</span></label>
      <label class="fld"><input class="input pg" inputmode="decimal" key=${'m' + el.id + el.max} defaultValue=${String(el.max)} aria-label=${el.name + ' 만점'} onChange=${(e) => upd(el, 'max', e.target.value)} /><span>점</span></label>
      <button class="mini-ib x" aria-label=${el.name + ' 빼기'} onClick=${() => withUndo(`'${el.name}' 뺐어요`, () => (r.elements = r.elements.filter((x) => x.id !== el.id)))}>✕</button>
    </div>`)}
    <div class="btns" style="margin-top:12px">
      <button class="btn" onClick=${() => add('exam')}>+ 지필 항목</button>
      <button class="btn" onClick=${() => add('perf')}>+ 수행 항목</button>
    </div>
    <p class="hint">수행평가는 보통 만점과 반영 비율이 같아요. 예: 반영 20%, 만점 20점.</p>
  <//>`;
}
