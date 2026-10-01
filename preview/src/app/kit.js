// 공통 조각
import { html } from '../lib/html.js';
import { useRef, useState, useLayoutEffect } from '../lib/ui.js';
import { pages, done, status, curStage, P, closeSheet, UI, unitOf } from './core.js';
import * as M from './motion.js';

/**
 * key가 바뀔 때마다 ref의 요소를 부드럽게 나타낸다 (처음 그릴 때는 가만히).
 * 화면 옮기기(탭·과목·날짜)에 쓴다 — 설정의 '화면을 옮길 때도 부드럽게'를 따른다.
 */
export function useFade(ref, key, on = M.viewOn) {
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (on()) M.play(ref.current, [{ opacity: 0, translate: '0 6px' }, { opacity: 1, translate: '0 0' }], 220);
  }, [key]);
}

const PATHS = {
  today: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4',
  progress: 'M4 19V5M4 19h16M8 15h3M8 11h7M8 7h10',
  grades: 'M9 3.5h6v3H9zM7.5 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1.5M8 16.5l2.5-3 2 2 3.5-4.5',
  gear: 'M4 6h8M16 6h4M4 12h2M10 12h10M4 18h10M18 18h2M14 4v4M8 10v4M16 16v4',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  down: 'M6 9l6 6 6-6',
  up: 'M6 15l6-6 6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  cal: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4',
};

export function Icon({ n, s = 22, w = 1.8 }) {
  return html`<svg width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${n === 'more' ? 3 : w} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${PATHS[n]} /></svg>`;
}

export const hue = (h) => ({ '--h': h });

/** 체크 동그라미. 일부만 한 경우 조각으로 채운다 */
export function Check({ state, frac = 0, onClick, label }) {
  const svg = useRef(null);
  const first = useRef(true);
  // 방금 끝낸 것만 채워지는 움직임 (탭을 옮겨 와서 처음 그릴 때는 가만히 → 한꺼번에 움직이지 않음)
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (state !== 'done' || !svg.current) return;
    M.play(svg.current.querySelector('.fill'), [{ opacity: 0, transform: 'scale(.55)' }, { opacity: 1, transform: 'scale(1)' }], 240);
    M.play(svg.current.querySelector('.tick'), [{ strokeDasharray: '16', strokeDashoffset: '16' }, { strokeDasharray: '16', strokeDashoffset: '0' }], 320);
  }, [state]);
  let inner = null;
  if (state === 'done') inner = html`<circle cx="13" cy="13" r="11" class="fill" /><path class="tick" d="M8 13.5l3.2 3.2L18 9.5" />`;
  else if (frac > 0) {
    const a = frac * Math.PI * 2 - Math.PI / 2;
    const x = 13 + 11 * Math.cos(a), y = 13 + 11 * Math.sin(a);
    inner = html`<path class="fill" d=${`M13 13L13 2A11 11 0 ${frac > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z`} />`;
  }
  return html`<button class="check" aria-label=${label} aria-pressed=${state === 'done' ? 'true' : 'false'} onClick=${(e) => { e.stopPropagation(); onClick(); }}>
    <svg viewBox="0 0 26 26" ref=${svg}><circle cx="13" cy="13" r="11" class="ring" />${inner}</svg>
  </button>`;
}

