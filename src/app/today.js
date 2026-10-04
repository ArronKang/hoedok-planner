// 오늘: 겉에는 할 일과 체크만. 나머지는 눌러야 나온다.
import { html } from '../lib/html.js';
import { useState, useRef, useEffect } from '../lib/ui.js';
import * as C from './core.js';
import { Icon, Check, Sheet, Swipe, hue, Seg, Stepper, isPad, NumField, DateField, glassBar } from './kit.js';
import { savePhoto, photoURL } from './photos.js';
import { installHintOn, hideInstallHint, openInstall } from './pwa.js';

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
  if (t.at) meta.push(html`<span key="a" class="num">${C.clock(t.at)}</span>`);
  if (showSubject && sub) meta.push(html`<span key="s">${sub.name}</span>`);
  if (t.kind === 'track') {
    const bn = st ? C.bookOf(sub, st)?.name || '' : '';
    meta.push(html`<span key="p">${st && bn && !st.name.includes(bn) ? bn + ' ' : ''}${C.trng(t)}</span>`);
  }
  if (t.due) meta.push(html`<span key="d">마감 ${md(t.due)}</span>`);
  if (PR().rowEst && t.kind === 'track' && taskMinutes(t)) meta.push(html`<span key="e">약 ${minutes(taskMinutes(t))}</span>`);
  if ((t.photos || []).length) meta.push(html`<span key="ph">사진 ${t.photos.length}</span>`);
  if (t.memo) meta.push(html`<span key="me">메모</span>`);
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
          ? html`<span class="num">${taskPages(t)}</span>${C.unitShort(C.taskUnit(t))}`
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
  const all = C.taskTally(live), fin = C.taskTally(live.filter((t) => t.status === 'done'));
  const units = C.UNITS.filter((u) => all[u.id]).slice(0, 2);
  const mins = C.plannedMinutes(live);
  const cap = C.capacity(day);
  const bySub = D().subjects.map((s) => [s, live.filter((t) => t.subjectId === s.id)]).filter(([, l]) => l.length);
  return html`<div>
    <button class="summary" onClick=${() => setUI({ open: { ...UI().open, summary: !open } })} aria-expanded=${open ? 'true' : 'false'}>
      <div class="line">
        <span><b>${doneN}</b> / ${live.length}개</span>
        ${units.map((u) => html`<span key=${u.id}><b>${fin[u.id] || 0}</b> / ${C.amountText(u.id, all[u.id], true)}</span>`)}
        <span class="caret">${open ? '접기' : '자세히'}</span>
      </div>
      <div class="sumbar" aria-hidden="true"><i style=${{ width: `${live.length ? (doneN / live.length) * 100 : 0}%` }}></i></div>
    </button>
    ${open
      ? html`<div class="sumdetail appear">
          ${bySub.map(([s, l]) => html`<div class="r hue" key=${s.id} style=${hue(s.h)}><span class="dot"></span><span>${s.name}</span><span class="num">${l.filter((t) => t.status === 'done').length}/${l.length}개${l.some((t) => t.kind === 'track') ? ` · ${C.tallyText(C.taskTally(l))}` : ''}</span></div>`)}
          <div style="margin-top:10px" class="row"><span class="sub">예상 시간</span><span class="num" style="margin-left:auto">${minutes(mins)}</span><span class="muted">/ 공부 가능 ${cap ? minutes(cap) : '없음'}</span></div>
          ${cap ? html`<div class="capbar"><i style=${{ width: `${Math.min(100, (mins / Math.max(mins, cap)) * 100)}%` }}></i><b style=${{ left: `${(cap / Math.max(mins, cap)) * 100}%` }}></b></div>` : null}
          <${DayCap} day=${day} />
        </div>`
      : null}
  </div>`;
}

