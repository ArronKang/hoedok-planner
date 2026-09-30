// 오늘: 겉에는 할 일과 체크만. 나머지는 눌러야 나온다.
import { html } from '../../../src/lib/html.js';
import { useState, useRef, useEffect } from '../../../src/lib/ui.js';
import * as C from './core.js';
import { Icon, Check, Sheet, Swipe, hue, Seg, Stepper, isPad } from './kit.js';

const { D, PR, UI, today, viewDay, setUI, openSheet, closeSheet, commit, withUndo, toast, subById, taskStage, taskPages, taskMinutes, tasksOn, overdue, addDays, diffDays, mdw, mdws, md, minutes, P } = C;

function titleOf(t) {
  if (t.kind === 'track') {
    const st = taskStage(t);
    return st ? st.name : '(삭제된 단계)';
  }
  return t.title;
}

function TaskRow({ t, showSubject }) {
  const sub = subById(t.subjectId);
  const td = today();
  const st = taskStage(t);
  const reps = t.reps > 1 ? t.reps : 0;
  const tomorrow = () => withUndo('내일로 옮겼어요', () => C.moveTask(t.id, addDays(t.date > td ? t.date : td, 1)));
  const complete = () => (t.status === 'done' ? null : C.toggleTask(t.id));
  const meta = [];
  if (t.at) meta.push(html`<span key="a" class="num">${t.at}</span>`);
  if (showSubject && sub) meta.push(html`<span key="s">${sub.name}</span>`);
  if (t.kind === 'track') {
    const bn = st ? C.bookOf(sub, st)?.name || '' : '';
    meta.push(html`<span key="p">${st && bn && !st.name.includes(bn) ? bn + ' ' : ''}${C.trng(t)}</span>`);
  }
  if (t.due) meta.push(html`<span key="d">마감 ${md(t.due)}</span>`);
  if ((t.moves || []).length && t.status !== 'done') meta.push(html`<span key="m" class="moved">${t.moves.length}번 미룸</span>`);
  return html`<${Swipe}
    cls=${'task hue ' + (t.status === 'done' ? 'done' : t.status === 'dropped' ? 'dropped' : '')}
    style=${hue(sub ? sub.h : 0)}
    onRight=${t.status === 'todo' ? complete : null}
    onLeft=${t.status !== 'done' ? tomorrow : null}
  >
    <div class="task-in" onClick=${() => openSheet({ type: 'task', id: t.id })}>
      <${Check}
        state=${t.status === 'done' ? 'done' : 'todo'}
        frac=${reps && t.status === 'todo' ? (t.repDone || 0) / reps : 0}
        onClick=${() => C.toggleTask(t.id)}
        label=${t.status === 'done' ? '완료 취소' : reps ? `한 번 더 했어요 (${t.repDone || 0}/${reps})` : '완료로 체크'}
      />
      <div class="tx">
        <div class="tt">${t.pri ? html`<em class="pri" aria-label=${'중요도 ' + t.pri}>${'!'.repeat(t.pri)}</em>` : null}<span>${titleOf(t)}</span></div>
        ${meta.length ? html`<div class="ts">${meta}</div>` : null}
      </div>
      <div class="amt">${reps
        ? html`<span class="num">${t.status === 'done' ? reps : t.repDone || 0}</span>/${reps}번`
        : t.kind === 'track'
          ? html`<span class="num">${taskPages(t)}</span>${C.unitOf(sub)}`
          : t.est
            ? minutes(t.est)
            : ''}</div>
    </div>
  <//>`;
}

