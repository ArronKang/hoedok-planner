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
      // 가장자리에 걸친 것(가운데가 테두리 2px 안)은 스크롤해야 보이는 것으로 친다
      if (x < b.left + 2 || x > b.right - 2 || y < b.top + 2 || y > b.bottom - 2) {
        vis = false;
        break;
      }
    }
    if (!vis || x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
    const hit = document.elementFromPoint(x, y);
    if (!hit) continue;
    if (hit === el || el.contains(hit)) continue;
    if (hit.closest('.toast, .fab, .dock')) continue; // 잠깐 뜨는 알림·＋ 단추·떠 있는 유리 막대가 덮는 것은 괜찮다 (스크롤하면 보임)
    if (el.tagName === 'INPUT' && hit.tagName === 'LABEL') continue;
    bad.push(`못 누름 ${desc(el)} ← ${desc(hit)}`);
  }
  return bad;
}

const eng = () => C.D().subjects.find((s) => s.name === '공통영어') || C.D().subjects[0];
const SCREENS = [
  ['오늘', () => C.go('today')],
  ['진도', () => C.go('progress')],
  ['과목', () => C.push('progress', { view: 'subject', id: C.D().subjects[0].id }, true)],
  ['과목(칸)', () => C.push('progress', { view: 'subject', id: eng().id }, true)],
  ['칸 채우기', () => C.openSheet({ type: 'record', sub: eng().id, stage: eng().stages[1].id })],
  ['쪽 적기', () => C.openSheet({ type: 'record', sub: C.D().subjects[0].id, stage: C.D().subjects[0].stages[1].id })],
  ['교재 고치기', () => C.openSheet({ type: 'edit', id: eng().id })],
  ['단원 이름', () => C.openSheet({ type: 'labels', id: eng().id, book: eng().books[0].id })],
  ['과목 추가 › 교재', () => C.openSheet({ type: 'setup', id: C.D().subjects[1].id })],
  ['성적', () => C.go('grades')],
  ['시험 결과', () => C.D().pastExams[0] && C.push('grades', { view: 'exam', id: C.D().pastExams[0].id }, true)],
  ['설정', () => C.openSheet({ type: 'settings' })],
  ['설정 › 학년과 과목', () => C.openSheet({ type: 'settings', page: 'school' })],
  ['설정 › 과목 순서', () => C.openSheet({ type: 'settings', page: 'subjects' })],
  ['설정 › 테마', () => C.openSheet({ type: 'settings', page: 'theme' })],
  ['설정 › 글자 크기', () => C.openSheet({ type: 'settings', page: 'text' })],
  ['설정 › 하루가 바뀌는 시각', () => C.openSheet({ type: 'settings', page: 'dayStart' })],
  ['설정 › 오늘 화면', () => C.openSheet({ type: 'settings', page: 'todayView' })],
  ['설정 › 진도 화면', () => C.openSheet({ type: 'settings', page: 'progressView' })],
  ['설정 › 공부 시간', () => C.openSheet({ type: 'settings', page: 'time' })],
  ['설정 › 기록 관리', () => C.openSheet({ type: 'settings', page: 'data' })],
  ['설정 › 정보', () => C.openSheet({ type: 'settings', page: 'about' })],
  ['설정 › 계정', () => C.openSheet({ type: 'settings', page: 'account' })],
  ['할 일', () => C.openSheet({ type: 'task', id: C.tasksOn(C.today())[0].id })],
  ['할 일 › 더 보기', () => {
    C.setUI({ open: { ...C.UI().open, taskMore: true } });
    C.openSheet({ type: 'task', id: C.tasksOn(C.today()).find((t) => t.kind === 'free').id });
  }],
  ['할 일 추가', () => C.openSheet({ type: 'add' })],
  ['다시 나누기', () => C.openSheet({ type: 'plan' })],
  ['돌아보기', () => C.openSheet({ type: 'week' })],
  ['달력', () => C.openSheet({ type: 'calendar' })],
  ['홈 화면에 추가', () => C.openSheet({ type: 'install' })],
  // 처음 화면 (예시 기록을 잠깐 처음 설정 전으로 돌려서 본다 — 다음 화면에서 되돌림)
  ...[0, 1, 2, 3, 4, 5].map((n) => [`처음 화면 ${n}`, () => {
    C.D().onboarded = false;
    C.setUI({ ob: n });
    C.commit();
  }]),
];

async function show(fn) {
  if (!C.D().onboarded) {
    C.D().onboarded = true;
    C.setUI({ ob: 0 });
    C.commit();
  }
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
  const fonts = o.fonts || ['pretendard'];
  const sizes = o.sizes || ['sm', 'md', 'lg', 'xl'];
  const themes = o.themes || C.THEMES;
  const bars = o.bars || ['auto'];
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
            for (const bar of bars) {
              // 아주 크게는 굵은 글씨도 함께 (가장 넓어지는 조합)
              C.setPrefs({ theme, size, density, tabStyle: bar, bold: size === 'xl' });
              for (const [name, fn] of SCREENS) {
                if (o.screens && !o.screens.includes(name)) continue;
                await show(fn);
                const dev = document.getElementById('device');
                const tag = `[${font}·${theme}·${size}${density === 'relaxed' ? '·넉넉' : ''}${size === 'xl' ? '·굵게' : ''}·${C.UI().dev}${bar !== 'auto' ? '·' + bar : ''} ${innerWidth}px] ${name}`;
                for (const b of [...overflows(dev), ...wrapped(dev), ...unclickable(dev)]) bad.push(`${tag}: ${b}`);
                checked++;
              }
            }
          }
    }
  } finally {
    if (!C.D().onboarded) {
      C.D().onboarded = true;
      C.setUI({ ob: 0 });
      C.commit();
    }
    C.closeSheet();
    C.setPrefs(keep);
    C.go('today');
  }
  return { checked, bad: [...new Set(bad)] };
}
