// 공통 조각
import { html } from '../lib/html.js';
import { useRef, useState, useLayoutEffect, useEffect } from '../lib/ui.js';
import { pages, done, status, curStage, P, closeSheet, UI, PR, stageUnit, amountText, ro, fitRange } from './core.js';
import * as M from './motion.js';
import { platform } from './pwa.js';

/**
 * key가 바뀌면 ref의 화면을 '겹쳐 바뀜'으로 바꾼다 (처음 그릴 때는 가만히).
 * 다시 그리기 직전(그리는 중)에 옛 화면을 복사해 두고, 그린 뒤에 복사본은 흐려지고 새 화면은 나타난다.
 * 화면 옮기기(탭·과목·날짜)에 쓴다 — 설정의 '화면을 옮길 때도 부드럽게'를 따른다.
 */
export function useCross(ref, key, rise = 0) {
  const last = useRef(key);
  const job = useRef(null);
  if (last.current !== key) {
    last.current = key;
    job.current = M.viewOn() ? M.viewCapture(ref.current) || 'plain' : null;
  }
  useLayoutEffect(() => {
    const g = job.current;
    job.current = null;
    if (g && M.viewOn()) M.crossfade(g === 'plain' ? null : g, ref.current, 200, rise);
  });
}
/** 예전 이름 (나타나기만) */
export const useFade = (ref, key) => useCross(ref, key, 4);

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

/** 체크할 때 짧은 진동 (되는 기기만 — 안드로이드. 설정에서 끌 수 있다) */
export function buzz() {
  try {
    if (PR().haptic !== false && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8);
  } catch {
    /* 무시 */
  }
}
export const canBuzz = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && platform() !== 'ios';

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
  return html`<button class="check" aria-label=${label} aria-pressed=${state === 'done' ? 'true' : 'false'} onClick=${(e) => {
    e.stopPropagation();
    if (state !== 'done') buzz();
    onClick();
  }}>
    <svg viewBox="0 0 26 26" ref=${svg}><circle cx="13" cy="13" r="11" class="ring" />${inner}</svg>
  </button>`;
}

/**
 * 진도 막대: 단계마다 한 칸(너비는 분량 비례), 한 만큼 과목 색으로 채운다. 안 한 곳은 같은 색을 옅게.
 * 막대에는 채움만 — 밑줄·테두리 같은 표시는 넣지 않는다 (지금 단계는 아래 글자로 알려 준다).
 */
