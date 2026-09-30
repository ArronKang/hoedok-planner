// 메인: 하루 To-Do (과목별 / 마감순 / 시간순)
import { html } from '../../lib/html.js';
import { useState, useStore } from '../../lib/ui.js';
import { Icon } from '../../ui/icons.js';
import { IconButton, Segmented, pickDate, Stepper, cx } from '../../ui/kit.js';
import { openSheet, Sheet } from '../../ui/overlay.js';
import { withUndo } from '../../ui/toast.js';
import { device, setDevice, resolveCards } from '../../state/device.js';
import { setSelectedDate } from '../../state/app.js';
import { useToday, useSelectedDate } from '../../data/hooks.js';
import { get } from '../../data/db.js';
import {
  tasksOn,
  overdueTasks,
  plannedMinutes,
  capacityFor,
  upcomingExams,
  subjects as allSubjects,
  subjectVars,
  fixedBlocksFor,
  availability,
} from '../../data/model.js';
import { tapCheck, completeTask, moveTask, setDayOverride } from '../../data/actions.js';
import { addDays, diffDays, formatMDW, WEEKDAYS, weekday, parseKey, minutesLabel, ddayLabel, relativeDayLabel, timeToMin } from '../../core/date.js';
import { ViewHeader, ViewBody, Fab } from '../common.js';
import { TaskRow } from './TaskRow.js';
import { openTask } from './TaskSheet.js';
import { openQuickAdd } from './QuickAdd.js';
import { openEndOfDay } from './EndOfDay.js';
import { ExamFactsCard } from '../exams/facts.js';
import { openSettings } from '../settings/index.js';

const cmpImp = (a, b) => (b.importance || 0) - (a.importance || 0);
const cmpCreated = (a, b) => (a.createdAt || 0) - (b.createdAt || 0);
const cmpTime = (a, b) => {
  const x = timeToMin(a.startTime);
  const y = timeToMin(b.startTime);
  if (x == null && y == null) return 0;
  if (x == null) return 1;
  if (y == null) return -1;
  return x - y;
};
const cmpDue = (a, b) => {
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
};
const doneLast = (a, b) => (a.status === 'done') - (b.status === 'done');

function DateTitle({ date, today }) {
  const { m, d } = parseKey(date);
  const rel = relativeDayLabel(date, today);
  return html`<span class="date-title">
    <span class="num dt-md">${m}.${String(d).padStart(2, '0')}</span>
    <span class="dt-wd">${WEEKDAYS[weekday(date)]}요일</span>
    ${rel ? html`<span class=${cx('dt-rel', rel === '오늘' && 'is-today')}>${rel}</span>` : null}
  </span>`;
}

function OverdueCard({ count }) {
  return html`<button class="overdue" onClick=${() => openEndOfDay({ mode: 'overdue' })}>
    <${Icon} name="inbox" size=${20} />
    <span class="grow">지난 날짜에 미완료 <b class="num">${count}</b>개가 남아 있습니다</span>
    <span class="ov-cta">정리하기</span>
  </button>`;
}

function DdayCard({ date, nav }) {
  const list = upcomingExams(date).slice(0, 4);
  if (!list.length) return null;
  return html`<div class="dday-strip" role="list">
    ${list.map((e) => {
      const n = diffDays(date, e.date);
      return html`<button role="listitem" key=${e.id} class="dday" onClick=${() => nav.push('exam', { id: e.id })}>
        <span class="num dd-n">${ddayLabel(n)}</span>
        <span class="dd-name ellipsis">${e.name}</span>
      </button>`;
    })}
  </div>`;
}

function DayCapacitySheet({ date, close }) {
  const o = get('dayOverrides', date);
  const base = availability().weekdays[weekday(date)] || 0;
  const cur = capacityFor(date);
  return html`<${Sheet} title=${formatMDW(date) + ' 공부 가능 시간'} onClose=${close}>
    <p class="sub" style="margin:0 0 12px">이 날만 바꿉니다. 요일 기본값은 설정 › 공부 가능 시간에서 바꿀 수 있습니다.</p>
    <div class="hstack" style="justify-content:center;margin:8px 0 16px">
      <${Stepper} label="공부 가능 시간" value=${cur} min=${0} max=${24 * 60} step=${30} format=${(v) => (v ? minutesLabel(v) : '없음')} onChange=${(v) => setDayOverride(date, v)} />
    </div>
    <p class="muted" style="text-align:center;margin:0 0 12px">요일 기본값: ${base ? minutesLabel(base) : '없음'}</p>
    ${o ? html`<button class="btn block" onClick=${() => setDayOverride(date, null)}>요일 기본값으로 되돌리기</button>` : null}
  <//>`;
}

