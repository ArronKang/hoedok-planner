// 화면 전수 점검 (브라우저 전용): 글꼴 × 글자 크기 × 디자인 × 화면마다
//  1) 가로로 넘치는 것(화면 밖으로 잘림, 세로 스크롤 상자 밖으로 삐져나옴)
//  2) 한 줄이어야 할 단추·탭 글씨가 두 줄로 꺾임
//  3) 보이는 단추를 실제로 누를 수 있는지 (다른 것이 덮고 있지 않은지)
// 쓰는 법: 앱 화면(http://localhost:5173/)의 콘솔에서
//   const L = await import('/tests/layout-check.js'); await L.run({ fonts: ['gaegu'] })
// 화면 크기는 브라우저에서 바꾼다 (휴대폰 360×780, 태블릿 800×1280·1280×800). 예시 기록을 불러와서 본다.
import * as C from '../src/app/core.js';
import { FONTS, ensureFont } from '../src/app/fonts.js';

const tick = () => new Promise((r) => setTimeout(r, 0));
const desc = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} "${(el.textContent || '').trim().slice(0, 18)}"`;

/** 잘리는 게 맞는 곳: 가로로 미는 줄, 말줄임(…) 상자 */
function intendedClip(el, stop) {
  for (let p = el.parentElement; p && p !== stop; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (/(auto|scroll)/.test(cs.overflowX) && cs.overflowY === 'hidden') return true;
    if (cs.textOverflow === 'ellipsis' && cs.overflowX !== 'visible') return true;
  }
  return false;
}
/** 가장 가까운 세로 스크롤 상자 (없으면 기기 틀) */
function scroller(el, dev) {
  for (let p = el.parentElement; p && p !== dev; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (/(auto|scroll)/.test(cs.overflowY)) return p;
  }
  return dev;
}

function overflows(dev) {
  const bad = [];
  const W = dev.getBoundingClientRect().right;
  if (document.documentElement.scrollWidth > innerWidth + 1) bad.push('페이지가 옆으로 밀림');
  for (const el of dev.querySelectorAll('*')) {
    if (el.closest('.m-ghost') || el.closest('svg')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (intendedClip(el, dev)) continue;
    const box = scroller(el, dev).getBoundingClientRect();
    const lim = Math.min(W, box.right);
    if (r.right > lim + 1.5) bad.push(`넘침 ${desc(el)} +${Math.round(r.right - lim)}px`);
  }
  return bad;
}

/** 글씨가 몇 줄로 보이나 (글자만 센다: 색 점 같은 작은 상자는 줄로 치지 않음) */
function lines(el) {
  const rg = document.createRange();
  const mids = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!n.textContent.trim()) continue;
    rg.selectNodeContents(n);
    for (const r of rg.getClientRects()) if (r.width > 1) mids.push(r.top + r.height / 2);
  }
  mids.sort((a, b) => a - b);
  let n = 0, last = -1e9;
  for (const m of mids) if (m - last > 6) (n++, (last = m));
  return n;
}
const ONE_LINE = '.seg button, .tabbar button > span:last-child, .side button > span:last-child, .chip, .btn.sm, .dday-chip, .banner .go, .tab-pill';
function wrapped(dev) {
  const bad = [];
  for (const el of dev.querySelectorAll(ONE_LINE)) {
    if (el.closest('.m-ghost') || !el.getClientRects().length) continue;
    if (lines(el) > 1) bad.push(`두 줄 ${desc(el)}`);
  }
  return bad;
}

/** 보이는 단추 가운데를 눌렀을 때 그 단추가 눌리는가 */
function unclickable(dev) {
  const bad = [];
  const top = dev.querySelector('.sheet-layer .sheet');
  const root = top || dev;
  for (const el of root.querySelectorAll('button, [role="radio"], a[href], input, select, summary')) {
    if (el.closest('.m-ghost') || el.disabled) continue;
    const det = el.closest('details');
    if (det && !det.open && el.tagName !== 'SUMMARY') continue; // 접힌 곳 안
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    // 스크롤해서 가려진 것은 건너뛴다
    let vis = true;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const b = p.getBoundingClientRect();
      if (x < b.left || x > b.right || y < b.top || y > b.bottom) {
        vis = false;
        break;
      }
    }
    if (!vis || x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
    const hit = document.elementFromPoint(x, y);
    if (!hit) continue;
    if (hit === el || el.contains(hit)) continue;
    if (hit.closest('.toast, .fab')) continue; // 잠깐 뜨는 알림·＋ 단추가 덮는 것은 괜찮다
    if (el.tagName === 'INPUT' && hit.tagName === 'LABEL') continue;
    bad.push(`못 누름 ${desc(el)} ← ${desc(hit)}`);
  }
  return bad;
}

const SCREENS = [
  ['오늘', () => C.go('today')],
  ['진도', () => C.go('progress')],
  ['과목', () => C.push('progress', { view: 'subject', id: C.D().subjects[0].id }, true)],
  ['성적', () => C.go('grades')],
  ['시험 결과', () => C.D().pastExams[0] && C.push('grades', { view: 'exam', id: C.D().pastExams[0].id }, true)],
  ['설정', () => C.openSheet({ type: 'settings' })],
  ['설정 › 디자인', () => C.openSheet({ type: 'settings', page: 'display' })],
  ['설정 › 글꼴', () => C.openSheet({ type: 'settings', page: 'font' })],
  ['설정 › 계정', () => C.openSheet({ type: 'settings', page: 'account' })],
  ['할 일', () => C.openSheet({ type: 'task', id: C.tasksOn(C.today())[0].id })],
  ['할 일 추가', () => C.openSheet({ type: 'add' })],
  ['다시 나누기', () => C.openSheet({ type: 'plan' })],
  ['돌아보기', () => C.openSheet({ type: 'week' })],
  ['달력', () => C.openSheet({ type: 'calendar' })],
  ['홈 화면에 추가', () => C.openSheet({ type: 'install' })],
];

async function show(fn) {
  C.closeSheet();
  C.setUI({ stacks: { today: [], progress: [], grades: [] } });
  await tick();
  fn();
  await tick();
  await tick();
  for (const a of document.getAnimations()) a.finish();
  // 한글 글꼴은 글자 묶음별로 나뉘어 있어 화면에 새 글자가 나오면 그때 받는다 → 다 받은 뒤에 잰다
  await document.fonts.ready;
}

/** 고른 글꼴의 목록(css)이 붙고 글꼴 파일을 받을 때까지 */
async function fontReady(id) {
  ensureFont(id);
  const l = document.getElementById('font-' + id);
  if (l && !l.sheet)
    await new Promise((r) => {
      l.addEventListener('load', r, { once: true });
      l.addEventListener('error', r, { once: true });
      setTimeout(r, 8000);
    });
  await tick();
  const fam = getComputedStyle(document.getElementById('device')).getPropertyValue('--kf').split(',')[0].trim();
  for (const w of [400, 700]) await document.fonts.load(`${w} 16px ${fam}`, '오늘 할 일 진도 성적 설정').catch(() => {});
  await document.fonts.ready;
  return { fam, ok: document.fonts.check(`16px ${fam}`, '오늘') };
}

/**
 * @param {{fonts?: string[], sizes?: string[], themes?: string[], screens?: string[]}} o
 * @returns {{checked:number, bad:string[]}}
 */
export async function run(o = {}) {
  const keep = { ...C.PR() };
  const fonts = o.fonts || FONTS.map((f) => f.id);
  const sizes = o.sizes || ['sm', 'md', 'lg', 'xl'];
  const themes = o.themes || ['paper', 'crisp', 'soft'];
  if (!C.isDemo()) C.loadDemo();
  C.setPrefs({ motion: 'off' });
  const bad = [];
  let checked = 0;
  try {
    for (const font of fonts) {
      C.setPrefs({ font });
      await tick();
      const fr = await fontReady(font);
      if (!fr.ok && font !== 'system') bad.push(`[${font}] 글꼴을 받지 못함 (${fr.fam}) — 인터넷 확인`);
      for (const theme of themes)
        for (const size of sizes)
          for (const density of size === 'xl' ? ['normal', 'relaxed'] : ['normal']) {
            C.setPrefs({ theme, size, density });
            for (const [name, fn] of SCREENS) {
              if (o.screens && !o.screens.includes(name)) continue;
              await show(fn);
              const dev = document.getElementById('device');
              const tag = `[${font}·${theme}·${size}${density === 'relaxed' ? '·넉넉' : ''}·${C.UI().dev} ${innerWidth}px] ${name}`;
              for (const b of [...overflows(dev), ...wrapped(dev), ...unclickable(dev)]) bad.push(`${tag}: ${b}`);
              checked++;
            }
          }
    }
  } finally {
    C.closeSheet();
    C.setPrefs(keep);
    C.go('today');
  }
  return { checked, bad: [...new Set(bad)] };
}
