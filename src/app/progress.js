// 진도: 겉에는 과목마다 퍼센트와 진도 막대. 과목을 누르면 숫자와 단계·칸, 더 들어가면 기록과 고치기.
// 교재마다 단위가 다르다(쪽·지문·문제·강·회·단원) — 쪽은 '어디까지', 나머지는 칸을 골라 채운다 (core.js 단위).
import { html } from '../lib/html.js';
import { useState } from '../lib/ui.js';
import * as C from './core.js';
import { Icon, Sheet, hue, StageBar, Seg, isPad, NumField, RangeField } from './kit.js';

const { D, PR, UI, today, setUI, openSheet, closeSheet, commit, withUndo, toast, subById, pages, done, status, tot, dn, pct, curStage, bookOf, fmt, P, md, mdws, addDays } = C;

/** 과목 줄 오른쪽 숫자: 퍼센트 또는 분량 (설정 › 진도 화면) */
const headline = (sub) => (PR().pctStyle === 'amount' && C.soleUnit(sub) ? html`${dn(sub)}<small>/${C.amountText(C.soleUnit(sub), tot(sub), true)}</small>` : P(pct(sub)));

function SubjectRow({ sub, current }) {
  const cur = curStage(sub);
  const empty = !sub.stages.length;
  const left = C.tally(sub.stages.map((s) => [C.stageUnit(sub, s), pages(s) - done(s)]));
  return html`<button class="sj hue" style=${hue(sub.h)} aria-current=${current ? 'true' : 'false'} onClick=${() => (empty ? openSheet({ type: 'setup', id: sub.id }) : C.push('progress', { view: 'subject', id: sub.id }, true))}>
    <div class="top"><span class="dot"></span><span class="name">${sub.name}</span>${empty ? null : html`<span class="pct">${headline(sub)}</span>`}</div>
    ${empty
      ? html`<div class="setup">교재를 넣으면 진도가 보여요 ›</div>`
      : html`<${StageBar} sub=${sub} />
        <div class="now">${cur ? html`지금 <b>${cur.name}</b> · 남은 ${C.tallyText(left)}` : '모든 단계를 끝냈어요'}</div>`}
  </button>`;
}

export function ProgressList() {
  const ex = D().exam;
  const o = C.overall();
  const sel = C.top('progress');
  const pad = isPad();
  const units = C.UNITS.filter((u) => o.all[u.id]);
  // 교재를 넣은 과목만 카드로, 안 넣은 과목은 아래 한 줄에 모은다 (주황 안내 카드가 여러 장 쌓이지 않게)
  const ready = D().subjects.filter((s) => s.stages.length);
  const waiting = D().subjects.filter((s) => !s.stages.length);
  return html`<div class="screen">
    <header class="head">
      <div class="t"><span class="kicker">${ex ? `${mdws(ex.date)}${C.isGoal(ex) ? ' 끝낼 날' : ''}` : '다음 시험 안 정함'}</span><h1>${ex ? ex.name : '진도'}</h1></div>
      ${ex && !C.examDay() ? html`<span class="dday-chip still">남은 날<b>${C.daysLeft()}일</b></span>` : null}
      ${!ex ? html`<button class="btn sm" style="margin-top:4px" onClick=${() => openSheet({ type: 'cycle', step: 'next' })}>정하기</button>` : null}
      <button class="ib" aria-label="진도 메뉴" onClick=${() => openSheet({ type: 'progressMenu' })}><${Icon} n="more" /></button>
    </header>
    ${units.length
      ? html`<div class="overall">
          <span class="big">${Math.round(o.p * 100)}<small>%</small></span>
          <span class="meta"><span class="ml">전 과목</span><span class="mu">${units.slice(0, 3).map((u) => html`<span key=${u.id}>${u.name} <b>${o.fin[u.id] || 0}</b>/${o.all[u.id]}</span>`)}</span></span>
        </div>
        <div class="divider"></div>`
      : null}
    <div class="scroll"><div class="body" style="padding-top:14px">
      ${ready.map((s, i) => html`<${SubjectRow} key=${s.id} sub=${s} current=${pad && ((sel && sel.id === s.id) || (!sel && i === 0))} />`)}
      ${!ready.length && waiting.length
        ? html`<div class="empty small"><h3>교재를 넣으면 진도가 생겨요</h3><p>과목을 누르고 쓰는 교재와 시험 범위를 넣으면, 1회독·2회독 단계와 날짜별 할 양이 저절로 만들어져요.</p></div>`
        : null}
      ${waiting.length
        ? html`<div class="waiting">
            <div class="sec-title" style="margin-top:4px">교재를 아직 안 넣은 과목<em>눌러서 넣기</em></div>
            <div class="chips">${waiting.map((s) => html`<button key=${s.id} class="chip hue add" style=${hue(s.h)} onClick=${() => openSheet({ type: 'setup', id: s.id })}><span class="dot"></span>${s.name}</button>`)}</div>
          </div>`
        : null}
      <button class="addline" onClick=${() => openSheet({ type: 'addSubject' })}><${Icon} n="plus" s=${20} />과목 추가</button>
    </div></div>
  </div>`;
}