/** 그날만 공부 가능 시간 바꾸기 (학원 보충, 행사 같은 날) */
export function DayCap({ day, compact }) {
  const cap = C.capacity(day);
  const changed = C.isDayChanged(day);
  return html`<div class=${'daycap' + (compact ? ' compact' : '')}>
    <span class="l"><b>${compact ? '이날' : day === today() ? '오늘' : md(day)} 공부 가능 시간</b>${changed
      ? html`<small>이날만 바꿈 · 요일 기본 ${C.weekdayCap(day) ? minutes(C.weekdayCap(day)) : '쉬는 날'}<button class="linkbtn" onClick=${() => C.setDayCap(day, null)}>되돌리기</button></small>`
      : compact ? null : html`<small>이날만 바꿀 수 있어요. 다시 나눌 때 반영돼요.</small>`}</span>
    <${Stepper} label="이날 공부 가능 시간" value=${cap} step=${30} min=${0} max=${960} fmtv=${(v) => (v ? minutes(v) : '쉼')} onChange=${(v) => C.setDayCap(day, v)} />
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
  const ds = C.dueSoon();
  if (ds.length && p.show.due !== false)
    out.push(html`<button class="banner" key="due" onClick=${() => openSheet({ type: 'due' })}>
      <span>다가오는 마감 · <b>${titleOf(ds[0])}</b> <span class="num">${md(ds[0].due)}</span>${ds.length > 1 ? ` 외 ${ds.length - 1}개` : ''}</span><span class="go">보기</span>
    </button>`);
  const od = overdue();
  if (od.length && p.show.overdue)
    out.push(html`<button class="banner" key="od" onClick=${() => openSheet({ type: 'endday', past: true })}><span>지난 날 못 끝낸 <b class="num">${od.length}</b>개가 있어요</span><span class="go">정리하기</span></button>`);
  // 예시를 보는 중이면 빠져나가는 길을 한 줄로 (설정 맨 위의 '예시 끝내기'로)
  if (C.isDemo()) out.push(html`<button class="banner quiet" key="demo" onClick=${() => openSheet({ type: 'settings' })}><span>예시 기록을 보고 있어요</span><span class="go">내 기록으로 시작</span></button>`);
  // 브라우저 창으로 열었을 때만: 홈 화면에 추가하면 앱처럼 열려요 (닫으면 다시 안 뜸)
  if (installHintOn())
    out.push(html`<div class="banner quiet with-x" key="inst">
      <button class="b" onClick=${openInstall}><span>홈 화면에 추가하면 앱처럼 열려요</span><span class="go">방법</span></button>
      <button class="x" aria-label="이 안내 닫기" onClick=${hideInstallHint}><${Icon} n="x" s=${16} /></button>
    </div>`);
  // 알림 줄은 한 장에 모아서 (상자를 여러 개 쌓지 않게)
  return out.length ? html`<div class="banners">${out}</div>` : null;
}

export function TodayScreen({ compact }) {
  const td = today();
  const day = viewDay();
  const p = PR();
  const ex = D().exam;
  const all = tasksOn(day);
  // 끝낸 일 숨기기: 목록에서 빼고 맨 아래에 '끝낸 일 N개 보기' 한 줄
  const hideDone = C.doneMode() === 'hide' && !UI().open.showDone;
  const doneN = all.filter((t) => t.status === 'done').length;
  const list = hideDone ? all.filter((t) => t.status !== 'done') : all;
  let body;
  if (!all.length) {
    // 할 일이 없을 때: 왜 없는지에 맞춰 다음에 할 일 하나를 크게 (막연히 '＋를 눌러 보세요' 대신)
    const subs = D().subjects;
    const noBook = subs.find((s) => !s.stages.length);
    const hasStages = subs.some((s) => s.stages.length);
    const plannable = hasStages && ex && !C.examDay() && day >= td;
    body = html`<div class="empty">
      <h3>${day === td ? '오늘' : mdws(day)} 할 일이 없어요</h3>
      ${!subs.length
        ? html`<p>먼저 준비할 과목을 넣어 주세요.</p><button class="btn pri" onClick=${() => openSheet({ type: 'addSubject' })}>과목 넣기</button>`
        : !hasStages
          ? html`<p>과목마다 쓰는 교재와 시험 범위를 넣으면 날마다 할 양이 저절로 생겨요.</p><button class="btn pri" onClick=${() => openSheet({ type: 'setup', id: noBook.id })}>${noBook.name} 교재 넣기</button>`
          : plannable
            ? html`<p>남은 분량을 ${C.endWord()} ${C.isGoal() ? '' : '전날'}까지 나눠서 날마다 할 양을 넣을 수 있어요.</p><button class="btn pri" onClick=${() => openSheet({ type: 'plan' })}>${C.endWord()}까지 나눠 주기</button>`
            : !ex
              ? html`<p>다음 시험이나 끝낼 날을 정하면 날마다 할 양을 나눠 드려요.</p><button class="btn pri" onClick=${() => openSheet({ type: 'cycle', step: 'next' })}>시험 정하기</button>`
              : null}
      <button class="btn ghost" style="margin-top:6px" onClick=${() => openSheet({ type: 'add' })}>할 일 직접 넣기</button>
    </div>`;
  } else if (!list.length) {
    body = html`<div class="empty small"><h3>다 끝냈어요</h3><p>끝낸 ${doneN}개는 숨겨 두었어요.</p></div>`;
  } else if (p.group === 'subject') {
    // 하루 할 일은 한 장에: 과목은 상자 대신 제목줄로 나눈다 (한 화면에 더 많이, 덜 어지럽게)
    body = html`<div class="daylist">${D()
      .subjects.map((s) => [s, C.sortTasks(list.filter((t) => t.subjectId === s.id), 'subject')])
      .filter(([, l]) => l.length)
      .map(
        ([s, l]) => html`<section class="group hue" key=${s.id} style=${hue(s.h)} aria-label=${s.name}>
          <div class="group-h"><span class="dot"></span>${s.name}<span class="num">${l.filter((t) => t.status === 'done').length}/${l.length}</span></div>
          ${l.map((t) => html`<${TaskRow} key=${t.id} t=${t} />`)}
        </section>`,
      )}</div>`;
  } else {
    body = html`<div class="daylist"><section class="group">${C.sortTasks(list, p.group).map((t) => html`<${TaskRow} key=${t.id} t=${t} showSubject />`)}</section></div>`;
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
      ${ex && p.show.dday && dday > 0 ? html`<button class="dday-chip" onClick=${() => C.go('progress')}>${ex.name.replace(/^\d학기 /, '')}<b>${p.ddayStyle === 'days' ? `${dday}일 남음` : `D-${dday}`}</b></button>` : null}
      ${isPad() ? html`<button class="ib" aria-label="할 일 추가" title="할 일 추가" onClick=${() => openSheet({ type: 'add' })}><${Icon} n="plus" /></button>` : null}
      <button class="ib" aria-label="더 보기" onClick=${() => openSheet({ type: 'todayMenu' })}><${Icon} n="more" /></button>
    </header>
    <div class="scroll"><div class="body">
      <${Banners} day=${day} />
      ${all.length && p.show.summary ? html`<${Summary} list=${all} day=${day} />` : null}
      ${body}
      ${C.doneMode() === 'hide' && doneN
        ? html`<button class="foot-link" onClick=${() => setUI({ open: { ...UI().open, showDone: !UI().open.showDone } })}>${hideDone ? `끝낸 일 ${doneN}개 보기` : '끝낸 일 숨기기'}</button>`
        : null}
      ${all.length && isPad() ? html`<button class="addline" onClick=${() => openSheet({ type: 'add' })}><${Icon} n="plus" s=${20} />할 일 추가</button>` : null}
      ${D().tasks.some((t) => t.date < td) ? html`<button class="foot-link" onClick=${() => openSheet({ type: 'week' })}>이번 주 돌아보기 ›</button>` : null}
    </div></div>
    ${!isPad() && !compact && !glassBar() ? html`<button class="fab" aria-label="할 일 추가" onClick=${() => openSheet({ type: 'add' })}><${Icon} n="plus" w=${2.2} /></button>` : null}
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
      ${(D().repeats || []).length ? row('반복하는 일', `${D().repeats.length}개 · 매일이나 요일마다 저절로 넣는 일`, () => openSheet({ type: 'repeats' })) : null}
    </div></div>
    <button class="linkrow-btn" onClick=${() => openSheet({ type: 'settings', page: 'views' })}>오늘 화면에 보일 것 고르기 ›</button>
  <//>`;
}

