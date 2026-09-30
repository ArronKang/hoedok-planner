// 할 일 한 줄: 체크(반복이면 칸 나눔 원), 제목(완료 시 형광펜), 메타 정보, 좌우 밀기
import { html } from '../../lib/html.js';
import { Icon } from '../../ui/icons.js';
import { SwipeRow, cx } from '../../ui/kit.js';
import { subjectVars, subjectOf } from '../../data/model.js';
import { diffDays, formatShort, minutesLabel } from '../../core/date.js';

function arcPath(cx0, cy0, r, a0, a1) {
  const x0 = cx0 + r * Math.cos(a0);
  const y0 = cy0 + r * Math.sin(a0);
  const x1 = cx0 + r * Math.cos(a1);
  const y1 = cy0 + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export function CheckMark({ task, onTap, label }) {
  const total = task.repeatTotal && task.repeatTotal > 1 ? task.repeatTotal : 0;
  const done = task.status === 'done';
  let ring;
  if (total) {
    const step = (Math.PI * 2) / total;
    const gap = Math.min(0.35, step * 0.22);
    ring = html`<svg viewBox="0 0 26 26" width="26" height="26">
      ${[...Array(total)].map((_, i) => {
        const a0 = -Math.PI / 2 + i * step + gap / 2;
        const a1 = a0 + step - gap;
        return html`<path key=${i} d=${arcPath(13, 13, 10.5, a0, a1)} class=${i < (task.repeatDone || 0) ? 'seg-on' : 'seg-off'} />`;
      })}
      ${done ? html`<path class="tick" d="M8.5 13.5l3 3 6-6.5" />` : html`<text x="13" y="13" class="rep-n">${task.repeatDone || 0}</text>`}
    </svg>`;
  } else {
    ring = html`<svg viewBox="0 0 26 26" width="26" height="26">
      <circle cx="13" cy="13" r="10.5" class="ring" />
      <path class="tick" d="M8.5 13.5l3 3 6-6.5" />
    </svg>`;
  }
  return html`<button
    class=${cx('chk', total && 'rep', done && 'on')}
    aria-label=${label || (done ? '완료 취소' : total ? `반복 ${task.repeatDone || 0}/${total} — 한 번 더 체크` : '완료로 체크')}
    aria-pressed=${done ? 'true' : 'false'}
    onClick=${(e) => {
      e.stopPropagation();
      onTap();
    }}
  >
    ${ring}
  </button>`;
}

const IMP = ['', '!', '!!', '!!!'];

export function TaskMeta({ task, today, showSubject, showDate }) {
  const parts = [];
  const subj = showSubject ? subjectOf(task.subjectId) : null;
  if (subj) parts.push(html`<span class="tm subj" style=${subjectVars(subj)}><span class="dot"></span>${subj.name}</span>`);
  if (showDate && task.date) parts.push(html`<span class="tm num">${formatShort(task.date)}</span>`);
  if (task.startTime) parts.push(html`<span class="tm num"><${Icon} name="clock" size=${14} />${task.startTime}</span>`);
  if (task.dueDate) {
    const d = diffDays(today, task.dueDate);
    parts.push(html`<span class="tm due">마감 <span class="num">${d === 0 ? '오늘' : d > 0 ? `D-${d}` : `D+${-d}`}</span></span>`);
  }
  if (task.pageFrom != null && task.pageTo != null && !String(task.title).includes('p.')) parts.push(html`<span class="tm num">p.${task.pageFrom}–${task.pageTo}</span>`);
  if (task.repeatTotal > 1) parts.push(html`<span class="tm"><${Icon} name="repeat" size=${14} /><span class="num">${task.repeatDone || 0}/${task.repeatTotal}</span></span>`);
  if (typeof task.estMinutes === 'number') {
    parts.push(
      html`<span class="tm">${minutesLabel(task.estMinutes)}${typeof task.actualMinutes === 'number' ? html`<span class="muted"> → ${minutesLabel(task.actualMinutes)}</span>` : null}</span>`,
    );
  }
  if ((task.attachmentIds || []).length) parts.push(html`<span class="tm"><${Icon} name="image" size=${14} /><span class="num">${task.attachmentIds.length}</span></span>`);
  if (task.memo) parts.push(html`<span class="tm"><${Icon} name="note" size=${14} /></span>`);
  if ((task.moves || []).length) parts.push(html`<span class="tm moved">미룸 <span class="num">${task.moves.length}</span>회</span>`);
  if (!parts.length) return null;
  return html`<div class="t-meta">${parts}</div>`;
}

export function TaskRow({ task, today, onOpen, onCheck, onComplete, onTomorrow, showSubject, showDate }) {
  const subj = subjectOf(task.subjectId);
  const done = task.status === 'done';
  const dropped = task.status === 'dropped';
  return html`<${SwipeRow}
    class="task-swipe"
    onRight=${done || dropped ? null : onComplete}
    onLeft=${dropped ? null : onTomorrow}
    rightLabel="완료"
    leftLabel="내일로"
  >
    <div class=${cx('task', done && 'is-done', dropped && 'is-dropped')} style=${subjectVars(subj)} onClick=${onOpen}>
      <${CheckMark} task=${task} onTap=${onCheck} />
      <div class="t-main">
        <div class="t-title-line">
          ${task.importance ? html`<span class=${'imp imp-' + task.importance} aria-label=${'중요도 ' + task.importance}>${IMP[task.importance]}</span>` : null}
          <span class="t-title">${task.title || '(제목 없음)'}</span>
        </div>
        <${TaskMeta} task=${task} today=${today} showSubject=${showSubject} showDate=${showDate} />
      </div>
    </div>
  <//>`;
}
