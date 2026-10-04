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

/** 휴대폰 손가락 창의 스크롤 상자 (창을 기기 스크롤로 움직이는 경우) */
const scrollerOf = (box) => (box && box.parentElement && box.parentElement.classList.contains('sheet-sc') ? box.parentElement : null);

/**
 * 휴대폰 창이 아래에서 올라온다 (아이폰 기본 창처럼).
 * 기기 스크롤 창은 **스크롤 상자째** 움직인다. 전에는 상자 안의 창을 움직였는데, 아이폰은 거꾸로 쌓은 스크롤 상자 안에서
 * 움직이는 창 때문에 스크롤 범위를 다시 계산해서 창이 제자리를 지나 화면 위로 올라갔다가 끝나는 순간 뚝 떨어졌다 (베타 1.1 영상).
 */
function rise(box, base) {
  const sc = scrollerOf(box);
  if (sc) return play(sc, [{ transform: `translateY(${box.offsetHeight}px)` }, { transform: 'translateY(0)' }], base, EASE_SHEET);
  return play(box, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], base, EASE_SHEET);
}

/** 창이 나타나는 움직임 */
export function sheetIn(veil, box) {
  if (!on()) return;
  if (sheetSwap) {
    // 창에서 창으로: 배경은 그대로. 휴대폰은 앞 창(복사본)이 내려가는 동안 이 창이 올라오고,
    // 태블릿은 앞 창이 먼저 지워진 뒤 나타난다 → 두 창의 글자가 반투명하게 겹치는 순간이 없다
    if (phone()) rise(box, 380);
    else play(box, [{ opacity: 0, scale: '.98' }, { opacity: 0, scale: '.98', offset: 0.4 }, { opacity: 1, scale: '1' }], 280);
    return;
  }
  // 닫히던 창이 아직 흐려지는 중이면 치운다 (배경 두 겹 방지)
  clearGhosts('.veil');
  play(veil, [{ opacity: 0 }, { opacity: 1 }], phone() ? 300 : 220);
  // 휴대폰: 아래에서 끝까지 올라온다 / 태블릿: 가운데서 살짝 커지며
  if (phone()) rise(box, 400);
  else play(box, [{ opacity: 0, scale: '.97' }, { opacity: 1, scale: '1' }], 240);
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
    return release(g, [fade, down], 260);
  }
  if (close) return release(g, [fade, ['.sheet', [{ opacity: 1, scale: '1' }, { opacity: 0, scale: '.97' }]]], 170);
  // 창에서 창으로: 휴대폰은 앞 창이 불투명한 채로 아래로 내려간다 (새 창은 그 뒤에서 올라옴)
  if (phone()) return release(g, [[null, [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }]]], 240, 32);
  release(g, [[null, [{ opacity: 1 }, { opacity: 0 }]]], 120, 32, EASE_OUT);
}

// ─────────── 설정 쪽 넘기기 (아이폰 설정처럼) ───────────
// 전에는 옛 쪽은 흐려지며 나가고 새 쪽은 흐린 채 들어와서, 중간에 두 쪽 글자가 반투명하게 섞였다 (베타 1.1 영상).
// 이제 두 쪽 모두 불투명: 위에 오는 쪽이 아래 쪽을 덮으며 움직인다.

/** 다시 그리기 전에: 지금 쪽을 복사하고, 창 안쪽 칸(sb)에서 보이던 자리를 기억한다 */
export function pageCapture(page, sb) {
  if (!viewOn() || !page || !sb) return null;
  const g = capture(page);
  if (!g) return null;
  const r = page.getBoundingClientRect(), s = sb.getBoundingClientRect();
  g.at = { top: r.top - s.top, left: r.left - s.left, width: r.width };
  return g;
}

/**
 * 다시 그린 뒤: 앞으로 가면 새 쪽이 오른쪽에서 덮으며 들어오고 옛 쪽은 왼쪽으로 조금 밀리며 아래에 깔린다.
 * 뒤로 가면 지금 쪽(복사본)이 오른쪽으로 걷히고 앞 쪽이 왼쪽에서 제자리로 온다.
 * 복사본은 창 안쪽 칸 크기의 상자에 가둔다 → 창 밖으로 삐져나오지 않는다.
 */