export function TaskSheet({ id }) {
  const t = D().tasks.find((x) => x.id === id);
  const [mode, setMode] = useState(null);
  const [upto, setUpto] = useState(null);
  const [picked, setPicked] = useState([]);
  const [rest, setRest] = useState('tomorrow');
  if (!t) return html`<${Sheet} title="할 일"><p class="muted">삭제된 할 일이에요.</p><//>`;
  const sub = subById(t.subjectId);
  const st = taskStage(t);
  const book = st ? C.bookOf(sub, st) : null;
  const td = today();
  const more = UI().open.taskMore;
  const next = addDays(t.date > td ? t.date : td, 1);
  const cells = !!(st && st.marks);
  const k = C.taskUnit(t);
  const val = upto ?? t.from + Math.floor((t.to - t.from) / 2);
  const reps = t.reps > 1 ? t.reps : 0;
  const rule = t.rep && C.repeatById(t.rep);
  // 반복하는 일이면 이름·시간 등은 그 뒤 반복에도 같이 바뀐다 (core.editTask)
  const set = (k2, v) => {
    C.editTask(t, k2, v);
    commit();
  };
  const ESTS = [15, 30, 45, 60, 90];

  let actions;
  if (mode === 'partial' && st) {
    const all = C.unitsOf(t);
    const did = cells ? all.filter((u) => picked.includes(u)) : all.filter((u) => u <= val);
    const left = all.filter((u) => !did.includes(u));
    const leftRun = left.length && left.length === left[left.length - 1] - left[0] + 1;
    actions = html`<div class="hue appear" style=${hue(sub.h)}>
      ${cells
        ? html`<p class="sub" style="margin:0 0 10px;text-align:center">${C.trng(t)} 중 한 것을 눌러 주세요</p>
            <div class=${'numgrid' + (book && book.labels && book.labels.some((l) => l.length > 4) ? ' wide' : '')}>${all.map(
              (u) => html`<button key=${u} class=${book && book.labels ? '' : 'num'} aria-pressed=${picked.includes(u) ? 'true' : 'false'} aria-label=${C.itemName(sub, book, u)} onClick=${() => setPicked(picked.includes(u) ? picked.filter((x) => x !== u) : [...picked, u])}>${C.itemShort(book, u)}</button>`,
            )}</div>`
        : html`<p class="sub" style="margin:0 0 4px;text-align:center">${C.trng(t)} 중 어디까지 했어요?</p>
            <div class="upto"><${NumField} cls="input big" value=${val < t.from ? null : val} empty min=${t.from} max=${t.to} unit="쪽" placeholder="–" label="몇 쪽까지" onLive=${(n) => n != null && setUpto(n)} onCommit=${(n) => setUpto(n == null ? t.from - 1 : n)} />쪽까지</div>
            <input class="range" type="range" min=${t.from - 1} max=${t.to} value=${val} onInput=${(e) => setUpto(+e.target.value)} aria-label="몇 쪽까지" />
            <div class="range-x"><span>안 함</span><span>${t.to}</span></div>`}
      <p class="result">한 양 <b>${did.length}</b> / ${C.amountText(k, C.taskPages(t), true)}</p>
      ${left.length && did.length
        ? html`<span class="label">남은 ${C.rangeText(sub, book, left[0], left[left.length - 1], leftRun ? null : left)}</span><${Seg} label="남은 분량" value=${rest} onChange=${setRest} options=${[['tomorrow', '내일로 넘기기'], ['drop', '안 하기']]} />`
        : null}
      <div class="btns" style="margin-top:16px">
        <button class="btn" onClick=${() => setMode(null)}>취소</button>
        <button class="btn pri" disabled=${!did.length} onClick=${() => {
          withUndo('반영했어요', () => C.partialTask(t.id, val, rest, cells ? picked : null));
          closeSheet();
        }}>${did.length === all.length ? '다 했어요' : '저장'}</button>
      </div>
    </div>`;
  } else if (t.status === 'todo') {
    actions = html`<div class="acts">
      <button class="btn pri wide" onClick=${() => {
        C.toggleTask(t.id);
        closeSheet();
      }}>${reps ? `한 번 더 했어요 · ${(t.repDone || 0) + 1}/${reps}` : '다 했어요'}</button>
      ${st && C.taskPages(t) > 1 ? html`<button class="btn" onClick=${() => setMode('partial')}>일부만 했어요</button>` : null}
      <button class="btn" onClick=${() => {
        withUndo(`${mdws(next)}(으)로 옮겼어요`, () => C.moveTask(t.id, next));
        closeSheet();
      }}>내일로</button>
      ${st ? null : html`<button class="btn" onClick=${() => openSheet({ type: 'calendar', pickFor: t.id })}>다른 날로</button>`}
    </div>`;
  } else if (t.status === 'done') {
    // 끝낸 일: 걸린 시간을 한 번에 고를 수 있게 (적지 않아도 됨)
    actions = html`<div>
      <span class="label" style="margin-top:0">걸린 시간 <span class="muted" style="font-weight:500">— 적어 두면 돌아보기에서 예상(${minutes(taskMinutes(t))})과 비교해요</span></span>
      <div class="chips">${[15, 30, 45, 60, 90, 120].map((m) => html`<button key=${m} class="chip" aria-pressed=${t.actual === m ? 'true' : 'false'} onClick=${() => set('actual', t.actual === m ? null : m)}>${minutes(m)}</button>`)}</div>
      <button class="btn block" style="margin-top:14px" onClick=${() => C.toggleTask(t.id)}>안 한 걸로 되돌리기</button>
    </div>`;
  } else {
    actions = html`<button class="btn block" onClick=${() => C.toggleTask(t.id)}>다시 할 일로</button>`;
  }

  const bn = book ? book.name : '';
  return html`<${Sheet} title=${sub ? sub.name : '할 일'}>
    <div class="hue" style=${hue(sub ? sub.h : 0)}>
      ${t.kind === 'free'
        ? html`<input class="input" style="font-size:1.15em;font-weight:650" key=${'t' + t.id} defaultValue=${t.title} aria-label="할 일 이름" enterkeyhint="done" onChange=${(e) => set('title', e.target.value.trim() || t.title)} />`
        : html`<h3 style="margin:0 0 2px;font-size:1.25em">${st ? st.name : ''}</h3>
          <p class="sub" style="margin:0">${bn && st && !st.name.includes(bn) ? bn + ' ' : ''}${C.trng(t)} · ${C.amountText(k, taskPages(t))}</p>`}
      <div style="margin:16px 0 14px">${actions}</div>
      ${t.kind === 'track' && sub ? html`<div class="kv"><span class="k">진도</span><button class="v" onClick=${() => C.push('progress', { view: 'subject', id: sub.id }, true)}>${sub.name} ${P(C.pct(sub))} ›</button></div>` : null}
      <div class="kv"><span class="k">날짜</span><span class="v">${mdws(t.date)}${t.at ? ` · ${C.clock(t.at)}` : ''}</span></div>
      ${rule ? html`<div class="kv"><span class="k">반복</span><span class="v">${C.daysText(rule.days)}</span></div>` : null}
      ${t.due ? html`<div class="kv"><span class="k">마감</span><span class="v">${mdws(t.due)}${t.status === 'todo' ? ` · ${dueLeft(t.due)}` : ''}</span></div>` : null}
      ${reps ? html`<div class="kv"><span class="k">한 횟수</span><span class="v">${t.status === 'done' ? reps : t.repDone || 0} / ${reps}번 ${(t.repDone || 0) > 0 && t.status === 'todo' ? html`<button class="linkbtn" onClick=${() => set('repDone', t.repDone - 1)}>하나 빼기</button>` : null}</span></div>` : null}
      ${(t.moves || []).length ? html`<div class="kv"><span class="k">미룬 기록</span><span class="v">${t.moves.map((m) => `${md(m.from)}→${md(m.to)}${m.reason ? ` (${m.reason})` : ''}`).join(', ')}</span></div>` : null}
      ${t.memo && !more ? html`<p class="memo">${t.memo}</p>` : null}
      ${(t.photos || []).length ? html`<div style="margin-top:12px"><${Photos} t=${t} /></div>` : null}
      <button class="more-toggle" onClick=${() => setUI({ open: { ...UI().open, taskMore: !more } })} aria-expanded=${more ? 'true' : 'false'}>더 보기<span class="caret">${more ? '▴' : '▾'}</span></button>
      ${more
        ? html`<div class="appear">
            <span class="label">중요도</span>
            <${Seg} label="중요도" value=${t.pri || 0} onChange=${(v) => set('pri', v || null)} options=${[[0, '없음'], [1, '!'], [2, '!!'], [3, '!!!']]} />
            ${t.kind === 'free'
              ? html`<span class="label">하루에 몇 번 <span class="muted" style="font-weight:500">— 여러 번이면 누를 때마다 하나씩 채워져요</span></span>
                  <${Stepper} label="하루에 할 횟수" value=${t.reps || 1} step=${1} min=${1} max=${10} fmtv=${(v) => (v === 1 ? '한 번' : `${v}번`)} onChange=${(v) => {
                    C.editTask(t, 'reps', v > 1 ? v : null);
                    t.repDone = Math.min(t.repDone || 0, Math.max(0, v - 1));
                    commit();
                  }} />
                  <${RepeatPick} t=${t} rule=${rule} />`
              : null}
            <span class="label">시작 시각 <span class="muted" style="font-weight:500">— 시간순으로 볼 때 써요</span></span>
            <div class="row">
              <input class="input" type="time" style="max-width:160px" key=${'at' + t.id + (t.at || '')} defaultValue=${t.at || ''} onChange=${(e) => set('at', e.target.value || null)} aria-label="시작 시각" />
              ${t.at ? html`<button class="btn sm quiet" onClick=${() => set('at', null)}>지우기</button>` : null}
            </div>
            <span class="label">예상 시간${t.kind === 'track' && !t.est ? html` <span class="muted" style="font-weight:500">— 지금은 분량으로 계산한 ${minutes(taskMinutes(t))}</span>` : null}</span>
            <div class="chips">
              ${ESTS.map((m) => html`<button key=${m} class="chip" aria-pressed=${t.est === m ? 'true' : 'false'} onClick=${() => set('est', t.est === m ? null : m)}>${minutes(m)}</button>`)}
              <span class="row est-own"><${NumField} value=${t.est && !ESTS.includes(t.est) ? t.est : null} empty min=${1} max=${600} unit="분" placeholder="직접" label="예상 시간 직접 적기(분)" onCommit=${(n) => set('est', n)} /><span class="muted small">분</span></span>
            </div>
            <span class="label">마감일</span>
            <div class="row">
              <${DateField} style="max-width:220px" value=${t.due || ''} label="마감일" onCommit=${(v) => set('due', v)} />
              ${t.due ? html`<button class="btn sm quiet" onClick=${() => set('due', null)}>지우기</button>` : null}
            </div>
            <span class="label">메모</span>
            <textarea class="input" rows="3" key=${'memo' + t.id} defaultValue=${t.memo || ''} placeholder="예: 준비물, 범위" onChange=${(e) => set('memo', e.target.value)}></textarea>
            ${(t.photos || []).length ? null : html`<span class="label">사진 <span class="muted" style="font-weight:500">— 예: 수행평가 안내문. 이 기기에만 저장돼요</span></span><${Photos} t=${t} />`}
            <div style="margin-top:18px"><button class="btn danger block" onClick=${() => {
              withUndo(rule ? '이날 것만 뺐어요' : '삭제했어요', () => C.deleteTask(t.id));
              closeSheet();
            }}>${rule ? '이날 것만 삭제' : '이 할 일 삭제'}</button></div>
          </div>`
        : null}
    </div>
  <//>`;
}

const ALLDAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** '3일 남음' / '오늘 마감' / '2일 지남' — 사실만 */
const dueLeft = (due) => {
  const n = diffDays(today(), due);
  return n > 0 ? `${n}일 남음` : n === 0 ? '오늘 마감' : `${-n}일 지남`;
};

/** 반복: 안 함 / 매일 / 요일마다. 켜면 앞으로 2주씩 저절로 넣는다 */
function RepeatPick({ t, rule }) {
  const days = rule ? rule.days : [];
  const mode = !rule ? 'none' : days.length === 7 ? 'daily' : 'week';
  const apply = (ds) => {
    const had = !!rule;
    const old = t.id; // 처음 켜면 할 일 번호가 '규칙번호.날짜'로 바뀐다 → 시트를 새 번호로 다시 연다
    const id = C.setRepeat(old, ds);
    commit();
    if (id !== old) openSheet({ type: 'task', id });
    if (!had) toast(`${C.daysText(ds)}${ds.length === 7 ? '' : '요일마다'} 반복해요. 앞으로 2주를 넣어 뒀어요`);
  };
  const pick = (v) => {
    if (v === mode) return;
    if (v === 'none') return withUndo('반복을 그만했어요', () => C.stopRepeat(rule.id, t.id));
    apply(v === 'daily' ? ALLDAYS : days.length && days.length < 7 ? days : [C.weekday(t.date)]);
  };
  return html`<div>
    <span class="label">반복 <span class="muted" style="font-weight:500">— 매일이나 요일마다 저절로 넣어요</span></span>
    <${Seg} label="반복" value=${mode} onChange=${pick} options=${[['none', '안 함'], ['daily', '매일'], ['week', '요일마다']]} />
    ${mode === 'week'
      ? html`<div class="chips appear" style="margin-top:8px">${WEEK_ORDER.map((w) => html`<button key=${w} class="chip" style="min-height:36px;padding:0 12px" aria-pressed=${days.includes(w) ? 'true' : 'false'} aria-label=${C.WD[w] + '요일'} onClick=${() => {
          const ds = days.includes(w) ? days.filter((x) => x !== w) : [...days, w];
          if (ds.length) apply(ds);
        }}>${C.WD[w]}</button>`)}</div>`
      : null}
    ${rule ? html`<p class="hint" style="margin-bottom:0">이름·예상 시간·중요도·시작 시각·횟수를 바꾸면 다음 반복에도 반영돼요. 메모·사진·마감일은 이날 것만.</p>` : null}
  </div>`;
}

