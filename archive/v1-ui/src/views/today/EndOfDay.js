// 하루 마감: 남은 할 일을 한 화면에서 내일로 / 날짜 지정 / 버림 (+ 이유 한 번 탭, 선택)
import { html } from '../../lib/html.js';
import { useState } from '../../lib/ui.js';
import { Sheet, openSheet } from '../../ui/overlay.js';
import { Icon } from '../../ui/icons.js';
import { pickDate, cx } from '../../ui/kit.js';
import { all, get, beginCapture, endCapture, restore } from '../../data/db.js';
import { subjectOf, subjectVars, tasksOn } from '../../data/model.js';
import { moveTask, dropTask, setOutcomeReason, saveTask } from '../../data/actions.js';
import { MOVE_REASONS } from '../../core/templates.js';
import { addDays, formatMDW, formatShort, minutesLabel, formatShortW } from '../../core/date.js';
import { useToday } from '../../data/hooks.js';
import { MinutesPicker } from './TaskSheet.js';

function capture(fn) {
  beginCapture();
  try {
    fn();
  } finally {
    return endCapture();
  }
}

function Row({ id, primary, today, state, setState }) {
  const t = get('tasks', id);
  if (!t) return null;
  const subj = subjectOf(t.subjectId);
  const st = state[id];
  const act = (kind, to) => {
    const entries = capture(() => (kind === 'drop' ? dropTask(id) : moveTask(id, to)));
    setState((s) => ({ ...s, [id]: { kind, to, entries, reason: null } }));
  };
  const undo = () => {
    restore(st.entries);
    setState((s) => {
      const n = { ...s };
      delete n[id];
      return n;
    });
  };
  const chooseDate = async () => {
    const d = await pickDate({
      title: '옮길 날짜',
      value: addDays(today, 1),
      today,
      min: today,
      quick: [
        { label: '오늘', date: today },
        { label: '내일', date: addDays(today, 1) },
        { label: '모레', date: addDays(today, 2) },
        { label: '일주일 뒤', date: addDays(today, 7) },
      ],
    });
    if (d) act('move', d);
  };
  return html`<li class=${cx('eod-row', st && 'handled')} style=${subjectVars(subj)}>
    <div class="eod-top">
      <span class="dot"></span>
      <div class="grow" style="min-width:0">
        <div class="eod-title">${t.title}</div>
        <div class="eod-meta">${subj ? subj.name : ''}${t.date < today ? ` · ${formatShortW(t.date)}` : ''}${t.repeatTotal > 1 ? ` · ${t.repeatDone || 0}/${t.repeatTotal}` : ''}${(t.moves || []).length ? ` · 미룸 ${t.moves.length}회` : ''}</div>
      </div>
    </div>
    ${st
      ? html`<div class="eod-done">
          <div class="hstack">
            <${Icon} name=${st.kind === 'drop' ? 'trash' : 'arrow-right'} size=${16} />
            <span class="grow">${st.kind === 'drop' ? '버렸습니다' : `${formatMDW(st.to)}(으)로 옮겼습니다`}</span>
            <button class="btn ghost sm" onClick=${undo}>되돌리기</button>
          </div>
          <div class="reason-q">이유 (선택)</div>
          <div class="chips">
            ${MOVE_REASONS.map(
              (r) => html`<button key=${r} class=${cx('chip', st.reason === r && 'on')} onClick=${() => {
                const next = st.reason === r ? null : r;
                setOutcomeReason(id, next);
                setState((s) => ({ ...s, [id]: { ...s[id], reason: next } }));
              }}>${r}</button>`,
            )}
          </div>
        </div>`
      : html`<div class="eod-actions">
          <button class="btn sm primary" onClick=${() => act('move', primary.to)}><${Icon} name="arrow-right" size=${16} />${primary.label}</button>
          <button class="btn sm" onClick=${chooseDate}><${Icon} name="calendar" size=${16} />날짜</button>
          <button class="btn sm" onClick=${() => act('drop')}><${Icon} name="trash" size=${16} />버림</button>
        </div>`}
  </li>`;
}

