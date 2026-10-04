// 리퀴드 글래스의 '굴절' (크롬 계열 브라우저: 윈도우 크롬·엣지, 삼성 인터넷, 안드로이드 크롬)
// 유리 막대 뒤의 내용이 가장자리에서 휘어 보이고, 떠오른 방울 안은 살짝 커져 보인다 (SVG 변위 필터를 backdrop-filter에).
// 사파리(아이폰·아이패드)는 backdrop-filter에 SVG 필터를 못 써서 흐림·채도·빛 반사 층으로만 그린다 (styles/app.css).
// 아이폰 기본 리퀴드 글래스(-apple-visual-effect)는 애플 앱 전용이라 웹에서 쓸 수 없다.

const NS = 'http://www.w3.org/2000/svg';
let svg = null;

/** 크롬 계열인가 (아이폰·아이패드의 크롬은 사파리 엔진이라 아님) */
export function refractable() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const apple = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return !apple && /Chrome\/|Chromium|SamsungBrowser|Edg\//.test(ua);
}

const enc = (s) => 'data:image/svg+xml,' + encodeURIComponent(s);

/**
 * 변위 지도: 가운데는 그대로(128), 가장자리 band px 안에서만 바깥쪽으로 휘게(가로는 빨강, 세로는 초록 채널).
 * mag: 전체가 가운데로 모이게 (방울 안이 커져 보임)
 */
function maps(w, h, band, mag) {
  const g = (dir, stops) => `<linearGradient id="g" gradientUnits="userSpaceOnUse" ${dir === 'x' ? `x1="0" y1="0" x2="${w}" y2="0"` : `x1="0" y1="0" x2="0" y2="${h}"`}>${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  const img = (grad) => enc(`<svg xmlns="${NS}" width="${w}" height="${h}"><defs>${grad}</defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`);
  if (mag)
    return [img(g('x', [[0, 'rgb(0,128,128)'], [1, 'rgb(255,128,128)']])), img(g('y', [[0, 'rgb(128,0,128)'], [1, 'rgb(128,255,128)']]))];
  const bx = Math.min(0.45, band / w), by = Math.min(0.45, band / h);
  return [
    img(g('x', [[0, 'rgb(0,128,128)'], [bx, 'rgb(128,128,128)'], [1 - bx, 'rgb(128,128,128)'], [1, 'rgb(255,128,128)']])),
    img(g('y', [[0, 'rgb(128,0,128)'], [by, 'rgb(128,128,128)'], [1 - by, 'rgb(128,128,128)'], [1, 'rgb(128,255,128)']])),
  ];
}

function filter(id, w, h, scale, band, mag) {
  const [mx, my] = maps(w, h, band, mag);
  return `<filter id="${id}" x="0" y="0" width="${w}" height="${h}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
    <feImage href="${mx}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="mx"/>
    <feImage href="${my}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="my"/>
    <feDisplacementMap in="SourceGraphic" in2="mx" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="d1"/>
    <feDisplacementMap in="d1" in2="my" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/>
  </filter>`;
}

const sizes = {};
/** 막대·방울·＋ 단추 크기에 맞춰 필터를 만든다 (크기가 바뀔 때마다) */
export function fitGlass(dock) {
  if (!dock || !refractable()) return;
  const bar = dock.querySelector('.tabbar.glass');
  const lens = dock.querySelector('.lens-glass');
  const add = dock.querySelector('.dock-add');
  const s = (el) => (el ? [Math.round(el.offsetWidth), Math.round(el.offsetHeight)] : [0, 0]);
  const [bw, bh] = s(bar), [lw, lh] = s(lens), [aw, ah] = s(add);
  const key = [bw, bh, lw, lh, aw, ah].join(',');
  if (!bw || sizes.key === key) return;
  sizes.key = key;
  if (!svg) {
    svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'lg-svg');
    svg.setAttribute('aria-hidden', 'true');
    document.body.appendChild(svg);
  }
  svg.innerHTML = `<defs>${filter('lg-bar', bw, bh, 22, 18, false)}${filter('lg-btn', aw || 62, ah || 62, 20, 16, false)}${filter('lg-lens', lw || 80, lh || 54, -Math.round((lw || 80) * 0.14), 0, true)}</defs>`;
  document.documentElement.classList.add('lg-refract');
}