/** 다가오는 마감: 다른 날로 잡아 둔 일 중 마감이 3일 안인 것 */
export function DueSheet() {
  const list = C.dueSoon();
  const td = today();
  return html`<${Sheet} title="다가오는 마감">
    <p class="sub" style="margin:0 0 4px">마감이 ${C.DUE_SOON}일 안인데 다른 날로 잡아 둔 일이에요.</p>
    ${!list.length ? html`<div class="empty"><h3>가까운 마감이 없어요</h3></div>` : null}
    ${list.map((t) => {
      const sub = subById(t.subjectId);
      return html`<div class="eod-item hue" key=${t.id} style=${hue(sub ? sub.h : 0)}>
        <div class="hd"><span class="dot"></span><b>${titleOf(t)}</b><small>${sub ? sub.name : ''}</small></div>
        <div class="due-facts"><span>마감 <b>${mdws(t.due)}</b> · ${dueLeft(t.due)}</span><span>할 날 ${mdws(t.date)}</span></div>
        <div class="btns">
          <button class="btn sm pri" onClick=${() => withUndo('오늘로 옮겼어요', () => C.moveTask(t.id, td))}>오늘 하기</button>
          <button class="btn sm" onClick=${() => openSheet({ type: 'task', id: t.id })}>자세히</button>
        </div>
      </div>`;
    })}
  <//>`;
}

/** 반복하는 일 모아 보기 */
export function RepeatsSheet() {
  const list = D().repeats || [];
  const td = today();
  return html`<${Sheet} title="반복하는 일">
    ${!list.length ? html`<div class="empty"><h3>반복하는 일이 없어요</h3><p>할 일 › 더 보기 › 반복에서 켜면 여기 모여요.</p></div>` : null}
    ${list.length
      ? html`<div class="set-list">${list.map((r) => {
          const sub = subById(r.subjectId);
          const next = D().tasks.filter((x) => x.rep === r.id && x.date >= td).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
          return html`<div class="set-row hue" key=${r.id} style=${hue(sub ? sub.h : 0)}>
            <span class="dot"></span>
            <button class="l plain" disabled=${!next} onClick=${() => next && openSheet({ type: 'task', id: next.id })}>
              <b>${r.title}</b><small>${sub ? sub.name : '(없는 과목)'} · ${C.daysText(r.days)}${r.est ? ` · ${minutes(r.est)}` : ''}${next ? ` · 다음 ${next.date === td ? '오늘' : md(next.date)}` : ''}</small>
            </button>
            <button class="btn sm quiet" onClick=${() => withUndo(`'${r.title}' 반복을 그만했어요`, () => C.stopRepeat(r.id))}>그만하기</button>
          </div>`;
        })}</div>
        <p class="hint">이름을 누르면 다음 반복이 열려요. 거기서 이름·요일·시간을 바꿀 수 있어요. 그만해도 지난 기록은 남아요.</p>`
      : null}
  <//>`;
}

// ─── 사진 ───

function Thumb({ id, onOpen }) {
  const [u, setU] = useState(null);
  useEffect(() => {
    let live = true;
    photoURL(id).then((x) => live && setU(x || 'none')).catch(() => live && setU('none'));
    return () => (live = false);
  }, [id]);
  // 'none': 이 기기에 없는 사진 (파일에서 불러온 기록 등)
  return html`<button class="thumb" onClick=${onOpen} aria-label="사진 크게 보기">${u === 'none' ? html`<span class="muted small">사진 없음</span>` : u ? html`<img src=${u} alt="" />` : html`<span class="muted small">…</span>`}</button>`;
}

function Photos({ t }) {
  const [busy, setBusy] = useState(false);
  const add = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    try {
      for (const f of files) {
        const id = await savePhoto(f);
        t.photos = [...(t.photos || []), id];
      }
      commit();
    } catch {
      toast('사진을 넣지 못했어요');
    }
    setBusy(false);
  };
  return html`<div class="photos">
    ${(t.photos || []).map((id) => html`<${Thumb} key=${id} id=${id} onOpen=${() => openSheet({ type: 'photo', id, task: t.id })} />`)}
    <label class="thumb add">${busy ? '넣는 중…' : '+ 사진'}<input type="file" accept="image/*" multiple style="display:none" onChange=${add} /></label>
  </div>`;
}

export function PhotoSheet({ id, task }) {
  const t = D().tasks.find((x) => x.id === task);
  const [u, setU] = useState(null);
  useEffect(() => {
    photoURL(id).then((x) => setU(x || 'none')).catch(() => setU('none'));
  }, [id]);
  const back = () => openSheet({ type: 'task', id: task });
  return html`<${Sheet} title="사진" tall onClose=${back} footer=${html`<button class="btn danger" onClick=${() => {
    // 사진 파일은 바로 지우지 않는다 → 되돌리기가 가능
    withUndo('사진을 뺐어요', () => t && (t.photos = (t.photos || []).filter((x) => x !== id)));
    back();
  }}>이 사진 빼기</button><button class="btn pri" onClick=${back}>할 일로 돌아가기</button>`}>
    <div class="photo-full">${u === 'none' ? html`<p class="muted">이 기기에 없는 사진이에요. 사진을 넣은 기기에서 동기화하면 보여요.</p>` : u ? html`<img src=${u} alt=${t ? `${t.title || ''} 사진` : '사진'} />` : html`<p class="muted">불러오는 중…</p>`}</div>
  <//>`;
}

/**
 * 과목에서 '다음에 할 것' 하나: 앞으로 잡아 둔 진도 할 일 중 가장 이른 것(그날보다 뒤).
 * 없으면 지금 단계에서 아직 안 한 앞부분. → 할 일 추가에서 한 번에 당겨 오거나 넣는다.
 */
