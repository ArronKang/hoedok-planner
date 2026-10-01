// 움직임 버그 체크리스트 자동 점검 (docs/움직임-버그-체크리스트.md)
// 앱 화면(index.html)을 연 브라우저 콘솔에서:
//   const m = await import('/tests/motion-check.js'); await m.run()
// 예시 자료를 불러와 실제로 창을 열고 닫고, 체크하고, 탭을 옮기며 남은 애니메이션·복사본을 센다.
import * as C from '../src/app/core.js';
import * as M from '../src/app/motion.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = () => wait(30);
// 브라우저 창이 가려져 있으면 애니메이션 시간이 멈춘다 → 점검할 때는 '보이는 것처럼' 하고,
// 시간이 흐르는 대신 애니메이션을 끝까지 넘긴다(finish). 끝없는 애니메이션은 넘길 수 없어 오류가 난다 = A1 실패.
let fastForward = false;
function finishAll() {
  const bad = [];
  for (const a of document.getAnimations()) {
    try {
      a.finish();
    } catch {
      bad.push(a);
    }
  }
  return bad.length;
}
const anims = (sel) => document.getAnimations().filter((a) => !sel || (a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest(sel)));
const ghosts = () => document.querySelectorAll('.m-ghost').length;
const opaque = (sel) => [...document.querySelectorAll(sel)].every((e) => getComputedStyle(e).opacity === '1');

export async function run({ level = 'normal', quiet = false, fast = true } = {}) {
  // fast: 시간이 흐르기를 기다리지 않고 넘긴다 (기본). 느린 기기·가려진 창에서도 결과가 같다.
  // 실제 속도로 보려면 fast: false (기기에서 눈으로 볼 때)
  const stub = document.hidden;
  fastForward = fast || stub;
  if (stub) Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  try {
    return await runInner(level, quiet);
  } finally {
    if (stub) delete document.hidden;
  }
}

/** before 뒤로 새로 시작된 애니메이션 (다시 재생되는 움직임 찾기) */
const fresh = (sel, before) => anims(sel).filter((a) => !before.has(a));
const snap = () => new Set(document.getAnimations());