function Facts({ sub }) {
  const f = C.facts(sub);
  const ex = D().exam;
  if (!f.unit)
    // 단위가 섞인 과목: 남은 분량은 단위마다, 하루 몫은 예상 시간으로 (쪽과 강을 더할 수 없으므로)
    return html`<div class="facts">
      <div class="fact"><div class="k">남은 분량</div><div class="v sm">${C.tallyText(f.remT, '없음')}</div></div>
      <div class="fact"><div class="k">${C.endWord()}까지</div><div class="v">${ex ? f.dl : '–'}<small>일</small></div></div>
      <div class="fact"><div class="k">지금까지 하루 평균</div><div class="v sm">${C.minutes(Math.round(f.avgMin))}</div></div>
      <div class="fact"><div class="k">하루씩 나누면</div><div class="v sm">${ex && f.perMin != null ? C.minutes(Math.round(f.perMin)) : '–'}</div></div>
    </div>`;
  const U = C.unitDef(f.unit).name;
  return html`<div class="facts">
    <div class="fact"><div class="k">남은 분량</div><div class="v">${f.rem}<small>${U}</small></div></div>
    <div class="fact"><div class="k">${C.endWord()}까지</div><div class="v">${ex ? f.dl : '–'}<small>일</small></div></div>
    <div class="fact"><div class="k">지금까지 하루 평균</div><div class="v">${fmt(f.avg)}<small>${U}</small></div></div>
    <div class="fact"><div class="k">하루씩 나누면</div><div class="v">${ex ? fmt(f.per) : '–'}<small>${U}</small></div></div>
  </div>`;
}

/** 단계 줄의 작은 글씨: 교재 · 범위 · 어디까지 */
function stageSmall(sub, s) {
  const b = bookOf(sub, s);
  const bn = b && !s.name.includes(b.name) ? b.name + ' ' : '';
  const sp = C.spanText(sub, b, s.from, s.to);
  if (status(s) !== 'doing') return bn + sp;
  return `${bn}${sp} · ${s.marks ? `${done(s)}칸 채움` : `${s.upto}쪽까지 함`}`;
}

function StageList({ sub }) {
  return html`<div class="stagelist">
    ${sub.stages.map((s) => {
      const st = status(s);
      const f = pages(s) ? done(s) / pages(s) : 0;
      return html`<button key=${s.id} class=${'stg ' + st} onClick=${() => openSheet({ type: 'record', sub: sub.id, stage: s.id })}>
        <span class="mk">${st === 'doing' ? html`<i style=${{ width: `${f * 100}%` }}></i>` : st === 'done' ? html`<${Icon} n="check" s=${14} w=${2.6} />` : null}</span>
        <span class="nm"><b>${s.name}</b><small>${stageSmall(sub, s)}</small></span>
        <span class="mini"><i style=${{ width: `${f * 100}%` }}></i></span>
        <span class="v">${done(s)}<small>/${pages(s)}</small></span>
      </button>`;
    })}
  </div>`;
}

const GRID_MAX = 30; // 칸이 이보다 많으면 처음엔 앞부분만 (나머지는 '모두 보기')

/** 칸 교재: 칸(줄) × 회독(열). 칸을 누르면 채워지고 다시 누르면 비워진다. 오른쪽 끝은 그 칸을 본 횟수 */
function CellGrid({ sub, b, first }) {
  const st = sub.stages.filter((s) => s.bookId === b.id);
  const open = UI().open['grid-' + b.id];
  if (!st.length) return null;
  const cnt = C.psgCounts(sub, b);
  const mn = Math.min(...cnt.map((x) => x.n)), mx = Math.max(...cnt.map((x) => x.n));
  const rows = open || cnt.length <= GRID_MAX ? cnt : cnt.slice(0, 20);
  const wideLabel = b.labels && b.labels.some((l) => l.length > 5);
  return html`<div>
    <div class="sec-title">${b.name}<em>${first ? '칸을 누르면 채워지고, 다시 누르면 비워져요' : C.spanText(sub, b, b.from, b.to)}</em></div>
    <div class=${'pgg' + (wideLabel ? ' wide' : '')} style=${{ '--n': st.length }} role="grid" aria-label=${b.name + ' 칸별 진도'}>
      <span class="hd"></span>
      ${st.map((s) => html`<span class="hd ell" key=${'h' + s.id} title=${s.name}>${s.name.replace(' · ' + b.name, '')}</span>`)}
      <span class="hd r">본 횟수</span>
      ${rows.map((x) => [
        html`<span class="rl ell" key=${'l' + x.u} title=${C.itemName(sub, b, x.u)}><b>${C.itemShort(b, x.u)}</b></span>`,
        ...st.map((s) => {
          const on = C.isMarked(s, x.u);
          const inside = x.u >= s.from && x.u <= s.to;
          return inside
            ? html`<button key=${s.id + x.u} class=${'c' + (on ? ' on' : '')} aria-pressed=${on ? 'true' : 'false'} aria-label=${`${s.name} ${C.itemName(sub, b, x.u)}`} onClick=${() => {
                C.toggleCell(sub, s, x.u);
                commit();
              }}></button>`
            : html`<span key=${s.id + x.u} class="c out" aria-hidden="true"></span>`;
        }),
        html`<span class=${'ct num' + (mx - mn >= 1 && x.n === mn ? ' low' : '')} key=${'n' + x.u}>${x.n}</span>`,
      ])}
    </div>
    ${cnt.length > GRID_MAX
      ? html`<button class="linkrow-btn" style="margin-top:8px" onClick=${() => setUI({ open: { ...UI().open, ['grid-' + b.id]: !open } })}>${open ? '앞부분만 보기' : `${cnt.length}칸 모두 보기`}</button>`
      : null}
  </div>`;
}

function Recent({ sub }) {
  const td = today();
  const days = Array.from({ length: 14 }, (_, i) => addDays(td, i - 13));
  const vals = days.map((d) => (sub.log || {})[d] || 0);
  const mx = Math.max(1, ...vals);
  const k = C.soleUnit(sub);
  const sum = C.tally(days.flatMap((d) => Object.entries(C.logTally(sub, d))));
  return html`<div>
    <div class="sec-title">최근 2주, 날마다 한 양<em>합계 ${C.tallyText(sum, '0' + C.unitWord(k))}</em></div>
    <div class="vbars">${vals.map((v, i) => html`<div key=${days[i]} title=${`${md(days[i])} ${C.tallyText(C.logTally(sub, days[i]), '0')}`}><i class=${v ? '' : 'zero'} style=${{ height: `${Math.max(3, (v / mx) * 100)}%` }}></i></div>`)}</div>
    <div class="vbars-x"><span>${md(days[0])}</span><span>오늘</span></div>
  </div>`;
}

