// 공통 UI 조각
import { html } from '../lib/html.js';
import { useState, useRef, useEffect, useLayoutEffect, useMemo } from '../lib/ui.js';
import { Icon } from './icons.js';
import { toNum, fmtNum } from '../core/num.js';
import { monthMatrix, addMonths, formatMonth, WEEKDAYS, weekday, formatMDW, monthKey } from '../core/date.js';
import { subjectVars } from '../data/model.js';
import { openSheet, Sheet } from './overlay.js';

export const cx = (...a) => a.filter(Boolean).join(' ');

export function IconButton({ icon, label, onClick, on, disabled, size = 22, badge, class: cls, refEl }) {
  return html`<button ref=${refEl} class=${cx('icon-btn', on && 'on', cls)} aria-label=${label} title=${label} onClick=${onClick} disabled=${disabled}>
    <${Icon} name=${icon} size=${size} />
    ${badge ? html`<span class="badge">${badge}</span>` : null}
  </button>`;
}

export function Button({ kind, size, icon, children, onClick, disabled, block, type = 'button', class: cls, label }) {
  return html`<button type=${type} class=${cx('btn', kind, size, block && 'block', cls)} onClick=${onClick} disabled=${disabled} aria-label=${label}>
    ${icon ? html`<${Icon} name=${icon} size=${size === 'sm' ? 18 : 20} />` : null}${children}
  </button>`;
}

export function Segmented({ options, value, onChange, size, label }) {
  return html`<div class=${cx('seg', size)} role="radiogroup" aria-label=${label}>
    ${options.map(
      (o) => html`<button key=${o.value} role="radio" aria-checked=${o.value === value ? 'true' : 'false'} class=${o.value === value ? 'on' : ''} onClick=${() => onChange(o.value)}>
        ${o.label}
      </button>`,
    )}
  </div>`;
}

export function Chip({ on, onClick, children, icon, class: cls, style, label }) {
  return html`<button class=${cx('chip', on && 'on', cls)} style=${style} onClick=${onClick} aria-pressed=${on ? 'true' : 'false'} aria-label=${label}>
    ${icon ? html`<${Icon} name=${icon} size=${16} />` : null}${children}
  </button>`;
}

export function SubjectChip({ subject, on, onClick }) {
  return html`<button class=${cx('chip subject', on && 'on')} style=${subjectVars(subject)} onClick=${onClick} aria-pressed=${on ? 'true' : 'false'}>
    <span class="dot"></span>${subject ? subject.name : '과목 없음'}
  </button>`;
}

export function Dot({ subject, size }) {
  return html`<span class="dot" style=${{ ...subjectVars(subject), ...(size ? { width: size + 'px', height: size + 'px' } : {}) }}></span>`;
}

export function Toggle({ checked, onChange, label }) {
  return html`<button role="switch" aria-checked=${checked ? 'true' : 'false'} aria-label=${label} class=${cx('toggle', checked && 'on')} onClick=${() => onChange(!checked)}></button>`;
}

export function Bar({ value, color, thin, thick, label }) {
  const pct = Math.max(0, Math.min(1, value || 0)) * 100;
  return html`<div class=${cx('bar', thin && 'thin', thick && 'thick')} role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(pct)} aria-label=${label} style=${color ? { '--bc': color } : null}>
    <i style=${{ width: pct + '%' }}></i>
  </div>`;
}

export function Field({ label, hint, children, class: cls }) {
  return html`<div class=${cx('field', cls)}>
    ${label ? html`<span class="field-label">${label}</span>` : null}
    ${children}
    ${hint ? html`<span class="hint">${hint}</span>` : null}
  </div>`;
}

export function Empty({ icon = 'inbox', title, children, action }) {
  return html`<div class="empty">
    <${Icon} name=${icon} size=${36} stroke=${1.5} />
    ${title ? html`<h4>${title}</h4>` : null}
    ${children ? html`<p>${children}</p>` : null}
    ${action}
  </div>`;
}

/**
 * 입력하는 동안은 자체 상태를 쓰고, 포커스가 빠질 때(또는 사라질 때) onCommit을 부른다.
 * 한글 조합 중 값이 덮어써지지 않도록 반제어 방식으로 만든다.
 */
