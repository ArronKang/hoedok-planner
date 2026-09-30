// 앱 계산·동작 테스트 (src/app/core.js). 예시 자료(loadDemo) 위에서 확인한다.
import { test, eq, ok } from './harness.js';
import * as C from '../src/app/core.js';

const T = () => C.today();
const remainingEqualsPlanned = () => {
  const bad = [];
  for (const s of C.D().subjects) {
    const rem = C.tot(s) - C.dn(s);
    const pl = C.D().tasks.filter((t) => t.kind === 'track' && t.subjectId === s.id && t.status === 'todo' && !t.hist && t.date >= T()).reduce((a, t) => a + C.taskPages(t), 0);
    if (rem !== pl) bad.push(`${s.name} 남은 ${rem} / 나눔 ${pl}`);
  }
  return bad;
};

test('앱: 날짜별로 나눈 합계 = 과목마다 남은 분량', () => {
  C.loadDemo();
  eq(remainingEqualsPlanned(), []);
});

test('앱: 마지막 날은 시험 전날', () => {
  C.loadDemo();
  const ex = C.D().exam;
  ok(C.D().tasks.filter((t) => t.kind === 'track' && !t.hist).every((t) => t.date < ex.date));
});

test('앱: 그날만 쉬면 그날엔 안 넣고, 합계는 그대로', () => {
  C.loadDemo();
  const d = C.addDays(T(), 3);
  C.setDayCap(d, 0);
  C.planAll(T());
  ok(!C.D().tasks.some((t) => t.date === d && t.kind === 'track' && !t.hist && !t.manual && t.status === 'todo'));
  eq(remainingEqualsPlanned(), []);
  C.setDayCap(d, null);
  ok(!C.isDayChanged(d));
});

test('앱: 쉬는 요일이어도 그날만 공부할 수 있다', () => {
  C.loadDemo();
  const d = C.addDays(T(), 5);
  C.setPrefs({ rest: [C.weekday(d)] });
  eq(C.capacity(d), 0);
  C.setDayCap(d, 120);
  eq(C.capacity(d), 120);
  ok(C.studyDays(T(), C.addDays(T(), 7)).some((x) => x.d === d));
  C.setPrefs({ rest: [], dayMin: {} });
});

test('앱: 체크하면 진도가 오르고, 풀면 돌아간다', () => {
  C.loadDemo();
  const t = C.tasksOn(T()).find((x) => x.kind === 'track' && !C.isPsg(C.subById(x.subjectId)));
  const sub = C.subById(t.subjectId);
  const before = C.dn(sub);
  C.toggleTask(t.id);
  eq(C.dn(sub), before + C.taskPages(t));
  eq(t.status, 'done');
  C.toggleTask(t.id);
  eq(C.dn(sub), before);
  eq(t.status, 'todo');
});

test('앱: 지문별 — 건너뛴 번호는 한 할 일로 (지문 4, 7)', () => {
  C.loadDemo();
  const eng = C.D().subjects.find((s) => s.name === '공통영어');
  const t = C.D().tasks.find((x) => x.subjectId === eng.id && x.date === T() && x.kind === 'track');
  eq(C.trng(t), '지문 4, 7');
  eq(C.taskPages(t), 2);
  const st = C.taskStage(t);
  C.partialTask(t.id, 4, 'tomorrow');
  ok(C.isMarked(st, 4) && !C.isMarked(st, 7));
  const rest = C.D().tasks.find((x) => x.subjectId === eng.id && x.date === C.addDays(T(), 1) && x.from === 7 && (x.moves || []).length);
  ok(rest, '남은 지문 7이 내일로');
  eq(C.trng(rest), '지문 7');
});

test('앱: 격자 칸을 다 채우면 그 할 일도 끝', () => {
  C.loadDemo();
  const eng = C.D().subjects.find((s) => s.name === '공통영어');
  const st = eng.stages[1];
  const t = C.D().tasks.filter((x) => x.stageId === st.id && x.status === 'todo' && !x.hist).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  for (const u of C.unitsOf(t)) if (!C.isMarked(st, u)) C.toggleCell(eng, st, u);
  eq(t.status, 'done');
});

test('앱: 여러 번 하는 일은 누를 때마다 하나씩', () => {
  C.loadDemo();
  const w = C.D().tasks.find((t) => t.title === '영단어 Day 12 외우기');
  C.toggleTask(w.id);
  eq([w.repDone, w.status], [2, 'todo']);
  C.toggleTask(w.id);
  eq(w.status, 'done');
  C.toggleTask(w.id);
  eq([w.repDone, w.status], [2, 'todo']);
});

test('앱: 마감순·시간순 정렬', () => {
  C.loadDemo();
  const list = C.tasksOn(T());
  ok(C.sortTasks(list, 'due')[0].due);
  eq(C.sortTasks(list, 'time')[0].at, '07:40');
});