function Coverage({ sub }) {
  const rb = C.refBook(sub);
  if (!rb || C.isCell(sub, rb)) return null;
  const labels = C.partLabels(sub), cnt = C.counts(sub), low = C.lowest(sub);
  return html`<div>
    <div class="sec-title">구간마다 몇 번 봤나<em>${rb.name} 쪽 기준</em></div>
    ${sub.stages.map((s) => html`<div class="cov-row" key=${s.id}><span class="nm ell">${s.name}</span><span class="cells">${Array.from({ length: C.PARTS }, (_, i) => {
      const v = C.share(sub, s, i);
      return html`<i key=${i} class=${v == null ? 'n' : v >= 0.98 ? 'f' : v > 0.02 ? 'h' : ''}></i>`;
    })}</span></div>`)}
    <div class="cov-x">${labels.map((l) => html`<span key=${l}>${l}</span>`)}</div>
    <div class="cov-cnt">${cnt.map((v, i) => html`<div key=${i} class=${low.includes(i) ? 'low' : ''}><b>${fmt(v)}</b>번</div>`)}</div>
  </div>`;
}

function Upcoming({ sub }) {
  const td = today();
  const list = D().tasks.filter((t) => t.subjectId === sub.id && t.status === 'todo' && t.date >= td && t.kind === 'track').sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 6);
  if (!list.length) return html`<p class="hint">이 과목은 앞으로 잡힌 할 일이 없어요.</p>`;
  return html`<div>
    <div class="sec-title">앞으로 잡힌 할 일</div>
    ${list.map((t) => {
      const s = sub.stages.find((x) => x.id === t.stageId);
      return html`<div class="kv" key=${t.id}><span class="k">${mdws(t.date)}</span><span class="v">${s ? s.name : ''} <span class="num">${C.trng(t)}</span></span></div>`;
    })}
  </div>`;
}

export function SubjectPage({ id, back }) {
  const sub = subById(id) || D().subjects.find((s) => s.stages.length) || D().subjects[0];
  if (!sub) return html`<div class="placeholder">과목을 넣어 주세요</div>`;
  if (!sub.stages.length)
    return html`<div class="screen hue" style=${hue(sub.h)}>
      ${back ? html`<div style="padding:10px var(--pad) 0"><button class="back" onClick=${back}><${Icon} n="left" s=${20} />진도</button></div>` : null}
      <div class="empty" style="margin:auto"><h3>${sub.name}에 쓸 교재를 넣어 주세요</h3><p>교재만 넣으면 1회독, 2회독… 단계와 날짜별 할 양은 알아서 만들어져요.</p><button class="btn pri" onClick=${() => openSheet({ type: 'setup', id: sub.id })}>교재 넣기</button></div>
    </div>`;
  const p = PR();
  const cur = curStage(sub);
  const lowT = p.lowest ? C.lowestText(sub) : '';
  const rw = C.remainingWeight(sub);
  const more = UI().open['more-' + sub.id];
  const doneStages = sub.stages.filter((s) => status(s) === 'done').length;
  const cellBooks = sub.books.filter((b) => C.isCell(sub, b) && sub.stages.some((s) => s.bookId === b.id));
  const k = C.soleUnit(sub);
  return html`<div class="screen hue" style=${hue(sub.h)}>
    <div class="scroll">
      <div class="sp-head">
        <div class="row">
          ${back ? html`<button class="back" onClick=${back}><${Icon} n="left" s=${20} />진도</button>` : null}
          <span class="grow"></span>
          <button class="ib" aria-label="과목 메뉴" onClick=${() => openSheet({ type: 'subjectMenu', id: sub.id })}><${Icon} n="more" /></button>
        </div>
        <div class="row1"><h1>${sub.name}</h1><span class="pct">${P(pct(sub))}</span></div>
        <div class="meta"><span>${sub.stages.length}단계 중 ${doneStages}개 끝</span><span>${k ? `${C.amountText(k, tot(sub))} 중 ${dn(sub)}` : `${C.tallyText(C.dnU(sub), '0')} 함`}</span></div>
        <${StageBar} sub=${sub} big legend=${p.legend} onCell=${(s) => openSheet({ type: 'record', sub: sub.id, stage: s.id })} />
      </div>
      <div class="body" style="padding-top:18px">
        ${cur
          ? html`<button class="btn pri block" onClick=${() => openSheet({ type: 'record', sub: sub.id, stage: cur.id })}>${cur.name} — ${cur.marks ? '칸 채우기' : '몇 쪽까지 했는지 적기'}</button>`
          : null}
        <${Facts} sub=${sub} />
        ${rw
          ? html`<button class="kv linkrow" onClick=${() => C.push('grades', { view: 'naesin', sem: C.curSemester().id, rec: rw.rec.id }, true)}><span class="k">아직 점수가 안 나온 비중</span><span class="v"><b class="num">${fmt(rw.rem, 0)}%</b> ›</span></button>`
          : null}
        ${lowT
          ? html`<button class="note" onClick=${() => setUI({ open: { ...UI().open, ['more-' + sub.id]: true } })}><span class="nt"><small>가장 적게 본 곳</small><b>${lowT}</b></span><span class="go">${C.isCell(sub, C.refBook(sub)) ? '' : '자세히'}</span></button>`
          : null}
        <div>
          <div class="sec-title">단계<em>눌러서 ${cellBooks.length === sub.books.length ? '칸 채우기' : cellBooks.length ? '적기' : '몇 쪽까지 했는지 적기'}</em></div>
          <${StageList} sub=${sub} />
        </div>
        ${cellBooks.map((b, i) => html`<${CellGrid} key=${b.id} sub=${sub} b=${b} first=${i === 0} />`)}
        <div>
          <button class="more-toggle" onClick=${() => setUI({ open: { ...UI().open, ['more-' + sub.id]: !more } })} aria-expanded=${more ? 'true' : 'false'}>기록 더 보기<span class="caret">${more ? '▴' : '▾'}</span></button>
          ${more
            ? html`<div class="stack appear">
                ${p.recent ? html`<${Recent} sub=${sub} />` : null}
                <${Coverage} sub=${sub} />
                <${Upcoming} sub=${sub} />
              </div>`
            : null}
        </div>
      </div>
    </div>
  </div>`;
}