function nextChunk(sub, day) {
  if (!sub) return null;
  const planned = D()
    .tasks.filter((t) => t.subjectId === sub.id && t.kind === 'track' && t.status === 'todo' && !t.hist && t.date > day)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))[0];
  if (planned) return { task: planned };
  const cs = C.curStage(sub);
  if (!cs) return null;
  const b = C.bookOf(sub, cs);
  const k = C.stageUnit(sub, cs);
  const size = { page: 10, psg: 3, q: 10, lec: 1, set: 1, ch: 1 }[k] || 3;
  const free = [];
  for (let u = cs.from; u <= cs.to && free.length < size; u++) if (!C.isMarked(cs, u)) free.push(u);
  if (!free.length) return null;
  const run = free.length === free[free.length - 1] - free[0] + 1;
  return { stage: cs, book: b, from: free[0], to: free[free.length - 1], units: run ? null : free };
}

export function AddSheet({ subjectId }) {
  const subs = D().subjects;
  const [sid, setSid] = useState(() => (subjectId && subs.some((s) => s.id === subjectId) ? subjectId : UI().lastSub && subs.some((s) => s.id === UI().lastSub) ? UI().lastSub : subs[0] && subs[0].id));
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
  const nx = nextChunk(sub, when);
  // 적는 예: 지금 단계의 교재와 단위로
  const cs = sub && C.curStage(sub);
  const example = cs ? (() => {
    const b = C.bookOf(sub, cs);
    let u = cs.from;
    while (u < cs.to && C.isMarked(cs, u)) u++;
    if (!cs.marks) u = cs.upto == null ? cs.from : Math.min(cs.to, cs.upto + 1);
    const z = Math.min(cs.to, u + (cs.marks ? 2 : 9));
    return `${b ? b.name + ' ' : ''}${b && b.labels ? `${C.itemShort(b, u)}~${C.itemShort(b, z)}` : C.stageUnit(sub, cs) === 'page' ? `p.${u}-${z}` : C.rangeText(sub, b, u, z).replace('–', '-')}`;
  })() : '쎈 p.20-35';
  const note = (title) => {
    setUI({ lastSub: sid });
    setAdded([...added, title]);
  };
  const submit = (e) => {
    e.preventDefault();
    const title = (ref.current ? ref.current.value : text).trim();
    if (!title || !sid) return;
    C.addTask({ title, subjectId: sid, date: when, link: C.parseLink(title, sub) });
    commit();
    note(title);
    setText('');
    if (ref.current) {
      ref.current.value = '';
      ref.current.focus();
    }
  };
  const pull = () => {
    if (!nx) return;
    if (nx.task) {
      const t = nx.task;
      withUndo(`${md(t.date)}에 잡혀 있던 것을 ${when === td ? '오늘' : md(when)}로 당겼어요`, () => C.moveTask(t.id, when));
      note(`${titleOf(t)} ${C.trng(t)}`);
    } else {
      const t = C.addTask({ title: '', subjectId: sid, date: when, link: { stage: nx.stage, from: nx.from, to: nx.to } });
      if (nx.units) t.units = nx.units;
      commit();
      note(`${nx.stage.name} ${C.trng(t)}`);
    }
  };
  const whenWord = when === td ? '오늘' : when === addDays(td, 1) ? '내일' : md(when);
  return html`<${Sheet} title="할 일 추가">
    <form onSubmit=${submit}>
      <input ref=${ref} class="input" style="font-size:1.1em" placeholder="무엇을 할까요?" value=${text} onInput=${(e) => setText(e.target.value)} aria-label="할 일" enterkeyhint="done" autocomplete="off" />
      ${link
        ? html`<p class="hint hue linked" style=${hue(sub.h)}><${Icon} n="check" s=${15} w=${2.4} />${sub.name} · ${link.stage.name} ${C.rangeText(sub, C.bookOf(sub, link.stage), link.from, link.to)} — 체크하면 진도에 반영돼요</p>`
        : html`<p class="hint">교재 이름과 범위를 함께 적으면 진도에 반영돼요. 예: ${example}</p>`}
      ${nx && !text.trim()
        ? html`<button type="button" class="pull hue" style=${hue(sub.h)} onClick=${pull}>
            <span class="l"><small>${nx.task ? `${md(nx.task.date)}에 잡혀 있는 다음 것 · ${whenWord}로 당겨 오기` : `${whenWord} 이어서 하기`}</small><b>${nx.task ? `${titleOf(nx.task)} ${C.trng(nx.task)}` : `${nx.stage.name} ${C.rangeText(sub, nx.book, nx.from, nx.to, nx.units)}`}</b></span>
            <${Icon} n="plus" s=${20} />
          </button>`
        : null}
      <span class="label">과목</span>
      <div class="chips">${subs.map((s) => html`<button type="button" key=${s.id} class="chip hue" style=${hue(s.h)} aria-pressed=${sid === s.id ? 'true' : 'false'} onClick=${() => setSid(s.id)}><span class="dot"></span>${s.name}</button>`)}</div>
      <span class="label">언제</span>
      <div class="chips">
        ${[[td, '오늘'], [addDays(td, 1), '내일'], [addDays(td, 2), '모레']].map(([d, l]) => html`<button type="button" key=${l} class="chip" aria-pressed=${when === d ? 'true' : 'false'} onClick=${() => setWhen(d)}>${l}</button>`)}
        <${DateField} style="width:auto" value=${when} label="날짜" onCommit=${(v) => setWhen(v)} />
      </div>
      <div class="btns" style="margin-top:18px"><button class="btn pri" type="submit" disabled=${!text.trim()}>추가</button></div>
      ${added.length ? html`<p class="hint">넣음: ${added.join(', ')}</p>` : null}
    </form>
  <//>`;
}

