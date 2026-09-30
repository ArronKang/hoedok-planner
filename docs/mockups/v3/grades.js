// 성적: 겉에는 시험 목록. 시험을 누르면 '공부한 것 ↔ 결과'를 나란히. 더 들어가면 과목별 계산과 흐름.
import { html } from '../../../src/lib/html.js';
import { useState } from '../../../src/lib/ui.js';
import * as C from './core.js';
import { Icon, Sheet, hue, Seg } from './kit.js';
import { computeRecord, lostBreakdown, rankPercent, weightedAverageGrade, achievementFromRaw } from '../../../src/core/calc/naesin.js';

const { D, UI, openSheet, closeSheet, commit, toast, P, fmt, mdws, md, today } = C;

const hOf = (name) => (D().subjects.find((s) => s.name === name) || C.SUBJECT_PRESETS.find((p) => p.name === name) || { h: 182 }).h;
const semOf = (id) => D().semesters.find((s) => s.id === id);
const examOf = (id) => D().pastExams.find((e) => e.id === id);
const signed = (v, d = 1) => (v == null ? '–' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmt(Math.abs(v), d)}`);

function semAvg(sem) {
  return weightedAverageGrade(sem.records.map((r) => ({ category: r.category, credits: r.credits, rankGrade: r.final.rankGrade })));
}

export function GradesHome() {
  const ex = D().exam;
  const past = [...D().pastExams].sort((a, b) => (a.date < b.date ? 1 : -1));
  const sel = UI().stacks.grades[0];
  const cur = (v, id) => (C.isPadDev() && sel && sel.view === v && sel.id === id ? 'true' : 'false');
  return html`<div class="screen">
    <header class="head">
      <div class="t"><h1>성적</h1></div>
      <button class="ib" aria-label="성적 메뉴" onClick=${() => openSheet({ type: 'gradesMenu' })}><${Icon} n="more" /></button>
    </header>
    <div class="scroll"><div class="body">
      ${!past.length && !D().semesters.length
        ? html`<div class="empty"><h3>아직 적은 성적이 없어요</h3><p>시험이 끝나면 여기서 점수를 적어요. 그 시험을 위해 공부한 기록과 나란히 보여 드려요.</p></div>`
        : null}
      <div>
        <div class="sec-title" style="margin-top:4px">시험</div>
        ${ex
          ? html`<div class="lrow off"><span class="nm"><b>${ex.name}</b><small>${mdws(ex.date)} · 시험이 끝나면 점수를 적어요</small></span><span class="v muted">D-${C.daysLeft()}</span></div>`
          : null}
        ${past.map((e) => {
          let v, small;
          if (e.kind === 'mock') {
            const g = Object.values(e.mock).map((x) => x[2]);
            v = `${fmt(g.reduce((a, b) => a + b, 0) / g.length)}등급`;
            small = '과목 평균';
          } else {
            const sem = semOf(e.semester);
            const diffs = sem.records.map((r) => r.elements.find((el) => el.name === e.elem)).filter((el) => el && el.avg != null).map((el) => el.score - el.avg);
            v = signed(diffs.reduce((a, b) => a + b, 0) / Math.max(1, diffs.length));
            small = '과목평균보다';
          }
          return html`<button class="lrow" key=${e.id} aria-current=${cur('exam', e.id)} onClick=${() => C.push('grades', { view: 'exam', id: e.id }, true)}>
            <span class="nm"><b>${e.name}</b><small>${mdws(e.date)}</small></span>
            <span class="v">${v}<small>${small}</small></span><span class="chev"><${Icon} n="right" s=${18} /></span>
          </button>`;
        })}
      </div>
      ${D().semesters.length
        ? html`<div>
            <div class="sec-title">학기 성적</div>
            ${D().semesters.map((s) => {
              const a = semAvg(s);
              return html`<button class="lrow" key=${s.id} aria-current=${cur('semester', s.id)} onClick=${() => C.push('grades', { view: 'semester', id: s.id }, true)}>
                <span class="nm"><b>${s.label}</b><small>${s.records.length}과목 · 학점 가중 평균</small></span>
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
    ? Object.entries(e.mock).map(([name, [raw, pctile, grade]]) => ({ name, study: (e.study || {})[name], raw, pctile, grade }))
    : sem.records.filter((r) => r.category === 'grade').map((r) => {
        const el = r.elements.find((x) => x.name === e.elem);
        const rk = (e.ranks || {})[r.subject];
        return { name: r.subject, study: (e.study || {})[r.subject], score: el && el.score, avg: el && el.avg, rp: rk ? rankPercent(rk[0], rk[1]) : null, rec: r };
      });
  const prev = [...D().pastExams].filter((x) => x.kind === e.kind && x.date < e.date).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const more = UI().open['rep-' + id];
  return html`<div class="screen"><div class="scroll">
    <div class="head" style="flex-direction:column;align-items:stretch">
      <${Back} label="성적" onClick=${back} />
      <span class="kicker">${mdws(e.date)}</span><h1>${e.name}</h1>
    </div>
    <div class="body">
      <p class="sub" style="margin:0">왼쪽은 이 시험을 위해 공부한 기록, 오른쪽은 결과예요. 판단은 직접 해 보세요.</p>
      <div class="card pad">
        <div class="pair">
          <span class="h">과목</span><span class="h">공부한 것</span><span class="h">결과</span>
          ${rows.map((r) => {
            const s = r.study;
            const resFrac = mock ? (r.pctile != null ? r.pctile / 100 : (10 - r.grade) / 9) : r.score / 100;
            return [
              html`<span class="sep" key=${r.name + 's'}></span>`,
              html`<span class="sn hue" key=${r.name + 'n'} style=${hue(hOf(r.name))} onClick=${r.rec ? () => C.push('grades', { view: 'naesin', sem: e.semester, rec: r.rec.id }) : undefined}><span class="dot"></span>${r.name.replace('공통', '').replace('통합', '통합')}</span>`,
              html`<span class="cell2 hue" key=${r.name + 'a'} style=${hue(hOf(r.name))}>
                ${s
                  ? html`<span class="t2"><b>${P(s.progress)}</b>진도</span><span class="hb"><i style=${{ width: `${s.progress * 100}%` }}></i></span><span class="t2">계획 ${s.planned}개 중 ${P(s.planDone)} 끝냄 · ${s.moved}번 미룸</span>`
                  : html`<span class="t2">기록 없음</span>`}
              </span>`,
              html`<span class="cell2" key=${r.name + 'b'}>
                ${mock
                  ? html`<span class="t2"><b>${r.grade}</b>등급 · 원점수 ${r.raw}${r.pctile != null ? ` · 백분위 ${r.pctile}` : ''}</span>`
                  : html`<span class="t2"><b>${fmt(r.score)}</b>점 · 평균보다 ${signed(r.score - r.avg)}</span>`}
                <span class="hb res"><i style=${{ width: `${resFrac * 100}%` }}></i></span>
                <span class="t2">${mock ? (r.pctile != null ? '막대: 백분위' : '막대: 등급 (절대평가)') : r.rp != null ? `석차 상위 ${fmt(r.rp)}%` : ''}</span>
              </span>`,
            ];
          })}
        </div>
      </div>
      <button class="more-toggle" onClick=${() => C.setUI({ open: { ...UI().open, ['rep-' + id]: !more } })}>${mock ? (prev ? `직전 모의고사(${prev.name})와 비교 · 과목별 흐름` : '과목별 흐름') : '같은 학기 중간고사(1차)와 비교'}<span class="caret">${more ? '▴' : '▾'}</span></button>
      ${more ? (mock ? html`<${MockCompare} e=${e} prev=${prev} />` : html`<${NaesinCompare} e=${e} sem=${sem} />`) : null}
    </div>
  </div></div>`;
}

