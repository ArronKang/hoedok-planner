// 움직임 — 규칙: docs/움직임-규칙.md · 버그 체크리스트: docs/움직임-버그-체크리스트.md
//
// 종류는 넷뿐: ① 창(아래에서 올라옴) ② 다음으로(가로 페이드) ③ 나타남·사라짐(페이드) ④ 손에 붙는 것(용수철).
// 시간·곡선은 아래 T·E의 값만 쓴다. 속도 설정은 없고 켜기/끄기만 (끄면 아무것도 움직이지 않는다).
// 움직이는 것은 위치·크기·투명도만. 사라지는 것은 복사본(m-ghost)을 지운다 → 실제 화면은 바로 바뀌고 바로 누를 수 있다.
import { PR } from './core.js';

/** 켜기/끄기. (예전의 느긋하게·빠르게는 켜기로 읽는다) */
export const LEVELS = [
  ['normal', '켜기'],
  ['off', '끄기'],
];
/** 곡선 (이것만) */
export const E = {
  standard: 'cubic-bezier(.2, 0, 0, 1)',
  sheet: 'cubic-bezier(.32, .72, 0, 1)',
  out: 'cubic-bezier(.2, .8, .2, 1)',
  in: 'cubic-bezier(.4, 0, 1, 1)',
};
/** 시간(ms) (이것만) */
export const T = { sheetIn: 380, sheetOut: 240, swapOut: 220, axis: 320, axisOut: 130, fadeIn: 200, fadeOut: 160 };
// 예전 이름 (다른 파일이 쓰는 것)
export const EASE_OUT = E.out;
export const EASE_IN = E.in;
export const EASE_SHEET = E.sheet;

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

/** 지금 움직임: 'normal' | 'off'. 고른 적 없으면 기기 설정을 따른다 */
export function level() {
  const m = PR().motion;
  if (m === 'off') return 'off';
  if (m === 'normal' || m === 'slow' || m === 'fast') return 'normal';
  return osReduce() ? 'off' : 'normal';
}
/** 지금 움직여도 되나 (화면이 안 보일 때는 움직이지 않는다 → 멈춘 애니메이션이 남지 않게) */
export const on = () => level() !== 'off' && !(typeof document !== 'undefined' && document.hidden);
/** 화면을 옮길 때도 움직이나 (예전 설정 motionView는 이제 따로 고르지 않는다) */
export const viewOn = () => on();
/** 시간: 켜져 있으면 그대로, 끄면 0 */
export const ms = (base) => (level() === 'off' ? 0 : Math.round(base));

/** 요소 하나를 한 번 움직인다. 끝나면 원래 모습(애니메이션을 남기지 않음) */
export function play(el, frames, base, easing = E.out) {
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
  const src = el.querySelectorAll('input, textarea, select');
  const dst = node.querySelectorAll('input, textarea, select');
  src.forEach((s, i) => {
    const d = dst[i];
    if (!d) return;
    if (s.type === 'checkbox' || s.type === 'radio') d.checked = s.checked;
    else if (s.type !== 'file') d.value = s.value;
  });
  const scrolls = [];
  const all = [el, ...el.querySelectorAll('*')];
  const allC = [node, ...node.querySelectorAll('*')];
  all.forEach((s, i) => {
    if (s.scrollTop || s.scrollLeft) scrolls.push([allC[i], s.scrollTop, s.scrollLeft]);
  });
  return { node, scrolls, rect };
}

/** 복사본을 화면(기기 틀) 맨 위에 붙이고 움직인 뒤 없앤다. parts: [선택자, 키프레임] */
export function release(g, parts, base = T.fadeOut, z = null, easing = E.in) {
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
  const anims = [];
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
  setTimeout(done, d + 200); // 애니메이션이 멈춰도(화면이 안 보일 때 등) 반드시 지운다
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

// ─────────── ① 창(시트) ───────────
// 창에서 다른 창으로 넘어갈 때는 배경을 새로 어둡게 하지 않는다 (깜빡임 방지).
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

/** 휴대폰 손가락 창의 스크롤 상자 (창을 기기 스크롤로 움직이는 경우) */
const scrollerOf = (box) => (box && box.parentElement && box.parentElement.classList.contains('sheet-sc') ? box.parentElement : null);

/**
 * 휴대폰 창이 아래에서 올라온다. 기기 스크롤 창은 **스크롤 상자째** 움직인다
 * (상자 안의 창을 움직이면 아이폰이 스크롤 범위를 다시 계산해 창이 위로 튀었다 — 베타 1.1 영상).
 */
function rise(box) {
  const sc = scrollerOf(box);
  if (sc) return play(sc, [{ transform: `translateY(${box.offsetHeight}px)` }, { transform: 'translateY(0)' }], T.sheetIn, E.sheet);
  return play(box, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], T.sheetIn, E.sheet);
}