function Summary({ list, day }) {
  const open = UI().open.summary;
  const live = list.filter((t) => t.status !== 'dropped');
  const doneN = live.filter((t) => t.status === 'done').length;
  const amt = (l) => C.mix(l.filter((t) => t.kind === 'track').map((t) => [subById(t.subjectId), taskPages(t)]));
  const all = amt(live), fin = amt(live.filter((t) => t.status === 'done'));
  const mins = live.reduce((a, t) => a + taskMinutes(t), 0);
  const cap = PR().rest.includes(C.weekday(day)) ? 0 : PR().avail[C.weekday(day)] || 0;
  const bySub = D().subjects.map((s) => [s, live.filter((t) => t.subjectId === s.id)]).filter(([, l]) => l.length);
  return html`<div>
    <button class="summary" onClick=${() => setUI({ open: { ...UI().open, summary: !open } })} aria-expanded=${open ? 'true' : 'false'}>
      <div class="line">
        <span><b>${doneN}</b> / ${live.length}개</span>
        ${all.p ? html`<span><b>${fin.p}</b> / ${all.p}쪽</span>` : null}
        ${all.q ? html`<span><b>${fin.q}</b> / ${all.q}지문</span>` : null}
        <span class="caret">${open ? '접기' : '자세히'}</span>
      </div>
      <div class="sumbar" aria-hidden="true"><i style=${{ width: `${live.length ? (doneN / live.length) * 100 : 0}%` }}></i></div>
    </button>
    ${open
      ? html`<div class="sumdetail">
          ${bySub.map(([s, l]) => html`<div class="r hue" key=${s.id} style=${hue(s.h)}><span class="dot"></span><span>${s.name}</span><span class="num">${l.filter((t) => t.status === 'done').length}/${l.length}개 · ${C.amount(s, l.reduce((a, t) => a + taskPages(t), 0))}</span></div>`)}
          <div style="margin-top:10px" class="row"><span class="sub">예상 시간</span><span class="num" style="margin-left:auto">${minutes(mins)}</span><span class="muted">/ 공부 가능 ${cap ? minutes(cap) : '없음'}</span></div>
          ${cap ? html`<div class="capbar"><i style=${{ width: `${Math.min(100, (mins / Math.max(mins, cap)) * 100)}%` }}></i><b style=${{ left: `${(cap / Math.max(mins, cap)) * 100}%` }}></b></div>` : null}
          <p class="hint">공부 가능 시간은 설정 › 공부 시간에서 요일마다 바꿀 수 있어요.</p>
        </div>`
      : null}
  </div>`;
}

/** 그 상황일 때만 뜨는 한 줄: 시험 날이 됐을 때 / 다음 시험이 안 정해졌을 때 / 못 끝낸 일 */
function Banners({ day }) {
  const td = today();
  const ex = D().exam;
  const p = PR();
  if (day !== td) return null;
  const out = [];
  if (ex && C.examDay())
    out.push(html`<button class="banner key" key="ex" onClick=${() => openSheet({ type: 'cycle' })}>
      <span>${C.isGoal(ex) ? html`<b>${ex.name}</b> 끝낼 날이에요` : html`<b>${ex.name}</b> 날이에요`}</span>
      <span class="go">${C.isGoal(ex) ? '정리하기' : '끝나면 결과 적기'}</span>
    </button>`);
  else if (!ex && D().subjects.length)
    out.push(html`<button class="banner key" key="nx" onClick=${() => openSheet({ type: 'cycle', step: 'next' })}>
      <span>다음 시험이나 끝낼 날을 정하면 날마다 할 양을 나눠 드려요</span><span class="go">정하기</span>
    </button>`);
  const od = overdue();
  if (od.length && p.show.overdue)
    out.push(html`<button class="banner" key="od" onClick=${() => openSheet({ type: 'endday', past: true })}><span>지난 날 못 끝낸 <b class="num">${od.length}</b>개가 있어요</span><span class="go">정리하기</span></button>`);
  return out.length ? html`<div class="stack">${out}</div>` : null;
}

export function TodayScreen({ compact }) {
  const td = today();
  const day = viewDay();
  const p = PR();
  const ex = D().exam;
  const list = tasksOn(day);
  let body;
  if (!list.length) {
    body = html`<div class="empty">
      <h3>${day === td ? '오늘' : mdws(day)} 할 일이 없어요</h3>
      ${D().subjects.some((s) => s.stages.length) && ex && !C.examDay()
        ? html`<p>남은 분량을 ${C.endWord()} ${C.isGoal() ? '' : '전날'}까지 나눠서 날마다 할 양을 넣을 수 있어요.</p><button class="btn pri" onClick=${() => openSheet({ type: 'plan' })}>${C.endWord()}까지 나눠 주기</button>`
        : html`<p>아래 ＋로 할 일을 넣어 보세요.</p>`}
    </div>`;
  } else if (p.group === 'subject') {
    body = D()
      .subjects.map((s) => [s, C.sortTasks(list.filter((t) => t.subjectId === s.id), 'subject')])
      .filter(([, l]) => l.length)
      .map(
        ([s, l]) => html`<section class="group hue" key=${s.id} style=${hue(s.h)}>
          <div class="group-h"><span class="dot"></span>${s.name}<span class="num">${l.filter((t) => t.status === 'done').length}/${l.length}</span></div>
          ${l.map((t) => html`<${TaskRow} key=${t.id} t=${t} />`)}
        </section>`,
      );
  } else {
    body = html`<section class="group">${C.sortTasks(list, p.group).map((t) => html`<${TaskRow} key=${t.id} t=${t} showSubject />`)}</section>`;
  }
  const dday = ex ? diffDays(td, ex.date) : null;
  return html`<div class="screen">
    <header class="head">
      <div class="t">
        <button class="titlebtn" onClick=${() => openSheet({ type: 'calendar' })} aria-label="날짜 고르기">
          <h1>${day === td ? '오늘' : mdws(day)}</h1><span class="caret">▾</span>
        </button>
        <span class="kicker">${day === td ? mdw(day) : diffDays(td, day) === 1 ? '내일' : diffDays(td, day) === -1 ? '어제' : ''}</span>
      </div>
      ${day !== td ? html`<button class="btn sm quiet" onClick=${() => setUI({ day: null })}>오늘로</button>` : null}
      ${ex && p.show.dday && dday > 0 ? html`<button class="dday-chip" onClick=${() => C.go('progress')}>${ex.name.replace(/^\d학기 /, '')}<b>D-${dday}</b></button>` : null}
      <button class="ib" aria-label="더 보기" onClick=${() => openSheet({ type: 'todayMenu' })}><${Icon} n="more" /></button>
    </header>
    <div class="scroll"><div class="body">
      <${Banners} day=${day} />
      ${list.length && p.show.summary ? html`<${Summary} list=${list} day=${day} />` : null}
      ${body}
      ${list.length ? html`<button class="addline" onClick=${() => openSheet({ type: 'add' })}><${Icon} n="plus" s=${20} />할 일 추가</button>` : null}
      ${D().tasks.some((t) => t.date < td) ? html`<button class="foot-link" onClick=${() => openSheet({ type: 'week' })}>이번 주 돌아보기 ›</button>` : null}
    </div></div>
    ${!isPad() && !compact ? html`<button class="fab" aria-label="할 일 추가" onClick=${() => openSheet({ type: 'add' })}><${Icon} n="plus" w=${2.2} /></button>` : null}
  </div>`;
}