function ActualTimes({ date }) {
  const done = tasksOn(date).filter((t) => t.status === 'done');
  const [open, setOpen] = useState(false);
  if (!done.length) return null;
  const filled = done.filter((t) => typeof t.actualMinutes === 'number').length;
  return html`<section class="eod-actual">
    <button class="list-row" onClick=${() => setOpen(!open)} aria-expanded=${open ? 'true' : 'false'}>
      <${Icon} name="clock" />
      <span class="label">실제 걸린 시간 적기 <span class="muted">(선택 · ${filled}/${done.length})</span></span>
      <${Icon} name=${open ? 'chev-up' : 'chev-down'} class="chev" />
    </button>
    ${open
      ? html`<ul class="eod-list">
          ${done.map((t) => {
            const s = subjectOf(t.subjectId);
            return html`<li key=${t.id} class="eod-row" style=${subjectVars(s)}>
              <div class="eod-top">
                <span class="dot"></span>
                <div class="grow" style="min-width:0">
                  <div class="eod-title">${t.title}</div>
                  <div class="eod-meta">예상 ${typeof t.estMinutes === 'number' ? minutesLabel(t.estMinutes) : '없음'}</div>
                </div>
              </div>
              <${MinutesPicker} label="실제 걸린 시간" value=${t.actualMinutes ?? null} onChange=${(v) => saveTask(t.id, { actualMinutes: v })} />
            </li>`;
          })}
        </ul>`
      : null}
  </section>`;
}

function EndOfDay({ close, date, mode }) {
  const today = useToday();
  const target = date && date < today ? date : today;
  // 연 순간의 목록을 고정한다 (옮긴 뒤에도 원래 날짜 묶음에 남아 있게)
  const [snap] = useState(() =>
    all('tasks')
      .filter((t) => t.status === 'todo' && t.date && t.date <= target)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0)))
      .map((t) => ({ id: t.id, date: t.date })),
  );
  const ids = snap.map((s) => s.id);
  const [state, setState] = useState({});
  const bringToday = mode === 'overdue';
  const primary = bringToday ? { label: '오늘로', to: today } : { label: '내일로', to: addDays(today, 1) };
  const remaining = ids.filter((id) => !state[id] && get('tasks', id) && get('tasks', id).status === 'todo');
  const dayTasks = tasksOn(target);
  const doneCount = dayTasks.filter((t) => t.status === 'done').length;
  const planned = dayTasks.filter((t) => t.status !== 'dropped').length;

  const moveAll = () => {
    const next = { ...state };
    for (const id of remaining) {
      const entries = capture(() => moveTask(id, primary.to));
      next[id] = { kind: 'move', to: primary.to, entries, reason: null };
    }
    setState(next);
  };

  const byDate = new Map();
  for (const { id, date: d } of snap) {
    if (!get('tasks', id)) continue;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(id);
  }

  return html`<${Sheet}
    title=${bringToday ? '지난 미완료 정리' : '하루 마감'}
    onClose=${() => close()}
    full
    footer=${html`<button class="btn primary block" onClick=${() => close()}>마치기</button>`}
  >
    <div class="eod">
      ${!bringToday
        ? html`<div class="eod-summary">
            <span class="num big">${formatShort(target)}</span>
            <span>계획 <b class="num">${planned}</b></span>
            <span>완료 <b class="num">${doneCount}</b></span>
            <span>남음 <b class="num">${remaining.length}</b></span>
          </div>`
        : null}
      ${ids.length === 0
        ? html`<div class="empty"><${Icon} name="check" size=${36} /><h4>남은 할 일이 없습니다</h4></div>`
        : html`
            ${remaining.length > 1
              ? html`<button class="btn block" style="margin-bottom:12px" onClick=${moveAll}><${Icon} name="arrow-right" size=${18} />남은 ${remaining.length}개 모두 ${primary.label}</button>`
              : null}
            ${[...byDate.entries()].map(
              ([d, list]) => html`<div key=${d}>
                <div class="section-title">${d === today ? '오늘' : formatMDW(d)} <span class="muted num">${list.length}</span></div>
                <ul class="eod-list">
                  ${list.map((id) => html`<${Row} key=${id} id=${id} primary=${primary} today=${today} state=${state} setState=${setState} />`)}
                </ul>
              </div>`,
            )}
          `}
      <${ActualTimes} date=${target} />
    </div>
  <//>`;
}

export function openEndOfDay({ date, mode = 'today' } = {}) {
  return openSheet((close) => html`<${EndOfDay} close=${close} date=${date} mode=${mode} />`);
}