async function runInner(level, quiet) {
  const results = [];
  // 창·알림이 다 나타날 때까지 (가려진 창에서는 넘기기)
  const shown = async () => {
    if (fastForward) {
      finishAll();
      await wait(30);
    } else await wait(M.ms(300) + 80);
  };
  const check = (id, ok, note = '') => results.push({ id, ok: !!ok, note });
  const idle = async (id) => {
    if (fastForward) {
      await wait(40); // 앱이 다시 그리고 움직임을 시작한 뒤에 넘긴다
      check(id + ' 끝없는 애니메이션 없음', finishAll() === 0);
      await wait(60);
    } else await wait(M.ms(600) + 400);
    check(id + ' 1초 뒤 애니메이션 0', anims().length === 0, anims().length ? anims().map((a) => a.effect && a.effect.target && a.effect.target.className).join(',') : '');
    check(id + ' 1초 뒤 복사본 0', ghosts() === 0);
    check(id + ' 흐린 채 멈춘 요소 없음', opaque('#device, .view, .sheet, .veil, .toast, .col.main, .appear'));
  };

  C.closeSheet();
  C.setUI({ toast: null, tab: 'today', day: null, stacks: { today: [], progress: [], grades: [] } });
  C.loadDemo();
  C.setPrefs({ motion: level, motionView: true });
  await wait(300);
  const dev = document.getElementById('device');
  check('E3 설정이 바로 적용', dev.dataset.motion === level);

  // ── 창 열기·닫기 ──
  const t = C.tasksOn(C.today()).find((x) => x.kind === 'free');
  C.openSheet({ type: 'task', id: t.id });
  await settle();
  if (level !== 'off') check('M1 창이 열릴 때 움직임', anims('.sheet-layer').length > 0);
  await shown();
  // B2: 창을 연 채 값을 바꿔도 다시 나타나지 않음
  let before = snap();
  C.editTask(t, 'memo', '움직임 점검');
  C.commit();
  await settle();
  check('B2 값을 바꿔도 창이 다시 나타나지 않음', fresh('.sheet-layer', before).length === 0);
  C.closeSheet();
  await settle();
  if (level !== 'off') {
    const g = document.querySelector('.m-ghost');
    check('M2 닫을 때 복사본이 흐려짐', !!g);
    if (g) {
      check('D1 복사본은 누를 수 없음', getComputedStyle(g).pointerEvents === 'none');
      check('D3 복사본은 읽히지 않음', g.getAttribute('aria-hidden') === 'true' && g.inert === true);
      check('K1 복사본은 기기 틀 안 (디자인 색 그대로)', g.parentNode === dev);
      const r = g.querySelector('.sheet').getBoundingClientRect();
      const under = document.elementFromPoint(r.left + r.width / 2, r.top + 30);
      check('D1 사라지는 동안 뒤 화면을 누를 수 있음', under && !under.closest('.m-ghost'));
    }
  } else check('E1 끄기: 복사본 없음', ghosts() === 0);
  await idle('A 창 닫기');

  // ── C1 창에서 창으로: 배경을 새로 어둡게 하지 않음 ──
  C.openSheet({ type: 'todayMenu' });
  await shown();
  before = snap();
  C.openSheet({ type: 'week' });
  await settle();
  check('C1 창→창: 배경 움직임 없음', fresh('.sheet-layer .veil', before).length === 0);
  check('C1 창→창: 배경은 하나', document.querySelectorAll('.sheet-layer .veil').length === 1);
  C.closeSheet();
  await idle('A 창→창');

  // ── C2 닫자마자 다시 열기 ──
  C.openSheet({ type: 'calendar' });
  await shown();
  C.closeSheet();
  await settle();
  C.openSheet({ type: 'calendar' });
  await settle();
  check('C2 닫자마자 다시 열어도 배경 두 겹 없음', document.querySelectorAll('.veil').length === 1);
  C.closeSheet();
  await idle('A 다시 열기');

  // ── C4 빠르게 열고 닫기 10번 ──
  for (let i = 0; i < 10; i++) {
    C.openSheet({ type: i % 2 ? 'week' : 'calendar' });
    await wait(15);
    C.closeSheet();
    await wait(15);
  }
  await idle('C4 빠르게 10번');

  // ── F1·F2 스크롤·적던 글자 ──
  C.openSheet({ type: 'settings' });
  await shown();
  const sb = document.querySelector('.sheet-layer .sheet-b');
  sb.scrollTop = 120;
  const top = sb.scrollTop;
  C.closeSheet();
  await settle();
  if (level !== 'off') {
    const gb = document.querySelector('.m-ghost .sheet-b');
    check('F1 사라지는 창이 맨 위로 튀지 않음', gb && Math.abs(gb.scrollTop - top) < 2, `${gb && gb.scrollTop} / ${top}`);
  }
  await idle('F1');
  C.openSheet({ type: 'add' });
  await shown();
  const inp = document.querySelector('.sheet-layer input.input');
  inp.value = '적던 글자';
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  await settle();
  C.closeSheet();
  await settle();
  if (level !== 'off') {
    const gi = document.querySelector('.m-ghost input.input');
    check('F2 사라지는 창에 적던 글자 그대로', gi && gi.value === '적던 글자');
  }
  await idle('F2');

  // ── F3 뒤 화면 스크롤 그대로 ──
  const sc = document.querySelector('.view .scroll');
  sc.scrollTop = 150;
  const scrollBefore = sc.scrollTop;
  C.openSheet({ type: 'todayMenu' });
  await shown();
  C.closeSheet();
  await wait(50);
  check('F3 창을 닫아도 뒤 화면 스크롤 그대로', document.querySelector('.view .scroll').scrollTop === scrollBefore);
  await idle('F3');
  document.querySelector('.view .scroll').scrollTop = 0;

  // ── 알림 ──
  C.toast('첫 알림');
  await settle();
  if (level !== 'off') check('M7 알림이 나타날 때 움직임', anims('.toast-layer').length > 0);
  await shown();
  before = snap();
  C.setUI({}); // 같은 알림 다시 그리기
  await settle();
  check('B3 같은 알림은 가만히', fresh('.toast-layer', before).length === 0);
  C.toast('두 번째 알림');
  await settle();
  check('C3 알림이 겹쳐 보이지 않음', document.querySelectorAll('.toast').length === 1);
  C.setUI({ toast: null });
  await idle('A 알림');

  // ── 체크 ──
  const todo = C.tasksOn(C.today()).find((x) => x.status === 'todo' && x.kind === 'track');
  C.toggleTask(todo.id);
  await settle();
  if (level !== 'off') check('M5 방금 체크한 것이 채워짐', anims('.check').length > 0);
  await idle('M5 체크');
  // B1: 탭을 옮겨 왔을 때 끝낸 일이 한꺼번에 움직이지 않음
  C.go('progress');
  await shown();
  before = snap();
  C.go('today');
  await settle();
  check('B1 탭을 옮겨 와도 동그라미가 한꺼번에 움직이지 않음', fresh('.check', before).length === 0);
  if (level !== 'off') check('M4 탭을 옮기면 새 화면이 나타남', anims('.view').length > 0 || anims('.pad-view').length > 0);
  await idle('M4 탭');
  C.toggleTask(todo.id); // 되돌림

  // ── E4 화면 옮길 때만 끄기 ──
  C.setPrefs({ motionView: false });
  before = snap();
  C.go('grades');
  await settle();
  check('E4 화면 옮길 때 움직임만 꺼짐', fresh('.view', before).length === 0 && fresh('.pad-view', before).length === 0);
  C.go('today');
  C.openSheet({ type: 'calendar' });
  await settle();
  if (level !== 'off') check('E4 창 움직임은 그대로', anims('.sheet-layer').length > 0);
  C.closeSheet();
  C.setPrefs({ motionView: true });
  await idle('E4');

  // ── I1·I2 뒤로 가기·Esc ──
  C.openSheet({ type: 'todayMenu' });
  await shown();
  history.back();
  await wait(120);
  check('I1 뒤로 가기로 닫힘', !C.UI().sheet);
  await idle('I1 뒤로 가기');
  C.openSheet({ type: 'todayMenu' });
  await shown();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await settle();
  check('I2 Esc로 닫힘', !C.UI().sheet);
  await idle('I2 Esc');

  // ── 끄기(E1): 아무것도 움직이지 않음 ──
  if (level === 'off') {
    C.openSheet({ type: 'settings' });
    await settle();
    C.go('progress');
    await settle();
    check('E1 끄기: 애니메이션 0', anims().length === 0, anims().length + '');
    C.closeSheet();
    await settle();
    check('E1 끄기: 복사본 0', ghosts() === 0);
  }

  C.closeSheet();
  C.setUI({ toast: null, tab: 'today' });
  const bad = results.filter((r) => !r.ok);
  if (!quiet) console.table(results);
  return { level, total: results.length, failed: bad.length, bad };
}

/** 네 단계 모두 */
export async function runAll() {
  const out = [];
  for (const level of ['normal', 'slow', 'fast', 'off']) out.push(await run({ level, quiet: true }));
  C.setPrefs({ motion: null });
  return out;
}