export function LoadBar({ planned, capacity, onClick, compact }) {
  const max = Math.max(planned, capacity, 1);
  const fill = (Math.min(planned, capacity) / max) * 100;
  const over = planned > capacity ? ((planned - capacity) / max) * 100 : 0;
  const markLeft = (capacity / max) * 100;
  const Tag = onClick ? 'button' : 'div';
  return html`<${Tag} class=${cx('load', compact && 'compact', onClick && 'tappable')} onClick=${onClick} aria-label=${`계획 ${minutesLabel(planned) || '0분'}, 공부 가능 ${minutesLabel(capacity) || '0분'}`}>
    <div class="load-text">
      <span>계획</span><b>${planned ? minutesLabel(planned) : '0분'}</b>
      <span class="muted">/</span>
      <span>가능</span><b>${capacity ? minutesLabel(capacity) : '없음'}</b>
      ${planned > capacity && capacity > 0 ? html`<span class="spacer"></span><span class="over-t">+${minutesLabel(planned - capacity)}</span>` : null}
    </div>
    <div class="load-track">
      <div class="load-fill" style=${{ width: fill + '%' }}></div>
      ${over ? html`<div class="load-over" style=${{ left: fill + '%', width: over + '%' }}></div>` : null}
      ${capacity > 0 && planned > 0 ? html`<div class="load-mark" style=${{ left: `calc(${markLeft}% - 1px)` }}></div>` : null}
    </div>
  <//>`;
}

function sortedFor(mode, tasks) {
  const list = [...tasks];
  if (mode === 'due') return list.sort((a, b) => doneLast(a, b) || cmpDue(a, b) || cmpImp(a, b) || cmpCreated(a, b));
  if (mode === 'time') return list.sort((a, b) => cmpTime(a, b) || cmpImp(a, b) || cmpCreated(a, b));
  return list.sort((a, b) => doneLast(a, b) || cmpImp(a, b) || cmpTime(a, b) || cmpCreated(a, b));
}

function TaskList({ date, today, mode }) {
  const all = tasksOn(date);
  const live = all.filter((t) => t.status !== 'dropped');
  const dropped = all.filter((t) => t.status === 'dropped');
  const [showDropped, setShowDropped] = useState(false);

  const handlers = (t) => ({
    onOpen: () => openTask(t.id),
    onCheck: () => tapCheck(t.id),
    onComplete: () => withUndo('완료로 표시했습니다', () => completeTask(t.id)),
    onTomorrow: () => {
      const to = addDays(t.date > today ? t.date : today, 1);
      withUndo(`${formatMDW(to)}(으)로 옮겼습니다`, () => moveTask(t.id, to));
    },
  });

  if (!live.length && !dropped.length) {
    return html`<div class="empty day-empty">
      <${Icon} name="today" size=${36} stroke=${1.5} />
      <h4>${date === today ? '오늘' : formatMDW(date)} 할 일이 없습니다</h4>
      <p>아래 ＋ 단추로 추가하세요. 이름만 적어도 됩니다.</p>
    </div>`;
  }

  let body;
  if (mode === 'subject') {
    const groups = new Map();
    for (const t of live) {
      const k = t.subjectId || '_';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(t);
    }
    const order = allSubjects().map((s) => s.id);
    const keys = [...groups.keys()].sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
    body = keys.map((k) => {
      const list = sortedFor('subject', groups.get(k));
      const s = allSubjects().find((x) => x.id === k);
      const done = list.filter((t) => t.status === 'done').length;
      return html`<section class="group" key=${k} style=${subjectVars(s)}>
        <div class="group-head">
          <span class="dot"></span>
          <span class="g-name ellipsis">${s ? s.name : '과목 없음'}</span>
          <span class="g-count num">${done}/${list.length}</span>
          <span class="spacer"></span>
          <${IconButton} icon="plus" size=${20} label=${(s ? s.name : '') + '에 할 일 추가'} onClick=${() => openQuickAdd(date, s ? s.id : null)} />
        </div>
        <div class="group-body">
          ${list.map((t) => html`<${TaskRow} key=${t.id} task=${t} today=${today} ...${handlers(t)} />`)}
        </div>
      </section>`;
    });
  } else {
    const list = sortedFor(mode, live);
    let rows = list.map((t) => ({ kind: 'task', t, time: timeToMin(t.startTime) }));
    if (mode === 'time') {
      const blocks = fixedBlocksFor(date).map((b) => ({ kind: 'block', b, time: timeToMin(b.start) }));
      rows = [...rows, ...blocks].sort((a, b) => {
        if (a.time == null && b.time == null) return 0;
        if (a.time == null) return 1;
        if (b.time == null) return -1;
        return a.time - b.time;
      });
    }
    body = html`<section class="group flat">
      <div class="group-body">
        ${rows.map((r) =>
          r.kind === 'block'
            ? html`<div class="fixed-block" key=${'b' + r.b.id}><${Icon} name="clock" size=${16} /><span class="num">${r.b.start}–${r.b.end}</span><span class="grow ellipsis">${r.b.label}</span></div>`
            : html`<${TaskRow} key=${r.t.id} task=${r.t} today=${today} showSubject ...${handlers(r.t)} />`,
        )}
      </div>
    </section>`;
  }

  return html`<div class="tasklist">
    ${body}
    ${dropped.length
      ? html`<button class="dropped-toggle" onClick=${() => setShowDropped(!showDropped)}>
          버린 항목 <span class="num">${dropped.length}</span>개 ${showDropped ? '숨기기' : '보기'}
        </button>`
      : null}
    ${showDropped
      ? html`<section class="group flat dropped">
          <div class="group-body">${dropped.map((t) => html`<${TaskRow} key=${t.id} task=${t} today=${today} showSubject ...${handlers(t)} />`)}</div>
        </section>`
      : null}
  </div>`;
}