/** 창이 나타나는 움직임 */
export function sheetIn(veil, box) {
  if (!on()) return;
  if (sheetSwap) {
    // 창에서 창으로: 배경은 그대로. 휴대폰은 앞 창(복사본)이 내려가는 동안 이 창이 올라오고,
    // 태블릿은 앞 창이 먼저 지워진 뒤 나타난다 → 두 창의 글자가 반투명하게 겹치는 순간이 없다
    if (phone()) rise(box);
    else play(box, [{ opacity: 0, scale: '.98' }, { opacity: 0, scale: '.98', offset: 0.4 }, { opacity: 1, scale: '1' }], T.sheetIn, E.out);
    return;
  }
  clearGhosts('.veil');
  play(veil, [{ opacity: 0 }, { opacity: 1 }], T.sheetIn, E.out);
  if (phone()) rise(box);
  else play(box, [{ opacity: 0, scale: '.97' }, { opacity: 1, scale: '1' }], T.fadeIn + 60, E.out);
}

/**
 * 창이 사라지는 움직임 (복사본으로) — close: 창이 없어짐, 아니면 다른 창으로 넘어감.
 * g.h: 사라지는 창의 높이 (휴대폰 손가락 창은 스크롤 상자째 그만큼 내려간다)
 */
export function sheetOut(g, close) {
  if (!g) return;
  const fade = ['.veil', [{ opacity: 1 }, { opacity: 0 }]];
  if (close && phone()) {
    const down = g.node.querySelector('.sheet-sc')
      ? ['.sheet-sc', [{ transform: 'translateY(0)' }, { transform: `translateY(${g.h || 0}px)` }]]
      : ['.sheet', [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }]];
    return release(g, [fade, down], T.sheetOut);
  }
  if (close) return release(g, [fade, ['.sheet', [{ opacity: 1, scale: '1' }, { opacity: 0, scale: '.97' }]]], T.fadeOut);
  if (phone()) return release(g, [[null, [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }]]], T.swapOut, 32);
  release(g, [[null, [{ opacity: 1 }, { opacity: 0 }]]], 120, 32, E.out);
}

// ─────────── ② 다음으로: 가로 페이드 ───────────
// 옛 것(복사본)이 왼쪽으로 조금 가며 먼저 흐려지고(0~40%), 새 것이 오른쪽에서 조금 들어오며 나타난다(30~100%).
// 두 글자가 겹쳐 보이는 순간이 없다. dir: 1 앞으로, -1 뒤로, 0 제자리에서 바뀜(옆으로 가지 않음).

