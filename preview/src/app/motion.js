// 움직임(애니메이션): 부드러운 페이드. 설정 › 디자인 · 글자 · 움직임에서 속도를 고르거나 끈다.
// 버그 체크리스트: docs/움직임-버그-체크리스트.md
//
// 규칙
// - 움직이는 것은 불투명도·위치·크기만 (배치를 다시 계산하지 않게).
// - 나타나는 움직임은 요소가 새로 생길 때 한 번만 (Web Animations API, 끝나면 원래 모습으로).
// - 사라지는 움직임은 사라지기 직전 모습을 복사해서(ghost) 흐리게 지운다.
//   → 실제 화면은 바로 바뀌고 바로 누를 수 있다. 복사본은 누를 수 없고 읽히지 않는다.
// - 끄면 아무것도 움직이지 않고, 복사본도 만들지 않는다.
import { PR } from './core.js';

const FACTOR = { slow: 1.45, normal: 1, fast: 0.6, off: 0 };
export const LEVELS = [
  ['slow', '느긋하게'],
  ['normal', '보통'],
  ['fast', '빠르게'],
  ['off', '끄기'],
];
export const EASE_OUT = 'cubic-bezier(.2, .8, .2, 1)';
export const EASE_IN = 'cubic-bezier(.4, 0, 1, 1)';
/** 아이폰 창이 올라오는 곡선 (빠르게 출발해 부드럽게 멈춤) */
export const EASE_SHEET = 'cubic-bezier(.32, .72, 0, 1)';

// 처음 물어볼 때 한 번 만든다 (테스트에서 matchMedia를 흉내 낼 수 있게)
let reduceMQ;
const mq = () => {
  if (reduceMQ === undefined) reduceMQ = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  return reduceMQ;
};
/** 기기에서 '동작 줄이기'를 켜 두었나 */
export const osReduce = () => !!(mq() && mq().matches);
export function onOsChange(fn) {
  const m = mq();
  if (m && m.addEventListener) m.addEventListener('change', fn);
}

/** 지금 움직임 단계. 사용자가 고른 적 없으면 기기 설정을 따른다 */
export function level() {
  const m = PR().motion;
  if (m && FACTOR[m] != null) return m;
  return osReduce() ? 'off' : 'normal';
}
/** 지금 움직여도 되나 (화면이 안 보일 때는 움직이지 않는다 → 멈춘 애니메이션이 남지 않게) */
export const on = () => level() !== 'off' && !(typeof document !== 'undefined' && document.hidden);
/** 화면을 옮길 때도 움직이나 */
export const viewOn = () => on() && PR().motionView !== false;
/** 기준 시간(보통)을 지금 속도로 */
export const ms = (base) => Math.round(base * FACTOR[level()]);

/** 요소 하나를 한 번 움직인다. 끝나면 원래 모습(애니메이션을 남기지 않음) */
export function play(el, frames, base, easing = EASE_OUT) {
  if (!el || typeof el.animate !== 'function' || !on()) return null;
  try {
    return el.animate(frames, { duration: ms(base), easing });
  } catch {
    return null;
  }
}

// ─────────── 사라지는 복사본 ───────────

const ghosts = new Set();

/**
 * 사라지기 직전 모습을 복사해 둔다 (아직 화면에 붙이지 않음).
 * 화면을 다시 그리기 **전에** 불러야 한다. 스크롤 위치와 적던 글자도 기억한다.
 */
export function capture(el, pin = false) {
  if (!el || !on()) return null;
  // pin: 복사본을 원래 자리에 그대로 겹쳐 놓는다 (화면 틀 안의 위치·크기를 기억)
  let rect = null;
  if (pin) {
    const dev = document.getElementById('device');
    const r = el.getBoundingClientRect(), d = dev ? dev.getBoundingClientRect() : { left: 0, top: 0 };
    if (!r.width || !r.height) return null;
    rect = { left: r.left - d.left, top: r.top - d.top, width: r.width, height: r.height };
  }
  const node = el.cloneNode(true);
  // 적던 글자: 복사본에는 처음 값만 들어가므로 지금 값을 옮긴다
  const src = el.querySelectorAll('input, textarea, select');
  const dst = node.querySelectorAll('input, textarea, select');
  src.forEach((s, i) => {
    const d = dst[i];
    if (!d) return;
    if (s.type === 'checkbox' || s.type === 'radio') d.checked = s.checked;
    else if (s.type !== 'file') d.value = s.value;
  });
  // 스크롤 위치는 화면에 붙인 뒤에만 되돌릴 수 있다
  const scrolls = [];
  const all = [el, ...el.querySelectorAll('*')];
  const allC = [node, ...node.querySelectorAll('*')];
  all.forEach((s, i) => {
    if (s.scrollTop || s.scrollLeft) scrolls.push([allC[i], s.scrollTop, s.scrollLeft]);
  });
  return { node, scrolls, rect };
}

