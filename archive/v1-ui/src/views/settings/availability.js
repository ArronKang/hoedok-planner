// 설정 › 공부 가능 시간 (요일별 기본값, 고정 일정, 날짜별 예외)
import { html } from '../../lib/html.js';
import { useState } from '../../lib/ui.js';
import { Icon } from '../../ui/icons.js';
import { Stepper, Field, IconButton, TextInput, cx } from '../../ui/kit.js';
import { withUndo } from '../../ui/toast.js';
import { all } from '../../data/db.js';
import { availability, today as todayKey } from '../../data/model.js';
import { setAvailability, setDayOverride } from '../../data/actions.js';
import { WEEKDAYS, minutesLabel, formatMDW } from '../../core/date.js';
import { uid } from '../../core/id.js';

const ORDER = [1, 2, 3, 4, 5, 6, 0];

function BlockEditor({ block, onChange, onDelete }) {
  const toggleDay = (d) => {
    const days = new Set(block.days || []);
    if (days.has(d)) days.delete(d);
    else days.add(d);
    onChange({ days: [...days].sort() });
  };
  return html`<div class="card card-pad block-ed">
    <div class="hstack">
      <${TextInput} class="input" value=${block.label} label="일정 이름" placeholder="예: 수학 학원" onCommit=${(v) => onChange({ label: v.trim() || '고정 일정' })} />
      <${IconButton} icon="trash" label="고정 일정 삭제" onClick=${onDelete} />
    </div>
    <div class="chips" style="margin-top:10px" role="group" aria-label="요일">
      ${ORDER.map((d) => html`<button key=${d} class=${cx('chip', (block.days || []).includes(d) && 'on')} onClick=${() => toggleDay(d)}>${WEEKDAYS[d]}</button>`)}
    </div>
    <div class="row2" style="margin-top:10px">
      <input type="time" class="input" value=${block.start || ''} aria-label="시작" onChange=${(e) => onChange({ start: e.target.value })} />
      <input type="time" class="input" value=${block.end || ''} aria-label="끝" onChange=${(e) => onChange({ end: e.target.value })} />
    </div>
  </div>`;
}

export function AvailabilityPage() {
  const a = availability();
  const t = todayKey();
  const overrides = all('dayOverrides')
    .filter((o) => o.id >= t)
    .sort((x, y) => (x.id < y.id ? -1 : 1));
  const setDay = (d, v) => {
    const w = [...a.weekdays];
    w[d] = v;
    setAvailability({ weekdays: w });
  };
  const weekTotal = a.weekdays.reduce((s, x) => s + (x || 0), 0);
  const saveBlock = (id, patch) => setAvailability({ blocks: a.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  return html`<div>
    <p class="sub" style="margin:0 0 12px">학원 등 고정 일정을 뺀, 스스로 공부할 수 있는 시간입니다. 하루 화면의 '계획 / 가능' 막대와 자동 배분에 쓰입니다.</p>
    <div class="card list">
      ${ORDER.map(
        (d) => html`<div class="list-row" key=${d}>
          <span class=${cx('wd-label', d === 0 && 'sun', d === 6 && 'sat')}>${WEEKDAYS[d]}요일</span>
          <span class="spacer"></span>
          <${Stepper} label=${WEEKDAYS[d] + '요일 공부 가능 시간'} value=${a.weekdays[d] || 0} min=${0} max=${16 * 60} step=${30} format=${(v) => (v ? minutesLabel(v) : '없음')} onChange=${(v) => setDay(d, v)} />
        </div>`,
      )}
      <div class="list-row"><span class="label muted">일주일 합계</span><span class="value num">${minutesLabel(weekTotal) || '0분'}</span></div>
    </div>

    <div class="section-title">고정 일정 <span class="muted" style="font-weight:500">— 시간순 보기에 함께 표시</span></div>
    ${a.blocks.map(
      (b) => html`<${BlockEditor}
        key=${b.id}
        block=${b}
        onChange=${(p) => saveBlock(b.id, p)}
        onDelete=${() => withUndo('고정 일정을 삭제했습니다', () => setAvailability({ blocks: a.blocks.filter((x) => x.id !== b.id) }))}
      />`,
    )}
    <button class="btn block" style="margin-top:8px" onClick=${() => setAvailability({ blocks: [...a.blocks, { id: uid(8), label: '학원', days: [1, 3], start: '18:00', end: '21:00' }] })}>
      <${Icon} name="plus" size=${18} />고정 일정 추가
    </button>

    <div class="section-title">날짜별 예외</div>
    ${overrides.length
      ? html`<div class="card list">
          ${overrides.map(
            (o) => html`<div class="list-row" key=${o.id}>
              <span class="label">${formatMDW(o.id)}</span>
              <span class="value num">${o.minutes ? minutesLabel(o.minutes) : '없음'}</span>
              <${IconButton} icon="x" label="예외 지우기" onClick=${() => withUndo('예외를 지웠습니다', () => setDayOverride(o.id, null))} />
            </div>`,
          )}
        </div>`
      : html`<p class="muted" style="margin:0 4px">하루 화면의 '계획 / 가능' 막대를 누르면 그날만 바꿀 수 있습니다.</p>`}
  </div>`;
}
