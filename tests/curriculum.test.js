// 학년별 과목·교과서 단원 (src/app/curriculum.js) · 테마 바꿔 읽기 (베타 2.0)
import { test, eq, ok } from './harness.js';
import * as C from '../src/app/core.js';
import * as K from '../src/app/curriculum.js';

test('교육과정: 고1 2학기는 공통과목 …2, 과학탐구실험은 골라 넣는 과목', () => {
  const r = K.recommend(1, 2);
  eq(r.map((x) => x.book).slice(0, 6), ['공통국어2', '공통수학2', '공통영어2', '한국사2', '통합사회2', '통합과학2']);
  ok(r.find((x) => x.name === '과학탐구실험').optional);
  ok(r.filter((x) => !x.optional).length === 6);
});

test('교육과정: 고2·3은 2022 개정 일반선택 과목에서 고른다 (모두 골라 넣는 과목)', () => {
  const r = K.recommend(2, 1);
  ok(r.some((x) => x.name === '대수') && r.some((x) => x.name === '물리학'));
  ok(r.every((x) => x.optional));
});

test('교과서 단원: 확인한 출판사는 목차 그대로, 모르면 교육과정 큰 단원, 그것도 없으면 1단원…', () => {
  const ne = K.units('공통영어', 2, 'ne-mbc');
  eq(ne.verified, true);
  eq(ne.labels.length, 4);
  ok(ne.labels[0].includes('Bonding'));
  const math = K.units('공통수학', 2, 'mirae');
  eq(math.verified, 'curriculum');
  eq(math.labels[0], '평면좌표');
  const kor = K.units('공통국어', 2, 'mirae');
  eq(kor.verified, false);
  eq(kor.labels[0], '1단원');
});

test('교과서 단원: 출판사 목록 끝에는 늘 "모름 · 다른 교과서"', () => {
  for (const s of ['공통국어', '공통수학', '공통영어', '한국사', '통합사회', '통합과학']) {
    const p = K.publishers(s);
    eq(p[p.length - 1][0], 'other');
    ok(p.length >= 5, s);
  }
});

test('시험 범위 짐작: 중간고사 앞 절반 · 기말고사 뒤 절반 · 모의고사 전부', () => {
  eq(K.scopeGuess(8, 'mid'), [1, 4]);
  eq(K.scopeGuess(8, 'final'), [5, 8]);
  eq(K.scopeGuess(5, 'mid'), [1, 3]);
  eq(K.scopeGuess(5, 'final'), [4, 5]);
  eq(K.scopeGuess(4, 'mock'), [1, 4]);
  eq(K.scopeGuess(1, 'final'), [1, 1]);
});

test('과목 만들기: 교과서는 단원 칸 교재, 범위만큼 단계가 생기고 나눌 수 있다', () => {
  C.store.set((s) => ({ ...s, data: { ...C.blank().data, onboarded: true, exam: { id: 'x', name: '2학기 중간고사', kind: 'mid', date: C.addDays(C.today(), 14), start: C.today() } } }));
  const s = K.makeSubject({ name: '통합사회', h: 14, pub: 'bisang', from: 1, to: 8 }, 2);
  const b = s.books[0];
  eq(b.unit, 'ch');
  eq(b.labels.length, 16);
  eq([b.from, b.to], [1, 8]);
  eq(b.pub, '비상교육 (이영호)');
  ok(s.stages.length >= 2);
  ok(s.stages.every((st) => st.from === 1 && st.to === 8 && Array.isArray(st.marks)));
  C.D().subjects.push(s);
  C.planAll(C.today());
  const tasks = C.D().tasks.filter((t) => t.subjectId === s.id);
  eq(tasks.reduce((a, t) => a + C.taskPages(t), 0), 16, '두 번 보기 × 8단원');
  ok(tasks.every((t) => t.date < C.D().exam.date));
});

test('과목 만들기: 범위가 단원 수를 넘거나 거꾸로면 맞춘다', () => {
  const s = K.makeSubject({ name: '한국사', h: 36, pub: 'other', from: 5, to: 9 }, 2);
  const b = s.books[0];
  ok(b.from >= 1 && b.to <= b.labels.length && b.from <= b.to, `${b.from}–${b.to} / ${b.labels.length}`);
});

test('테마: 예전 테마·강조 색은 가까운 새 테마로, 예전 속도는 켜기로, 글꼴은 하나로', () => {
  eq(C.migratePrefs({ theme: 'paper', accent: 'theme' }).theme, 'warm');
  eq(C.migratePrefs({ theme: 'crisp', accent: 'theme' }).theme, 'ink');
  eq(C.migratePrefs({ theme: 'soft', accent: 'theme' }).theme, 'base');
  eq(C.migratePrefs({ theme: 'soft', accent: 'purple' }).theme, 'lavender');
  eq(C.migratePrefs({ theme: 'ocean' }).theme, 'ocean');
  eq(C.migratePrefs({ motion: 'slow' }).motion, 'normal');
  eq(C.migratePrefs({ motion: 'off' }).motion, 'off');
  eq(C.migratePrefs({ font: 'gaegu' }).font, 'pretendard');
});

test('설정 동기화: 화면 설정 중 기기마다 다른 것(태블릿 칸·마지막 탭)은 계정으로 맞추지 않는다', () => {
  ok(C.LOOK_PREFS.includes('theme') && C.LOOK_PREFS.includes('size') && C.LOOK_PREFS.includes('mode'));
  ok(!C.LOOK_PREFS.includes('padAside') && !C.LOOK_PREFS.includes('lastTab') && !C.LOOK_PREFS.includes('listWidth'));
});