test('앱: 시험 정리 → 기록 고정, 점수는 1차 지필로, 남은 진도 할 일은 치움', () => {
  C.loadDemo();
  const soc = C.D().subjects.find((s) => s.name === '통합사회');
  const pct = C.pct(soc);
  const exId = C.D().exam.id;
  C.D().exam.date = T();
  C.closeExam({ scores: { [soc.id]: { score: 95, avg: 70.5, rank: 9, enrolled: 240 } } });
  const past = C.D().pastExams.find((e) => e.id === exId);
  ok(past && past.study['통합사회'].progress === pct);
  const rec = C.findRecord(C.D().semesters.find((s) => s.id === past.semester), soc);
  eq([rec.elements[0].score, rec.elements[0].avg], [95, 70.5]);
  eq(past.ranks['통합사회'], [9, 240]);
  eq(C.D().tasks.filter((t) => t.kind === 'track' && t.status === 'todo' && t.date >= T()).length, 0);
  ok(C.overdue().every((t) => t.kind === 'free'), '지난 진도 할 일은 알림에서 빠짐');
  eq(C.D().exam, null);
  eq(C.remainingWeight(soc).rem, 40, '1차 30%가 나와서 70 → 40 (시험이 없으면 가장 최근 학기 기준)');
});

test('앱: 다음 시험 — 이름 짐작, 범위는 지난 범위 다음 쪽부터, 단계 구성은 그대로', () => {
  C.loadDemo();
  const soc = C.D().subjects.find((s) => s.name === '통합사회');
  const ids = soc.stages.map((s) => s.id).join();
  const b = soc.books[0], oldTo = b.to, len = b.to - b.from + 1;
  C.D().exam.date = T();
  C.closeExam();
  const g = C.nextGuess();
  eq(g.name, '2학기 기말고사');
  C.shiftScopes();
  eq([b.from, b.to], [oldTo + 1, oldTo + len]);
  C.startNext(g);
  eq(soc.stages.map((s) => s.id).join(), ids);
  eq(C.pct(soc), 0);
  C.planAll(T());
  eq(remainingEqualsPlanned(), []);
});

test('앱: 끝낼 날은 그날까지 나누고, 성적에는 안 남는다', () => {
  C.loadDemo();
  C.D().exam.date = T();
  C.closeExam();
  const d = C.addDays(T(), 20);
  C.startNext({ name: '겨울방학', kind: 'goal', date: d });
  C.planAll(T());
  eq(C.endWord(), '끝낼 날');
  const last = C.D().tasks.filter((t) => t.kind === 'track' && !t.hist).map((t) => t.date).sort().pop();
  ok(last <= d);
  const n = C.D().pastExams.length;
  C.closeExam();
  eq(C.D().pastExams.length, n);
});

test('앱: 다른 기기에서 끝낸 할 일은 진도 칸에도 채운다', () => {
  C.loadDemo();
  const t = C.tasksOn(T()).find((x) => x.kind === 'track' && !C.isPsg(C.subById(x.subjectId)));
  const st = C.taskStage(t);
  const before = st.upto;
  t.status = 'done'; // 다른 기기에서 온 할 일 기록 (과목 기록은 옛것)
  eq(C.reconcile(new Set([t.id])), 1);
  eq(st.upto, Math.max(before ?? 0, t.to));
  eq(C.reconcile(new Set([t.id])), 0, '두 번째는 바꿀 것 없음');
});

test('앱: 파일로 내보내고 불러오기', () => {
  C.loadDemo();
  const n = C.D().tasks.length;
  const info = C.readBackup(JSON.stringify(C.backupObject()));
  eq(info.counts.subjects, 6);
  C.resetAll();
  eq(C.D().subjects.length, 0);
  C.applyBackup(info.obj);
  eq([C.D().subjects.length, C.D().tasks.length, C.D().onboarded], [6, n, true]);
  let err = null;
  try {
    C.readBackup('{"app":"x"}');
  } catch (e) {
    err = e.message;
  }
  ok(err, '다른 파일은 거절');
});

test('앱: 내신 흐름과 틀린 이유', () => {
  C.loadDemo();
  const s = C.naesinSeries('통합사회');
  eq(s.map((p) => [p.label, p.v, p.avg]), [['1-1 1차', 92.4, 68.5], ['1-1 2차', 89.7, 69.1]]);
  const fin = C.D().pastExams.find((e) => e.id === 'ex-final1');
  eq(C.wrongText(fin.wrong['공통국어']), '개념 1 · 실수 1 · 안 한 범위 3');
  const m9 = C.D().pastExams.find((e) => e.id === 'ex-m9');
  eq(C.wrongText(m9.wrong['공통수학']), '실수 1 · 시간 부족 2 · 처음 보는 유형 1');
});

test('앱: 아직 점수가 안 나온 비중 (통합사회 70%)', () => {
  C.loadDemo();
  const soc = C.D().subjects.find((s) => s.name === '통합사회');
  eq(C.remainingWeight(soc).rem, 70);
});