// ─────────── 시트들 ───────────

export function TodayMenu() {
  const p = PR();
  const row = (label, sub, fn) => html`<button class="set-row" onClick=${fn}><span class="l"><b>${label}</b>${sub ? html`<small>${sub}</small>` : null}</span><${Icon} n="right" s=${18} /></button>`;
  return html`<${Sheet} title="오늘 화면">
    <div class="set-group"><h3>보는 방법</h3>
      <div class="set-list"><div class="set-row col">
        <${Seg} label="보는 방법" value=${p.group} onChange=${(v) => C.setPrefs({ group: v })} options=${[['subject', '과목별'], ['due', '마감순'], ['time', '시간순']]} />
        <small class="muted">${p.group === 'due' ? '마감일이 가까운 일부터. 마감이 없는 일은 뒤에 놓여요.' : p.group === 'time' ? '시작 시각을 적은 일부터 시각 순서로. 시각은 할 일 › 더 보기에서 적어요.' : '과목마다 묶어서 보여요.'}</small>
      </div></div>
    </div>
    <div class="set-group"><div class="set-list">
      ${row('하루 마감', '못 끝낸 일을 한 번에 정리', () => openSheet({ type: 'endday' }))}
      ${D().exam ? row('남은 계획 다시 나누기', `밀린 게 많을 때 ${C.endWord()}까지 새로 나눠요`, () => openSheet({ type: 'plan' })) : row('다음 시험 정하기', '시험이나 끝낼 날을 정하면 날마다 할 양을 나눠요', () => openSheet({ type: 'cycle', step: 'next' }))}
      ${row('이번 주 돌아보기', '계획한 것과 한 것', () => openSheet({ type: 'week' }))}
      ${row('달력', '다른 날 보기', () => openSheet({ type: 'calendar' }))}
    </div></div>
    <p class="hint">오늘 화면에 보일 것은 설정 › 오늘 화면에서 고를 수 있어요.</p>
  <//>`;
}

