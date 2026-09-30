// 진도: 겉에는 과목마다 퍼센트와 진도 칸. 과목을 누르면 숫자와 단계, 더 들어가면 기록과 고치기.
import { html } from '../lib/html.js';
import { useState } from '../lib/ui.js';
import * as C from './core.js';
import { Icon, Sheet, hue, StageBar, Seg, isPad } from './kit.js';

const { D, PR, UI, today, setUI, openSheet, closeSheet, commit, withUndo, toast, subById, pages, done, status, tot, dn, pct, curStage, bookOf, fmt, P, md, mdws, addDays } = C;

function SubjectRow({ sub, current }) {
  const cur = curStage(sub);
  const empty = !sub.stages.length;
  return html`<button class="sj hue" style=${hue(sub.h)} aria-current=${current ? 'true' : 'false'} onClick=${() => (empty ? openSheet({ type: 'setup', id: sub.id }) : C.push('progress', { view: 'subject', id: sub.id }, true))}>
    <div class="top"><span class="dot"></span><span class="name">${sub.name}</span>${empty ? null : html`<span class="pct">${P(pct(sub))}</span>`}</div>
    ${empty
      ? html`<div class="setup">교재를 넣으면 진도가 보여요 ›</div>`
      : html`<${StageBar} sub=${sub} />
        <div class="now">${cur ? html`지금 <b>${cur.name}</b>` : '모든 단계를 끝냈어요'} · 남은 ${C.amount(sub, tot(sub) - dn(sub))}</div>`}
  </button>`;
}

export function ProgressList() {
  const ex = D().exam;
  const o = C.overall();
  const sel = C.top('progress');
  const pad = isPad();
  const all = C.mix(D().subjects.map((s) => [s, tot(s)]));
  const fin = C.mix(D().subjects.map((s) => [s, dn(s)]));
  return html`<div class="screen">
    <header class="head">
      <div class="t"><span class="kicker">${ex ? `${mdws(ex.date)}${C.isGoal(ex) ? ' 끝낼 날' : ''}` : '다음 시험 안 정함'}</span><h1>${ex ? ex.name : '진도'}</h1></div>
      ${ex && !C.examDay() ? html`<button class="dday-chip" style="cursor:default">남은 날<b>${C.daysLeft()}일</b></button>` : null}
      ${!ex ? html`<button class="btn sm" style="margin-top:4px" onClick=${() => openSheet({ type: 'cycle', step: 'next' })}>정하기</button>` : null}
      <button class="ib" aria-label="진도 메뉴" onClick=${() => openSheet({ type: 'progressMenu' })}><${Icon} n="more" /></button>
    </header>
    <div class="overall">
      <span class="big">${Math.round(o.p * 100)}<small>%</small></span>
      <span class="meta">전 과목<br />${all.q && all.p
        ? html`<b>${fin.p}</b>/${all.p}쪽 · <b>${fin.q}</b>/${all.q}지문`
        : html`<b>${all.p || all.q}</b>${all.q ? '지문' : '쪽'} 중 <b>${fin.p || fin.q}</b>${all.q ? '지문' : '쪽'}`}</span>
    </div>
    <div class="divider"></div>
    <div class="scroll"><div class="body" style="padding-top:14px">
      ${D().subjects.map((s, i) => html`<${SubjectRow} key=${s.id} sub=${s} current=${pad && ((sel && sel.id === s.id) || (!sel && i === 0))} />`)}
      <button class="addline" onClick=${() => openSheet({ type: 'addSubject' })}><${Icon} n="plus" s=${20} />과목 추가</button>
    </div></div>
  </div>`;
}

function Facts({ sub }) {
  const f = C.facts(sub);
  const U = C.unitOf(sub);
  const ex = D().exam;
  return html`<div class="facts">
    <div class="fact"><div class="k">남은 분량</div><div class="v">${f.rem}<small>${U}</small></div></div>
    <div class="fact"><div class="k">${C.endWord()}까지</div><div class="v">${ex ? f.dl : '–'}<small>일</small></div></div>
    <div class="fact"><div class="k">지금까지 하루 평균</div><div class="v">${fmt(f.avg)}<small>${U}</small></div></div>
    <div class="fact"><div class="k">하루씩 나누면</div><div class="v">${ex ? fmt(f.per) : '–'}<small>${U}</small></div></div>
  </div>`;
}

