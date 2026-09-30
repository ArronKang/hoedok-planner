// 캘린더: 날짜별 계획 시간/가용 시간, 할 일 점, 시험 표시
import { html } from '../../lib/html.js';
import { useState, useMemo, useRef } from '../../lib/ui.js';
import { Icon } from '../../ui/icons.js';
import { IconButton, cx } from '../../ui/kit.js';
import { setSelectedDate } from '../../state/app.js';
import { useToday, useSelectedDate } from '../../data/hooks.js';
import { tasksOn, plannedMinutes, capacityFor, exams, subjectOf, subjectVars } from '../../data/model.js';
import { resolveCards } from '../../state/device.js';
import { monthMatrix, addMonths, formatMonth, WEEKDAYS, weekday, monthKey, formatMDW, minutesLabel, diffDays, ddayLabel } from '../../core/date.js';
import { EXAM_KINDS } from '../../core/calc/exam.js';
import { ViewHeader, ViewBody } from '../common.js';
import { TaskRow } from '../today/TaskRow.js';
import { openTask } from '../today/TaskSheet.js';
import { openQuickAdd } from '../today/QuickAdd.js';
import { tapCheck } from '../../data/actions.js';
import { LoadBar } from '../today/DayView.js';

function DayCell({ d, month, today, selected, examsOn, onPick }) {
  const tasks = tasksOn(d).filter((t) => t.status !== 'dropped');
  const planned = plannedMinutes(d);
  const cap = capacityFor(d);
  const ratio = cap > 0 ? planned / cap : planned > 0 ? 2 : 0;
  const wd = weekday(d);
  const shown = tasks.slice(0, 5);
  return html`<button
    class=${cx('mc-day', monthKey(d) !== month && 'other', d === today && 'today', d === selected && 'sel', wd === 0 && 'sun', wd === 6 && 'sat')}
    onClick=${() => onPick(d)}
    aria-label=${`${formatMDW(d)}, 할 일 ${tasks.length}개${examsOn.length ? ', ' + examsOn.map((e) => e.name).join(', ') : ''}`}
  >
    <span class="mc-d num">${Number(d.slice(8))}</span>
    ${planned > 0 || cap > 0
      ? html`<span class="mc-load" aria-hidden="true"><i style=${{ width: Math.min(100, ratio * 100) + '%' }} class=${ratio > 1 ? 'over' : ''}></i></span>`
      : html`<span class="mc-load empty" aria-hidden="true"></span>`}
    <span class="mc-dots" aria-hidden="true">
      ${shown.map((t) => html`<i key=${t.id} class=${t.status === 'done' ? 'on' : ''} style=${subjectVars(subjectOf(t.subjectId))}></i>`)}
      ${tasks.length > 5 ? html`<b>+${tasks.length - 5}</b>` : null}
    </span>
    ${examsOn.length ? html`<span class="mc-exam ellipsis">${EXAM_KINDS[examsOn[0].kind] ? EXAM_KINDS[examsOn[0].kind].short : '시험'}</span>` : null}
  </button>`;
}

function MonthCard({ month, setMonth, today, selected, onPick }) {
  const weeks = useMemo(() => monthMatrix(month), [month]);
  const examsByDate = new Map();
  for (const e of exams()) {
    if (!examsByDate.has(e.date)) examsByDate.set(e.date, []);
    examsByDate.get(e.date).push(e);
  }
  const touch = useRef(null);
  return html`<section
    class="card month-card"
    onTouchStart=${(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
    onTouchEnd=${(e) => {
      const s = touch.current;
      touch.current = null;
      if (!s) return;
      const dx = e.changedTouches[0].clientX - s.x;
      const dy = e.changedTouches[0].clientY - s.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) setMonth(addMonths(month, dx < 0 ? 1 : -1));
    }}
  >
    <div class="mc-head">
      <h3 class="num">${formatMonth(month)}</h3>
      <span class="spacer"></span>
      ${month !== monthKey(today) ? html`<button class="btn sm subtle" onClick=${() => setMonth(monthKey(today))}>이번 달</button>` : null}
      <${IconButton} icon="chev-left" label="이전 달" onClick=${() => setMonth(addMonths(month, -1))} />
      <${IconButton} icon="chev-right" label="다음 달" onClick=${() => setMonth(addMonths(month, 1))} />
    </div>
    <div class="mc-grid" role="grid">
      ${[0, 1, 2, 3, 4, 5, 6].map((w) => html`<div key=${'w' + w} class=${cx('mc-wd', w === 0 && 'sun', w === 6 && 'sat')}>${WEEKDAYS[w]}</div>`)}
      ${weeks.flat().map((d) => html`<${DayCell} key=${d} d=${d} month=${month} today=${today} selected=${selected} examsOn=${examsByDate.get(d) || []} onPick=${onPick} />`)}
    </div>
    <div class="mc-legend">
      <span><i class="lg-load"></i>계획 ÷ 공부 가능 시간</span>
      <span><i class="lg-dot on"></i>완료</span>
      <span><i class="lg-dot"></i>남음</span>
    </div>
  </section>`;
}

function SelectedDayCard({ date, today, shell }) {
  const tasks = tasksOn(date).filter((t) => t.status !== 'dropped');
  const planned = plannedMinutes(date);
  const cap = capacityFor(date);
  const examsOn = exams().filter((e) => e.date === date);
  return html`<section class="card sel-day">
    <div class="card-head">
      <h3 class="grow" style="color:var(--ink);font-size:var(--t-body)">${formatMDW(date)}</h3>
      <${IconButton} icon="plus" label="이 날에 할 일 추가" onClick=${() => openQuickAdd(date)} />
      ${shell && shell.openDay ? html`<button class="btn sm subtle" onClick=${() => shell.openDay(date)}>하루 화면</button>` : null}
    </div>
    <div class="card-pad" style="padding-top:0">
      ${examsOn.map((e) => html`<div class="tag accent" key=${e.id} style="margin-bottom:8px">${e.name}</div>`)}
      <${LoadBar} planned=${planned} capacity=${cap} compact />
    </div>
    ${tasks.length
      ? html`<div class="group flat"><div class="group-body">
          ${tasks.map((t) => html`<${TaskRow} key=${t.id} task=${t} today=${today} showSubject onOpen=${() => openTask(t.id)} onCheck=${() => tapCheck(t.id)} />`)}
        </div></div>`
      : html`<p class="muted" style="padding:0 var(--pad) var(--pad);margin:0">할 일이 없습니다.</p>`}
  </section>`;
}

export function CalendarView({ nav, panel, shell }) {
  const today = useToday();
  const selected = useSelectedDate();
  const [month, setMonth] = useState(monthKey(selected));
  const cards = resolveCards('calendar', panel ? panel.cards : null).filter((c) => !c.hidden);
  const next = exams().find((e) => e.date >= today);
  return html`<div class="view cal-view">
    <${ViewHeader}
      nav=${nav}
      panel=${panel}
      title="캘린더"
      sub=${next ? `${next.name} ${ddayLabel(diffDays(today, next.date))}` : null}
    />
    <${ViewBody}>
      <div class="stack">
        ${cards.map((c) =>
          c.id === 'month'
            ? html`<${MonthCard} key="m" month=${month} setMonth=${setMonth} today=${today} selected=${selected} onPick=${(d) => setSelectedDate(d === today ? null : d)} />`
            : html`<${SelectedDayCard} key="d" date=${selected} today=${today} shell=${shell} />`,
        )}
      </div>
    <//>
  </div>`;
}
