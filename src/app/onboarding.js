// 처음 설정 (베타 2.0): 환영 → 로그인 → 시험 → 학년 → 과목·교과서 → 시작.
// 단계 넘김은 움직임 규칙 ② '다음으로'(오른쪽으로 페이드, 뒤로는 왼쪽).
// 고1은 2022 개정 공통과목을 골라 두고, 출판사를 고르면 교과서 단원이 칸으로 들어간다 (curriculum.js).
import { html } from '../lib/html.js';
import { useState, useStore, useRef, useEffect } from '../lib/ui.js';
import * as C from './core.js';
import { hue, DateField, useCross, Icon } from './kit.js';
import { syncState } from '../sync/state.js';
import { installable, openInstall, platform } from './pwa.js';
import { AccountPage } from './account.js';
import * as K from './curriculum.js';

const { D, UI, setUI, commit, today, addDays, diffDays, mdws } = C;
const { makeSubject } = K;

function guessExam() {
  const m = +today().slice(5, 7);
  if (m >= 3 && m <= 5) return '1학기 중간고사';
  if (m >= 6 && m <= 7) return '1학기 기말고사';
  if (m >= 8 && m <= 10) return '2학기 중간고사';
  return '2학기 기말고사';
}

/** 한 단계: 위에 질문, 가운데 고르는 것, 아래(엄지 닿는 곳)에 단추 */
function Step({ n, title, desc, children, foot }) {
  return html`<div class="ob-card">
    <div class="ob-top">${n ? html`<span class="ob-step">${n} / 4</span>` : null}<h2>${title}</h2>${desc ? html`<p>${desc}</p>` : null}</div>
    <div class="ob-body">${children}</div>
    <div class="ob-foot">${foot}</div>
  </div>`;
}

/** 앱을 한눈에: 오늘 할 일을 체크하면 → 진도 칸이 채워진다 */
function Hero() {
  const rows = [
    [300, '공통국어', '1단원 읽기', true],
    [226, '공통수학', '다항식의 연산', true],
    [262, '공통영어', 'Lesson 2', false],
  ];
  return html`<div class="hero" aria-hidden="true">
    <div class="hero-card">
      <div class="hero-h"><b>오늘</b><span>할 일 2 / 3</span></div>
      ${rows.map(([h, s, t, done]) => html`<div class=${'hero-row hue' + (done ? ' done' : '')} key=${s} style=${hue(h)}>
        <span class="hero-ck">${done ? html`<svg viewBox="0 0 24 24"><path d="M6.5 12.5l3.5 3.5 7.5-8" /></svg>` : null}</span>
        <span class="hero-t"><b>${t}</b><small>${s}</small></span>
      </div>`)}
    </div>
    <div class="hero-card hero-prog hue" style=${hue(226)}>
      <div class="hero-h"><b>공통수학 진도</b><span class="num">62%</span></div>
      <div class="hero-bar"><i style="flex:3"></i><i style="flex:2"></i><i class="half" style="flex:2"></i><i class="todo" style="flex:3"></i></div>
    </div>
  </div>`;
}

/** 학년·학기에 맞춘 과목 줄들의 처음 상태 */
function initRows(grade, sem, kind) {
  return K.recommend(grade, sem).map((r) => {
    const u = K.units(r.name, sem, null);
    const [a, b] = K.scopeGuess(u.labels.length, kind);
    return { ...r, on: grade === 1 ? !r.optional : false, pub: grade === 1 ? '' : 'other', from: a, to: b };
  });
}