export function TextInput({ value, onCommit, placeholder, class: cls = 'input', multiline, autoFocus, inputMode, onEnter, label, maxLength, rows, enterKeyHint }) {
  const [draft, setDraft] = useState(value ?? '');
  const st = useRef({ focused: false, draft: value ?? '', value, onCommit });
  st.current.value = value;
  st.current.onCommit = onCommit;
  st.current.draft = draft;
  const ref = useRef(null);
  useEffect(() => {
    if (!st.current.focused) setDraft(value ?? '');
  }, [value]);
  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
    return () => {
      const s = st.current;
      if ((s.draft ?? '') !== (s.value ?? '') && s.onCommit) s.onCommit(s.draft);
    };
  }, []);
  const commit = () => {
    const s = st.current;
    if ((s.draft ?? '') !== (s.value ?? '')) s.onCommit && s.onCommit(s.draft);
  };
  const common = {
    ref,
    class: cls,
    value: draft,
    placeholder,
    'aria-label': label || placeholder,
    maxlength: maxLength,
    onInput: (e) => {
      st.current.draft = e.target.value;
      setDraft(e.target.value);
    },
    onFocus: () => (st.current.focused = true),
    onBlur: () => {
      st.current.focused = false;
      commit();
    },
  };
  if (multiline) return html`<textarea ...${common} rows=${rows || 3}></textarea>`;
  return html`<input
    ...${common}
    inputmode=${inputMode}
    enterkeyhint=${enterKeyHint || 'done'}
    onKeyDown=${(e) => {
      if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        commit();
        if (onEnter) onEnter(st.current.draft);
        else e.target.blur();
      }
    }}
  />`;
}

export function NumberInput({ value, onCommit, placeholder, suffix, decimals = 2, min, max, label, class: cls, integer }) {
  const shown = value == null || value === '' ? '' : String(value);
  const affix = suffix ? html`<span class="affix">${suffix}</span>` : null;
  const input = html`<${TextInput}
    value=${shown}
    class=${cx('input num', cls)}
    placeholder=${placeholder}
    label=${label}
    inputMode=${integer ? 'numeric' : 'decimal'}
    onCommit=${(v) => {
      let n = toNum(v);
      if (n != null) {
        if (min != null) n = Math.max(min, n);
        if (max != null) n = Math.min(max, n);
        if (integer) n = Math.round(n);
        else n = Number(n.toFixed(decimals));
      }
      onCommit(n);
    }}
  />`;
  return suffix ? html`<div class="input-affix">${input}${affix}</div>` : input;
}

export function Stepper({ value, onChange, min = 0, max = Infinity, step = 1, format = (v) => v, label }) {
  const v = value ?? min;
  return html`<div class="stepper" role="group" aria-label=${label}>
    <button aria-label="줄이기" onClick=${() => onChange(Math.max(min, v - step))} disabled=${v <= min}><${Icon} name="minus" size=${18} /></button>
    <span class="val">${format(v)}</span>
    <button aria-label="늘리기" onClick=${() => onChange(Math.min(max, v + step))} disabled=${v >= max}><${Icon} name="plus" size=${18} /></button>
  </div>`;
}

// ---------- 날짜 선택 ----------

export function MonthGrid({ month, selected, today, onPick, min, max, marks, weekStartsOn = 0 }) {
  const weeks = useMemo(() => monthMatrix(month, weekStartsOn), [month, weekStartsOn]);
  const wds = [...Array(7)].map((_, i) => (i + weekStartsOn) % 7);
  return html`<div class="cal-grid" role="grid">
    ${wds.map((w) => html`<div key=${'w' + w} class=${cx('cal-wd', w === 0 && 'sun', w === 6 && 'sat')}>${WEEKDAYS[w]}</div>`)}
    ${weeks.flat().map((d) => {
      const wd = weekday(d);
      const disabled = (min && d < min) || (max && d > max);
      return html`<button
        key=${d}
        role="gridcell"
        aria-label=${formatMDW(d)}
        aria-selected=${d === selected ? 'true' : 'false'}
        class=${cx('cal-day', monthKey(d) !== month && 'other', d === today && 'today', d === selected && 'sel', wd === 0 && 'sun', wd === 6 && 'sat', disabled && 'disabled')}
        onClick=${() => onPick(d)}
      >
        <span class="d">${Number(d.slice(8))}</span>
        ${marks && marks.has(d) ? html`<span class="mark"></span>` : null}
      </button>`;
    })}
  </div>`;
}