export function EndDaySheet({ past }) {
  const td = today();
  const day = past ? td : viewDay();
  const inDay = (t) => t.status === 'todo' && !t.closed && (past ? t.date < td : t.date <= day);
  // 반복하는 일은 밀리지 않는다 → 정리할 목록에서 뺀다
  const [snap] = useState(() => D().tasks.filter((t) => inDay(t) && !t.rep).map((t) => t.id));
  const [repN] = useState(() => (past ? 0 : D().tasks.filter((t) => inDay(t) && t.rep && t.date === day).length));
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
    ${repN ? html`<p class="hint" style="margin:0 0 6px">못 한 반복하는 일 ${repN}개는 옮기지 않고 이날 기록으로 남겨요.</p>` : null}
    ${items.map((t) => {
      const sub = subById(t.subjectId);
      const h = handled[t.id];
      return html`<div class="eod-item hue" key=${t.id} style=${hue(sub ? sub.h : 0)}>
        <div class="hd"><span class="dot"></span><b>${titleOf(t)}</b><small>${sub ? sub.name : ''} · ${md(snapDate(t, h))}</small></div>
        ${h
          ? html`<div class="reasons appear">
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
  const ws = PR().weekStart === 1 ? 1 : 0; // 달력 첫 요일 (설정)
  const start = addDays(first, -((C.weekday(first) - ws + 7) % 7));
  const heads = [0, 1, 2, 3, 4, 5, 6].map((i) => (i + ws) % 7);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const weeks = cells.slice(35).every((d) => d.slice(0, 7) !== month) ? cells.slice(0, 35) : cells;
  const shift = (n) => {
    const idx = y * 12 + (m - 1) + n;
    setMonth(`${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`);
  };
  const ex = D().exam;
  const dues = new Set(D().tasks.filter((t) => t.status === 'todo' && t.due).map((t) => t.due));
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
    <div class="cal appear" key=${month}>
      ${heads.map((i) => html`<div key=${i} class=${'wd' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '')}>${C.WD[i]}</div>`)}
      ${weeks.map((d) => {
        const l = tasksOn(d).filter((t) => t.status !== 'dropped');
        const wd = C.weekday(d);
        return html`<button key=${d} class=${`d${d.slice(0, 7) !== month ? ' other' : ''}${d === td ? ' today' : ''}${d === viewDay() && !pickFor ? ' sel' : ''}${wd === 0 ? ' sun' : wd === 6 ? ' sat' : ''}`} onClick=${() => choose(d)} aria-label=${`${mdws(d)} 할 일 ${l.length}개${dues.has(d) ? ', 마감 있음' : ''}`}>
          <span class="n">${+d.slice(8)}</span>
          <span class="dots">${l.slice(0, 6).map((t) => html`<i key=${t.id} class=${'hue' + (t.status === 'done' ? ' on' : '')} style=${hue(subById(t.subjectId)?.h || 0)}></i>`)}</span>
          ${ex && ex.date === d ? html`<span class="ex">${C.isGoal(ex) ? '끝' : '시험'}</span>` : dues.has(d) ? html`<span class="ex due">마감</span>` : null}
        </button>`;
      })}
    </div>
    <p class="hint">점 하나가 할 일 하나예요. 채워진 점은 끝낸 일.${dues.size ? ' 마감은 안 끝낸 일의 마감일이에요.' : ''}</p>
  </div>`;
  if (inline) return body;
  return html`<${Sheet} title=${pickFor ? '옮길 날짜' : '달력'}>${body}<//>`;
}

export function WeekSheet() {
  const [back, setBack] = useState(0); // 몇 주 전
  const [range, setRange] = useState('week'); // 'week' | 'exam' (시험 준비를 시작한 날부터 오늘까지)
  const ex = D().exam;
  const td = today();
  // 시험 준비가 한 주보다 길 때만 '전체'를 고를 수 있다
  const canAll = !!(ex && ex.start && ex.start < addDays(td, -6));
  const all = canAll && range === 'exam';
  const end = addDays(td, -7 * back);
  const w = all ? C.periodStats(ex.start, td) : C.weekStats(end);
  const rate = w.planned ? w.done / w.planned : null;
  const mx = Math.max(1, ...w.days.map((d) => d.pages));
  const reasons = Object.entries(w.reasons).sort((a, b) => b[1] - a[1]);
  const rmx = Math.max(1, ...reasons.map((r) => r[1]));
  const sum = C.tally(D().subjects.flatMap((s) => w.days.flatMap((d) => Object.entries(C.logTally(s, d.d)))));
  const tm = w.time;
  const hasOlder = D().tasks.some((t) => t.date < addDays(end, -6));
  const many = w.days.length > 7;
  return html`<${Sheet} title=${all ? `${ex.name.replace(/^\d학기 /, '')} 준비 돌아보기` : back ? `${back}주 전 돌아보기` : '이번 주 돌아보기'} tall>
    ${canAll ? html`<div style="margin-bottom:10px"><${Seg} label="기간" value=${range} onChange=${(v) => { setRange(v); setBack(0); }} options=${[['week', '한 주씩'], ['exam', '시험 준비 전체']]} /></div>` : null}
    ${all
      ? html`<p class="sub" style="margin:0 0 12px;text-align:center">${md(w.from)}–${md(w.end)} · ${w.days.length}일 · 계획한 것과 실제로 한 것</p>`
      : html`<div class="weeknav">
          <button class="ib" aria-label="지난주" disabled=${!hasOlder} onClick=${() => setBack(back + 1)}><${Icon} n="left" /></button>
          <span class="sub">${md(w.from)}–${md(w.end)} · 계획한 것과 실제로 한 것</span>
          <button class="ib" aria-label="다음 주" disabled=${!back} onClick=${() => setBack(back - 1)}><${Icon} n="right" /></button>
        </div>`}
    <div class="appear" key=${all ? 'all' : 'w' + back}>
    <div class="facts">
      <div class="fact"><div class="k">계획한 일</div><div class="v">${w.planned}<small>개</small></div></div>
      <div class="fact"><div class="k">끝낸 일</div><div class="v">${w.done}<small>개 · ${rate == null ? '–' : P(rate)}</small></div></div>
      <div class="fact"><div class="k">미룬 횟수</div><div class="v">${w.moved}<small>번</small></div></div>
      <div class="fact"><div class="k">안 하기로 한 일</div><div class="v">${w.dropped}<small>개</small></div></div>
    </div>
    <div class="sec-title">날마다 한 양<em>합계 ${C.tallyText(sum)}</em></div>
    <div class=${'vbars' + (many ? ' many' : '')}>${w.days.map((d) => html`<div key=${d.d} title=${`${md(d.d)} ${d.pages}`}><i class=${d.pages ? '' : 'zero'} style=${{ height: `${Math.max(3, (d.pages / mx) * 100)}%` }}></i></div>`)}</div>
    <div class="vbars-x">${many
      ? html`<span>${md(w.days[0].d)}</span><span>${md(w.days[w.days.length - 1].d)}</span>`
      : w.days.map((d) => html`<span key=${d.d}>${C.WD[C.weekday(d.d)]}</span>`)}</div>
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
    <div class="sec-title">예상 시간과 걸린 시간${tm.n ? html`<em>걸린 시간을 적은 ${tm.n}개</em>` : null}</div>
    ${tm.n
      ? html`<div class="est-vs">
          <div><small>예상</small><b class="num">${minutes(tm.est)}</b></div>
          <div><small>걸린 시간</small><b class="num">${minutes(tm.actual)}</b></div>
          <div><small>예상 대비</small><b class="num">${Math.round((tm.actual / Math.max(1, tm.est)) * 100)}%</b></div>
        </div>
        <table class="tbl" style="margin-top:10px"><thead><tr><th>과목</th><th class="r">개수</th><th class="r">예상</th><th class="r">걸린 시간</th></tr></thead><tbody>
          ${D().subjects.filter((s) => tm.bySub[s.id]).map((s) => {
            const o = tm.bySub[s.id];
            return html`<tr key=${s.id}><td><span class="hue row" style=${hue(s.h)}><span class="dot"></span>${s.name}</span></td><td class="r n">${o.n}</td><td class="r n">${minutes(o.est)}</td><td class="r n">${minutes(o.actual)}</td></tr>`;
          })}
        </tbody></table>`
      : html`<p class="hint" style="margin-top:0">끝낸 할 일을 누르면 걸린 시간을 고를 수 있어요. 적은 것만 여기서 예상과 나란히 보여요.</p>`}
    </div>
  <//>`;
}

/** 시험 날(끝낼 날)까지 나눠 주기 (미리 보고 확정) */
export function PlanSheet({ only }) {
  const td = today();
  const ex = D().exam;
  const [edit, setEdit] = useState(null); // 시간을 바꾸는 중인 날짜
  const { tasks, days } = C.previewPlan(td, only || null);
  // 쉬도록 바꾼 날도 줄에 남겨 둔다 (되돌릴 수 있게)
  const rows = [];
  if (ex) for (let d = td; d < C.planEnd(ex); d = addDays(d, 1)) if (C.capacity(d) > 0 || C.isDayChanged(d)) rows.push(d);
  const byDay = rows.map((d) => [d, tasks.filter((t) => t.date === d)]);
  // 그날 이미 있는 다른 할 일(직접 넣은 일 등)도 시간에 더한다
  const stays = (t) => t.status === 'todo' && !(t.kind === 'track' && !t.manual && !t.hist && (!only || t.subjectId === only));
  // 2주보다 먼 날의 반복하는 일은 아직 할 일로 안 만들어져 있으니 따로 더한다
  const dayMin = (d, l) => C.plannedMinutes(l) + C.plannedMinutes(D().tasks.filter((t) => t.date === d && stays(t))) + C.pendingRepeatMinutes(d);
  const total = C.taskTally(tasks);
  const tu = C.UNITS.filter((u) => total[u.id]);
  const p = PR();
  const E = C.endWord();
  const n = days.length || 1;
  const needMin = byDay.reduce((a, [d, l]) => a + dayMin(d, l), 0);
  const capMin = byDay.reduce((a, [d]) => a + C.capacity(d), 0);
  // 단위가 섞이면 큰 숫자는 첫 단위, 나머지는 작게 덧붙인다
  const big = (f) => {
    if (!tu.length) return html`<b class="num">0</b>`;
    const [u0, ...us] = tu;
    return html`<b class="num">${f(total[u0.id])}</b>${C.unitShort(u0.id)}${us.length ? html`<small>+ ${us.map((u) => C.amountText(u.id, f(total[u.id]), true)).join(' · ')}</small>` : null}`;
  };
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
      <div><small>남은 분량</small>${big((x) => x)}</div>
      <div><small>나눌 날</small><b class="num">${days.length}</b>일</div>
      <div><small>하루 평균</small>${big((x) => Math.round(x / n))}</div>
    </div>
    ${ex && tasks.length
      ? html`<div class="kv" style="margin-bottom:6px"><span class="k">예상 시간 합</span><span class="v"><b class="num">${minutes(needMin)}</b> <span class="muted">/ 공부 가능 시간 합 ${minutes(capMin)}</span></span></div>`
      : null}
    ${ex
      ? html`<p class="hint" style="margin:0 0 10px">과목마다 지금 하는 단계부터 이어서, ${mdws(C.lastPlanDay(ex))}까지 나눠요. 직접 넣은 일과 반복하는 일 시간을 먼저 빼고, 남는 시간이 긴 날에 더 많이 넣어요. 이미 끝낸 일과 직접 넣은 일은 그대로 둬요. 날짜의 시간을 누르면 그날만 바꿀 수 있어요.</p>`
      : null}
    <div class="set-list" style="margin-bottom:14px">
      <div class="set-row col"><span class="l"><b>쉬는 요일</b><small>이 요일에는 넣지 않아요</small></span>
        <div class="chips">${C.WD.map((w, i) => html`<button key=${w} class="chip" style="min-height:32px;padding:0 10px" aria-pressed=${p.rest.includes(i) ? 'true' : 'false'} onClick=${() => C.setPrefs({ rest: p.rest.includes(i) ? p.rest.filter((x) => x !== i) : [...p.rest, i] })}>${w}</button>`)}</div>
      </div>
    </div>
    ${byDay.map(([d, l]) => {
      const cap = C.capacity(d), m = dayMin(d, l);
      return html`<div class=${'dayplan' + (cap ? '' : ' off')} key=${d}>
      <div class="dh">${mdws(d)}
        <button class=${'dtime' + (cap && m > cap ? ' over' : '') + (C.isDayChanged(d) ? ' changed' : '')} onClick=${() => setEdit(edit === d ? null : d)} aria-expanded=${edit === d ? 'true' : 'false'}>${cap ? `${minutes(m)} / ${minutes(cap)}` : '쉼'}</button>
        <span class="num">${l.length ? C.tallyText(C.taskTally(l)) : ''}</span>
      </div>
      ${edit === d ? html`<${DayCap} day=${d} compact />` : null}
      <ul>${l.map((t) => {
        const s = subById(t.subjectId);
        const st = s && s.stages.find((x) => x.id === t.stageId);
        return html`<li key=${t.id} class="hue" style=${hue(s.h)}><span class="dot"></span>${s.name} · ${st ? st.name : ''}<span class="num">${C.trng(t)}</span></li>`;
      })}</ul>
    </div>`;
    })}
  <//>`;
}