export function TaskSheet({ id }) {
  const t = D().tasks.find((x) => x.id === id);
  const [mode, setMode] = useState(null);
  const [upto, setUpto] = useState(null);
  const [rest, setRest] = useState('tomorrow');
  if (!t) return html`<${Sheet} title="할 일"><p class="muted">삭제된 할 일이에요.</p><//>`;
  const sub = subById(t.subjectId);
  const st = taskStage(t);
  const td = today();
  const more = UI().open.taskMore;
  const next = addDays(t.date > td ? t.date : td, 1);
  const val = upto ?? t.from + Math.floor((t.to - t.from) / 2);
  const psg = C.isPsg(sub);
  const U = C.unitOf(sub);
  const reps = t.reps > 1 ? t.reps : 0;
  const set = (k, v) => {
    t[k] = v;
    commit();
  };

  let actions;
  if (mode === 'partial' && st) {
    actions = html`<div class="hue" style=${hue(sub.h)}>
      <p class="sub" style="margin:0 0 4px;text-align:center">${C.trng(t)} 중 ${psg ? '몇 번 지문까지' : '어디까지'} 했어요?</p>
      <div class="upto"><input class="input big" inputmode="numeric" value=${String(val)} onInput=${(e) => setUpto(C.clamp(parseInt(e.target.value) || t.from - 1, t.from - 1, t.to))} aria-label=${psg ? '몇 번 지문까지' : '몇 쪽까지'} />${psg ? '번까지' : '쪽까지'}</div>
      <input class="range" type="range" min=${t.from - 1} max=${t.to} value=${val} onInput=${(e) => setUpto(+e.target.value)} aria-label=${psg ? '몇 번 지문까지' : '몇 쪽까지'} />
      <div class="range-x"><span>안 함</span><span>${t.to}</span></div>
      <p class="result">한 양 <b>${C.unitsOf(t).filter((u) => u <= val).length}</b> / ${taskPages(t)}${U}</p>
      ${val < t.to
        ? html`<span class="label">남은 ${(() => {
            const l = C.unitsOf(t).filter((u) => u > val);
            return C.rng(sub, l[0], l[l.length - 1], t.units ? l : null);
          })()}</span><${Seg} label="남은 분량" value=${rest} onChange=${setRest} options=${[['tomorrow', '내일로 넘기기'], ['drop', '안 하기']]} />`
        : null}
      <div class="btns" style="margin-top:16px">
        <button class="btn" onClick=${() => setMode(null)}>취소</button>
        <button class="btn pri" onClick=${() => {
          withUndo('반영했어요', () => C.partialTask(t.id, val, rest));
          closeSheet();
        }}>저장</button>
      </div>
    </div>`;
  } else if (t.status === 'todo') {
    actions = html`<div class="acts">
      <button class="btn pri wide" onClick=${() => {
        C.toggleTask(t.id);
        closeSheet();
      }}>${reps ? `한 번 더 했어요 · ${(t.repDone || 0) + 1}/${reps}` : '다 했어요'}</button>
      ${st ? html`<button class="btn" onClick=${() => setMode('partial')}>일부만 했어요</button>` : null}
      <button class="btn" onClick=${() => {
        withUndo(`${mdws(next)}(으)로 옮겼어요`, () => C.moveTask(t.id, next));
        closeSheet();
      }}>내일로</button>
      ${st ? null : html`<button class="btn" onClick=${() => openSheet({ type: 'calendar', pickFor: t.id })}>다른 날로</button>`}
    </div>`;
  } else {
    actions = html`<button class="btn block" onClick=${() => C.toggleTask(t.id)}>${t.status === 'done' ? '안 한 걸로 되돌리기' : '다시 할 일로'}</button>`;
  }

  return html`<${Sheet} title=${sub ? sub.name : '할 일'}>
    <div class="hue" style=${hue(sub ? sub.h : 0)}>
      ${t.kind === 'free'
        ? html`<input class="input" style="font-size:1.15em;font-weight:650" key=${'t' + t.id} defaultValue=${t.title} aria-label="할 일 이름" onChange=${(e) => set('title', e.target.value.trim() || t.title)} />`
        : html`<h3 style="margin:0 0 2px;font-size:1.25em">${st ? st.name : ''}</h3>
          <p class="sub" style="margin:0">${st ? C.bookOf(sub, st)?.name : ''} ${C.trng(t)} · ${C.amount(sub, taskPages(t))}</p>`}
      <div style="margin:16px 0 14px">${actions}</div>
      ${t.kind === 'track' && sub ? html`<div class="kv"><span class="k">진도</span><button class="v" onClick=${() => C.push('progress', { view: 'subject', id: sub.id }, true)}>${sub.name} ${P(C.pct(sub))} ›</button></div>` : null}
      <div class="kv"><span class="k">날짜</span><span class="v">${mdws(t.date)}${t.at ? ` · ${t.at}` : ''}</span></div>
      ${reps ? html`<div class="kv"><span class="k">한 횟수</span><span class="v">${t.status === 'done' ? reps : t.repDone || 0} / ${reps}번 ${(t.repDone || 0) > 0 && t.status === 'todo' ? html`<button class="linkbtn" onClick=${() => set('repDone', t.repDone - 1)}>하나 빼기</button>` : null}</span></div>` : null}
      ${(t.moves || []).length ? html`<div class="kv"><span class="k">미룬 기록</span><span class="v">${t.moves.map((m) => `${md(m.from)}→${md(m.to)}${m.reason ? ` (${m.reason})` : ''}`).join(', ')}</span></div>` : null}
      <button class="more-toggle" onClick=${() => setUI({ open: { ...UI().open, taskMore: !more } })} aria-expanded=${more ? 'true' : 'false'}>더 보기<span class="caret">${more ? '▴' : '▾'}</span></button>
      ${more
        ? html`<div>
            <span class="label">중요도</span>
            <${Seg} label="중요도" value=${t.pri || 0} onChange=${(v) => set('pri', v || null)} options=${[[0, '없음'], [1, '!'], [2, '!!'], [3, '!!!']]} />
            ${t.kind === 'free'
              ? html`<span class="label">몇 번 할까요 <span class="muted" style="font-weight:500">— 여러 번이면 누를 때마다 하나씩 채워져요</span></span>
                  <${Stepper} label="반복 횟수" value=${t.reps || 1} step=${1} min=${1} max=${10} fmtv=${(v) => (v === 1 ? '한 번' : `${v}번`)} onChange=${(v) => {
                    t.reps = v > 1 ? v : null;
                    t.repDone = Math.min(t.repDone || 0, Math.max(0, v - 1));
                    commit();
                  }} />`
              : null}
            <span class="label">시작 시각 <span class="muted" style="font-weight:500">— 시간순으로 볼 때 써요</span></span>
            <div class="row">
              <input class="input" type="time" style="max-width:160px" key=${'at' + t.id + (t.at || '')} defaultValue=${t.at || ''} onChange=${(e) => set('at', e.target.value || null)} aria-label="시작 시각" />
              ${t.at ? html`<button class="btn sm quiet" onClick=${() => set('at', null)}>지우기</button>` : null}
            </div>
            <span class="label">예상 시간</span>
            <div class="chips">${[15, 30, 45, 60, 90].map((m) => html`<button key=${m} class="chip" aria-pressed=${(t.est || (t.kind === 'track' ? taskMinutes(t) : 0)) === m ? 'true' : 'false'} onClick=${() => set('est', m)}>${minutes(m)}</button>`)}</div>
            <span class="label">실제로 걸린 시간 <span class="muted" style="font-weight:500">— 예상과 비교할 때 써요</span></span>
            <div class="chips">${[15, 30, 45, 60, 90, 120].map((m) => html`<button key=${m} class="chip" aria-pressed=${t.actual === m ? 'true' : 'false'} onClick=${() => set('actual', t.actual === m ? null : m)}>${minutes(m)}</button>`)}</div>
            <span class="label">마감일</span>
            <input class="input" type="date" style="max-width:220px" key=${'due' + t.id} defaultValue=${t.due || ''} onChange=${(e) => set('due', e.target.value || null)} />
            <span class="label">메모</span>
            <textarea class="input" rows="3" key=${'memo' + t.id} defaultValue=${t.memo || ''} placeholder="예: 준비물, 범위" onChange=${(e) => set('memo', e.target.value)}></textarea>
            <span class="label">사진</span>
            <button class="addline" onClick=${() => toast('시안에서는 사진을 넣을 수 없어요')}>+ 사진 넣기 (예: 수행평가 안내문)</button>
            <div style="margin-top:18px"><button class="btn danger block" onClick=${() => {
              withUndo('삭제했어요', () => C.deleteTask(t.id));
              closeSheet();
            }}>이 할 일 삭제</button></div>
          </div>`
        : null}
    </div>
  <//>`;
}