function DatePickerBody({ value, today, close, min, max, quick, allowClear }) {
  const [month, setMonth] = useState(monthKey(value || today));
  return html`<div class="cal">
    ${quick && quick.length
      ? html`<div class="chips" style="margin-bottom:12px">
          ${quick.map((q) => html`<button key=${q.label} class="chip" onClick=${() => close(q.date)}>${q.label}</button>`)}
        </div>`
      : null}
    <div class="cal-head">
      <span class="title">${formatMonth(month)}</span>
      <${IconButton} icon="chev-left" label="이전 달" onClick=${() => setMonth(addMonths(month, -1))} />
      <${IconButton} icon="chev-right" label="다음 달" onClick=${() => setMonth(addMonths(month, 1))} />
    </div>
    <${MonthGrid} month=${month} selected=${value} today=${today} onPick=${(d) => close(d)} min=${min} max=${max} />
    ${allowClear ? html`<button class="btn ghost block" style="margin-top:8px" onClick=${() => close(null)}>날짜 지우기</button>` : null}
  </div>`;
}

/** 날짜 고르기 시트. 결과: 날짜 키 | null(지우기) | undefined(취소) */
export function pickDate({ title = '날짜 선택', value, today, min, max, quick, allowClear }) {
  return openSheet(
    (close) => html`<${Sheet} title=${title} onClose=${() => close(undefined)}>
      <${DatePickerBody} value=${value} today=${today} close=${close} min=${min} max=${max} quick=${quick} allowClear=${allowClear} />
    <//>`,
  );
}

// ---------- 드래그로 순서 바꾸기 ----------

/**
 * items를 드래그 손잡이로 순서 변경. renderItem(item, grip) — grip은 손잡이 요소.
 */
export function SortableList({ items, keyOf, renderItem, onReorder, class: cls }) {
  const box = useRef(null);
  const drag = useRef(null);

  const onDown = (e, key) => {
    if (e.button !== undefined && e.button !== 0) return;
    const container = box.current;
    if (!container) return;
    const els = [...container.querySelectorAll(':scope > [data-sort-key]')];
    const idx = els.findIndex((el) => el.dataset.sortKey === String(key));
    if (idx < 0) return;
    e.preventDefault();
    const rects = els.map((el) => el.getBoundingClientRect());
    drag.current = { key, idx, target: idx, startY: e.clientY, els, rects, pointerId: e.pointerId };
    els[idx].classList.add('dragging');
    els.forEach((el, i) => i !== idx && el.classList.add('shifting'));
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 무시 */
    }
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dy = e.clientY - d.startY;
    const { els, rects, idx } = d;
    els[idx].style.transform = `translateY(${dy}px)`;
    const h = rects[idx].height + (rects[1] && rects[0] ? rects[1].top - rects[0].bottom : 0);
    const center = rects[idx].top + rects[idx].height / 2 + dy;
    let target = idx;
    for (let i = 0; i < rects.length; i++) {
      const mid = rects[i].top + rects[i].height / 2;
      if (i < idx && center < mid) {
        target = Math.min(target, i);
      }
      if (i > idx && center > mid) target = i;
    }
    d.target = target;
    els.forEach((el, i) => {
      if (i === idx) return;
      let shift = 0;
      if (idx < target && i > idx && i <= target) shift = -h;
      if (idx > target && i < idx && i >= target) shift = h;
      el.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  };
  const onUp = (e) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    d.els.forEach((el) => {
      el.classList.remove('dragging', 'shifting');
      el.style.transform = '';
    });
    if (d.target !== d.idx) {
      const keys = items.map(keyOf);
      const [moved] = keys.splice(d.idx, 1);
      keys.splice(d.target, 0, moved);
      onReorder(keys);
    }
  };

  return html`<div class=${cx('sortable', cls)} ref=${box}>
    ${items.map((item) => {
      const key = keyOf(item);
      const grip = html`<span class="grip" aria-label="끌어서 순서 바꾸기" onPointerDown=${(e) => onDown(e, key)} onPointerMove=${onMove} onPointerUp=${onUp} onPointerCancel=${onUp}>
        <${Icon} name="grip" size=${20} />
      </span>`;
      return html`<div key=${key} data-sort-key=${String(key)} class="sortable-item">${renderItem(item, grip)}</div>`;
    })}
  </div>`;
}