function StageList({ sub }) {
  return html`<div class="stagelist">
    ${sub.stages.map((s) => {
      const st = status(s);
      const f = pages(s) ? done(s) / pages(s) : 0;
      return html`<button key=${s.id} class=${'stg ' + st} onClick=${() => openSheet({ type: 'record', sub: sub.id, stage: s.id })}>
        <span class="mk">${st === 'doing' ? html`<i style=${{ width: `${f * 100}%` }}></i>` : null}</span>
        <span class="nm"><b>${s.name}</b><small>${bookOf(sub, s) && !s.name.includes(bookOf(sub, s).name) ? bookOf(sub, s).name + ' ' : ''}${C.span(sub, s.from, s.to)}${st === 'doing' ? ` · ${s.upto}쪽까지 함` : ''}</small></span>
        <span class="mini"><i style=${{ width: `${f * 100}%` }}></i></span>
        <span class="v">${done(s)}<small>/${pages(s)}</small></span>
      </button>`;
    })}
  </div>`;
}

/** 지문별 과목: 지문(줄) × 회독(칸). 칸을 누르면 채워지고, 오른쪽 끝은 그 지문을 본 횟수 */
function PassageGrid({ sub }) {
  return html`<div class="stack">
    ${sub.books.map((b, bi) => {
      const st = sub.stages.filter((s) => s.bookId === b.id);
      if (!st.length) return null;
      const cnt = C.psgCounts(sub, b);
      const mn = Math.min(...cnt.map((x) => x.n)), mx = Math.max(...cnt.map((x) => x.n));
      return html`<div key=${b.id}>
        <div class="sec-title">${b.name}${bi === 0 ? html`<em>칸을 누르면 채워지고, 다시 누르면 비워져요</em>` : null}</div>
        <div class="pgg" style=${{ '--n': st.length }} role="grid" aria-label=${b.name + ' 지문별 진도'}>
          <span class="hd"></span>
          ${st.map((s) => html`<span class="hd ell" key=${'h' + s.id} title=${s.name}>${s.name.replace(' · ' + b.name, '')}</span>`)}
          <span class="hd r">본 횟수</span>
          ${cnt.map((x) => [
            html`<span class="rl" key=${'l' + x.u}>지문 <b class="num">${x.u}</b></span>`,
            ...st.map((s) => {
              const on = C.isMarked(s, x.u);
              return html`<button key=${s.id + x.u} class=${'c' + (on ? ' on' : '')} aria-pressed=${on ? 'true' : 'false'} aria-label=${`${s.name} 지문 ${x.u}`} onClick=${() => {
                C.toggleCell(sub, s, x.u);
                commit();
              }}></button>`;
            }),
            html`<span class=${'ct num' + (mx - mn >= 1 && x.n === mn ? ' low' : '')} key=${'n' + x.u}>${x.n}</span>`,
          ])}
        </div>
      </div>`;
    })}
  </div>`;
}

function Recent({ sub }) {
  const td = today();
  const days = Array.from({ length: 14 }, (_, i) => addDays(td, i - 13));
  const vals = days.map((d) => (sub.log || {})[d] || 0);
  const mx = Math.max(1, ...vals);
  const U = C.unitOf(sub);
  return html`<div>
    <div class="sec-title">최근 2주, 날마다 한 ${C.isPsg(sub) ? '지문 수' : '쪽수'}<em>합계 ${vals.reduce((a, b) => a + b, 0)}${U}</em></div>
    <div class="vbars">${vals.map((v, i) => html`<div key=${days[i]} title=${`${md(days[i])} ${v}${U}`}><i class=${v ? '' : 'zero'} style=${{ height: `${Math.max(3, (v / mx) * 100)}%` }}></i></div>`)}</div>
    <div class="vbars-x"><span>${md(days[0])}</span><span>오늘</span></div>
  </div>`;
}