export function AddSheet() {
  const subs = D().subjects;
  const [sid, setSid] = useState(() => UI().lastSub && subs.some((s) => s.id === UI().lastSub) ? UI().lastSub : subs[0] && subs[0].id);
  const [text, setText] = useState('');
  const [when, setWhen] = useState(viewDay());
  const [added, setAdded] = useState([]);
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.focus();
  }, []);
  const sub = subById(sid);
  const link = C.parseLink(text, sub);
  const td = today();
  const cs = sub && C.curStage(sub);
  const ex = cs ? (() => {
    if (C.isPsg(sub)) {
      const free = [];
      for (let u = cs.from; u <= cs.to && free.length < 3; u++) if (!C.isMarked(cs, u)) free.push(u);
      return free.length ? `지문 ${free[0]}-${free[free.length - 1]}` : '지문 1-3';
    }
    const a = cs.upto == null ? cs.from : Math.min(cs.to, cs.upto + 1);
    return `${C.bookOf(sub, cs)?.name || ''} p.${a}-${Math.min(cs.to, a + 9)}`;
  })() : '쎈 p.20-35';
  const submit = (e) => {
    e.preventDefault();
    const title = (ref.current ? ref.current.value : text).trim();
    if (!title || !sid) return;
    C.addTask({ title, subjectId: sid, date: when, link: C.parseLink(title, sub) });
    setUI({ lastSub: sid });
    commit();
    setAdded([...added, title]);
    setText('');
    if (ref.current) {
      ref.current.value = '';
      ref.current.focus();
    }
  };
  return html`<${Sheet} title="할 일 추가">
    <form onSubmit=${submit}>
      <input ref=${ref} class="input" style="font-size:1.1em" placeholder="무엇을 할까요?" value=${text} onInput=${(e) => setText(e.target.value)} aria-label="할 일" enterkeyhint="done" autocomplete="off" />
      ${link
        ? html`<p class="hint hue" style=${{ ...hue(sub.h), color: 'var(--sc)', fontWeight: 600 }}>✓ ${sub.name} · ${link.stage.name} ${C.rng(sub, link.from, link.to)} — 체크하면 진도에 반영돼요</p>`
        : html`<p class="hint">${C.isPsg(sub) ? '지문 번호를' : '교재 이름과 쪽을 함께'} 적으면 진도에 저절로 반영돼요. 예: ${ex}</p>`}
      <span class="label">과목</span>
      <div class="chips">${subs.map((s) => html`<button type="button" key=${s.id} class="chip hue" style=${hue(s.h)} aria-pressed=${sid === s.id ? 'true' : 'false'} onClick=${() => setSid(s.id)}><span class="dot"></span>${s.name}</button>`)}</div>
      <span class="label">언제</span>
      <div class="chips">
        ${[[td, '오늘'], [addDays(td, 1), '내일'], [addDays(td, 2), '모레']].map(([d, l]) => html`<button type="button" key=${l} class="chip" aria-pressed=${when === d ? 'true' : 'false'} onClick=${() => setWhen(d)}>${l}</button>`)}
        <input class="input" type="date" style="width:auto" value=${when} onChange=${(e) => e.target.value && setWhen(e.target.value)} aria-label="날짜" />
      </div>
      <div class="btns" style="margin-top:18px"><button class="btn pri" type="submit" disabled=${!text.trim()}>추가</button></div>
      ${added.length ? html`<p class="hint">추가함: ${added.join(', ')}</p>` : null}
    </form>
  <//>`;
}