export function StageBar({ sub, big, onCell, legend }) {
  if (!sub.stages.length) return null;
  const cur = curStage(sub);
  const Tag = onCell ? 'button' : 'span';
  const amt = (s) => `${done(s)}/${amountText(stageUnit(sub, s), pages(s), true)}`;
  return html`<div>
    <div class=${'bar' + (big ? ' big' : '')} role="img" aria-label=${`${sub.name} 진도 ${sub.stages.map((s) => `${s.name} ${amt(s)}`).join(', ')}`}>
      ${sub.stages.map((s) => {
        const st = status(s);
        return html`<${Tag}
          key=${s.id}
          class=${`cell ${st}`}
          style=${{ flexGrow: pages(s) || 1, flexBasis: 0 }}
          title=${`${s.name} · ${amt(s)}`}
          onClick=${onCell ? () => onCell(s) : undefined}
          aria-label=${onCell ? `${s.name}, ${amt(s)}. 눌러서 적기` : undefined}
        ><i style=${{ width: `${pages(s) ? (done(s) / pages(s)) * 100 : 0}%` }}></i><//>`;
      })}
    </div>
    ${legend
      ? html`<div class="legend">${sub.stages.map((s) => html`<span key=${s.id} class=${cur && cur.id === s.id ? 'cur' : ''} style=${{ flexGrow: pages(s) || 1, flexBasis: 0 }} title=${s.name}>${/^\d+회독 · /.test(s.name) ? s.name.split(' · ')[0] : s.name}</span>`)}</div>`
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

// ─────────── 숫자·날짜 칸 ───────────
// 전에는 글자를 칠 때마다 범위 안으로 고치거나(20쪽부터인데 '2'를 치면 지워짐),
// 범위 밖 값을 말없이 무시해서(칸에는 친 숫자, 저장은 옛 값) 숫자가 제대로 안 들어갔다.
// 이제: 치는 동안은 그대로 두고, 칸을 떠나거나 완료를 누를 때 확인한다.
//      범위 밖이면 가까운 값으로 맞추고 칸 아래에 한 줄로 알려 준다. 보이는 값 = 저장된 값.

/** 적은 글 → 숫자 (빈칸 null, 숫자가 아니면 NaN) */
export function parseNum(txt, decimal = false) {
  const t = String(txt == null ? '' : txt).replace(/[,\s]/g, '');
  if (t === '') return null;
  if (!(decimal ? /^-?\d*\.?\d+$|^-?\d+\.$/ : /^-?\d+$/).test(t)) return NaN;
  return Number(t);
}
const nfmt = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

/**
 * 숫자 칸.
 * value: 지금 값(null = 빈칸) · onCommit(n|null): 칸을 떠날 때 저장 · onLive(n|null): 치는 동안 맞는 값일 때마다(미리 보기용)
 * min·max: 범위 · decimal: 소수 · empty: 비워 둘 수 있음 · unit: 알림 문구에 붙는 단위 ('쪽')
 * note: 바깥에서 알려 줄 한 줄 (범위를 함께 옮긴 경우 등)
 */
export function NumField({ value, onCommit, onLive, min = -Infinity, max = Infinity, decimal = false, empty = false, label, cls = 'input pg', placeholder, unit = '', note: outer }) {
  const ref = useRef(null);
  const dirty = useRef(false); // 칸을 누른 뒤 실제로 글자를 쳤나 (안 쳤으면 떠나도 아무것도 바꾸지 않는다)
  const [note, setNote] = useState(null);
  const shown = value == null || (typeof value === 'number' && !isFinite(value)) ? '' : nfmt(value);
  // 칸을 보고 있지 않을 때만 실제 값으로 맞춘다 → 다시 그려져도 치던 글자를 덮지 않는다
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.value !== shown) el.value = shown;
  });
  const commit = () => {
    const el = ref.current;
    if (!el) return;
    if (!dirty.current) {
      if (el.value !== shown) el.value = shown;
      return;
    }
    dirty.current = false;
    let n = parseNum(el.value, decimal);
    if (n === null) {
      if (empty) {
        setNote(null);
        if (value != null) onCommit(null);
      } else {
        el.value = shown;
        setNote(shown ? '비울 수 없어서 그대로 뒀어요' : null);
      }
      return;
    }
    if (isNaN(n)) {
      el.value = shown;
      return setNote('숫자만 적을 수 있어요');
    }
    let msg = null;
    if (n < min) {
      msg = `${nfmt(min)}${unit}보다 작을 수 없어서 ${ro(nfmt(min) + unit)} 맞췄어요`;
      n = min;
    } else if (n > max) {
      msg = `${nfmt(max)}${unit}까지라서 ${ro(nfmt(max) + unit)} 맞췄어요`;
      n = max;
    }
    setNote(msg);
    el.value = nfmt(n);
    if (n !== value) onCommit(n);
  };
  const live = (e) => {
    dirty.current = true;
    if (!onLive) return;
    const n = parseNum(e.target.value, decimal);
    onLive(n == null || isNaN(n) ? null : Math.min(max, Math.max(min, n)), n);
  };
  const msg = note || outer;
  return html`<span class="numf">
    <input
      ref=${ref}
      class=${cls}
      type="text"
      inputmode=${decimal ? 'decimal' : 'numeric'}
      enterkeyhint="done"
      autocomplete="off"
      defaultValue=${shown}
      placeholder=${placeholder}
      aria-label=${label}
      aria-invalid=${note ? 'true' : 'false'}
      onFocus=${(e) => {
        setNote(null);
        const el = e.target;
        dirty.current = false;
        if (el.value !== shown) el.value = shown; // 옆 칸이 이 칸 값을 함께 옮겼을 수 있다
        // 누르면 전체 선택 → 바로 새 숫자를 치면 바뀐다
        setTimeout(() => {
          if (document.activeElement !== el) return;
          try {
            el.setSelectionRange(0, el.value.length);
          } catch {
            /* 무시 */
          }
        }, 0);
      }}
      onInput=${live}
      onBlur=${commit}
      onKeyDown=${(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.target.blur();
        }
      }}
    />
    ${msg ? html`<small class="numf-note" role="status">${msg}</small>` : null}
  </span>`;
}