/** 복사본을 화면(기기 틀) 맨 위에 붙이고 흐리게 지운 뒤 없앤다. parts: [선택자, 움직임] */
export function release(g, parts, base = 160, z = null, easing = EASE_IN) {
  if (!g) return;
  const dev = document.getElementById('device');
  if (!dev) return;
  const node = g.node;
  node.classList.add('m-ghost'); // 'ghost'는 단추 모양(.btn.ghost) 이름과 겹쳐서 쓰지 않는다
  node.setAttribute('aria-hidden', 'true');
  node.inert = true;
  node.removeAttribute('role');
  node.removeAttribute('aria-modal');
  for (const x of node.querySelectorAll('[role="dialog"]')) {
    x.removeAttribute('role');
    x.removeAttribute('aria-modal');
  }
  if (z != null) node.style.zIndex = z;
  if (g.rect) {
    const r = g.rect;
    Object.assign(node.style, { position: 'absolute', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', right: 'auto', bottom: 'auto', margin: '0', maxHeight: 'none', transform: 'none', translate: 'none' });
  }
  dev.appendChild(node);
  for (const [n, top, left] of g.scrolls) {
    n.scrollTop = top;
    n.scrollLeft = left;
  }
  ghosts.add(node);
  const d = ms(base);
  const done = () => {
    if (!ghosts.has(node)) return;
    ghosts.delete(node);
    node.remove();
  };
  let anims = [];
  for (const [sel, frames] of parts) {
    const t = sel ? (node.matches(sel) ? node : node.querySelector(sel)) : node;
    if (t && typeof t.animate === 'function') {
      try {
        anims.push(t.animate(frames, { duration: d, easing, fill: 'forwards' }));
      } catch {
        /* 무시 */
      }
    }
  }
  if (!anims.length) return done();
  Promise.all(anims.map((a) => a.finished)).then(done, done);
  // 애니메이션이 멈춰도(화면이 안 보일 때 등) 반드시 지운다
  setTimeout(done, d + 200);
}

/** 남은 복사본을 바로 지운다 (창을 닫자마자 다시 열 때 배경이 두 겹이 되지 않게) */
export function clearGhosts(sel = null) {
  for (const n of [...ghosts]) {
    if (sel && !n.matches(sel) && !n.querySelector(sel)) continue;
    ghosts.delete(n);
    n.remove();
  }
}
export const ghostCount = () => ghosts.size;

// ─────────── 창(시트) ───────────
// 창에서 다른 창으로 넘어갈 때는 배경을 새로 어둡게 하지 않는다 (깜빡임 방지).
// App이 그리기 전에 '넘어가는 중'인지 적어 두고, 새 창이 처음 그려질 때 읽는다.
let sheetSwap = false;
export const setSheetSwap = (v) => (sheetSwap = v);
export const isSheetSwap = () => sheetSwap;
// 휴대폰 창을 끝까지 끌어내려 닫았을 때: 이미 화면 밖이라 사라지는 복사본을 만들지 않는다
let skip = false;
export const skipExit = () => (skip = true);
export function takeSkipExit() {
  const v = skip;
  skip = false;
  return v;
}

export const phone = () => {
  const d = document.getElementById('device');
  return !!(d && d.classList.contains('phone'));
};

/** 창이 나타나는 움직임 */
export function sheetIn(veil, box) {
  if (!on()) return;
  if (sheetSwap) {
    // 앞 창의 복사본이 위에서 흐려지며 이 창을 드러낸다 → 이 창은 가만히
    return;
  }
  // 닫히던 창이 아직 흐려지는 중이면 치운다 (배경 두 겹 방지)
  clearGhosts('.veil');
  play(veil, [{ opacity: 0 }, { opacity: 1 }], phone() ? 300 : 220);
  // 휴대폰: 아래에서 끝까지 올라온다 (아이폰 기본 창처럼) / 태블릿: 가운데서 살짝 커지며
  if (phone()) play(box, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], 400, EASE_SHEET);
  else play(box, [{ opacity: 0, scale: '.97' }, { opacity: 1, scale: '1' }], 240);
}

/** 창이 사라지는 움직임 (복사본으로) — close: 창이 없어짐, 아니면 다른 창으로 넘어감 */
export function sheetOut(g, close) {
  if (!g) return;
  if (close && phone()) return release(g, [['.veil', [{ opacity: 1 }, { opacity: 0 }]], ['.sheet', [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }]]], 260);
  if (close) return release(g, [['.veil', [{ opacity: 1 }, { opacity: 0 }]], ['.sheet', [{ opacity: 1, scale: '1' }, { opacity: 0, scale: '.97' }]]], 170);
  release(g, [['.sheet', [{ opacity: 1 }, { opacity: 0 }]]], 160, 32);
}

// ─────────── 화면 바꾸기: 겹쳐 바뀜 ───────────
// 전에는 옛 화면이 한순간에 사라지고 새 화면이 서서히 나타나서, 그 '빈 순간'이 깜빡임으로 보였다.
// 이제 옛 화면의 복사본을 그 자리에 겹쳐 두고 흐리게 지우는 동안 새 화면이 나타난다 → 빈 순간이 없다.

/** 다시 그리기 전에 부른다: 지금 화면을 복사해 둔다 */
export const viewCapture = (el) => (viewOn() ? capture(el, true) : null);
/** 다시 그린 뒤에 부른다: 복사본은 흐려지고 새 화면은 나타난다 */
export function crossfade(g, el, base = 200, rise = 0) {
  if (!g) return play(el, [{ opacity: 0 }, { opacity: 1 }], base);
  clearGhosts('.m-view');
  g.node.classList.add('m-view');
  release(g, [[null, [{ opacity: 1 }, { opacity: 0 }]]], base, 4, EASE_OUT);
  play(el, rise ? [{ opacity: 0, translate: `0 ${rise}px` }, { opacity: 1, translate: '0 0' }] : [{ opacity: 0 }, { opacity: 1 }], base);
}