export function pagePush(g, page, sb, back) {
  const sheet = sb && sb.closest('.sheet');
  if (!g || !page || !sheet || !viewOn()) return;
  clearGhosts('.m-page');
  const w = sb.clientWidth;
  const box = document.createElement('div');
  box.className = 'm-ghost m-page';
  box.setAttribute('aria-hidden', 'true');
  box.inert = true;
  Object.assign(box.style, {
    position: 'absolute', left: sb.offsetLeft + 'px', top: sb.offsetTop + 'px', width: w + 'px', height: sb.clientHeight + 'px',
    overflow: 'hidden', zIndex: back ? '3' : '1', background: 'var(--surf)',
    boxShadow: back ? '-10px 0 24px rgba(0, 0, 0, .1)' : 'none',
  });
  const n = g.node;
  Object.assign(n.style, { position: 'absolute', margin: '0', left: g.at.left + 'px', top: g.at.top + 'px', width: g.at.width + 'px' });
  box.appendChild(n);
  sheet.appendChild(box);
  for (const [el, t, l] of g.scrolls) {
    el.scrollTop = t;
    el.scrollLeft = l;
  }
  ghosts.add(box);
  // 새 쪽: 앞으로 갈 때는 위에 오므로 창 안쪽 칸을 빈틈없이 덮는다 (배경 + 옆 여백까지)
  const st = page.style;
  const keep = { position: st.position, zIndex: st.zIndex, background: st.background, boxShadow: st.boxShadow, minHeight: st.minHeight };
  if (!back) {
    const top = page.getBoundingClientRect().top - sb.getBoundingClientRect().top;
    Object.assign(st, { position: 'relative', zIndex: '2', background: 'var(--surf)', boxShadow: '0 0 0 20px var(--surf), -20px 0 26px rgba(0, 0, 0, .09)', minHeight: Math.max(0, sb.clientHeight - top) + 'px' });
  }
  const d = ms(back ? 300 : 340);
  const done = () => {
    if (!ghosts.has(box)) return;
    ghosts.delete(box);
    box.remove();
    Object.assign(st, keep);
  };
  const a = back
    ? [
        play(box, [{ transform: 'translateX(0)' }, { transform: `translateX(${w}px)` }], back ? 300 : 340, EASE_SHEET),
        play(page, [{ transform: `translateX(${-w * 0.3}px)`, opacity: 0.6 }, { transform: 'translateX(0)', opacity: 1 }], 300, EASE_SHEET),
      ]
    : [
        play(n, [{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${-w * 0.3}px)`, opacity: 0.55 }], 340, EASE_SHEET),
        play(page, [{ transform: `translateX(${w}px)` }, { transform: 'translateX(0)' }], 340, EASE_SHEET),
      ];
  const live = a.filter(Boolean);
  if (!live.length) return done();
  Promise.all(live.map((x) => x.finished)).then(done, done);
  setTimeout(done, d + 200); // 애니메이션이 멈춰도 반드시 걷어 낸다
}

// ─────────── 유리 막대 렌즈: 용수철 ───────────
// 전에는 방울이 키프레임 사이를 같은 속도로 옮겨 가서 '미끄러지는' 느낌이 없었다 (베타 1.1 영상: 0.17초 등속 → 0.5초 제자리).

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

/**
 * 유리 막대 렌즈가 옮겨 가는 키프레임 (용수철). from: 출발 자리(px, 도착 자리 기준), w: 탭 한 칸 너비.
 * lifted: 손가락으로 밀다 놓았을 때처럼 방울이 이미 떠 있음.
 * 방울은 떠오르며(커지며) 출발해 빠를수록 진행 방향으로 늘어나고, 도착하면 회색 알약으로 내려앉는다.
 * 알약도 같은 길로 함께 가서, 방울이 내려앉을 때 이미 그 자리에 있다.
 * 돌려줌: { bubble, lens: 키프레임 목록, dur: 기준 시간(ms) }
 */
export function lensFrames(from, w, lifted = false) {
  const slots = Math.min(3, Math.abs(from) / Math.max(1, w));
  const S = spring(0.34 + 0.05 * slots, 0.72);
  const up = lifted ? 0 : 0.09, down = 0.16;
  const tl = Math.max(up, S.dur - down * 0.5);
  const T = tl + down;
  const ease = (k) => k * k * (3 - 2 * k);
  const n = Math.max(2, Math.ceil(T * 60));
  const bubble = [], lens = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * T;
    const s = t >= S.dur ? { x: 1, v: 0 } : S.at(t);
    const x = (from * (1 - s.x)).toFixed(2);
    const L = t < up ? ease(t / up) : t > tl ? 1 - ease(Math.min(1, (t - tl) / down)) : 1; // 떠 있는 정도
    const str = Math.min(0.18, (Math.abs(s.v * from) / Math.max(1, w)) * 0.016); // 빠를수록 늘어남
    const sx = (1 + L * (0.16 + str)).toFixed(3), sy = (1 + L * (0.3 - str * 0.5)).toFixed(3);
    const o = i / n;
    bubble.push({ offset: o, opacity: +Math.min(1, L * 1.6).toFixed(3), transform: `translateX(${x}px) scale(${sx}, ${sy})` });
    lens.push({ offset: o, opacity: +(1 - Math.min(1, L * 1.6)).toFixed(3), transform: `translateX(${x}px)` });
  }
  return { bubble, lens, dur: Math.round(T * 1000) };
}

/** 렌즈 옮기기: 남은 움직임을 멈추고 용수철로 (움직임을 끄면 바로 그 자리) */
export function glide(lensEl, bubbleEl, from, lifted = false) {
  for (const el of [lensEl, bubbleEl]) {
    if (!el) continue;
    if (el.getAnimations) for (const a of el.getAnimations()) a.cancel();
    el.style.transform = '';
    el.style.opacity = '';
  }
  if (!lensEl || !bubbleEl || (!from && !lifted)) return;
  const f = lensFrames(from, bubbleEl.offsetWidth || 1, lifted);
  play(lensEl, f.lens, f.dur, 'linear');
  play(bubbleEl, f.bubble, f.dur, 'linear');
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