// ---------- 좌우로 밀기 ----------

/**
 * 오른쪽으로 밀면 onRight, 왼쪽으로 밀면 onLeft. 세로 스크롤은 방해하지 않는다.
 */
export function SwipeRow({ children, onRight, onLeft, rightLabel = '완료', leftLabel = '내일로', rightIcon = 'check', leftIcon = 'arrow-right', class: cls, disabled }) {
  const ref = useRef(null);
  const st = useRef(null);
  const suppress = useRef(false);
  const [dir, setDir] = useState(0);

  const reset = (el) => {
    el.style.transition = 'transform .22s cubic-bezier(.2,.7,.2,1)';
    el.style.transform = '';
    setTimeout(() => {
      if (el) el.style.transition = '';
    }, 240);
  };
  const onDown = (e) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.target.closest && e.target.closest('button, input, textarea, select, a, .grip')) return;
    st.current = { x: e.clientX, y: e.clientY, id: e.pointerId, active: false, dx: 0 };
  };
  const onMove = (e) => {
    const s = st.current;
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.active) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        st.current = null;
        return;
      }
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        if ((dx > 0 && !onRight) || (dx < 0 && !onLeft)) {
          st.current = null;
          return;
        }
        s.active = true;
        try {
          ref.current.setPointerCapture(e.pointerId);
        } catch {
          /* 무시 */
        }
      } else return;
    }
    const lim = dx > 0 ? (onRight ? 1 : 0) : onLeft ? 1 : 0;
    const x = dx * lim;
    s.dx = x;
    const d = x > 0 ? 1 : x < 0 ? -1 : 0;
    if (d !== dir) setDir(d);
    ref.current.querySelector('.swipe-content').style.transform = `translateX(${x}px)`;
  };
  const onUp = (e) => {
    const s = st.current;
    st.current = null;
    if (!s || !s.active) return;
    suppress.current = true;
    setTimeout(() => (suppress.current = false), 50);
    const el = ref.current.querySelector('.swipe-content');
    const w = ref.current.offsetWidth || 320;
    const th = Math.min(110, w * 0.28);
    if (s.dx > th && onRight) {
      reset(el);
      onRight();
    } else if (s.dx < -th && onLeft) {
      reset(el);
      onLeft();
    } else reset(el);
    setDir(0);
  };
  return html`<div
    ref=${ref}
    class=${cx('swipe', cls)}
    onPointerDown=${onDown}
    onPointerMove=${onMove}
    onPointerUp=${onUp}
    onPointerCancel=${onUp}
    onClickCapture=${(e) => {
      if (suppress.current) {
        e.stopPropagation();
        e.preventDefault();
      }
    }}
  >
    <div class=${cx('swipe-bg', dir > 0 && 'show-right', dir < 0 && 'show-left')} aria-hidden="true">
      <span class="sw-r"><${Icon} name=${rightIcon} size=${20} />${rightLabel}</span>
      <span class="sw-l">${leftLabel}<${Icon} name=${leftIcon} size=${20} /></span>
    </div>
    <div class="swipe-content">${children}</div>
  </div>`;
}

// ---------- 사실 수치 ----------

export function Facts({ items }) {
  return html`<div class="facts">
    ${items.map(
      (it) => html`<div class="fact" key=${it.k}>
        <span class="k">${it.k}</span>
        <span class="v">${it.v == null ? '–' : it.v}${it.v != null && it.u ? html`<span class="u">${it.u}</span>` : null}</span>
      </div>`,
    )}
  </div>`;
}

export function fmtAmount(v) {
  return v == null ? null : fmtNum(v, 1);
}

/** 레이아웃 효과로 요소 크기를 잰다 */
export function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const upd = () => setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    upd();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return size;
}