export function EndDaySheet({ past }) {
  const td = today();
  const day = past ? td : viewDay();
  const [snap] = useState(() => D().tasks.filter((t) => t.status === 'todo' && !t.closed && (past ? t.date < td : t.date <= day)).map((t) => t.id));
  const [handled, setHandled] = useState({});
  const items = snap.map((id) => D().tasks.find((t) => t.id === id)).filter(Boolean);
  const target = past ? td : addDays(td, 1);
  const act = (t, kind) => {
    if (kind === 'move') C.moveTask(t.id, target);
    else C.dropTask(t.id);
    commit();
    setHandled({ ...handled, [t.id]: { kind, reason: null } });
  };
  const left = items.filter((t) => !handled[t.id] && t.status === 'todo');
  return html`<${Sheet}
    title=${past ? '지난 날 못 끝낸 일' : '하루 마감'}
    tall
    footer=${html`${D().exam ? html`<button class="btn" onClick=${() => openSheet({ type: 'plan' })}>남은 계획 다시 나누기</button>` : null}<button class="btn pri" onClick=${closeSheet}>마치기</button>`}
  >
    ${left.length > 1
      ? html`<button class="btn block" style="margin-bottom:10px" onClick=${() => {
          const h = { ...handled };
          for (const t of left) {
            C.moveTask(t.id, target);
            h[t.id] = { kind: 'move', reason: null };
          }
          commit();
          setHandled(h);
        }}>남은 ${left.length}개 모두 ${past ? '오늘로' : '내일로'}</button>`
      : null}
    ${!items.length ? html`<div class="empty"><h3>남은 일이 없어요</h3></div>` : null}
    ${items.map((t) => {
      const sub = subById(t.subjectId);
      const h = handled[t.id];
      return html`<div class="eod-item hue" key=${t.id} style=${hue(sub ? sub.h : 0)}>
        <div class="hd"><span class="dot"></span><b>${titleOf(t)}</b><small>${sub ? sub.name : ''} · ${md(snapDate(t, h))}</small></div>
        ${h
          ? html`<div class="reasons">
              <span class="small muted">${h.kind === 'move' ? `${mdws(target)}(으)로 옮겼어요` : '안 하기로 했어요'} · 이유 (선택)</span>
              <div class="chips" style="margin-top:6px">${C.MOVE_REASONS.map((r) => html`<button key=${r} class="chip" aria-pressed=${h.reason === r ? 'true' : 'false'} onClick=${() => {
                C.setReason(t.id, h.reason === r ? null : r);
                commit();
                setHandled({ ...handled, [t.id]: { ...h, reason: h.reason === r ? null : r } });
              }}>${r}</button>`)}</div>
            </div>`
          : html`<div class="btns">
              <button class="btn sm pri" onClick=${() => act(t, 'move')}>${past ? '오늘로' : '내일로'}</button>
              <button class="btn sm" onClick=${() => openSheet({ type: 'calendar', pickFor: t.id, back: { type: 'endday', past } })}>다른 날</button>
              <button class="btn sm" onClick=${() => act(t, 'drop')}>안 하기</button>
            </div>`}
      </div>`;
    })}
  <//>`;
}
function snapDate(t, h) {
  if (h && h.kind === 'move' && (t.moves || []).length) return t.moves[t.moves.length - 1].from;
  return t.date;
}