// ─────────── 시트 ───────────

/** 단계 적기: 쪽 교재는 '몇 쪽까지', 칸 교재는 칸을 눌러 채우기 */
export function RecordSheet({ sub: sid, stage: stid }) {
  const sub = subById(sid);
  const s = sub && sub.stages.find((x) => x.id === stid);
  const [v, setV] = useState(() => (s ? (s.upto ?? s.from - 1) : 0));
  if (!s) return html`<${Sheet} title="단계"><p class="muted">없는 단계예요.</p><//>`;
  const b = bookOf(sub, s);
  if (s.marks) {
    // 칸: 누르면 바로 반영
    const all = Array.from({ length: pages(s) }, (_, i) => s.from + i);
    const wide = b && b.labels && b.labels.some((l) => l.length > 4);
    const fill = (on) => {
      const bf = done(s);
      C.markRange(s, s.from, s.to, on);
      C.logAdd(sub, today(), done(s) - bf, C.stageUnit(sub, s));
      commit();
    };
    return html`<${Sheet} title=${s.name} footer=${html`<button class="btn pri" onClick=${closeSheet}>다 됐어요</button>`}>
      <div class="hue" style=${hue(sub.h)}>
        <p class="sub" style="margin:0 0 12px">${b && !s.name.includes(b.name) ? b.name + ' ' : ''}${C.spanText(sub, b, s.from, s.to)} · 한 것을 눌러 주세요</p>
        <div class=${'numgrid' + (wide ? ' wide' : '')}>${all.map((u) => html`<button key=${u} class=${b && b.labels ? '' : 'num'} aria-pressed=${C.isMarked(s, u) ? 'true' : 'false'} aria-label=${C.itemName(sub, b, u)} onClick=${() => {
          C.toggleCell(sub, s, u);
          commit();
        }}>${C.itemShort(b, u)}</button>`)}</div>
        <div class="chips" style="justify-content:center;margin-top:14px">
          <button class="chip" onClick=${() => fill(false)}>모두 비우기</button>
          <button class="chip" onClick=${() => fill(true)}>모두 채우기</button>
        </div>
        <p class="result">채운 칸 <b>${done(s)}</b> / ${pages(s)}</p>
      </div>
    <//>`;
  }
  const save = () => {
    const before = pct(sub);
    withUndo(() => `${sub.name} 진도 ${P(before)} → ${P(pct(sub))}`, () => C.recordStage(sub, s, v));
    closeSheet();
  };
  const set = (x) => setV(C.clamp(x, s.from - 1, s.to));
  return html`<${Sheet} title=${s.name} footer=${html`<button class="btn" onClick=${closeSheet}>취소</button><button class="btn pri" onClick=${save}>저장</button>`}>
    <div class="hue" style=${hue(sub.h)}>
      <p class="sub" style="text-align:center;margin:0 0 6px">${b ? b.name + ' ' : ''}${s.from}–${s.to}쪽 중 어디까지 했어요?</p>
      <div class="upto"><${NumField} cls="input big" value=${v < s.from ? null : v} empty min=${s.from} max=${s.to} unit="쪽" placeholder="–" label="몇 쪽까지" onLive=${(n) => n != null && set(n)} onCommit=${(n) => set(n == null ? s.from - 1 : n)} />쪽까지</div>
      <input class="range" type="range" min=${s.from - 1} max=${s.to} value=${v} onInput=${(e) => set(+e.target.value)} aria-label="몇 쪽까지" />
      <div class="range-x"><span>시작 전</span><span>${s.to}쪽</span></div>
      <div class="chips" style="justify-content:center;margin-top:14px">
        <button class="chip" onClick=${() => set(s.from - 1)}>아직 안 함</button>
        <button class="chip" onClick=${() => set(Math.floor((s.from + s.to) / 2))}>절반</button>
        <button class="chip" onClick=${() => set(s.to)}>끝까지</button>
      </div>
      <p class="result">한 양 <b>${Math.max(0, v - s.from + 1)}</b> / ${pages(s)}쪽</p>
      <p class="hint" style="text-align:center">오늘 화면에서 체크해도 여기에 저절로 반영돼요.</p>
    </div>
  <//>`;
}