const SHIFT = 24;
/** 다시 그리기 전에 부른다: 지금 모습을 그 자리에 고정해 복사해 둔다 */
export const viewCapture = (el) => (on() ? capture(el, true) : null);
/** 다시 그린 뒤에 부른다. inner: 복사본 안에서 실제로 움직일 부분(선택자) — 없으면 통째로 */
export function axis(g, el, dir = 1, inner = null, z = 4) {
  const dx = dir * SHIFT;
  if (g) {
    clearGhosts('.m-view');
    g.node.classList.add('m-view');
    release(g, [[inner, [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-dx}px)` }]]], T.axisOut, z, E.in);
  }
  play(
    el,
    [
      { opacity: 0, transform: `translateX(${dx}px)` },
      { opacity: 0, transform: `translateX(${dx}px)`, offset: 0.3, easing: E.standard },
      { opacity: 1, transform: 'translateX(0)' },
    ],
    T.axis,
    'linear',
  );
}
/** 예전 이름: 겹쳐 바뀜 → 이제 제자리 가로 페이드(dir 0) */
export const crossfade = (g, el) => axis(g, el, 0);

// ─────────── ④ 손에 붙는 것: 유리 막대 렌즈 (용수철) ───────────

/**
 * 용수철 움직임 0 → 1: 빠르게 출발해 부드럽게 멈추고, damping < 1이면 살짝 지나쳤다 돌아온다.
 * response: 한 번 출렁이는 시간(초). 돌려줌: { dur: 멈추는 때(초), at(t) → { x, v(초당) } }
 */
export function spring(response = 0.4, damping = 0.72) {
  const w0 = (2 * Math.PI) / response;
  const z = Math.min(0.99, damping);
  const a = z * w0, b = w0 * Math.sqrt(1 - z * z);
  const at = (t) => {
    const e = Math.exp(-a * t);
    return { x: 1 - e * (Math.cos(b * t) + (a / b) * Math.sin(b * t)), v: e * ((w0 * w0) / b) * Math.sin(b * t) };
  };
  let dur = 0.05;
  while (dur < 2) {
    const s = at(dur);
    if (Math.abs(1 - s.x) < 0.002 && Math.abs(s.v) < 0.05) break;
    dur += 1 / 120;
  }
  return { dur, at };
}

/** 떠오른 방울의 크기 (막대보다 크게) */
export const LIFT = { sx: 1.16, sy: 1.3 };

/**
 * 유리 막대 렌즈가 옮겨 가는 키프레임 (용수철). from: 출발 자리(px, 도착 자리 기준), w: 탭 한 칸 너비.
 * lifted: 손가락으로 밀다 놓았을 때처럼 방울이 이미 떠 있음. hold: 도착해서 내려앉지 않고 떠 있음(누르고 있는 동안).
 * to: 도착 자리(px, 기본 0 = 그 칸) — 누르는 순간 손가락 밑으로 갈 때
 * 방울은 떠오르며(커지며) 출발해 빠를수록 진행 방향으로 늘어나고, 도착하면 회색 알약으로 내려앉는다.
 * 알약도 같은 길로 함께 가서, 방울이 내려앉을 때 이미 그 자리에 있다.
 * 돌려줌: { bubble, lens: 키프레임 목록, dur: 시간(ms) }
 */
export function lensFrames(from, w, lifted = false, hold = false, to = 0) {
  const slots = Math.min(3, Math.abs(from - to) / Math.max(1, w));
  const S = spring(0.34 + 0.05 * slots, 0.72);
  const up = lifted ? 0 : 0.09, down = hold ? 0 : 0.16;
  const tl = hold ? Infinity : Math.max(up, S.dur - down * 0.5);
  const T0 = hold ? Math.max(up, S.dur) : tl + down;
  const ease = (k) => k * k * (3 - 2 * k);
  const n = Math.max(2, Math.ceil(T0 * 60));
  const bubble = [], lens = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * T0;
    const s = t >= S.dur ? { x: 1, v: 0 } : S.at(t);
    const x = (to + (from - to) * (1 - s.x)).toFixed(2);
    const L = t < up ? ease(t / up) : t > tl ? 1 - ease(Math.min(1, (t - tl) / down)) : 1; // 떠 있는 정도
    const str = Math.min(0.18, (Math.abs(s.v * (from - to)) / Math.max(1, w)) * 0.016); // 빠를수록 늘어남
    const sx = (1 + L * (LIFT.sx - 1 + str)).toFixed(3), sy = (1 + L * (LIFT.sy - 1 - str * 0.5)).toFixed(3);
    const o = i / n;
    bubble.push({ offset: o, opacity: +Math.min(1, L * 1.6).toFixed(3), transform: `translateX(${x}px) scale(${sx}, ${sy})` });
    lens.push({ offset: o, opacity: +(1 - Math.min(1, L * 1.6)).toFixed(3), transform: `translateX(${x}px)` });
  }
  return { bubble, lens, dur: Math.round(T0 * 1000) };
}

/** 지금 그려진 가로 위치(px) — 움직이는 중이면 그 순간의 자리 */
export function currentX(el) {
  if (!el) return 0;
  const m = getComputedStyle(el).transform;
  if (!m || m === 'none') return 0;
  const v = m.match(/matrix(3d)?\(([^)]+)\)/);
  if (!v) return 0;
  const p = v[2].split(',').map(Number);
  return v[1] ? p[12] : p[4];
}

/**
 * 렌즈 옮기기: 남은 움직임을 멈추고 용수철로. 막대의 움직임은 '끄기'만 따르고 시간은 늘 같다.
 * hold: 누르고 있는 동안 — 떠오른 채로 멈춘다 (fill: forwards)
 */
export function glide(lensEl, bubbleEl, from, lifted = false, hold = false, to = 0) {
  for (const el of [lensEl, bubbleEl]) {
    if (!el) continue;
    if (el.getAnimations) for (const a of el.getAnimations()) a.cancel();
    el.style.transform = '';
    el.style.opacity = '';
  }
  if (!lensEl || !bubbleEl || (!from && !lifted && !hold) || !on()) return;
  const f = lensFrames(from, bubbleEl.offsetWidth || 1, lifted, hold, to);
  const opt = { duration: f.dur, easing: 'linear', fill: hold ? 'forwards' : 'none' };
  try {
    lensEl.animate(f.lens, opt);
    bubbleEl.animate(f.bubble, opt);
  } catch {
    /* 무시 */
  }
}

/**
 * 탭 막대의 '채움 칸' 옮기기 (베타 2.1 — 이 앱만의 모양: 진도 칸이 채워지듯 고른 탭 칸이 채워진다).
 * 용수철로 미끄러지고, 빠를수록 가는 방향으로 조금 늘어난다. 떠오르거나 투명해지지 않는다.
 * from·to: 그 칸 자리 기준 px. hold: 누르고 있는 동안 멈춰 있음
 */
export function slide(el, from, to = 0, hold = false) {
  if (!el) return;
  if (el.getAnimations) for (const a of el.getAnimations()) a.cancel();
  el.style.transform = '';
  if (!on() || (from === to && !hold)) return;
  const w = el.offsetWidth || 1;
  const S = spring(0.34 + 0.05 * Math.min(3, Math.abs(from - to) / w), 0.78);
  const n = Math.max(2, Math.ceil(S.dur * 60));
  const frames = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * S.dur;
    const s = S.at(t);
    const x = (to + (from - to) * (1 - s.x)).toFixed(2);
    const str = Math.min(0.14, (Math.abs(s.v * (from - to)) / w) * 0.012);
    frames.push({ offset: i / n, transform: `translateX(${x}px) scaleX(${(1 + str).toFixed(3)})` });
  }
  frames[frames.length - 1].transform = `translateX(${to}px) scaleX(1)`;
  try {
    el.animate(frames, { duration: Math.round(S.dur * 1000), easing: 'linear', fill: hold ? 'forwards' : 'none' });
  } catch {
    /* 무시 */
  }
}