export function DayView({ nav, panel }) {
  const today = useToday();
  const date = useSelectedDate();
  const mode = useStore(device, (s) => s.dayMode);
  const phoneCards = useStore(device, (s) => s.phoneCards);
  const cards = resolveCards('today', panel ? panel.cards : phoneCards).filter((c) => !c.hidden);
  const overdue = overdueTasks(today);
  const planned = plannedMinutes(date);
  const capacity = capacityFor(date);
  const nextExam = upcomingExams(today)[0];

  const changeDate = async () => {
    const d = await pickDate({ title: '날짜로 이동', value: date, today, quick: [{ label: '오늘', date: today }] });
    if (d) setSelectedDate(d === today ? null : d);
  };
  const go = (n) => {
    const d = addDays(date, n);
    setSelectedDate(d === today ? null : d);
  };

  const render = {
    overdue: () => (date === today && overdue.length ? html`<${OverdueCard} key="overdue" count=${overdue.length} />` : null),
    dday: () => html`<${DdayCard} key="dday" date=${today} nav=${nav} />`,
    load: () =>
      html`<div class="card load-card" key="load">
        <${LoadBar} planned=${planned} capacity=${capacity} onClick=${() => openSheet((close) => html`<${DayCapacitySheet} date=${date} close=${close} />`)} />
      </div>`,
    tasks: () =>
      html`<div key="tasks" class="tasks-card">
        <div class="tasks-toolbar">
          <${Segmented}
            label="보기 방식"
            size="sm"
            value=${mode}
            onChange=${(v) => setDevice({ dayMode: v })}
            options=${[
              { value: 'subject', label: '과목별' },
              { value: 'due', label: '마감순' },
              { value: 'time', label: '시간순' },
            ]}
          />
        </div>
        <${TaskList} date=${date} today=${today} mode=${mode} />
      </div>`,
    progress: () => (nextExam ? html`<${ExamFactsCard} key="progress" exam=${nextExam} today=${today} nav=${nav} compact />` : null),
  };

  return html`<div class="view day-view">
    <${ViewHeader}
      nav=${nav}
      panel=${panel}
      title=${html`<${DateTitle} date=${date} today=${today} />`}
      onTitle=${changeDate}
      titleLabel="날짜 고르기"
      actions=${html`
        <${IconButton} icon="chev-left" label="전날" onClick=${() => go(-1)} />
        <${IconButton} icon="chev-right" label="다음 날" onClick=${() => go(1)} />
        ${date !== today ? html`<button class="btn sm subtle today-btn" onClick=${() => setSelectedDate(null)}>오늘</button>` : null}
        <${IconButton} icon="moon" label="하루 마감" onClick=${() => openEndOfDay({ date })} />
        ${!panel ? html`<${IconButton} icon="sliders" label="설정" onClick=${() => openSettings()} />` : null}
      `}
    />
    <${ViewBody}>
      <div class="stack">${cards.map((c) => (render[c.id] ? render[c.id]() : null))}</div>
    <//>
    <${Fab} onClick=${() => openQuickAdd(date)} />
  </div>`;
}
