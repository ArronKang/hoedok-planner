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
  check('E3 설정이 바로 적용', dev.dataset.motion === M.level() && M.level() === (level === 'off' ? 'off' : 'normal'));

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

  // ── E4 (베타 2.0): 움직임은 켜기/끄기만. 켜 두면 창도 화면 옮기기도 같은 규칙으로 움직인다 ──
  C.go('grades');
  await settle();
  C.go('today');
  C.openSheet({ type: 'calendar' });
  await settle();
  if (level !== 'off') check('E4 창 움직임', anims('.sheet-layer').length > 0);
  C.closeSheet();
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

  // ── 베타 1.0: 겹쳐 바뀜(M) · 휴대폰 창 기기 스크롤(N) · 유리 막대 렌즈(O) ──
  C.go('progress');
  await shown();
  await idle('M 준비');
  const subs = C.D().subjects.filter((x) => x.stages.length);
  C.push('progress', { view: 'subject', id: subs[0].id }, true);
  await settle();
  if (level !== 'off') {
    check('M1 화면을 바꾸면 옛 화면 복사본이 겹쳐 흐려짐', document.querySelectorAll('.m-view').length === 1);
    C.push('progress', { view: 'subject', id: subs[1].id }, true);
    await settle();
    check('M2 연달아 바꿔도 복사본이 쌓이지 않음', document.querySelectorAll('.m-view').length <= 1);
  } else check('M4 끄기: 겹쳐 바뀜 복사본 없음', document.querySelectorAll('.m-view').length === 0);
  await idle('M 겹쳐 바뀜');
  check('M2 끝나면 복사본 0', document.querySelectorAll('.m-view').length === 0);
  C.setUI({ stacks: { today: [], progress: [], grades: [] } });
  C.go('today');
  await idle('M 정리');
  // N: 손가락 기기의 휴대폰 창
  const touch = matchMedia('(pointer: coarse)').matches && C.UI().dev === 'phone';
  if (touch) {
    C.openSheet({ type: 'todayMenu' });
    await shown();
    await wait(60);
    const sc = document.querySelector('.sheet-layer .sheet-sc');
    // 거꾸로 쌓은 상자: 열린 자리 = scrollTop 0, 닫힌 자리 = -(최대)
    check('N1 창은 처음부터 열린 자리 (위치를 옮기지 않아도)', !!sc && Math.abs(sc.scrollTop) <= 2 && getComputedStyle(sc).flexDirection === 'column-reverse');
    if (sc) {
      sc.scrollTop = -(sc.scrollHeight - sc.clientHeight);
      sc.dispatchEvent(new Event('scroll')); // 가려진 창에서는 스크롤 알림이 늦게 오므로 직접
      await settle();
      check('N2 끝까지 끌어내리면 닫힘', !C.UI().sheet);
      check('N2 끌어 닫으면 사라지는 복사본 없음', ghosts() === 0);
    }
    await idle('N 끌어 닫기');
  }
  // O: 유리 막대
  const keepBar = C.PR().tabStyle;
  C.setPrefs({ tabStyle: 'glass' });
  await settle();
  if (C.UI().dev === 'phone') {
    before = snap();
    C.go('progress');
    await settle();
    if (level !== 'off') {
      const la = fresh('.lens', before);
      check('O1 탭을 바꾸면 렌즈가 미끄러짐', la.length > 0);
      // Q1: 같은 속도가 아니라 용수철 (키프레임을 촘촘히 계산해 넣는다 — 모양은 노드 테스트가 확인)
      check('Q1 렌즈는 용수철로 (촘촘한 키프레임)', la.length > 0 && la.every((x) => x.effect.getKeyframes().length > 10));
    } else check('O3 끄기: 렌즈 움직임 없음', fresh('.lens', before).length === 0);
    await idle('O 렌즈');
    C.go('today');
    await idle('O 정리');
    // R: 막대를 누른 채 옆으로 밀기 (손가락 흉내)
    const nav = document.querySelector('.tabbar.glass');
    if (nav) {
      const nr = nav.getBoundingClientRect();
      const w = (nr.width - 8) / nav.querySelectorAll('button').length;
      const y = nr.top + nr.height / 2;
      const first = nav.querySelector('button');
      const pe = (el, type, x, yy = y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 31, pointerType: 'touch', isPrimary: true, clientX: x, clientY: yy }));
      let x = nr.left + 4 + w / 2;
      pe(first, 'pointerdown', x);
      for (let i = 0; i < 10; i++) pe(nav, 'pointermove', (x += w * 0.2));
      const bub = nav.querySelector('.lens-glass');
      check('R1 밀면 방울이 손가락을 따라옴', bub && bub.style.opacity === '1' && /translateX\(\d/.test(bub.style.transform));
      for (let i = 0; i < 12; i++) pe(nav, 'pointermove', (x += w * 0.3)); // 설정 칸 너머까지
      pe(nav, 'pointerup', x);
      first.click(); // 손가락을 뗀 자리의 누름이 따라와도 한 번 삼킨다
      await settle();
      check('R2 놓으면 가까운 탭이 열리고, 설정 칸까지 밀어도 설정 창은 안 열림', C.UI().tab === 'grades' && !C.UI().sheet, C.UI().tab);
      await idle('R 밀기');
      check('R3 다 끝나면 손가락 자리 모양을 걷어 냄', bub && !bub.getAttribute('style'));
      // 세로로 움직이면 밀기가 아님
      pe(first, 'pointerdown', nr.left + 4 + w / 2);
      pe(nav, 'pointermove', nr.left + 4 + w / 2 + 3, y - 30);
      pe(nav, 'pointermove', nr.left + 4 + w * 2, y - 60);
      pe(nav, 'pointerup', nr.left + 4 + w * 2, y - 60);
      await settle();
      check('R4 세로로 움직이면 밀기가 아님', C.UI().tab === 'grades' && (!bub || bub.style.opacity !== '1'));
      C.go('today');
      await idle('R 정리');
    }
  }
  C.setPrefs({ tabStyle: keepBar });
  await settle();

  // ── 베타 1.2: 창이 위로 튀지 않음(N9) · 창→창(C5) · 설정 쪽 넘기기(P4·P5) ──
  // 앞에서 체크할 때 뜬 알림이 점검 도중에 시간이 다 되어 사라지면(복사본) 그것까지 세므로 먼저 치운다
  C.setUI({ toast: null });
  await idle('알림 정리');
  if (level !== 'off') {
    C.openSheet({ type: 'settings' });
    await settle();
    if (touch) {
      const sc2 = document.querySelector('.sheet-layer .sheet-sc');
      const box = sc2 && sc2.querySelector('.sheet');
      const a = sc2 && sc2.getAnimations()[0];
      check('N9 올라오는 움직임은 스크롤 상자째 (안의 창은 가만히)', !!a && box.getAnimations().length === 0);
      if (a) {
        const dur = a.effect.getComputedTiming().duration;
        const tops = [];
        for (const k of [0.1, 0.3, 0.5, 0.8]) {
          a.currentTime = dur * k;
          tops.push(box.getBoundingClientRect().top);
        }
        a.finish();
        const fin = box.getBoundingClientRect().top;
        check('N9 올라오는 동안 제자리보다 위로 가지 않음', tops.every((t) => t >= fin - 1) && Math.abs(sc2.scrollTop) <= 2, tops.map(Math.round).join(',') + ' → ' + Math.round(fin));
      }
    }
    await shown();
    const sb2 = document.querySelector('.sheet-layer .sheet-b');
    sb2.scrollTop = 160;
    const keepTop = sb2.scrollTop;
    [...sb2.querySelectorAll('button')].find((b) => b.textContent.includes('테마')).click();
    await settle();
    // 움직임 규칙 ②: 옛 쪽(창 안쪽 칸 복사본)이 먼저 짧게 흐려지고, 새 쪽은 30%까지 보이지 않다가 들어온다 → 두 글자가 겹치지 않음
    const og2 = document.querySelector('.m-view');
    const oa = og2 && og2.querySelector('.set-page') && og2.querySelector('.set-page').getAnimations()[0];
    const na = sb2.getAnimations()[0];
    check('P4 옛 쪽은 먼저 짧게 흐려짐', !!oa && oa.effect.getComputedTiming().duration <= 140, oa ? String(oa.effect.getComputedTiming().duration) : '없음');
    check('P4 새 쪽은 30%까지 투명 (겹치지 않음)', !!na && na.effect.getKeyframes().some((k) => Math.abs(k.offset - 0.3) < 0.01 && +k.opacity === 0));
    check('P2 복사본은 창 안쪽 칸째 (창 밖으로 안 삐져나옴)', !!og2 && og2.classList.contains('sheet-b') && og2.parentNode === document.getElementById('device'));
    check('P3 새 쪽은 맨 위부터', sb2.scrollTop === 0);
    await idle('P4 앞으로');
    sb2.querySelector('.set-page .back').click();
    await settle();
    const na2 = sb2.getAnimations()[0];
    check('P4 뒤로: 왼쪽에서 들어옴', !!na2 && /translateX\(-/.test(na2.effect.getKeyframes()[0].transform || ''));
    check('P5 뒤로 가면 보던 스크롤 자리', Math.abs(sb2.scrollTop - keepTop) <= 2, `${sb2.scrollTop} / ${keepTop}`);
    await idle('P5 뒤로');
    // C5 창→창: 앞 창은 반투명하게 겹치지 않는다
    C.openSheet({ type: 'todayMenu' });
    await shown();
    C.openSheet({ type: 'week' });
    await settle();
    const og = document.querySelector('.m-ghost');
    const fades = (el) => el.getAnimations().some((x) => x.effect.getKeyframes().some((k) => k.opacity != null && +k.opacity < 1));
    if (C.UI().dev === 'phone') check('C5 창→창(휴대폰): 앞 창은 불투명한 채 내려가고 새 창이 올라옴', !!og && !fades(og) && anims('.sheet-layer').length > 0);
    else {
      const nb = document.querySelector('.sheet-layer .sheet');
      const k = nb && nb.getAnimations()[0];
      check('C5 창→창(태블릿): 앞 창이 지워진 뒤 새 창이 나타남', !!k && k.effect.getKeyframes().some((f) => f.offset > 0.3 && f.offset < 1 && +f.opacity === 0));
    }
    C.closeSheet();
    await idle('C5 창→창');
  }

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
  for (const level of ['normal', 'off']) out.push(await run({ level, quiet: true }));
  C.setPrefs({ motion: null });
  return out;
}
