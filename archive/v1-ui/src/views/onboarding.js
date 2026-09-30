// 처음 시작: 과목 → 공부 가능 시간 → 학기 (모두 나중에 설정에서 바꿀 수 있음)
import { html } from '../lib/html.js';
import { useState, useStore } from '../lib/ui.js';
import { Icon } from '../ui/icons.js';
import { Chip, Stepper, cx } from '../ui/kit.js';
import { activeSubjects, availability, SUBJECT_COLORS, subjectVars } from '../data/model.js';
import { addSubject, setAvailability, setPrefs } from '../data/actions.js';
import { SUBJECT_PRESETS } from '../core/templates.js';
import { WEEKDAYS, minutesLabel } from '../core/date.js';
import { AddSemesterForm } from './settings/semesters.js';
import { APP_NAME } from '../config.js';
import { syncState } from '../sync/state.js';
import { openSettings } from './settings/index.js';

const ORDER = [1, 2, 3, 4, 5, 6, 0];

function StepSubjects({ next }) {
  const existing = activeSubjects();
  const names = new Set(existing.map((s) => s.name));
  const [picked, setPicked] = useState(() => new Set(existing.length ? [] : ['공통국어', '공통수학', '공통영어', '한국사', '통합사회', '통합과학']));
  const [custom, setCustom] = useState('');
  const toggle = (n) => {
    const x = new Set(picked);
    if (x.has(n)) x.delete(n);
    else x.add(n);
    setPicked(x);
  };
  const addCustom = (e) => {
    e.preventDefault();
    const n = custom.trim();
    if (!n) return;
    addSubject({ name: n });
    setCustom('');
  };
  const go = () => {
    for (const p of SUBJECT_PRESETS) if (picked.has(p.name) && !names.has(p.name)) addSubject({ ...p, color: (SUBJECT_COLORS.find((c) => c.id === p.color) || {}).hex });
    next();
  };
  const count = existing.length + [...picked].filter((n) => !names.has(n)).length;
  return html`<div class="ob-step">
    <h2>어떤 과목을 공부하나요?</h2>
    <p class="sub">2022 개정 교육과정 공통과목을 먼저 골라 두었습니다. 학점과 분류는 나중에 설정에서 고칠 수 있습니다.</p>
    <div class="chips" style="margin:16px 0">
      ${SUBJECT_PRESETS.filter((p) => !names.has(p.name)).map(
        (p) => html`<${Chip} key=${p.name} on=${picked.has(p.name)} onClick=${() => toggle(p.name)}>${p.name}<//>`,
      )}
    </div>
    ${existing.length
      ? html`<div class="chips" style="margin-bottom:12px">
          ${existing.map((s) => html`<span key=${s.id} class="chip subject on" style=${subjectVars(s)}><span class="dot"></span>${s.name}</span>`)}
        </div>`
      : null}
    <form class="qa-row" onSubmit=${addCustom}>
      <input class="input" placeholder="목록에 없는 과목 직접 추가" aria-label="과목 이름" value=${custom} onInput=${(e) => setCustom(e.target.value)} />
      <button class="btn" type="submit" disabled=${!custom.trim()}>추가</button>
    </form>
    <div class="ob-foot">
      <button class="btn primary lg block" disabled=${!count} onClick=${go}>${count ? `과목 ${count}개로 계속` : '과목을 하나 이상 고르세요'}</button>
    </div>
  </div>`;
}

function StepTime({ next, back }) {
  const a = availability();
  const setDay = (d, v) => {
    const w = [...a.weekdays];
    w[d] = v;
    setAvailability({ weekdays: w });
  };
  return html`<div class="ob-step">
    <h2>요일별로 스스로 공부할 수 있는 시간은?</h2>
    <p class="sub">학원 같은 고정 일정을 뺀 시간입니다. 하루 계획이 넘치는지 막대로 보여줄 때와 자동 배분에 씁니다.</p>
    <div class="card list" style="margin-top:16px">
      ${ORDER.map(
        (d) => html`<div class="list-row" key=${d}>
          <span class=${cx('wd-label', d === 0 && 'sun', d === 6 && 'sat')}>${WEEKDAYS[d]}요일</span>
          <span class="spacer"></span>
          <${Stepper} label=${WEEKDAYS[d] + '요일'} value=${a.weekdays[d] || 0} min=${0} max=${16 * 60} step=${30} format=${(v) => (v ? minutesLabel(v) : '없음')} onChange=${(v) => setDay(d, v)} />
        </div>`,
      )}
    </div>
    <div class="ob-foot hstack">
      <button class="btn lg" onClick=${back}>이전</button>
      <button class="btn primary lg grow" onClick=${next}>계속</button>
    </div>
  </div>`;
}

function StepSemester({ done, back }) {
  return html`<div class="ob-step">
    <h2>지금 학기</h2>
    <p class="sub">내신 성적과 중간·기말고사를 학기별로 묶는 데 씁니다.</p>
    <div style="margin-top:16px"><${AddSemesterForm} onDone=${done} /></div>
    <div class="ob-foot hstack">
      <button class="btn lg" onClick=${back}>이전</button>
      <button class="btn lg grow" onClick=${done}>나중에 하기</button>
    </div>
  </div>`;
}

export function Onboarding() {
  // 과목을 이미 고른 뒤 새로 고침했다면 다음 단계부터 이어서
  const [step, setStep] = useState(() => (activeSubjects().length ? 2 : 0));
  const sync = useStore(syncState);
  const finish = () => setPrefs({ onboarded: true });
  return html`<div class="onboarding">
    <div class="ob-inner">
      ${step === 0
        ? html`<div class="ob-step ob-hello">
            <div class="ob-mark" aria-hidden="true"><span class="hl-demo">오늘 할 일</span></div>
            <h1>${APP_NAME}</h1>
            <p class="lead">계획을 세우고, 실행하고, 결과를 있는 그대로 되돌아보는 공부 플래너.</p>
            <ul class="ob-points">
              <li><${Icon} name="today" />하루 할 일은 과목별로. 끝낸 일에는 형광펜이 그어집니다.</li>
              <li><${Icon} name="book" />시험마다 회독 트랙을 만들고, 남은 분량을 날짜별로 나눕니다.</li>
              <li><${Icon} name="chart" />공부한 기록과 시험 결과를 나란히 놓고 봅니다. 판단은 직접 합니다.</li>
            </ul>
            <div class="ob-foot">
              <button class="btn primary lg block" onClick=${() => setStep(1)}>시작하기</button>
              ${sync.configured
                ? html`<button class="btn ghost block" style="margin-top:8px" onClick=${() => openSettings('account')}>이미 쓰던 계정으로 로그인</button>`
                : html`<button class="btn ghost block" style="margin-top:8px" onClick=${() => openSettings('data')}>백업 파일에서 가져오기</button>`}
            </div>
          </div>`
        : step === 1
          ? html`<${StepSubjects} next=${() => setStep(2)} />`
          : step === 2
            ? html`<${StepTime} next=${() => setStep(3)} back=${() => setStep(1)} />`
            : html`<${StepSemester} done=${finish} back=${() => setStep(2)} />`}
      ${step > 0 ? html`<div class="ob-dots" aria-label=${`${step}/3 단계`}>${[1, 2, 3].map((i) => html`<i key=${i} class=${i <= step ? 'on' : ''}></i>`)}</div>` : null}
    </div>
  </div>`;
}