export function CalendarSheet({ pickFor, back, inline }) {
  const td = today();
  const [month, setMonth] = useState(() => (UI().day || td).slice(0, 7));
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const start = addDays(first, -C.weekday(first));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const weeks = cells.slice(35).every((d) => d.slice(0, 7) !== month) ? cells.slice(0, 35) : cells;
  const shift = (n) => {
    const idx = y * 12 + (m - 1) + n;
    setMonth(`${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`);
  };
  const ex = D().exam;
  const choose = (d) => {
    if (pickFor) {
      withUndo(`${mdws(d)}(으)로 옮겼어요`, () => C.moveTask(pickFor, d));
      if (back) openSheet(back);
      else closeSheet();
    } else {
      setUI({ day: d === td ? null : d, sheet: null, tab: 'today' });
    }
  };
  const body = html`<div>
    <div class="cal-h">
      <b>${y}년 ${m}월</b>
      <button class="ib" aria-label="이전 달" onClick=${() => shift(-1)}><${Icon} n="left" /></button>
      <button class="ib" aria-label="다음 달" onClick=${() => shift(1)}><${Icon} n="right" /></button>
    </div>
    <div class="cal">
      ${C.WD.map((w, i) => html`<div key=${w} class=${'wd' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '')}>${w}</div>`)}
      ${weeks.map((d) => {
        const l = tasksOn(d).filter((t) => t.status !== 'dropped');
        const wd = C.weekday(d);
        return html`<button key=${d} class=${`d${d.slice(0, 7) !== month ? ' other' : ''}${d === td ? ' today' : ''}${d === viewDay() && !pickFor ? ' sel' : ''}${wd === 0 ? ' sun' : wd === 6 ? ' sat' : ''}`} onClick=${() => choose(d)} aria-label=${`${mdws(d)} 할 일 ${l.length}개`}>
          <span class="n">${+d.slice(8)}</span>
          <span class="dots">${l.slice(0, 6).map((t) => html`<i key=${t.id} class=${'hue' + (t.status === 'done' ? ' on' : '')} style=${hue(subById(t.subjectId)?.h || 0)}></i>`)}</span>
          ${ex && ex.date === d ? html`<span class="ex">${C.isGoal(ex) ? '끝' : '시험'}</span>` : null}
        </button>`;
      })}
    </div>
    <p class="hint">점 하나가 할 일 하나예요. 채워진 점은 끝낸 일.</p>
  </div>`;
  if (inline) return body;
  return html`<${Sheet} title=${pickFor ? '옮길 날짜' : '달력'}>${body}<//>`;
}

export function WeekSheet() {
  const w = C.weekStats();
  const rate = w.planned ? w.done / w.planned : null;
  const mx = Math.max(1, ...w.days.map((d) => d.pages));
  const reasons = Object.entries(w.reasons).sort((a, b) => b[1] - a[1]);
  const rmx = Math.max(1, ...reasons.map((r) => r[1]));
  const sum = C.mix(D().subjects.map((s) => [s, w.days.reduce((a, d) => a + ((s.log || {})[d.d] || 0), 0)]));
  return html`<${Sheet} title="이번 주 돌아보기" tall>
    <p class="sub" style="margin:0 0 12px">${md(addDays(today(), -6))}–${md(today())} · 계획한 것과 실제로 한 것</p>
    <div class="facts">
      <div class="fact"><div class="k">계획한 일</div><div class="v">${w.planned}<small>개</small></div></div>
      <div class="fact"><div class="k">끝낸 일</div><div class="v">${w.done}<small>개 · ${rate == null ? '–' : P(rate)}</small></div></div>
      <div class="fact"><div class="k">미룬 횟수</div><div class="v">${w.moved}<small>번</small></div></div>
      <div class="fact"><div class="k">안 하기로 한 일</div><div class="v">${w.dropped}<small>개</small></div></div>
    </div>
    <div class="sec-title">날마다 한 양<em>합계 ${sum.text}</em></div>
    <div class="vbars">${w.days.map((d) => html`<div key=${d.d} title=${`${md(d.d)} ${d.pages}`}><i class=${d.pages ? '' : 'zero'} style=${{ height: `${Math.max(3, (d.pages / mx) * 100)}%` }}></i></div>`)}</div>
    <div class="vbars-x">${w.days.map((d) => html`<span key=${d.d}>${C.WD[C.weekday(d.d)]}</span>`)}</div>
    <div class="sec-title">과목마다</div>
    <table class="tbl"><thead><tr><th>과목</th><th class="r">계획</th><th class="r">끝냄</th><th class="r">비율</th></tr></thead><tbody>
      ${D().subjects.filter((s) => w.bySub[s.id]).map((s) => {
        const o = w.bySub[s.id];
        return html`<tr key=${s.id}><td><span class="hue row" style=${hue(s.h)}><span class="dot"></span>${s.name}</span></td><td class="r n">${o.planned}</td><td class="r n">${o.done}</td><td class="r n">${P(o.done / o.planned)}</td></tr>`;
      })}
    </tbody></table>
    ${reasons.length
      ? html`<div class="sec-title">미루거나 안 한 이유</div>
          <div class="lost">${reasons.map(([r, n]) => html`<div class="r" key=${r}><span>${r}</span><span class="hb"><i style=${{ width: `${(n / rmx) * 100}%`, background: 'var(--ink-3)' }}></i></span><span class="num n">${n}번</span></div>`)}</div>`
      : null}
  <//>`;
}