export function SubjectMenu({ id }) {
  const sub = subById(id);
  const row = (label, small, fn, danger) => html`<button class="set-row" onClick=${fn}><span class="l"><b style=${danger ? 'color:var(--flag)' : ''}>${label}</b>${small ? html`<small>${small}</small>` : null}</span><${Icon} n="right" s=${18} /></button>`;
  return html`<${Sheet} title=${sub.name}>
    <div class="set-list">
      ${row('교재와 단계 고치기', '교재 이름·범위·세는 단위(쪽·지문·단원…), 단계 순서', () => openSheet({ type: 'edit', id }))}
      ${row('공부 순서 바꾸기', '개념 → 문제 → 개념 → 심화 같은 순서를 다시 골라요', () => openSheet({ type: 'routine', id }))}
      ${D().exam ? row('이 과목만 다시 나누기', `남은 분량을 ${C.endWord()}까지 새로 나눠요`, () => openSheet({ type: 'plan', only: id })) : null}
      ${row('성적 계산 방법', '학점, 평가 항목과 반영 비율', () => C.openGradeSetup(id))}
      ${row('색 바꾸기', '', () => openSheet({ type: 'color', id }))}
    </div>
    <div class="set-list" style="margin-top:16px">
      ${row('이 과목 빼기', '할 일과 진도 기록도 함께 사라져요', () => {
        withUndo(`${C.josa(sub.name, '을', '를')} 뺐어요`, () => {
          D().subjects = D().subjects.filter((s) => s.id !== id);
          D().tasks = D().tasks.filter((t) => t.subjectId !== id);
        });
        C.setUI({ sheet: null, stacks: { ...UI().stacks, progress: [] } });
      }, true)}
    </div>
  <//>`;
}

export function ProgressMenu() {
  const row = (label, small, fn) => html`<button class="set-row" onClick=${fn}><span class="l"><b>${label}</b>${small ? html`<small>${small}</small>` : null}</span><${Icon} n="right" s=${18} /></button>`;
  const ex = D().exam;
  return html`<${Sheet} title="진도">
    <div class="set-list">
      ${ex ? row('모든 과목 다시 나누기', `남은 분량을 ${C.endWord()}까지 새로 나눠요`, () => openSheet({ type: 'plan' })) : null}
      ${row('과목 추가', '', () => openSheet({ type: 'addSubject' }))}
      ${ex
        ? row(C.isGoal(ex) ? '끝낼 날 바꾸기' : '시험 바꾸기', '이름과 날짜', () => openSheet({ type: 'settings', page: 'exam' }))
        : row('다음 시험 정하기', '시험이나 끝낼 날', () => openSheet({ type: 'cycle', step: 'next' }))}
      ${ex ? row(C.isGoal(ex) ? '이 기간 정리하기' : '이 시험 정리하기', C.isGoal(ex) ? '남은 할 일을 치우고 다음을 정해요' : '결과를 적고 다음 시험을 준비해요', () => openSheet({ type: 'cycle' })) : null}
    </div>
    <button class="linkrow-btn" onClick=${() => openSheet({ type: 'settings', page: 'progressView' })}>진도 화면에 보일 것 고르기 ›</button>
  <//>`;
}

export function ColorSheet({ id }) {
  const sub = subById(id);
  return html`<${Sheet} title=${`${sub.name} 색`}>
    <p class="hint" style="margin:0 0 12px">어떤 색을 골라도 지금 디자인에 맞는 밝기로 바뀌어요.</p>
    <div class="swatches">${C.HUES.map((h) => html`<button key=${h} class="swatch hue" style=${hue(h)} aria-pressed=${sub.h === h ? 'true' : 'false'} aria-label=${'색 ' + h} onClick=${() => {
      sub.h = h;
      commit();
    }}></button>`)}</div>
  <//>`;
}

// ─────────── 교재 넣기·고치기 ───────────

/** 단위 고르기 (교재 하나). 바꾸면 적어 둔 진도는 옮길 수 있는 만큼 옮긴다 (core.setBookUnit) */
function UnitPick({ sub, b, onDone, onChanged }) {
  const cur = C.bookUnit(sub, b);
  const has = sub.stages.some((s) => s.bookId === b.id && done(s));
  return html`<div class="unit-pick appear" role="radiogroup" aria-label=${b.name + ' 세는 단위'}>
    ${C.UNITS.map((u) => html`<button key=${u.id} class="chip" role="radio" aria-checked=${cur === u.id ? 'true' : 'false'} aria-pressed=${cur === u.id ? 'true' : 'false'} onClick=${() => {
      if (u.id !== cur) {
        C.setBookUnit(sub, b, u.id);
        if (u.id === 'ch' && !b.labels) C.setBookLabels(sub, b, C.genLabels(1, Math.max(1, Math.ceil((b.to - b.from + 1) / 3)), 3).slice(0, Math.max(1, b.to - b.from + 1)));
        commit();
        onChanged && onChanged();
      }
      onDone();
    }}><b>${u.name}</b><small>${u.desc}</small></button>`)}
    ${has ? html`<p class="hint" style="width:100%">바꿔도 한 진도는 옮길 수 있는 만큼 옮겨요. 단원으로 바꿀 때는 칸 이름에 맞춰 다시 채워 주세요.</p>` : null}
  </div>`;
}

/**
 * 교재 목록 — 과목 하나. 줄마다: 이름 / 세는 단위 / 범위(또는 단원 이름).
 * compact: 처음 설정(제안 칩 적게) · lean: 범위만(다음 범위 확인) · edit: 이름도 고칠 수 있게 · onChanged: 범위·단위가 바뀌면
 */