/** 시작 ~ 끝 두 칸 (교재 범위·단계 범위). onCommit(from, to) */
export function RangeField({ from, to, onCommit, unit = '쪽', label = '', min = 1, max = 9999 }) {
  const [note, setNote] = useState(null);
  const put = (which, n) => {
    const [f, t] = fitRange(from, to, which, n, min);
    const moved = which === 'from' ? t !== to : f !== from;
    setNote(moved ? (which === 'from' ? `끝도 같은 길이만큼 옮겼어요 (${f}–${t})` : `시작도 같은 길이만큼 옮겼어요 (${f}–${t})`) : null);
    onCommit(f, Math.min(max, t));
  };
  return html`<span class="rangef">
    <span class="rangef-in">
      <${NumField} value=${from} min=${min} max=${max} unit=${unit} label=${label + ' 시작'} onCommit=${(n) => put('from', n)} />
      <span class="tilde">~</span>
      <${NumField} value=${to} min=${min} max=${max} unit=${unit} label=${label + ' 끝'} onCommit=${(n) => put('to', n)} />
      ${unit ? html`<span class="u">${unit}</span>` : null}
    </span>
    ${note ? html`<small class="numf-note ok" role="status">${note}</small>` : null}
  </span>`;
}

/** 날짜 칸: 고를 수 없는 날을 고르면 되돌리고 알려 준다 (전에는 말없이 무시해서 칸에만 남았다) */
export function DateField({ value, onCommit, min, label, cls = 'input', style, why }) {
  const ref = useRef(null);
  const [note, setNote] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.value !== (value || '')) el.value = value || '';
  });
  return html`<span class="datef">
    <input ref=${ref} class=${cls} type="date" style=${style} min=${min} defaultValue=${value || ''} aria-label=${label} onChange=${(e) => {
      const v = e.target.value;
      if (!v) return;
      if (min && v < min) {
        e.target.value = value || '';
        return setNote(why || '그날은 고를 수 없어요');
      }
      setNote(null);
      onCommit(v);
    }} />
    ${note ? html`<small class="numf-note" role="status">${note}</small>` : null}
  </span>`;
}

export function Stepper({ value, step = 30, min = 0, max = 960, fmtv, onChange, label }) {
  return html`<span class="stepper" role="group" aria-label=${label}>
    <button aria-label="줄이기" onClick=${() => onChange(Math.max(min, value - step))}>−</button>
    <span>${fmtv ? fmtv(value) : value}</span>
    <button aria-label="늘리기" onClick=${() => onChange(Math.min(max, value + step))}>+</button>
  </span>`;
}

/** 손가락으로 쓰는 기기인가 (휴대폰 창을 기기 스크롤로 끌어내리게) */
export const touchy = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/**
 * 창 틀. step: 한 창 안에서 단계가 바뀌는 경우(시험 정리 등) 바뀔 때마다 내용이 부드럽게 나타난다.
 *
 * 휴대폰(손가락): 창을 **기기 스크롤**로 움직인다 — 창 위쪽 빈 곳(gap) + 창을 세로로 쌓은 스크롤 상자.
 *   맨 아래까지 내려 둔 것이 '열림', 맨 위(창이 화면 밖)가 '닫힘'. 손가락으로 끌어내리면 기기가 직접 스크롤하므로
 *   아이폰 기본 창처럼 120Hz로 따라오고, 놓으면 관성·튕김·제자리 돌아가기도 기기 그대로다 (scroll-snap).
 *   창 안 내용이 맨 위일 때 아래로 끌면 창 전체가 내려간다 (기기의 스크롤 이어 받기).
 * 태블릿·PC: 가운데 뜨는 창. 휴대폰 크기의 PC 창(마우스)은 위쪽 손잡이 줄을 끌어서 닫는다.
 */