export function Onboarding() {
  const step = UI().ob || 0;
  const ref = useRef(null);
  useCross(ref, step, (a, b) => Math.sign(b - a)); // 움직임 규칙 ②
  const go = (n) => setUI({ ob: n, toast: null }); // 넘어가면 떠 있던 알림은 거둔다 (입력 칸을 가리지 않게)
  const data = D();
  const sync = useStore(syncState);
  const signed = !!sync.user;
  const ex = data.exam;
  const sch = data.school || { grade: 1, sem: K.guessSem(today()) };
  const [rows, setRows] = useState(null);
  const [custom, setCustom] = useState('');

  // 로그인 단계에서 로그인하고 계정 기록을 다 받아 왔는데 계정이 비어 있으면 → 다음 단계로
  useEffect(() => {
    if (step === 1 && signed && !sync.first && !D().onboarded) go(2);
  }, [step, signed, sync.first]);

  let body;
  if (step === 0) {
    const me = platform();
    const install = installable() && me !== 'desktop';
    body = html`<div class="ob-hello">
      <${Hero} />
      <h1>회독 플래너</h1>
      <p>시험까지 공부할 양을 날마다 나눠 주고, 체크하면 진도가 채워져요.</p>
      <button class="btn pri block big" onClick=${() => {
        if (!data.exam) data.exam = { id: C.uid(), name: guessExam(), kind: 'mid', date: addDays(today(), 14), start: today() };
        commit();
        go(signed ? 2 : 1);
      }}>시작하기</button>
      ${signed
        ? html`<p class="ob-signed">로그인됨 · ${sync.user.email}${sync.first ? html`<br />계정 기록을 받아 오는 중…` : ''}</p>`
        : html`<button class="btn text block" onClick=${() => C.loadDemo()}>예시로 둘러보기</button>`}
      ${install
        ? html`<div class="ob-install">
            ${me === 'ios' ? html`<p>아이폰은 <b>홈 화면에 추가</b>한 아이콘으로 열어서 시작하세요.</p>` : html`<p>홈 화면에 추가하면 앱처럼 열려요.</p>`}
            <button class="link" onClick=${openInstall}>홈 화면에 추가하는 법</button>
          </div>`
        : null}
    </div>`;
  } else if (step === 1) {
    body = html`<${Step}
      n="1"
      title="로그인"
      desc="로그인하면 휴대폰과 태블릿이 같은 기록과 설정을 써요. 다른 기기에서 쓰던 기록도 그대로 받아 와요."
      foot=${html`<button class="btn" onClick=${() => go(0)}>이전</button><span class="sp"></span>${signed ? html`<button class="btn pri" onClick=${() => go(2)}>다음</button>` : html`<button class="btn text" onClick=${() => go(2)}>로그인 없이 시작</button>`}`}
    >
      ${signed
        ? html`<div class="ob-done"><${Icon} n="check" s=${22} /><b>${sync.user.email}</b><small>${sync.first ? '계정 기록을 받아 오는 중…' : '로그인했어요'}</small></div>`
        : html`<${AccountPage} ob />`}
    <//>`;
  } else if (step === 2) {
    const goal = C.isGoal(ex);
    const pick = (n) => {
      if (n === 'goal') {
        ex.kind = 'goal';
        ex.name = '';
      } else {
        ex.name = n;
        ex.kind = C.kindOfName(n);
        const m = n.match(/([12])학기/);
        if (m) data.school = { ...sch, sem: +m[1] };
      }
      setRows(null);
      commit();
    };
    const left = diffDays(today(), ex.date);
    body = html`<${Step}
      n="2"
      title="다음 시험은 언제예요?"
      desc="날짜까지 남은 날에 공부할 양을 나눠 드려요."
      foot=${html`<button class="btn" onClick=${() => go(signed ? 0 : 1)}>이전</button><span class="sp"></span><button class="btn pri" disabled=${goal && !ex.name.trim()} onClick=${() => go(3)}>다음</button>`}
    >
      <div class="pick-grid" role="radiogroup" aria-label="시험">
        ${C.EXAM_NAMES.map((n) => html`<button key=${n} class="pick" role="radio" aria-checked=${!goal && ex.name === n ? 'true' : 'false'} onClick=${() => pick(n)}><b>${n.replace(/^[12]학기 /, '')}</b><small>${(n.match(/[12]학기/) || ['학력평가'])[0]}</small></button>`)}
        <button class="pick" role="radio" aria-checked=${goal ? 'true' : 'false'} onClick=${() => pick('goal')}><b>기간만</b><small>방학·평소</small></button>
      </div>
      ${goal
        ? html`<span class="label">무엇을 끝낼 기간인가요</span>
            <input class="input" key="goalname" defaultValue=${ex.name} placeholder="예: 겨울방학 개념 한 바퀴" onInput=${(e) => {
              ex.name = e.target.value;
              commit();
            }} aria-label="기간 이름" />`
        : null}
      <div class="date-row">
        <div class="l"><span class="label" style="margin:0">${goal ? '끝낼 날' : '시험 첫날'}</span>
          <${DateField} value=${ex.date} min=${addDays(today(), 1)} why="오늘 뒤의 날짜를 골라 주세요" label=${goal ? '끝낼 날' : '시험 첫날'} onCommit=${(v) => {
            ex.date = v;
            commit();
          }} /></div>
        <div class="dd"><b class="num">D-${left}</b><small>${mdws(ex.date)}</small></div>
      </div>
    <//>`;
  } else if (step === 3) {
    const set = (patch) => {
      data.school = { ...sch, ...patch };
      setRows(null);
      commit();
    };
    body = html`<${Step}
      n="3"
      title="몇 학년이에요?"
      desc="학년과 학기에 맞는 과목·교과서를 골라 둘게요. (2022 개정 교육과정)"
      foot=${html`<button class="btn" onClick=${() => go(2)}>이전</button><span class="sp"></span><button class="btn pri" onClick=${() => {
        if (!data.school) set({});
        go(4);
      }}>다음</button>`}
    >
      <div class="pick-list" role="radiogroup" aria-label="학년">
        ${K.GRADES.map(([g, name]) => html`<button key=${g} class="pick wide" role="radio" aria-checked=${sch.grade === g ? 'true' : 'false'} onClick=${() => set({ grade: g })}>
          <b>${name}</b><small>${g === 1 ? '공통과목 — 국어·수학·영어·한국사·통합사회·통합과학' : '선택과목 — 학교에서 고른 과목을 골라요'}</small>
        </button>`)}
      </div>
      <span class="label">학기</span>
      <div class="seg" role="radiogroup" aria-label="학기">${[1, 2].map((s) => html`<button key=${s} role="radio" aria-checked=${sch.sem === s ? 'true' : 'false'} aria-pressed=${sch.sem === s ? 'true' : 'false'} onClick=${() => set({ sem: s })}>${s}학기</button>`)}</div>
    <//>`;
  } else if (step === 4) {
    const list = rows || initRows(sch.grade, sch.sem, ex.kind);
    const upd = (i, patch) => {
      const next = list.map((r, j) => (j === i ? { ...r, ...patch } : r));
      setRows(next);
    };
    const picked = list.filter((r) => r.on);
    body = html`<${Step}
      n="4"
      title="과목과 교과서"
      desc=${sch.grade === 1 ? '교과서 출판사를 고르면 단원이 칸으로 들어가요. 시험 범위에 맞게 단원을 골라 주세요.' : '이번 학기에 듣는 과목을 골라 주세요. 단원은 나중에 교재 고치기에서 맞출 수 있어요.'}
      foot=${html`<button class="btn" onClick=${() => go(3)}>이전</button><span class="sp"></span><button class="btn pri" disabled=${!picked.length} onClick=${() => {
        const keep = data.subjects.filter((s) => picked.some((r) => r.name === s.name) && s.books.length);
        const made = picked.filter((r) => !keep.some((s) => s.name === r.name)).map((r) => makeSubject(r, sch.sem));
        data.subjects = [...keep, ...made];
        data.school = { ...sch, pubs: Object.fromEntries(picked.map((r) => [r.name, r.pub || 'other'])) };
        commit();
        go(5);
      }}>${picked.length}과목으로 다음</button>`}
    >
      <div class="subj-list">
        ${list.map((r, i) => {
          const u = K.units(r.name, sch.sem, r.pub || 'other');
          const n = u.labels.length;
          const pubs = K.publishers(r.name);
          return html`<div class=${'subj hue' + (r.on ? ' on' : '')} key=${r.name} style=${hue(r.h)}>
            <button class="subj-h" aria-pressed=${r.on ? 'true' : 'false'} onClick=${() => upd(i, { on: !r.on })}>
              <span class="tick">${r.on ? html`<${Icon} n="check" s=${16} />` : null}</span>
              <b>${r.name}</b><small>${r.book}</small>
            </button>
            ${r.on
              ? html`<div class="subj-b">
                  ${pubs.length > 1
                    ? html`<label class="field"><span>교과서</span><select class="input" value=${r.pub || ''} onChange=${(e) => {
                        const pub = e.target.value;
                        const nn = K.units(r.name, sch.sem, pub).labels.length;
                        const [a, b] = K.scopeGuess(nn, ex.kind);
                        upd(i, { pub, from: a, to: b });
                      }}>
                        <option value="" disabled>출판사 고르기</option>
                        ${pubs.map(([id, name]) => html`<option key=${id} value=${id}>${name}</option>`)}
                      </select></label>`
                    : null}
                  <label class="field"><span>범위</span>
                    <span class="range">
                      <select class="input" value=${r.from} onChange=${(e) => upd(i, { from: +e.target.value, to: Math.max(+e.target.value, r.to) })} aria-label=${r.name + ' 범위 시작'}>${u.labels.map((l, k) => html`<option key=${k} value=${k + 1}>${l}</option>`)}</select>
                      <span class="muted">~</span>
                      <select class="input" value=${r.to} onChange=${(e) => upd(i, { to: +e.target.value, from: Math.min(+e.target.value, r.from) })} aria-label=${r.name + ' 범위 끝'}>${u.labels.map((l, k) => html`<option key=${k} value=${k + 1}>${l}</option>`)}</select>
                    </span>
                  </label>
                  <small class="src">${u.verified === true ? `단원 ${n}개 · 교과서 목차` : u.verified === 'curriculum' ? `단원 ${n}개 · 교육과정 큰 단원 (출판사 목차와 이름이 조금 다를 수 있어요)` : `단원 ${n}개 · 이름은 나중에 고칠 수 있어요`}</small>
                </div>`
              : null}
          </div>`;
        })}
      </div>
      <form class="row" style="margin-top:14px" onSubmit=${(e) => {
        e.preventDefault();
        const name = custom.trim();
        if (!name || list.some((r) => r.name === name)) return;
        setRows([...list, { name, h: C.HUES[list.length % C.HUES.length], book: name, on: true, pub: 'other', from: 1, to: 5 }]);
        setCustom('');
      }}><input class="input" placeholder="목록에 없는 과목" value=${custom} onInput=${(e) => setCustom(e.target.value)} aria-label="과목 이름" /><button class="btn" type="submit" disabled=${!custom.trim()}>추가</button></form>
    <//>`;
  } else {
    // step 5: 시작
    const ready = data.subjects.filter((s) => s.stages.length);
    const { tasks, days } = C.previewPlan(today());
    const mins = tasks.reduce((a, t) => a + C.taskMinutes(t), 0);
    const finish = (plan) => {
      for (const s of data.subjects) if (s.books.length && !s.stages.length) s.stages = C.stagesFor(s, 'mine');
      if (plan) C.planAll(today());
      data.onboarded = true;
      commit();
      setUI({ ob: 0, tab: 'today', day: null });
      if (plan) C.toast(`${days.length}일치 할 일을 넣었어요`);
    };
    body = html`<${Step}
      title="이렇게 나눠서 시작할게요"
      desc=${`${ready.length}과목을 ${days.length ? mdws(days[days.length - 1].d) : ''}까지 날마다 나눠요.`}
      foot=${html`<button class="btn" onClick=${() => go(4)}>이전</button><span class="sp"></span><button class="btn text" onClick=${() => finish(false)}>나누지 않고</button><button class="btn pri" disabled=${!tasks.length} onClick=${() => finish(true)}>나눠서 시작</button>`}
    >
      <div class="plan-sum">
        <div><small>공부할 시간</small><b class="num">${C.minutes(Math.round(mins / 60) * 60 || mins)}</b></div>
        <div><small>나눌 날</small><b class="num">${days.length}</b>일</div>
        <div><small>하루 예상</small><b class="num">${days.length ? C.minutes(Math.round(mins / days.length / 5) * 5) : '–'}</b></div>
      </div>
      ${data.subjects.map((s) => html`<div class="kv hue" key=${s.id} style=${hue(s.h)}><span class="k row"><span class="dot"></span>${s.name}</span><span class="v">${!s.stages.length ? html`<span class="muted">교재 없음</span>` : s.books[0].labels ? `${C.amountText('ch', s.books[0].to - s.books[0].from + 1)} · ${C.spanText(s, s.books[0], s.books[0].from, s.books[0].to)}` : C.tallyText(C.totU(s))}</span></div>`)}
      <p class="hint">교과서를 개념 → 복습으로 두 번 보게 나눠요. 문제집은 진도 › 과목에서 더 넣을 수 있어요.</p>
    <//>`;
  }
  return html`<div class="ob" ref=${ref}>${body}</div>`;
}