/** 진도 칸: 단계마다 한 칸, 너비는 쪽수 비례 */
export function StageBar({ sub, big, onCell, legend }) {
  if (!sub.stages.length) return null;
  const cur = curStage(sub);
  const Tag = onCell ? 'button' : 'span';
  return html`<div>
    <div class=${'bar' + (big ? ' big' : '')} role="img" aria-label=${`${sub.name} 진도 ${P(sub.stages.reduce((a, s) => a + done(s), 0) / Math.max(1, sub.stages.reduce((a, s) => a + pages(s), 0)))}`}>
      ${sub.stages.map((s) => {
        const st = status(s);
        return html`<${Tag}
          key=${s.id}
          class=${`cell ${st}${cur && cur.id === s.id ? ' cur' : ''}`}
          style=${{ flexGrow: pages(s) || 1, flexBasis: 0 }}
          title=${`${s.name} · ${done(s)}/${pages(s)}${unitOf(sub)}`}
          onClick=${onCell ? () => onCell(s) : undefined}
          aria-label=${onCell ? `${s.name}, ${done(s)}/${pages(s)}${unitOf(sub)}. 눌러서 적기` : undefined}
        ><i style=${{ width: `${pages(s) ? (done(s) / pages(s)) * 100 : 0}%` }}></i><//>`;
      })}
    </div>
    ${legend
      ? html`<div class="legend">${sub.stages.map((s) => html`<span key=${s.id} class=${cur && cur.id === s.id ? 'cur' : ''} style=${{ flexGrow: pages(s) || 1, flexBasis: 0 }}>${s.name}</span>`)}</div>`
      : null}
  </div>`;
}

export function Seg({ value, options, onChange, label }) {
  return html`<div class="seg" role="radiogroup" aria-label=${label}>
    ${options.map(([v, l]) => html`<button key=${String(v)} role="radio" aria-pressed=${value === v ? 'true' : 'false'} aria-checked=${value === v ? 'true' : 'false'} onClick=${() => onChange(v)}>${l}</button>`)}
  </div>`;
}

export function Switch({ on, onChange, label }) {
  return html`<button class="switch" role="switch" aria-checked=${on ? 'true' : 'false'} aria-label=${label} onClick=${() => onChange(!on)}></button>`;
}

export function Stepper({ value, step = 30, min = 0, max = 960, fmtv, onChange, label }) {
  return html`<span class="stepper" role="group" aria-label=${label}>
    <button aria-label="줄이기" onClick=${() => onChange(Math.max(min, value - step))}>−</button>
    <span>${fmtv ? fmtv(value) : value}</span>
    <button aria-label="늘리기" onClick=${() => onChange(Math.min(max, value + step))}>+</button>
  </span>`;
}

/** 시트 틀 */
/** 창 틀. step: 한 창 안에서 단계가 바뀌는 경우(시험 정리 등) 바뀔 때마다 내용이 부드럽게 나타난다 */
export function Sheet({ title, children, footer, tall, wide, onClose, step }) {
  const close = onClose || closeSheet;
  const box = useRef(null);
  const veil = useRef(null);
  const drag = useRef(null);
  // 처음 열릴 때 한 번: 배경은 서서히 어두워지고 창은 살짝 올라오며 (창에서 창으로 넘어갈 때는 가만히)
  useLayoutEffect(() => M.sheetIn(veil.current, box.current), []);
  // 휴대폰: 위쪽 손잡이 줄을 끌어내리면 닫힌다 (손가락을 따라 움직이기만 하고 효과는 없음)
  const down = (e) => {
    if (UI().dev !== 'phone' || e.target.closest('button')) return;
    drag.current = { y: e.clientY, id: e.pointerId, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    d.dy = Math.max(0, e.clientY - d.y);
    if (box.current) box.current.style.transform = d.dy ? `translateY(${d.dy}px)` : '';
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    // 닫을 때는 끌어내린 자리 그대로 두어야 사라지는 모습이 그 자리에서 이어진다
    if (d.dy > 90) {
      if (!M.on() && box.current) box.current.style.transform = '';
      return close();
    }
    if (box.current) {
      box.current.style.transform = '';
      if (d.dy > 2) M.play(box.current, [{ transform: `translateY(${d.dy}px)` }, { transform: 'none' }], 200);
    }
  };
  return html`<div>
    <div class="veil" ref=${veil} onClick=${close}></div>
    <div class=${'sheet' + (tall ? ' tall' : '') + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label=${title} ref=${box}>
      <div class="sheet-h" onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up}><span class="grab"></span><h2 class="ell">${title}</h2><button class="ib" aria-label="닫기" onClick=${close}><${Icon} n="x" /></button></div>
      <div class="sheet-b">${step ? html`<div class="appear" key=${step}>${children}</div>` : children}</div>
      ${footer ? html`<div class="sheet-f">${footer}</div>` : null}
    </div>
  </div>`;
}

/** 좌우로 밀기: 오른쪽 = 완료, 왼쪽 = 내일로 (손가락을 따라 움직이기만 하고 효과는 없음) */
export function Swipe({ children, onRight, onLeft, cls, style }) {
  const ref = useRef(null);
  const st = useRef(null);
  const [dx, setDx] = useState(0);
  const down = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('button, input, select')) return;
    st.current = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false };
  };
  const move = (e) => {
    const s = st.current;
    if (!s || s.id !== e.pointerId) return;
    const x = e.clientX - s.x, y = e.clientY - s.y;
    if (!s.on) {
      if (Math.abs(y) > 10 && Math.abs(y) > Math.abs(x)) return (st.current = null);
      if (Math.abs(x) < 12) return;
      s.on = true;
      ref.current.setPointerCapture(e.pointerId);
    }
    const v = x > 0 ? (onRight ? x : 0) : onLeft ? x : 0;
    s.dx = v;
    setDx(v);
  };
  const up = () => {
    const s = st.current;
    st.current = null;
    if (!s || !s.on) return;
    const w = ref.current.offsetWidth;
    const th = Math.min(120, w * 0.3);
    setDx(0);
    ref.current._sw = true;
    setTimeout(() => ref.current && (ref.current._sw = false), 60);
    if (s.dx > th) onRight();
    else if (s.dx < -th) onLeft();
  };
  return html`<div
    class=${cls + (dx ? ' dragging' : '')}
    style=${style}
    ref=${ref}
    onPointerDown=${down}
    onPointerMove=${move}
    onPointerUp=${up}
    onPointerCancel=${up}
    onClickCapture=${(e) => {
      if (ref.current && ref.current._sw) {
        e.stopPropagation();
        e.preventDefault();
      }
    }}
  >
    ${dx > 0 ? html`<div class="task-bg r">완료</div>` : dx < 0 ? html`<div class="task-bg l">내일로</div>` : null}
    <div class="sw-in" style=${{ transform: dx ? `translateX(${dx}px)` : '' }}>${children}</div>
  </div>`;
}

export function Toast({ t }) {
  const el = useRef(null);
  // 새 알림이 뜰 때마다 한 번 (같은 알림이 다시 그려질 때는 가만히)
  useLayoutEffect(() => {
    if (!t) return;
    M.clearGhosts('.toast'); // 사라지던 알림이 남아 두 개가 겹쳐 보이지 않게
    M.play(el.current, [{ opacity: 0, translate: '0 10px' }, { opacity: 1, translate: '0 0' }], 200);
  }, [t && t.id]);
  if (!t) return null;
  return html`<div class="toast" role="status" ref=${el}><span class="m">${t.msg}</span>${t.undo ? html`<button onClick=${t.undo}>${t.label || '되돌리기'}</button>` : null}</div>`;
}

export const isPad = () => UI().dev === 'pad';