export function BookEditor({ sub, compact, lean, edit, onChanged, back }) {
  const [custom, setCustom] = useState('');
  const [picking, setPicking] = useState(null);
  const suggest = C.suggestBooks(sub.name).filter((n) => !sub.books.some((b) => b.name === n)).slice(0, compact ? 4 : 8);
  const addBook = (n) => {
    sub.books.push(C.bookFor(sub, n));
    commit();
  };
  const changed = () => onChanged && onChanged();
  return html`<div class="books">
    ${sub.books.map((b) => {
      const k = C.bookUnit(sub, b);
      const u = C.unitDef(k);
      return html`<div class="brow2" key=${b.id}>
        <div class="bhd">
          ${edit
            ? html`<input class="input bname" key=${'n' + b.id + b.name} defaultValue=${b.name} aria-label="교재 이름" onChange=${(e) => {
                if (e.target.value.trim()) b.name = e.target.value.trim();
                commit();
              }} />`
            : html`<span class="bn ell">${b.name}</span>`}
          <button class=${'unit-chip' + (picking === b.id ? ' on' : '')} aria-expanded=${picking === b.id ? 'true' : 'false'} aria-label=${`${b.name} 세는 단위: ${u.name}. 눌러서 바꾸기`} onClick=${() => setPicking(picking === b.id ? null : b.id)}>${u.name}<${Icon} n="down" s=${14} w=${2.2} /></button>
          <button class="mini-ib x" aria-label=${b.name + ' 빼기'} onClick=${() => {
            const had = sub.stages.some((s) => s.bookId === b.id);
            withUndo(`'${b.name}' 뺐어요`, () => {
              sub.books = sub.books.filter((x) => x.id !== b.id);
              sub.stages = sub.stages.filter((s) => s.bookId !== b.id);
            });
            if (had) changed();
          }}>✕</button>
        </div>
        ${picking === b.id ? html`<${UnitPick} sub=${sub} b=${b} onDone=${() => setPicking(null)} onChanged=${changed} />` : null}
        <div class="bctl">
          ${b.labels
            ? html`<button class="lbl-sum" onClick=${() => openSheet({ type: 'labels', id: sub.id, book: b.id, back })}>
                <span class="ell"><b>${C.spanText(sub, b, b.from, b.to)}</b> · ${b.labels.length}개</span><span class="go">이름 고치기 ›</span>
              </button>`
            : html`<${RangeField} from=${b.from} to=${b.to} unit=${k === 'page' ? '쪽' : k === 'psg' ? '번' : k === 'q' ? '번' : u.name} label=${b.name} onCommit=${(f, t) => {
                C.setBookRange(sub, b, f, t);
                commit();
                changed();
              }} />
              ${k === 'ch' ? html`<button class="linkbtn" onClick=${() => openSheet({ type: 'labels', id: sub.id, book: b.id, back })}>이름 붙이기</button>` : null}`}
        </div>
      </div>`;
    })}
    ${lean
      ? null
      : html`<div class="chips" style="margin-top:10px">
          ${suggest.map((n) => html`<button key=${n} class="chip add" onClick=${() => addBook(n)}>+ ${n}</button>`)}
          <form style="display:flex;gap:6px" onSubmit=${(e) => {
            e.preventDefault();
            if (custom.trim()) {
              addBook(custom.trim());
              setCustom('');
            }
          }}><input class="input" style="width:150px;min-height:38px;padding:6px 10px" placeholder="직접 적기" value=${custom} onInput=${(e) => setCustom(e.target.value)} aria-label="교재 이름 직접 적기" enterkeyhint="done" /></form>
        </div>`}
  </div>`;
}

/** 단원 이름 정하기: 큰 단원 × 작은 단원으로 만들거나 직접 적기. 채운 칸은 이름으로 따라간다 */
export function LabelsSheet({ id, book, back }) {
  const sub = subById(id);
  const b = sub && sub.books.find((x) => x.id === book);
  const [text, setText] = useState(() => (b && b.labels ? C.labelsText(b.labels) : ''));
  // 지금 이름이 '1-1 … 2-3'처럼 생겼으면 그 모양에서 시작 (만들기 칸과 아래 글이 서로 다르지 않게)
  const [gen, setGen] = useState(() => C.labelsShape(b && b.labels) || { start: 1, big: 2, small: 3 });
  if (!b) return html`<${Sheet} title="단원"><p class="muted">교재를 찾을 수 없어요.</p><//>`;
  const list = C.parseLabels(text);
  const leave = () => (back ? openSheet(back) : closeSheet());
  const make = (g) => {
    setGen(g);
    setText(C.labelsText(C.genLabels(g.start, g.big, g.small)));
  };
  const step = (k, d, lo, hi) => make({ ...gen, [k]: C.clamp(gen[k] + d, lo, hi) });
  return html`<${Sheet} title=${`${b.name} 단원`} tall onClose=${leave} footer=${html`<button class="btn" onClick=${leave}>취소</button><button class="btn pri" disabled=${!list.length} onClick=${() => {
    withUndo(`${b.name} 단원 ${list.length}개로 바꿨어요`, () => {
      if (C.bookUnit(sub, b) !== 'ch') C.setBookUnit(sub, b, 'ch');
      C.setBookLabels(sub, b, list);
    });
    if (back) openSheet({ ...back, changed: true });
    else closeSheet();
  }}>${list.length ? `${list.length}개로 저장` : '저장'}</button>`}>
    <div class="hue" style=${hue(sub.h)}>
      <p class="sub" style="margin:0 0 14px">칸 하나가 단원 하나예요. 영어 교과서라면 '1-1, 1-2…'처럼요.</p>
      <div class="set-list">
        <div class="set-row col">
          <span class="l"><b>번호로 만들기</b><small>큰 단원 × 작은 단원 → 1-1, 1-2 …</small></span>
          <div class="genrow">
            <span>시작</span><span class="stepper sm"><button aria-label="시작 번호 줄이기" onClick=${() => step('start', -1, 1, 99)}>−</button><span>${gen.start}</span><button aria-label="시작 번호 늘리기" onClick=${() => step('start', 1, 1, 99)}>+</button></span>
            <span>큰 단원</span><span class="stepper sm"><button aria-label="큰 단원 줄이기" onClick=${() => step('big', -1, 1, 20)}>−</button><span>${gen.big}개</span><button aria-label="큰 단원 늘리기" onClick=${() => step('big', 1, 1, 20)}>+</button></span>
            <span>작은 단원</span><span class="stepper sm"><button aria-label="작은 단원 줄이기" onClick=${() => step('small', -1, 0, 12)}>−</button><span>${gen.small ? `${gen.small}개` : '없음'}</span><button aria-label="작은 단원 늘리기" onClick=${() => step('small', 1, 0, 12)}>+</button></span>
          </div>
        </div>
        <div class="set-row col">
          <span class="l"><b>직접 적기</b><small>쉼표나 줄바꿈으로 나눠요. '1-1~1-4'처럼 적으면 펼쳐져요</small></span>
          <textarea class="input" rows="3" value=${text} onInput=${(e) => setText(e.target.value)} placeholder="예: 1-1~1-4, 2-1~2-3, 쉬어가기" aria-label="단원 이름"></textarea>
        </div>
      </div>
      <div class="sec-title">${list.length ? `칸 ${list.length}개` : '아직 없어요'}</div>
      <div class="lbl-chips">${list.slice(0, 120).map((l, i) => html`<span key=${i + l}>${l}</span>`)}${list.length > 120 ? html`<span class="muted">… ${list.length - 120}개 더</span>` : null}</div>
      ${sub.stages.some((s) => s.bookId === b.id && done(s)) ? html`<p class="hint">이미 채운 칸은 같은 이름의 칸으로 옮겨져요. 이름이 바뀐 칸은 비워져요.</p>` : null}
    </div>
  <//>`;
}