function MockCompare({ e, prev }) {
  const mocks = [...D().pastExams].filter((x) => x.kind === 'mock').sort((a, b) => (a.date < b.date ? -1 : 1));
  const names = Object.keys(e.mock);
  const [pick, setPick] = useState(names[0]);
  const abs = e.mock[pick][1] == null;
  const pts = mocks.map((m) => ({ label: m.name.replace(' 모의고사', ''), v: m.mock[pick] ? (abs ? m.mock[pick][2] : m.mock[pick][1]) : null }));
  return html`<div class="stack">
    ${prev
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

function Line({ pts, min, max, invert, unit }) {
  const W = 520, H = 180, L = 36, R = 16, T = 16, B = 30;
  const xs = (i) => L + (pts.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (pts.length - 1));
  const ys = (v) => {
    const f = (v - min) / (max - min || 1);
    return invert ? T + f * (H - T - B) : H - B - f * (H - T - B);
  };
  const ticks = invert ? [1, 3, 5, 7, 9] : [min, Math.round((min + max) / 2), max].map((x) => Math.round(x));
  const valid = pts.map((p, i) => [p, i]).filter(([p]) => p.v != null);
  return html`<div class="chart"><svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label="흐름 그래프">
    ${ticks.map((t) => html`<g key=${t}><line class="gl" x1=${L} x2=${W - R} y1=${ys(t)} y2=${ys(t)} /><text class="ax" x=${L - 8} y=${ys(t) + 4} text-anchor="end">${t}</text></g>`)}
    <path class="ln" d=${valid.map(([p, i], k) => `${k ? 'L' : 'M'}${xs(i)} ${ys(p.v)}`).join('')} />
    ${valid.map(([p, i]) => html`<g key=${i}><circle class="pt" cx=${xs(i)} cy=${ys(p.v)} r="5" /><text class="lb" x=${xs(i)} y=${ys(p.v) - 10} text-anchor="middle">${p.v}${unit}</text></g>`)}
    ${pts.map((p, i) => html`<text key=${'x' + i} class="ax" x=${xs(i)} y=${H - 8} text-anchor="middle">${p.label}</text>`)}
  </svg></div>`;
}

function NaesinCompare({ e, sem }) {
  return html`<div class="stack">
    <p class="hint" style="margin:0">같은 학기 1차 지필(중간)과 비교했어요.</p>
    <table class="tbl"><thead><tr><th>과목</th><th class="r">1차</th><th class="r">2차</th><th class="r">변화</th></tr></thead><tbody>
      ${sem.records.filter((r) => r.category === 'grade').map((r) => {
        const a = r.elements.find((x) => x.name === '1차 지필'), b = r.elements.find((x) => x.name === e.elem);
        const d = a && b ? b.score - a.score : null;
        return html`<tr key=${r.id}><td>${r.subject}</td><td class="r n">${a ? fmt(a.score) : '–'}</td><td class="r n">${b ? fmt(b.score) : '–'}</td><td class=${'r n ' + (d > 0 ? 'up' : d < 0 ? 'dn' : '')}>${signed(d)}</td></tr>`;
      })}
    </tbody></table>
  </div>`;
}

/** 학기 성적 */
export function SemesterPage({ id, back }) {
  const sem = semOf(id);
  if (!sem) return html`<div class="placeholder">학기를 골라 주세요</div>`;
  const a = semAvg(sem);
  return html`<div class="screen"><div class="scroll">
    <div class="head" style="flex-direction:column;align-items:stretch">
      <${Back} label="성적" onClick=${back} />
      <span class="kicker">학기 성적</span><h1>${sem.label}</h1>
    </div>
    <div class="overall"><span class="big">${a.avg == null ? '–' : fmt(a.avg, 2)}<small>등급</small></span><span class="meta">학점 가중 평균<br />등급 나오는 <b>${a.count}</b>과목 · <b>${a.credits}</b>학점</span></div>
    <div class="body">
      <table class="tbl"><thead><tr><th>과목</th><th class="r">학점</th><th class="r">합계</th><th class="r">원점수</th><th class="r">성취도</th><th class="r">등급</th></tr></thead><tbody>
        ${sem.records.map((r) => {
          const c = computeRecord(r.elements);
          return html`<tr class="click" key=${r.id} onClick=${() => C.push('grades', { view: 'naesin', sem: sem.id, rec: r.id })}>
            <td><span class="row hue" style=${hue(r.h)}><span class="dot"></span>${r.subject}</span></td>
            <td class="r n">${r.credits}</td><td class="r n">${c.total == null ? '–' : c.total.toFixed(2)}</td><td class="r n">${c.raw ?? '–'}</td>
            <td class="r">${r.final.achievement || achievementFromRaw(c.raw) || '–'}</td><td class="r n">${r.category === 'achievement' ? '–' : r.final.rankGrade ?? '–'}</td>
          </tr>`;
        })}
      </tbody></table>
      <p class="hint">과목을 누르면 평가 항목마다 점수를 적고 합계가 어떻게 나왔는지 볼 수 있어요. 등급은 학교에서 받은 값을 적어요.</p>
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
          ${c.remainingWeight > 0 ? html`<div>아직 안 나온 비율<b>${fmt(c.remainingWeight, 0)}%</b></div>` : null}
        </div>
        ${c.weightSum !== 100 ? html`<p class="hint">반영 비율을 더하면 ${c.weightSum}%예요.</p>` : null}
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

      ${r.category === 'grade'
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
  const row = (label, small, fn) => html`<button class="set-row" onClick=${fn}><span class="l"><b>${label}</b>${small ? html`<small>${small}</small>` : null}</span><${Icon} n="right" s=${18} /></button>`;
  return html`<${Sheet} title="성적">
    <div class="set-list">
      ${row('모의고사 결과 적기', '원점수·백분위·등급', () => openSheet({ type: 'mockEntry' }))}
    </div>
    <p class="hint">내신은 학기 성적 › 과목을 눌러 평가 항목마다 적어요.</p>
  <//>`;
}

export function MockEntrySheet() {
  const names = D().subjects.map((s) => s.name);
  const [vals, setVals] = useState({});
  const [name, setName] = useState('10월 모의고사');
  const set = (n, i, v) => setVals({ ...vals, [n]: Object.assign([null, null, null], vals[n] || [], { [i]: v === '' ? null : Number(v) }) });
  return html`<${Sheet} title="모의고사 결과 적기" tall footer=${html`<button class="btn" onClick=${closeSheet}>취소</button><button class="btn pri" onClick=${() => {
    const mock = {};
    for (const n of names) if (vals[n] && vals[n][2]) mock[n] = vals[n];
    if (!Object.keys(mock).length) return toast('등급을 하나 이상 적어 주세요');
    D().pastExams.push({ id: C.uid(), name, kind: 'mock', date: today(), mock });
    commit();
    closeSheet();
    toast(`${name}을 저장했어요`);
  }}>저장</button>`}>
    <span class="label">시험 이름</span>
    <input class="input" value=${name} onInput=${(e) => setName(e.target.value)} />
    <span class="label">과목마다 <span class="muted" style="font-weight:500">— 영어·한국사는 원점수와 등급만</span></span>
    <table class="tbl"><thead><tr><th>과목</th><th class="r">원점수</th><th class="r">백분위</th><th class="r">등급</th></tr></thead><tbody>
      ${names.map((n) => {
        const abs = /영어|한국사/.test(n);
        return html`<tr key=${n}><td>${n}</td>
          <td class="r"><input class="input pg" inputmode="numeric" aria-label=${n + ' 원점수'} onChange=${(e) => set(n, 0, e.target.value)} /></td>
          <td class="r">${abs ? html`<span class="muted">–</span>` : html`<input class="input pg" inputmode="numeric" aria-label=${n + ' 백분위'} onChange=${(e) => set(n, 1, e.target.value)} />`}</td>
          <td class="r"><input class="input pg" inputmode="numeric" aria-label=${n + ' 등급'} onChange=${(e) => set(n, 2, e.target.value)} /></td></tr>`;
      })}
    </tbody></table>
  <//>`;
}