export function Sheet({ title, children, footer, tall, wide, onClose, step }) {
  const close = onClose || closeSheet;
  const box = useRef(null);
  const veil = useRef(null);
  const sc = useRef(null);
  const drag = useRef(null);
  const st = useRef({ ready: false, touching: false, done: false });
  const native = UI().dev === 'phone' && touchy();
  // 처음 열릴 때 한 번: 배경은 서서히 어두워지고 창은 아래에서 올라온다 (창에서 창으로 넘어갈 때는 가만히)
  useLayoutEffect(() => {
    const s = sc.current;
    if (s) s.scrollTop = s.scrollHeight; // 열린 자리(맨 아래)에서 시작
    st.current.ready = true; // 이 뒤로 맨 위(닫힌 자리)에 닿으면 닫는다
    M.sheetIn(veil.current, box.current);
  }, []);
  // 창 내용이 커지거나 작아져도 열린 자리에 붙어 있게 (끌고 있을 때는 그대로)
  useEffect(() => {
    const s = sc.current, b = box.current;
    if (!s || !b || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (!st.current.touching && !st.current.done && st.current.ready) s.scrollTop = s.scrollHeight;
    });
    ro.observe(b);
    // 손가락이 닿아 있는지 (스크롤을 막지 않도록 passive로 직접 듣는다)
    const on = () => (st.current.touching = true);
    const off = () => (st.current.touching = false);
    const opt = { passive: true };
    s.addEventListener('touchstart', on, opt);
    s.addEventListener('touchend', off, opt);
    s.addEventListener('touchcancel', off, opt);
    return () => {
      ro.disconnect();
      s.removeEventListener('touchstart', on, opt);
      s.removeEventListener('touchend', off, opt);
      s.removeEventListener('touchcancel', off, opt);
    };
  }, []);
  const onScroll = () => {
    const s = sc.current, b = box.current, v = veil.current;
    if (!s || !b || st.current.done) return;
    const h = b.offsetHeight || 1;
    const shown = Math.max(0, Math.min(1, s.scrollTop / Math.max(1, s.scrollHeight - s.clientHeight)));
    if (v) v.style.opacity = shown >= 0.999 ? '' : String(shown);
    // 끝까지 끌어내리면 닫는다 (이미 화면 밖이라 사라지는 움직임은 없이)
    if (st.current.ready && s.scrollTop <= Math.min(2, h * 0.01)) {
      st.current.done = true;
      M.skipExit();
      close();
    }
  };
  // PC(마우스)에서 휴대폰 크기 창: 위쪽 손잡이 줄을 끌어내리면 닫힌다
  const down = (e) => {
    if (native || UI().dev !== 'phone' || e.target.closest('button')) return;
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
    if (d.dy > 90) {
      if (!M.on() && box.current) box.current.style.transform = '';
      return close();
    }
    if (box.current) {
      box.current.style.transform = '';
      if (d.dy > 2) M.play(box.current, [{ transform: `translateY(${d.dy}px)` }, { transform: 'none' }], 200);
    }
  };
  const sheet = html`<div class=${'sheet' + (tall ? ' tall' : '') + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label=${title} ref=${box}>
    <div class="sheet-h" onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up}><span class="grab" aria-hidden="true"></span><h2 class="ell">${title}</h2><button class="ib" aria-label="닫기" onClick=${close}><${Icon} n="x" /></button></div>
    <div class="sheet-b">${step ? html`<div class="appear" key=${step}>${children}</div>` : children}</div>
    ${footer ? html`<div class="sheet-f">${footer}</div>` : null}
  </div>`;
  if (!native)
    return html`<div>
      <div class="veil" ref=${veil} onClick=${close}></div>
      ${sheet}
    </div>`;
  return html`<div>
    <div class="veil" ref=${veil}></div>
    <div class=${'sheet-sc' + (tall ? ' tall' : '')} ref=${sc} onScroll=${onScroll}>
      <div class="sheet-gap" onClick=${close}></div>
      ${sheet}
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

/**
 * 아래 탭 막대 모양: 아이폰은 떠 있는 유리 막대(리퀴드 글래스), 나머지는 화면에 붙은 기본 막대.
 * 설정 › 화면 › 탭 막대에서 직접 고를 수 있다.
 */
export const glassBar = () => {
  const v = PR().tabStyle || 'auto';
  return v === 'glass' || (v === 'auto' && platform() === 'ios');
};