export function SetupSheet({ id }) {
  const sub = subById(id);
  const [routine, setRoutine] = useState('mine');
  if (!sub) return null;
  const preview = C.buildStages(sub.books, routine);
  return html`<${Sheet}
    title=${`${sub.name} 교재`}
    tall
    footer=${html`<button class="btn" onClick=${closeSheet}>나중에</button><button class="btn pri" disabled=${!sub.books.length} onClick=${() => {
      sub.stages = C.stagesFor(sub, routine);
      sub.routine = routine;
      const n = D().exam ? C.planSubject(sub, today()) : 0;
      commit();
      C.setUI({ sheet: null });
      C.push('progress', { view: 'subject', id: sub.id }, true);
      toast(n ? `${sub.stages.length}단계를 만들고 날짜별로 나눴어요` : `${sub.stages.length}단계를 만들었어요`);
    }}>단계 만들기</button>`}
  >
    <p class="sub" style="margin:0 0 12px">눌러서 넣고, 시험 범위만 맞춰 주세요. 쪽이 아니라 지문·문제·단원으로 세는 교재는 단위를 눌러 바꿔요.</p>
    ${sub.books.length ? null : html`<p class="note-line">아래에서 쓰는 교재를 눌러 넣어 주세요. 목록에 없으면 '직접 적기'에 이름을 적고 완료를 누르면 돼요.</p>`}
    <${BookEditor} sub=${sub} back=${{ type: 'setup', id }} />
    ${sub.books.length
      ? html`<span class="label" style="margin-top:22px">공부 순서</span>
          ${C.ROUTINES.map((r) => html`<button key=${r.id} class="rt" aria-pressed=${routine === r.id ? 'true' : 'false'} onClick=${() => setRoutine(r.id)}><b>${r.name}</b><small>${C.buildStages(sub.books, r.id).map((s) => s.name).join(' → ')}</small></button>`)}
          <p class="hint">${preview.length}단계가 만들어져요. 나중에 이름과 순서를 고칠 수 있어요.</p>`
      : null}
  <//>`;
}

export function RoutineSheet({ id }) {
  const sub = subById(id);
  return html`<${Sheet} title="공부 순서 바꾸기">
    <p class="hint" style="margin:0 0 12px">새 순서로 단계를 다시 만들어요. 적어 둔 진도는 처음으로 돌아가요.</p>
    ${C.ROUTINES.map((r) => html`<button key=${r.id} class="rt" aria-pressed=${sub.routine === r.id ? 'true' : 'false'} onClick=${() => {
      withUndo('단계를 다시 만들었어요', () => {
        sub.stages = C.stagesFor(sub, r.id);
        sub.routine = r.id;
        if (D().exam) C.planSubject(sub, today());
      });
      closeSheet();
    }}><b>${r.name}</b><small>${C.buildStages(sub.books, r.id).map((s) => s.name).join(' → ')}</small></button>`)}
  <//>`;
}

/** 단계 범위 (교재 범위 안에서): 쪽·번호는 두 칸, 단원 이름은 고르기 */
function StageRange({ sub, s, onChanged }) {
  const b = bookOf(sub, s);
  if (!b) return html`<span class="muted small">${C.spanText(sub, null, s.from, s.to)}</span>`;
  const apply = (f, t) => {
    C.setStageRange(s, f, t);
    commit();
    onChanged();
  };
  if (b.labels) {
    const opts = b.labels.map((l, i) => html`<option key=${i} value=${i + 1}>${l}</option>`);
    return html`<span class="rangef-in">
      <select class="input" aria-label="처음 단원" value=${String(s.from)} onChange=${(e) => {
        const f = +e.target.value;
        apply(f, Math.max(f, s.to));
      }}>${opts}</select>
      <span class="tilde">~</span>
      <select class="input" aria-label="끝 단원" value=${String(s.to)} onChange=${(e) => {
        const t = +e.target.value;
        apply(Math.min(s.from, t), t);
      }}>${opts}</select>
    </span>`;
  }
  const k = C.bookUnit(sub, b);
  return html`<${RangeField} from=${s.from} to=${s.to} min=${b.from} max=${b.to} unit=${k === 'page' ? '쪽' : ''} label=${s.name} onCommit=${apply} />`;
}