/** 시험 날(끝낼 날)까지 나눠 주기 (미리 보고 확정) */
export function PlanSheet({ only }) {
  const td = today();
  const ex = D().exam;
  const { tasks, days } = C.previewPlan(td, only || null);
  const byDay = days.map((d) => [d.d, tasks.filter((t) => t.date === d.d)]);
  const total = C.mix(tasks.map((t) => [subById(t.subjectId), taskPages(t)]));
  const p = PR();
  const E = C.endWord();
  const n = days.length || 1;
  // 쪽과 지문이 섞이면 큰 숫자는 쪽, 지문은 작게 덧붙인다
  const big = (x, y) => html`<b class="num">${total.p || !total.q ? x : y}</b>${total.p || !total.q ? '쪽' : '지문'}${total.p && total.q ? html`<small>+ ${y}지문</small>` : null}`;
  return html`<${Sheet}
    title=${only ? `${subById(only).name}만 다시 나누기` : `${E}까지 나눠 주기`}
    tall
    footer=${html`<button class="btn" onClick=${closeSheet}>닫기</button><button class="btn pri" disabled=${!tasks.length} onClick=${() => {
      withUndo(`${byDay.filter(([, l]) => l.length).length}일치 할 일을 넣었어요`, () => (only ? C.planSubject(subById(only), td) : C.planAll(td)));
      C.setUI({ sheet: null, tab: 'today', day: null });
    }}>이대로 넣기</button>`}
  >
    ${!ex ? html`<p class="muted">시험이나 끝낼 날이 없어요. 오늘 화면 › … › 다음 시험 정하기에서 넣어 주세요.</p>` : null}
    <div class="plan-sum">
      <div><small>남은 분량</small>${big(total.p, total.q)}</div>
      <div><small>나눌 날</small><b class="num">${days.length}</b>일</div>
      <div><small>하루 평균</small>${big(Math.round(total.p / n), Math.round(total.q / n))}</div>
    </div>
    ${ex
      ? html`<p class="hint" style="margin:0 0 10px">과목마다 지금 하는 단계부터 이어서, ${mdws(C.lastPlanDay(ex))}까지 나눠요. 공부 가능 시간이 긴 날에 더 많이 넣어요. 이미 끝낸 일과 직접 넣은 일은 그대로 둬요.</p>`
      : null}
    <div class="set-list" style="margin-bottom:14px">
      <div class="set-row"><span class="l"><b>쉬는 요일</b><small>이 요일에는 넣지 않아요</small></span>
        <div class="chips">${C.WD.map((w, i) => html`<button key=${w} class="chip" style="min-height:32px;padding:0 10px" aria-pressed=${p.rest.includes(i) ? 'true' : 'false'} onClick=${() => C.setPrefs({ rest: p.rest.includes(i) ? p.rest.filter((x) => x !== i) : [...p.rest, i] })}>${w}</button>`)}</div>
      </div>
    </div>
    ${byDay.map(([d, l]) => html`<div class="dayplan" key=${d}>
      <div class="dh">${mdws(d)}<span class="num">${C.mix(l.map((t) => [subById(t.subjectId), taskPages(t)])).text}</span></div>
      <ul>${l.map((t) => {
        const s = subById(t.subjectId);
        const st = s && s.stages.find((x) => x.id === t.stageId);
        return html`<li key=${t.id} class="hue" style=${hue(s.h)}><span class="dot"></span>${s.name} · ${st ? st.name : ''}<span class="num">${C.trng(t)}</span></li>`;
      })}</ul>
    </div>`)}
  <//>`;
}
