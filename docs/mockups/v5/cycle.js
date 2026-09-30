// 시험이 끝난 뒤: 결과 적기 → (기록 고정) → 다음 시험 정하기 → 범위 쪽수만 확인 → 나눠서 시작
// 한 학기 내내 쓰려면 이 흐름이 끊기지 않아야 한다. 입력은 점수와 쪽수뿐, 나머지는 지난 것을 가져온다.
import { html } from '../../../src/lib/html.js';
import { useState, useRef } from '../../../src/lib/ui.js';
import * as C from './core.js';
import { Sheet, hue } from './kit.js';
import { BookEditor } from './progress.js';
import { MockTable } from './grades.js';

const { D, today, closeSheet, commit, withUndo, toast, addDays, diffDays, mdws, setUI } = C;

function Steps({ n, of }) {
  return html`<div class="steps" aria-label=${`${of}단계 중 ${n}단계`}>${Array.from({ length: of }, (_, i) => html`<i key=${i} class=${i < n ? 'on' : ''}></i>`)}</div>`;
}

export function CycleSheet({ step: first }) {
  const ex0 = D().exam;
  const [step, setStep] = useState(first || (ex0 ? (C.isGoal(ex0) ? 'close' : 'result') : 'next'));
  // 적은 점수는 화면을 다시 그리지 않고 바로 기억한다 (마지막 칸을 적고 곧바로 저장을 눌러도 빠지지 않게)
  const vals = useRef({}).current;
  const mockVals = useRef({}).current;
  const [more, setMore] = useState(false);
  const [next, setNext] = useState(() => C.nextGuess());
  const [goalName, setGoalName] = useState('');
  const ex = D().exam;
  // 시험을 정리하면서 시작했는지는 처음 열 때 정해 둔다 (정리 뒤에는 시험이 사라지므로)
  const [hadExam] = useState(() => !first && !!ex0);
  const total = hadExam ? 4 : 3;
  const idx = { result: 1, close: 1, next: hadExam ? 2 : 1, scope: hadExam ? 3 : 2, start: hadExam ? 4 : 3 }[step];

  // ── 1. 결과 적기 (시험) ──
  if (step === 'result' && ex) {
    const mock = ex.kind === 'mock';
    const num = (v) => (v === '' || isNaN(Number(v)) ? null : Number(v));
    const set = (id, k, v) => (vals[id] = { ...(vals[id] || {}), [k]: num(v) });
    const setMock = (n, i, v) => (mockVals[n] = Object.assign([null, null, null], mockVals[n] || [], { [i]: num(v) }));
    const close = (withScores) => {
      const mockOut = {};
      if (withScores) for (const [n, v] of Object.entries(mockVals)) if (v && v[2]) mockOut[n] = v;
      withUndo(`${ex.name} 기록을 남겼어요`, () => C.closeExam(withScores ? { scores: vals, mock: mockOut } : {}));
      setNext(C.nextGuess()); // 방금 끝낸 시험을 보고 다음을 짐작
      setStep('next');
    };
    return html`<${Sheet} title=${`${ex.name} 결과`} tall footer=${html`<button class="btn" onClick=${() => close(false)}>점수는 나중에</button><button class="btn pri" onClick=${() => close(true)}>저장하고 다음</button>`}>
      <${Steps} n=${idx} of=${total} />
      <p class="sub" style="margin:0 0 14px">${mock ? '과목마다 원점수·백분위·등급을 적어 주세요.' : '과목마다 받은 점수를 적어 주세요. 과목 성적 계산에도 바로 들어가요.'} 모르는 건 비워 두고 나중에 성적 탭에서 적어도 돼요.</p>
      ${mock
        ? html`<${MockTable} names=${D().subjects.map((s) => s.name)} set=${setMock} />`
        : html`
          <div class="scoregrid" style=${{ gridTemplateColumns: more ? 'minmax(72px,1fr) repeat(4, minmax(0, 60px))' : 'minmax(0,1fr) 88px' }}>
            <span class="h">과목</span><span class="h c">점수</span>
            ${more ? html`<span class="h c">과목평균</span><span class="h c">석차</span><span class="h c">수강자</span>` : null}
            ${D().subjects.map((s) => [
              html`<span class="sn hue" key=${s.id + 'n'} style=${hue(s.h)}><span class="dot"></span><span class="ell">${more ? s.name.replace('공통', '') : s.name}</span></span>`,
              html`<input key=${s.id + 's'} class="input pg" inputmode="decimal" aria-label=${s.name + ' 점수'} onChange=${(e) => set(s.id, 'score', e.target.value)} />`,
              ...(more
                ? [
                    html`<input key=${s.id + 'a'} class="input pg" inputmode="decimal" aria-label=${s.name + ' 과목평균'} onChange=${(e) => set(s.id, 'avg', e.target.value)} />`,
                    html`<input key=${s.id + 'r'} class="input pg" inputmode="numeric" aria-label=${s.name + ' 석차'} onChange=${(e) => set(s.id, 'rank', e.target.value)} />`,
                    html`<input key=${s.id + 'e'} class="input pg" inputmode="numeric" aria-label=${s.name + ' 수강자 수'} onChange=${(e) => set(s.id, 'enrolled', e.target.value)} />`,
                  ]
                : []),
            ])}
          </div>
          <button class="more-toggle" onClick=${() => setMore(!more)} aria-expanded=${more ? 'true' : 'false'}>과목평균·석차도 적기<span class="caret">${more ? '▴' : '▾'}</span></button>`}
      <p class="hint">저장하면 이번 시험을 위해 공부한 기록(진도, 계획 중 끝낸 비율, 미룬 횟수)이 이 시험에 묶여서 성적 탭에 남아요. 남은 진도 할 일은 오늘 화면에서 치워요.</p>
    <//>`;
  }

  // ── 1. 끝낼 날 정리 ──
  if (step === 'close' && ex) {
    return html`<${Sheet} title=${`${ex.name} 정리`} footer=${html`<button class="btn" onClick=${closeSheet}>아직 아니에요</button><button class="btn pri" onClick=${() => {
      withUndo(`${ex.name} 정리했어요`, () => C.closeExam());
      setNext(C.nextGuess());
      setStep('next');
    }}>정리하고 다음</button>`}>
      <${Steps} n=${idx} of=${total} />
      <p class="sub" style="margin:0">남은 진도 할 일은 오늘 화면에서 치우고, 진도 기록은 그대로 둬요.</p>
    <//>`;
  }

  // ── 2. 다음은 무엇? ──
  if (step === 'next' || ((step === 'result' || step === 'close') && !ex)) {
    const goal = next.kind === 'goal';
    const names = [...new Set([next.kind !== 'goal' ? next.name : C.nextGuess().name, ...C.EXAM_NAMES])];
    const pickName = (n) => setNext({ ...next, name: n, kind: C.kindOfName(n) });
    const ok = next.date > today() && (!goal || goalName.trim());
    const hasBooks = D().subjects.some((s) => s.books.length);
    return html`<${Sheet} title="다음 준비" tall footer=${html`<button class="btn" onClick=${closeSheet}>나중에 정하기</button><button class="btn pri" disabled=${!ok} onClick=${() => {
      const n = goal ? { ...next, name: goalName.trim() } : next;
      setNext(n);
      if (hasBooks) {
        C.shiftScopes();
        commit();
        setStep('scope');
      } else {
        C.startNext(n);
        commit();
        setStep('start');
      }
    }}>다음</button>`}>
      <${Steps} n=${idx} of=${total} />
      <h3 class="q">다음은 무엇을 준비하나요?</h3>
      <div class="chips">
        ${names.map((n) => html`<button key=${n} class="chip" aria-pressed=${!goal && next.name === n ? 'true' : 'false'} onClick=${() => pickName(n)}>${n}</button>`)}
        <button class="chip" aria-pressed=${goal ? 'true' : 'false'} onClick=${() => setNext({ ...next, kind: 'goal' })}>시험 없이 끝낼 날만</button>
      </div>
      ${goal
        ? html`<span class="label">무엇을 끝낼 기간인가요</span>
            <input class="input" value=${goalName} placeholder="예: 겨울방학 개념 한 바퀴" onInput=${(e) => setGoalName(e.target.value)} aria-label="기간 이름" />`
        : null}
      <span class="label">${goal ? '끝낼 날' : '시험 첫날'}</span>
      <input class="input" type="date" style="max-width:220px" value=${next.date} onChange=${(e) => e.target.value && setNext({ ...next, date: e.target.value })} aria-label=${goal ? '끝낼 날' : '시험 첫날'} />
      <p class="hint">${next.date > today() ? `${mdws(next.date)} · ${diffDays(today(), next.date)}일 남았어요` : '오늘 뒤의 날짜를 골라 주세요'}</p>
      <p class="hint">시험이 없는 방학이나 평소에는 '끝낼 날만'을 고르면 그날까지 나눠 드려요. 성적 비교만 없어요.</p>
    <//>`;
  }

  // ── 3. 범위 ──
  if (step === 'scope') {
    return html`<${Sheet} title="이번 범위" tall footer=${html`<button class="btn" onClick=${() => setStep('next')}>이전</button><button class="btn pri" onClick=${() => {
      C.startNext(next);
      commit();
      setStep('start');
    }}>다음</button>`}>
      <${Steps} n=${idx} of=${total} />
      <p class="sub" style="margin:0 0 14px">지난 범위 바로 다음 쪽부터 같은 길이로 넣어 두었어요. 쪽수만 맞춰 주세요. 공부 순서와 단계 이름은 지난번 그대로 가져가요.</p>
      ${D().subjects.filter((s) => s.books.length).map((s) => html`<div class="bookcard hue" key=${s.id} style=${hue(s.h)}>
        <div class="hd"><span class="dot"></span>${s.name}<small>${s.stages.length}단계 · ${C.isPsg(s) ? '지문으로 세기' : '쪽으로 세기'}</small></div>
        <${BookEditor} sub=${s} compact lean />
      </div>`)}
      <p class="hint">교재를 더 넣으려면 시작한 뒤 진도 › 과목 › … › 교재와 단계 고치기에서 할 수 있어요.</p>
    <//>`;
  }

  // ── 4. 시작 ──
  const cur = D().exam;
  const { tasks, days } = cur ? C.previewPlan(today()) : { tasks: [], days: [] };
  const sum = C.mix(tasks.map((t) => [C.subById(t.subjectId), C.taskPages(t)]));
  const finish = (plan) => {
    if (plan) C.planAll(today());
    commit();
    setUI({ sheet: null, tab: 'today', day: null });
    toast(plan ? `${days.length}일치 할 일을 넣었어요` : `${cur ? cur.name : '다음 시험'} 준비를 시작해요`);
  };
  return html`<${Sheet} title=${cur ? cur.name : '시작'} tall footer=${html`<button class="btn" onClick=${() => finish(false)}>나누지 않고 시작</button><button class="btn pri" disabled=${!tasks.length} onClick=${() => finish(true)}>나눠서 시작</button>`}>
    <${Steps} n=${idx} of=${total} />
    <p class="sub" style="margin:0 0 14px">${cur ? `남은 분량을 ${mdws(C.lastPlanDay(cur))}까지 날마다 나눠요.` : ''}</p>
    <div class="plan-sum">
      <div><small>전체 분량</small><b class="num">${sum.p || sum.q}</b>${sum.p || !sum.q ? '쪽' : '지문'}${sum.p && sum.q ? html`<small>+ ${sum.q}지문</small>` : null}</div>
      <div><small>나눌 날</small><b class="num">${days.length}</b>일</div>
      <div><small>과목</small><b class="num">${D().subjects.filter((s) => s.stages.length).length}</b>개</div>
    </div>
    ${D().subjects.map((s) => html`<div class="kv hue" key=${s.id} style=${hue(s.h)}><span class="k row"><span class="dot"></span>${s.name}</span><span class="v">${s.stages.length ? `${s.stages.length}단계 · ${C.amount(s, C.tot(s))}` : html`<span class="muted">교재 없음</span>`}</span></div>`)}
  <//>`;
}