export function EditSheet({ id, changed: wasChanged }) {
  const sub = subById(id);
  const [dirty, setDirty] = useState(!!wasChanged);
  if (!sub) return null;
  const mark = () => !dirty && setDirty(true);
  const move = (i, d) => {
    const a = sub.stages;
    [a[i], a[i + d]] = [a[i + d], a[i]];
    commit();
    mark();
  };
  const ex = D().exam;
  return html`<${Sheet} title=${`${sub.name} 고치기`} tall wide footer=${dirty && ex && sub.stages.length
    ? html`<button class="btn" onClick=${closeSheet}>그냥 닫기</button><button class="btn pri" onClick=${() => {
        withUndo(`${sub.name} 남은 분량을 다시 나눴어요`, () => C.planSubject(sub, today()));
        closeSheet();
      }}>남은 날에 다시 나누기</button>`
    : html`<button class="btn pri" onClick=${closeSheet}>다 됐어요</button>`}>
    ${dirty && ex && sub.stages.length ? html`<p class="note-line">범위나 단위가 바뀌었어요. 날짜별 할 일도 새 범위로 바꾸려면 아래 '남은 날에 다시 나누기'를 눌러 주세요.</p>` : null}
    <div class="sec-title" style="margin-top:0">교재<em>세는 단위를 누르면 바꿀 수 있어요</em></div>
    <${BookEditor} sub=${sub} edit onChanged=${mark} back=${{ type: 'edit', id, changed: true }} />
    <div class="sec-title" style="margin-top:26px">회독 단계<em>이름·교재·범위</em></div>
    ${sub.stages.map((s, i) => html`<div class="ed" key=${s.id}>
      <div class="ed-1">
        <span class="i">${i + 1}</span>
        <input class="input nm" key=${'n' + s.id + s.name} defaultValue=${s.name} aria-label="단계 이름" onChange=${(e) => {
          if (e.target.value.trim()) s.name = e.target.value.trim();
          commit();
        }} />
        <button class="mini-ib" aria-label="위로" disabled=${i === 0} onClick=${() => move(i, -1)}>↑</button>
        <button class="mini-ib" aria-label="아래로" disabled=${i === sub.stages.length - 1} onClick=${() => move(i, 1)}>↓</button>
        <button class="mini-ib x" aria-label="단계 빼기" onClick=${() => {
          withUndo(`'${s.name}' 뺐어요`, () => (sub.stages = sub.stages.filter((x) => x.id !== s.id)));
          mark();
        }}>✕</button>
      </div>
      <div class="ed-2">
        <select class="input" aria-label="교재" value=${s.bookId} onChange=${(e) => {
          const b = sub.books.find((x) => x.id === e.target.value);
          if (!b) return;
          withUndo(`'${s.name}' 교재를 ${b.name}(으)로 바꿨어요`, () => {
            s.bookId = b.id;
            s.from = b.from;
            s.to = b.to;
            s.upto = null;
            if (C.isCell(sub, b)) s.marks = [];
            else delete s.marks;
          });
          mark();
        }}>${sub.books.map((b) => html`<option key=${b.id} value=${b.id}>${b.name}</option>`)}</select>
        <${StageRange} sub=${sub} s=${s} onChanged=${mark} />
      </div>
    </div>`)}
    <div class="btns" style="margin-top:12px">
      <button class="btn" disabled=${!sub.books.length} onClick=${() => {
        const b = sub.books[0];
        const s = { id: C.uid(), name: `${sub.stages.length + 1}회독 · ${b.name}`, bookId: b.id, from: b.from, to: b.to, upto: null };
        if (C.isCell(sub, b)) s.marks = [];
        sub.stages.push(s);
        commit();
        mark();
      }}>+ 단계 하나 더</button>
      <button class="btn" onClick=${() => openSheet({ type: 'routine', id })}>공부 순서 다시 고르기</button>
    </div>
    ${sub.books.length
      ? html`<div class="sec-title" style="margin-top:26px">한 칸에 걸리는 시간<em>오늘 화면의 예상 시간과 나누기에 써요</em></div>
          <div class="set-list">${sub.books.map((b) => {
            const k = C.bookUnit(sub, b);
            const u = C.unitDef(k);
            const per = k === 'page' ? '쪽당' : k === 'ch' ? '단원 하나에' : `${u.name} 하나에`;
            return html`<div class="set-row col" key=${b.id}>
              <span class="l"><b>${b.name}</b><small>${per}</small></span>
              <${Seg} label=${b.name + ' 걸리는 시간'} value=${C.paceOfBook(sub, b)} onChange=${(v) => {
                b.pace = v;
                commit();
              }} options=${(C.PACE_OPTS[k] || C.PACE_OPTS.page).map((m) => [m, `${m}분`])} />
            </div>`;
          })}</div>`
      : null}
  <//>`;
}

export function AddSubjectSheet() {
  const have = new Set(D().subjects.map((s) => s.name));
  const [name, setName] = useState('');
  const add = (n) => {
    const sub = C.newSubject(n);
    D().subjects.push(sub);
    const pre = C.SUBJECT_PRESETS.find((p) => p.name === n);
    if (pre) sub.books = pre.books.slice(0, 2).map((b) => C.presetBook(n, b));
    commit();
    openSheet({ type: 'setup', id: sub.id });
  };
  return html`<${Sheet} title="과목 추가">
    <div class="chips">${C.SUBJECT_PRESETS.filter((p) => !have.has(p.name)).map((p) => html`<button key=${p.name} class="chip add" onClick=${() => add(p.name)}>+ ${p.name}</button>`)}</div>
    <form class="row" style="margin-top:14px" onSubmit=${(e) => {
      e.preventDefault();
      if (name.trim()) add(name.trim());
    }}><input class="input" placeholder="직접 적기" value=${name} onInput=${(e) => setName(e.target.value)} aria-label="과목 이름" /><button class="btn" type="submit" disabled=${!name.trim()}>추가</button></form>
  <//>`;
}
