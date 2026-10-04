// 처음 설정: 시험 → 과목 → 교재 → 시작. 공부 순서는 묻지 않고 기본값(개념→문제→개념→심화)으로.
import { html } from '../lib/html.js';
import { useState, useStore } from '../lib/ui.js';
import * as C from './core.js';
import { hue, DateField } from './kit.js';
import { BookEditor } from './progress.js';
import { syncState } from '../sync/state.js';
import { installable, openInstall, platform } from './pwa.js';

const { D, UI, setUI, commit, today, addDays, diffDays, mdws } = C;

function guessExam() {
  const m = +today().slice(5, 7);
  if (m >= 3 && m <= 5) return '1학기 중간고사';
  if (m >= 6 && m <= 7) return '1학기 기말고사';
  if (m >= 8 && m <= 10) return '2학기 중간고사';
  return '2학기 기말고사';
}

function Card({ step, title, desc, children, foot }) {
  // 단계가 바뀌면 새 카드가 부드럽게 나타난다
  return html`<div class="ob"><div class="ob-card appear" key=${title}>
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
  const sync = useStore(syncState);

  if (step === 0) {
    const me = platform();
    const install = installable() && me !== 'desktop';
    // 로그인한 상태면 예시는 숨긴다 (예시가 계정에 섞일 길을 아예 없앰)
    const signed = !!sync.user;
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
      ${signed
        ? html`<p class="ob-signed">로그인됨 · ${sync.user.email}${sync.first ? html`<br />계정 기록을 받아 오는 중…` : ''}</p>`
        : html`<button class="btn ghost block" style="margin-top:8px" onClick=${() => C.loadDemo()}>예시로 먼저 둘러보기</button>
            <button class="btn ghost block" style="margin-top:2px" onClick=${() => C.openSheet({ type: 'settings', page: 'account', from: 'ob' })}>다른 기기에서 쓰던 기록이 있어요</button>`}
      ${install
        ? html`<div class="ob-install">
            ${me === 'ios' ? html`<p>아이폰은 먼저 <b>홈 화면에 추가</b>하고, 그 아이콘으로 열어서 시작하세요. Safari와 아이콘 앱은 기록이 따로예요.</p>` : html`<p>홈 화면에 추가하면 아이콘을 눌러 앱처럼 열려요.</p>`}
            <button class="link" onClick=${openInstall}>홈 화면에 추가하는 법</button>
          </div>`
        : null}
    </div></div>`;
  }

  if (step === 1) {
    const ex = data.exam;
    const goal = C.isGoal(ex);
    return html`<${Card}
      step="1 / 3"
      title="다음 시험은 언제예요?"
      desc="날짜를 알면 남은 날을 세고, 날마다 할 양을 나눠 드릴 수 있어요."
      foot=${html`<button class="btn" onClick=${() => go(0)}>이전</button><span class="sp"></span><button class="btn pri" disabled=${goal && !ex.name.trim()} onClick=${() => go(2)}>다음</button>`}
    >
      <span class="label">시험</span>
      <div class="chips">
        ${C.EXAM_NAMES.map((n) => html`<button key=${n} class="chip" aria-pressed=${!goal && ex.name === n ? 'true' : 'false'} onClick=${() => {
          ex.name = n;
          ex.kind = C.kindOfName(n);
          commit();
        }}>${n}</button>`)}
        <button class="chip" aria-pressed=${goal ? 'true' : 'false'} onClick=${() => {
          ex.kind = 'goal';
          ex.name = '';
          commit();
        }}>시험 없이 끝낼 날만</button>
      </div>
      ${goal
        ? html`<span class="label">무엇을 끝낼 기간인가요</span>
            <input class="input" key="goalname" defaultValue=${ex.name} placeholder="예: 겨울방학 개념 한 바퀴" onInput=${(e) => {
              ex.name = e.target.value;
              commit();
            }} aria-label="기간 이름" />`
        : null}
      <span class="label">${goal ? '끝낼 날' : '시험 첫날'}</span>
      <${DateField} style="max-width:220px" value=${ex.date} min=${addDays(today(), 1)} why="오늘 뒤의 날짜를 골라 주세요" label=${goal ? '끝낼 날' : '시험 첫날'} onCommit=${(v) => {
        ex.date = v;
        commit();
      }} />
      <p class="hint">${mdws(ex.date)} · ${diffDays(today(), ex.date)}일 남았어요</p>
      ${goal ? html`<p class="hint">방학이나 평소처럼 시험이 없을 때예요. 그날까지 나눠 드리고, 성적 비교만 없어요.</p>` : null}
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
      desc=${C.isGoal(data.exam) ? '이번에 공부할 과목만 골라 주세요. 나중에 더 넣을 수 있어요.' : '이번 시험 과목만 골라 주세요. 나중에 더 넣을 수 있어요.'}
      foot=${html`<button class="btn" onClick=${() => go(1)}>이전</button><span class="sp"></span><button class="btn pri" disabled=${!picked.size} onClick=${() => {
        const keep = data.subjects.filter((s) => picked.has(s.name));
        for (const n of picked) if (!keep.some((s) => s.name === n)) keep.push(C.newSubject(n));
        data.subjects = keep;
        for (const s of keep) {
          if (!s.books.length) {
            const pre = C.SUBJECT_PRESETS.find((p) => p.name === s.name);
            if (pre) s.books = pre.books.slice(0, 2).map((b) => C.presetBook(s.name, b));
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
      desc=${`${C.isGoal(data.exam) ? '공부할' : '시험'} 범위만 맞추고, 안 쓰는 건 빼 주세요. 지문·문제·단원(1-1, 1-2…)으로 세는 교재는 '쪽'을 눌러 바꿔요.`}
      foot=${html`<button class="btn" onClick=${() => go(2)}>이전</button><span class="sp"></span><button class="btn pri" onClick=${() => {
        for (const s of data.subjects) if (s.books.length && !s.stages.length) s.stages = C.stagesFor(s, 'mine');
        commit();
        go(4);
      }}>다음</button>`}
    >
      ${data.subjects.map((s) => html`<div class="bookcard hue" key=${s.id} style=${hue(s.h)}>
        <div class="hd"><span class="dot"></span>${s.name}<small>${s.books.length ? `${s.books.length}권` : '나중에 넣어도 돼요'}</small></div>
        <${BookEditor} sub=${s} compact back=${null} />
      </div>`)}
    <//>`;
  }

  // step 4: 시작
  const ready = data.subjects.filter((s) => s.stages.length);
  const { tasks, days } = C.previewPlan(today());
  const total = C.taskTally(tasks);
  const tu = C.UNITS.filter((u) => total[u.id]);
  const mins = tasks.reduce((a, t) => a + C.taskMinutes(t), 0);
  const finish = (plan) => {
    for (const s of data.subjects) if (s.books.length && !s.stages.length) s.stages = C.stagesFor(s, 'mine');
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
      <div><small>전체 분량</small><b class="num">${tu.length ? total[tu[0].id] : 0}</b>${tu.length ? C.unitShort(tu[0].id) : '쪽'}${tu.length > 1 ? html`<small>+ ${tu.slice(1).map((u) => C.amountText(u.id, total[u.id], true)).join(' · ')}</small>` : null}</div>
      <div><small>나눌 날</small><b class="num">${days.length}</b>일</div>
      <div><small>하루 예상</small><b class="num">${days.length ? C.minutes(Math.round(mins / days.length / 5) * 5) : '–'}</b></div>
    </div>
    ${data.subjects.map((s) => html`<div class="kv hue" key=${s.id} style=${hue(s.h)}><span class="k row"><span class="dot"></span>${s.name}</span><span class="v">${s.stages.length ? `${s.stages.length}단계 · ${C.tallyText(C.totU(s))}` : html`<span class="muted">교재 없음 — 나중에</span>`}</span></div>`)}
    <p class="hint">공부 순서는 <b>개념 → 문제 → 개념 → 심화</b>로 시작해요. 과목마다 나중에 바꿀 수 있어요.</p>
  <//>`;
}
