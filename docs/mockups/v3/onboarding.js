// 처음 설정: 시험 → 과목 → 교재 → 시작. 공부 순서는 묻지 않고 기본값(개념→문제→개념→심화)으로.
import { html } from '../../../src/lib/html.js';
import { useState } from '../../../src/lib/ui.js';
import * as C from './core.js';
import { hue } from './kit.js';
import { BookEditor } from './progress.js';

const { D, UI, setUI, commit, today, addDays, diffDays, mdws } = C;

function guessExam() {
  const m = +today().slice(5, 7);
  if (m >= 3 && m <= 5) return '1학기 중간고사';
  if (m >= 6 && m <= 7) return '1학기 기말고사';
  if (m >= 8 && m <= 10) return '2학기 중간고사';
  return '2학기 기말고사';
}

function Card({ step, title, desc, children, foot }) {
  return html`<div class="ob"><div class="ob-card">
    <div class="ob-top">${step ? html`<span class="ob-step">${step}</span>` : null}<h2>${title}</h2>${desc ? html`<p>${desc}</p>` : null}</div>
    <div class="ob-body">${children}</div>
    <div class="ob-foot">${foot}</div>
  </div></div>`;
}

export function Onboarding() {
  const step = UI().ob || 0;
  const go = (n) => setUI({ ob: n });
  const data = D();
  const [picked, setPicked] = useState(() => new Set(data.subjects.length ? data.subjects.map((s) => s.name) : ['공통국어', '공통수학', '공통영어', '한국사', '통합사회', '통합과학']));
  const [custom, setCustom] = useState('');

  if (step === 0) {
    return html`<div class="ob"><div class="ob-hello">
      <div class="ob-demo hue" style=${hue(14)}>
        <div class="row"><span class="dot"></span><b>통합사회</b><span class="num" style="margin-left:auto;color:var(--sc);font-size:1.3em">47%</span></div>
        <div class="bar" style="height:14px"><span class="cell done" style="flex-grow:89;flex-basis:0"><i style="width:100%"></i></span><span class="cell doing cur" style="flex-grow:40;flex-basis:0"><i style="width:75%"></i></span><span class="cell todo" style="flex-grow:89;flex-basis:0"></span><span class="cell todo" style="flex-grow:36;flex-basis:0"></span></div>
      </div>
      <h1>회독 플래너</h1>
      <p>공부할 양을 날짜별로 나눠 주고, 체크하면 진도 칸이 저절로 채워지는 플래너예요.</p>
      <button class="btn pri block" style="min-height:52px" onClick=${() => {
        if (!data.exam) data.exam = { id: C.uid(), name: guessExam(), kind: 'mid', date: addDays(today(), 14), start: today() };
        commit();
        go(1);
      }}>시작하기</button>
      <button class="btn ghost block" style="margin-top:8px" onClick=${() => C.loadDemo()}>예시로 먼저 둘러보기</button>
    </div></div>`;
  }

  if (step === 1) {
    const ex = data.exam;
    return html`<${Card}
      step="1 / 3"
      title="다음 시험은 언제예요?"
      desc="시험 날짜를 알면 남은 날을 세고, 날마다 할 양을 나눠 드릴 수 있어요."
      foot=${html`<button class="btn" onClick=${() => go(0)}>이전</button><span class="sp"></span><button class="btn pri" onClick=${() => go(2)}>다음</button>`}
    >
      <span class="label">시험</span>
      <div class="chips">${['1학기 중간고사', '1학기 기말고사', '2학기 중간고사', '2학기 기말고사', '모의고사'].map((n) => html`<button key=${n} class="chip" aria-pressed=${ex.name === n ? 'true' : 'false'} onClick=${() => {
        ex.name = n;
        ex.kind = n.includes('모의') ? 'mock' : n.includes('기말') ? 'final' : 'mid';
        commit();
      }}>${n}</button>`)}</div>
      <span class="label">시험 첫날</span>
      <input class="input" type="date" style="max-width:220px" value=${ex.date} onChange=${(e) => {
        if (e.target.value > today()) {
          ex.date = e.target.value;
          commit();
        }
      }} />
      <p class="hint">${mdws(ex.date)} · ${diffDays(today(), ex.date)}일 남았어요</p>
    <//>`;
  }

  if (step === 2) {
    const toggle = (n) => {
      const x = new Set(picked);
      x.has(n) ? x.delete(n) : x.add(n);
      setPicked(x);
    };
    const all = [...new Set([...C.SUBJECT_PRESETS.map((p) => p.name), ...picked])];
    return html`<${Card}
      step="2 / 3"
      title="어떤 과목을 준비하나요?"
      desc="이번 시험 과목만 골라 주세요. 나중에 더 넣을 수 있어요."
      foot=${html`<button class="btn" onClick=${() => go(1)}>이전</button><span class="sp"></span><button class="btn pri" disabled=${!picked.size} onClick=${() => {
        const keep = data.subjects.filter((s) => picked.has(s.name));
        for (const n of picked) if (!keep.some((s) => s.name === n)) keep.push(C.newSubject(n));
        data.subjects = keep;
        for (const s of keep) {
          if (!s.books.length) {
            const pre = C.SUBJECT_PRESETS.find((p) => p.name === s.name);
            if (pre) s.books = pre.books.slice(0, 2).map((b) => C.newBook(b));
          }
        }
        commit();
        go(3);
      }}>${picked.size}과목으로 다음</button>`}
    >
      <div class="chips">${all.map((n) => {
        const pre = C.SUBJECT_PRESETS.find((p) => p.name === n);
        return html`<button key=${n} class="chip hue" style=${hue(pre ? pre.h : 182)} aria-pressed=${picked.has(n) ? 'true' : 'false'} onClick=${() => toggle(n)}><span class="dot"></span>${n}</button>`;
      })}</div>
      <form class="row" style="margin-top:14px" onSubmit=${(e) => {
        e.preventDefault();
        if (custom.trim()) {
          setPicked(new Set([...picked, custom.trim()]));
          setCustom('');
        }
      }}><input class="input" placeholder="목록에 없는 과목" value=${custom} onInput=${(e) => setCustom(e.target.value)} aria-label="과목 이름" /><button class="btn" type="submit" disabled=${!custom.trim()}>추가</button></form>
    <//>`;
  }

  if (step === 3) {
    return html`<${Card}
      step="3 / 3"
      title="과목마다 쓰는 교재"
      desc="자주 쓰는 교재를 미리 넣어 두었어요. 시험 범위 쪽수만 맞추고, 안 쓰는 건 빼 주세요."
      foot=${html`<button class="btn" onClick=${() => go(2)}>이전</button><span class="sp"></span><button class="btn pri" onClick=${() => {
        for (const s of data.subjects) if (s.books.length && !s.stages.length) s.stages = C.buildStages(s.books, 'mine');
        commit();
        go(4);
      }}>다음</button>`}
    >
      ${data.subjects.map((s) => html`<div class="bookcard hue" key=${s.id} style=${hue(s.h)}>
        <div class="hd"><span class="dot"></span>${s.name}<small>${s.books.length ? `${s.books.length}권` : '나중에 넣어도 돼요'}</small></div>
        <${BookEditor} sub=${s} compact />
      </div>`)}
    <//>`;
  }

  // step 4: 시작
  const ready = data.subjects.filter((s) => s.stages.length);
  const { tasks, days } = C.previewPlan(today());
  const total = tasks.reduce((a, t) => a + (t.to - t.from + 1), 0);
  const finish = (plan) => {
    for (const s of data.subjects) if (s.books.length && !s.stages.length) s.stages = C.buildStages(s.books, 'mine');
    if (plan) C.planAll(today());
    data.onboarded = true;
    commit();
    setUI({ ob: 0, tab: 'today', day: null });
    if (plan) C.toast(`${days.length}일치 할 일을 넣었어요. 오늘 것부터 체크해 보세요`);
  };
  return html`<${Card}
    title="이렇게 나눠서 시작할게요"
    desc=${`${ready.length}과목의 남은 분량을 ${days.length ? mdws(days[days.length - 1].d) : ''}까지 날마다 나눠요.`}
    foot=${html`<button class="btn" onClick=${() => go(3)}>이전</button><span class="sp"></span><button class="btn" onClick=${() => finish(false)}>나누지 않고 시작</button><button class="btn pri" disabled=${!tasks.length} onClick=${() => finish(true)}>나눠서 시작</button>`}
  >
    <div class="plan-sum">
      <div><small>전체 분량</small><b class="num">${total}</b>쪽</div>
      <div><small>나눌 날</small><b class="num">${days.length}</b>일</div>
      <div><small>하루 평균</small><b class="num">${days.length ? Math.round(total / days.length) : 0}</b>쪽</div>
    </div>
    ${data.subjects.map((s) => html`<div class="kv hue" key=${s.id} style=${hue(s.h)}><span class="k row"><span class="dot"></span>${s.name}</span><span class="v">${s.stages.length ? `${s.stages.length}단계 · ${C.tot(s)}쪽` : html`<span class="muted">교재 없음 — 나중에</span>`}</span></div>`)}
    <p class="hint">공부 순서는 <b>개념 → 문제 → 개념 → 심화</b>로 시작해요. 과목마다 나중에 바꿀 수 있어요.</p>
  <//>`;
}