function Coverage({ sub }) {
  const rb = C.refBook(sub);
  if (!rb || C.isPsg(sub)) return null;
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
  const psg = C.isPsg(sub);
  const cur = curStage(sub);
  const lowT = p.lowest ? C.lowestText(sub) : '';
  const rw = C.remainingWeight(sub);
  const more = UI().open['more-' + sub.id];
  const doneStages = sub.stages.filter((s) => status(s) === 'done').length;
  return html`<div class="screen hue" style=${hue(sub.h)}>
    <div class="scroll">
      <div class="sp-head">
        <div class="row">
          ${back ? html`<button class="back" onClick=${back}><${Icon} n="left" s=${20} />진도</button>` : null}
          <span class="grow"></span>
          <button class="ib" aria-label="과목 메뉴" onClick=${() => openSheet({ type: 'subjectMenu', id: sub.id })}><${Icon} n="more" /></button>
        </div>
        <div class="row1"><h1>${sub.name}</h1><span class="pct">${P(pct(sub))}</span></div>
        <div class="meta"><span>${sub.stages.length}단계 중 ${doneStages}개 끝</span><span>${tot(sub)}${C.unitOf(sub)} 중 ${dn(sub)}${C.unitOf(sub)}</span></div>
        <${StageBar} sub=${sub} big legend=${p.legend} onCell=${(s) => openSheet({ type: 'record', sub: sub.id, stage: s.id })} />
      </div>
      <div class="body" style="padding-top:18px">
        ${cur && !psg
          ? html`<button class="btn pri block" onClick=${() => openSheet({ type: 'record', sub: sub.id, stage: cur.id })}>${cur.name} — 몇 쪽까지 했는지 적기</button>`
          : null}
        <${Facts} sub=${sub} />
        ${rw
          ? html`<button class="kv linkrow" onClick=${() => C.push('grades', { view: 'naesin', sem: C.curSemester().id, rec: rw.rec.id }, true)}><span class="k">아직 점수가 안 나온 비중</span><span class="v"><b class="num">${fmt(rw.rem, 0)}%</b> ›</span></button>`
          : null}
        ${lowT
          ? html`<button class="note" onClick=${() => setUI({ open: { ...UI().open, ['more-' + sub.id]: true } })}>가장 적게 본 곳<b>${lowT}</b><span class="go">${psg ? '' : '자세히'}</span></button>`
          : null}
        ${psg
          ? html`<${PassageGrid} sub=${sub} />`
          : html`<div>
              <div class="sec-title">단계<em>눌러서 몇 쪽까지 했는지 적기</em></div>
              <${StageList} sub=${sub} />
            </div>`}
        <div>
          <button class="more-toggle" onClick=${() => setUI({ open: { ...UI().open, ['more-' + sub.id]: !more } })} aria-expanded=${more ? 'true' : 'false'}>기록 더 보기<span class="caret">${more ? '▴' : '▾'}</span></button>
          ${more
            ? html`<div class="stack">
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

export function RecordSheet({ sub: sid, stage: stid }) {
  const sub = subById(sid);
  const s = sub && sub.stages.find((x) => x.id === stid);
  const [v, setV] = useState(() => (s ? (s.upto ?? s.from - 1) : 0));
  if (!s) return html`<${Sheet} title="단계"><p class="muted">없는 단계예요.</p><//>`;
  if (s.marks) {
    // 지문별: 번호를 눌러 채우고 비운다 (바로 반영)
    const all = Array.from({ length: pages(s) }, (_, i) => s.from + i);
    const fill = (on) => {
      const b = done(s);
      C.markRange(s, s.from, s.to, on);
      C.logAdd(sub, today(), done(s) - b);
      commit();
    };
    return html`<${Sheet} title=${s.name} footer=${html`<button class="btn pri" onClick=${closeSheet}>다 됐어요</button>`}>
      <div class="hue" style=${hue(sub.h)}>
        <p class="sub" style="margin:0 0 12px">${bookOf(sub, s)?.name || ''} ${C.span(sub, s.from, s.to)} · 본 지문을 눌러 주세요</p>
        <div class="numgrid">${all.map((u) => html`<button key=${u} class="num" aria-pressed=${C.isMarked(s, u) ? 'true' : 'false'} onClick=${() => {
          C.toggleCell(sub, s, u);
          commit();
        }}>${u}</button>`)}</div>
        <div class="chips" style="justify-content:center;margin-top:14px">
          <button class="chip" onClick=${() => fill(false)}>모두 비우기</button>
          <button class="chip" onClick=${() => fill(true)}>모두 채우기</button>
        </div>
        <p class="result">본 지문 <b>${done(s)}</b> / ${pages(s)}개</p>
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
      <p class="sub" style="text-align:center;margin:0 0 6px">${bookOf(sub, s)?.name || ''} ${s.from}–${s.to}쪽 중 어디까지 했어요?</p>
      <div class="upto"><input class="input big" inputmode="numeric" value=${v < s.from ? '' : String(v)} placeholder="–" onInput=${(e) => set(e.target.value === '' ? s.from - 1 : parseInt(e.target.value) || s.from - 1)} aria-label="몇 쪽까지" />쪽까지</div>
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
      ${row('교재와 단계 고치기', `이름·${C.isPsg(sub) ? '지문 수' : '쪽'}·순서, 쪽 또는 지문으로 세기`, () => openSheet({ type: 'edit', id }))}
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
    <p class="hint">진도 화면에 보일 것은 설정 › 진도 화면에서 고를 수 있어요.</p>
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

/** 교재 넣기 — 과목 하나. 지문별 과목이면 범위가 지문 번호가 된다 */
export function BookEditor({ sub, compact, lean }) {
  const [custom, setCustom] = useState('');
  const pre = C.SUBJECT_PRESETS.find((p) => p.name === sub.name);
  const psg = C.isPsg(sub);
  const suggest = [...new Set([...(pre ? pre.books : []), ...C.BOOK_SUGGEST])].filter((n) => !sub.books.some((b) => b.name === n)).slice(0, compact ? 4 : 8);
  const addBook = (n) => {
    const b = C.newBook(n);
    if (psg) (b.from = 1), (b.to = 12);
    sub.books.push(b);
    commit();
  };
  return html`<div>
    ${sub.books.map((b) => html`<div class="brow" key=${b.id}>
      <span class="bn ell">${b.name}</span>
      ${psg ? html`<span class="muted small">지문</span>` : null}
      <input class="input pg" inputmode="numeric" key=${'f' + b.id + b.from} defaultValue=${String(b.from)} aria-label=${b.name + (psg ? ' 첫 지문' : ' 시작 쪽')} onChange=${(e) => {
        const n = parseInt(e.target.value);
        if (n > 0 && n <= b.to) b.from = n;
        commit();
      }} />
      <span class="muted">~</span>
      <input class="input pg" inputmode="numeric" key=${'t' + b.id + b.to} defaultValue=${String(b.to)} aria-label=${b.name + (psg ? ' 끝 지문' : ' 끝 쪽')} onChange=${(e) => {
        const n = parseInt(e.target.value);
        if (n >= b.from) b.to = n;
        commit();
      }} />
      <span class="muted small">${psg ? '번' : '쪽'}</span>
      <button class="mini-ib x" aria-label=${b.name + ' 빼기'} onClick=${() => {
        sub.books = sub.books.filter((x) => x.id !== b.id);
        commit();
      }}>✕</button>
    </div>`)}
    ${lean ? null : html`<div class="chips" style="margin-top:8px">
      ${suggest.map((n) => html`<button key=${n} class="chip add" onClick=${() => addBook(n)}>+ ${n}</button>`)}
      <form style="display:flex;gap:6px" onSubmit=${(e) => {
        e.preventDefault();
        if (custom.trim()) {
          addBook(custom.trim());
          setCustom('');
        }
      }}><input class="input" style="width:150px;min-height:38px;padding:6px 10px" placeholder="직접 적기" value=${custom} onInput=${(e) => setCustom(e.target.value)} aria-label="교재 이름 직접 적기" /></form>
    </div>`}
  </div>`;
}

/** 세는 방법: 쪽 / 지문. 바꾸면 단계를 새로 만든다 */
function UnitPicker({ sub, onPicked }) {
  return html`<div class="set-list">
    <div class="set-row col">
      <span class="l"><b>세는 방법</b><small>영어처럼 같은 지문을 여러 번 보는 과목은 지문으로 세면 어느 지문이 약한지 보여요</small></span>
      <${Seg} label="세는 방법" value=${sub.unit || 'page'} onChange=${(v) => {
        withUndo(v === 'passage' ? '지문으로 세기로 바꿨어요' : '쪽으로 세기로 바꿨어요', () => C.setUnit(sub, v));
        onPicked && onPicked();
      }} options=${[['page', '쪽으로'], ['passage', '지문으로']]} />
      ${sub.stages.some((s) => done(s)) ? html`<small class="muted">바꾸면 단계를 새로 만들고, 적어 둔 진도는 처음으로 돌아가요.</small>` : null}
    </div>
  </div>`;
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
      sub.stages = C.buildStages(sub.books, routine, C.isPsg(sub));
      sub.routine = routine;
      const n = D().exam ? C.planSubject(sub, today()) : 0;
      commit();
      C.setUI({ sheet: null });
      C.push('progress', { view: 'subject', id: sub.id }, true);
      toast(n ? `${sub.stages.length}단계를 만들고 날짜별로 나눴어요` : `${sub.stages.length}단계를 만들었어요`);
    }}>단계 만들기</button>`}
  >
    <p class="sub" style="margin:0 0 12px">눌러서 넣고, 시험 범위 ${C.isPsg(sub) ? '지문 번호' : '쪽수'}만 맞춰 주세요.</p>
    <${BookEditor} sub=${sub} />
    ${sub.books.length
      ? html`<span class="label" style="margin-top:22px">공부 순서</span>
          ${C.ROUTINES.map((r) => html`<button key=${r.id} class="rt" aria-pressed=${routine === r.id ? 'true' : 'false'} onClick=${() => setRoutine(r.id)}><b>${r.name}</b><small>${C.buildStages(sub.books, r.id).map((s) => s.name).join(' → ')}</small></button>`)}
          <p class="hint">${preview.length}단계가 만들어져요. 나중에 이름과 순서를 고칠 수 있어요.</p>`
      : null}
    <div style="margin-top:18px">
      <div class="set-list"><div class="set-row col">
        <span class="l"><b>세는 방법</b><small>영어처럼 같은 지문을 여러 번 보는 과목은 지문으로</small></span>
        <${Seg} label="세는 방법" value=${sub.unit || 'page'} onChange=${(v) => {
          if ((sub.unit || 'page') === v) return;
          sub.unit = v;
          if (v === 'passage') for (const b of sub.books) (b.from = 1), (b.to = 12);
          commit();
        }} options=${[['page', '쪽으로'], ['passage', '지문으로']]} />
      </div></div>
    </div>
  <//>`;
}

export function RoutineSheet({ id }) {
  const sub = subById(id);
  return html`<${Sheet} title="공부 순서 바꾸기">
    <p class="hint" style="margin:0 0 12px">새 순서로 단계를 다시 만들어요. 적어 둔 진도는 처음으로 돌아가요.</p>
    ${C.ROUTINES.map((r) => html`<button key=${r.id} class="rt" aria-pressed=${sub.routine === r.id ? 'true' : 'false'} onClick=${() => {
      withUndo('단계를 다시 만들었어요', () => {
        sub.stages = C.buildStages(sub.books, r.id, C.isPsg(sub));
        sub.routine = r.id;
        if (D().exam) C.planSubject(sub, today());
      });
      closeSheet();
    }}><b>${r.name}</b><small>${C.buildStages(sub.books, r.id).map((s) => s.name).join(' → ')}</small></button>`)}
  <//>`;
}

export function EditSheet({ id }) {
  const sub = subById(id);
  if (!sub) return null;
  const psg = C.isPsg(sub);
  const move = (i, d) => {
    const a = sub.stages;
    [a[i], a[i + d]] = [a[i + d], a[i]];
    commit();
  };
  return html`<${Sheet} title=${`${sub.name} 고치기`} tall wide>
    <div class="sec-title" style="margin-top:0">교재<em>시험 범위 ${psg ? '지문 번호' : '쪽'}</em></div>
    <${BookEditor} sub=${sub} />
    <div class="sec-title" style="margin-top:26px">회독 단계<em>이름·교재·범위를 바로 고칠 수 있어요</em></div>
    ${sub.stages.map((s, i) => html`<div class="ed" key=${s.id}>
      <span class="i">${i + 1}</span>
      <input class="input nm" key=${'n' + s.id + s.name} defaultValue=${s.name} aria-label="단계 이름" onChange=${(e) => {
        if (e.target.value.trim()) s.name = e.target.value.trim();
        commit();
      }} />
      <select class="input" style="width:auto" aria-label="교재" onChange=${(e) => {
        const b = sub.books.find((x) => x.id === e.target.value);
        if (b) {
          s.bookId = b.id;
          s.from = b.from;
          s.to = b.to;
          s.upto = null;
          if (s.marks) s.marks = [];
        }
        commit();
      }}>${sub.books.map((b) => html`<option key=${b.id} value=${b.id} selected=${b.id === s.bookId}>${b.name}</option>`)}</select>
      <input class="input pg" inputmode="numeric" key=${'f' + s.id + s.from} defaultValue=${String(s.from)} aria-label=${psg ? '첫 지문' : '시작 쪽'} onChange=${(e) => {
        const n = parseInt(e.target.value);
        if (n > 0 && n <= s.to) s.from = n;
        commit();
      }} />
      <span class="tilde">~</span>
      <input class="input pg" inputmode="numeric" key=${'t' + s.id + s.to} defaultValue=${String(s.to)} aria-label=${psg ? '끝 지문' : '끝 쪽'} onChange=${(e) => {
        const n = parseInt(e.target.value);
        if (n >= s.from) s.to = n;
        commit();
      }} />
      <button class="mini-ib" aria-label="위로" disabled=${i === 0} onClick=${() => move(i, -1)}>↑</button>
      <button class="mini-ib" aria-label="아래로" disabled=${i === sub.stages.length - 1} onClick=${() => move(i, 1)}>↓</button>
      <button class="mini-ib x" aria-label="단계 빼기" onClick=${() => withUndo(`'${s.name}' 뺐어요`, () => (sub.stages = sub.stages.filter((x) => x.id !== s.id)))}>✕</button>
    </div>`)}
    <div class="btns" style="margin-top:12px">
      <button class="btn" disabled=${!sub.books.length} onClick=${() => {
        const b = sub.books[0];
        const s = { id: C.uid(), name: `${sub.stages.length + 1}회독 · ${b.name}`, bookId: b.id, from: b.from, to: b.to, upto: null };
        if (psg) s.marks = [];
        sub.stages.push(s);
        commit();
      }}>+ 단계 하나 더</button>
      <button class="btn" onClick=${() => openSheet({ type: 'routine', id })}>공부 순서 다시 고르기</button>
    </div>
    <div style="margin-top:22px"><${UnitPicker} sub=${sub} /></div>
    <div class="set-list" style="margin-top:12px">
      <div class="set-row"><span class="l"><b>${psg ? '지문 하나에' : '쪽당'} 걸리는 시간</b><small>오늘 화면의 예상 시간에 써요</small></span>
        <${Seg} label="걸리는 시간" value=${C.paceOf(sub)} onChange=${(v) => {
          sub.pace = v;
          commit();
        }} options=${psg ? [[5, '5분'], [10, '10분'], [15, '15분'], [20, '20분']] : [[2, '2분'], [3, '3분'], [5, '5분'], [8, '8분']]} />
      </div>
    </div>
  <//>`;
}

export function AddSubjectSheet() {
  const have = new Set(D().subjects.map((s) => s.name));
  const [name, setName] = useState('');
  const add = (n) => {
    const sub = C.newSubject(n);
    D().subjects.push(sub);
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
