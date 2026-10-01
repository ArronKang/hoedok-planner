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
