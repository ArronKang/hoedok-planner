// 움직임 설정 (노드 전용: 기기의 '동작 줄이기'를 흉내 낸다)
// 체크리스트 E1·E2 — 화면에서 하는 점검은 tests/motion-check.js
import { test, eq, ok } from './harness.js';
import * as C from '../src/app/core.js';

// 기기 설정 흉내: matches를 바꿔 가며 본다
const fake = { matches: true, addEventListener() {} };
globalThis.matchMedia = () => fake;
const M = await import('../src/app/motion.js');

test('움직임: 고른 적 없고 기기에서 동작 줄이기를 켰으면 끄기로 시작', () => {
  fake.matches = true;
  C.setPrefs({ motion: null });
  eq(M.level(), 'off');
  eq(M.on(), false);
  eq(M.ms(220), 0);
});

test('움직임: 고른 적 없고 동작 줄이기를 안 켰으면 보통', () => {
  fake.matches = false;
  C.setPrefs({ motion: null });
  eq(M.level(), 'normal');
  eq(M.ms(220), 220);
});

test('움직임: 직접 고르면 기기 설정보다 그 값을 따른다', () => {
  fake.matches = true;
  C.setPrefs({ motion: 'fast' });
  eq(M.level(), 'fast');
  eq(M.ms(200), 120);
  C.setPrefs({ motion: 'slow' });
  eq(M.ms(200), 290);
});

test('움직임: 끄기면 움직이지 않고 복사본도 만들지 않는다', () => {
  C.setPrefs({ motion: 'off' });
  const el = { animate: () => 'ran', cloneNode: () => ({}) };
  eq(M.play(el, [], 200), null);
  eq(M.capture(el), null);
  C.setPrefs({ motion: 'normal', motionView: false });
  eq(M.viewOn(), false, '화면 옮길 때만 끔');
  eq(M.play(el, [], 200), 'ran', '창·알림은 그대로 움직임');
  C.setPrefs({ motion: null, motionView: true });
});

test('움직임: 모르는 값이면 기본으로', () => {
  fake.matches = false;
  C.setPrefs({ motion: 'turbo' });
  eq(M.level(), 'normal');
  C.setPrefs({ motion: null });
});

// ── 베타 1.2: 유리 막대 렌즈 용수철 (체크리스트 Q) ──
const xOf = (f) => +/translateX\((-?[\d.]+)px\)/.exec(f.transform)[1];

test('렌즈 용수철: 출발 자리에서 시작해 도착 자리(0)에서 멈춘다', () => {
  const f = M.lensFrames(-120, 80);
  eq(xOf(f.bubble[0]), -120);
  eq(xOf(f.bubble[f.bubble.length - 1]), 0);
  eq(f.bubble[0].offset, 0);
  eq(f.bubble[f.bubble.length - 1].offset, 1);
  ok(f.bubble.every((k, i) => !i || k.offset > f.bubble[i - 1].offset), '시간 순서');
  eq(f.bubble[f.bubble.length - 1].opacity, 0, '방울은 내려앉아 사라짐');
  eq(f.lens[f.lens.length - 1].opacity, 1, '알약은 도착 자리에 다시 보임');
  ok(f.dur >= 350 && f.dur <= 900, `시간 ${f.dur}ms`);
});

test('렌즈 용수철: 같은 속도가 아니다 — 빠르게 출발해 천천히 멈춘다', () => {
  const f = M.lensFrames(-200, 80);
  const xs = f.bubble.map(xOf);
  const steps = xs.slice(1).map((x, i) => Math.abs(x - xs[i]));
  const fast = Math.max(...steps.slice(0, Math.ceil(steps.length / 3)));
  const late = Math.max(...steps.slice(-Math.ceil(steps.length / 4)));
  ok(fast > late * 4, `처음 ${fast.toFixed(1)}px/프레임, 끝 ${late.toFixed(1)}px/프레임`);
});

test('렌즈 용수철: 살짝 지나쳤다 돌아오되 많이 출렁이지 않는다', () => {
  const xs = M.lensFrames(-200, 80).bubble.map(xOf);
  const over = Math.max(...xs);
  ok(over > 0, '도착 자리를 조금 지나침');
  ok(over < 200 * 0.08, `지나친 거리 ${over.toFixed(1)}px (8% 안쪽)`);
});

test('렌즈 용수철: 움직이는 동안 진행 방향으로 늘어나고, 멈추면 원래 모양', () => {
  const f = M.lensFrames(-200, 80);
  const sx = f.bubble.map((k) => +/scale\(([\d.]+),/.exec(k.transform)[1]);
  ok(Math.max(...sx) > 1.16 + 0.05, '빠를 때 더 늘어남');
  eq(sx[sx.length - 1], 1);
});

test('렌즈 용수철: 손가락으로 밀다 놓으면(이미 떠 있음) 처음부터 떠 있다', () => {
  const f = M.lensFrames(30, 80, true);
  eq(f.bubble[0].opacity, 1);
  eq(f.lens[0].opacity, 0);
  eq(xOf(f.bubble[f.bubble.length - 1]), 0);
});
