// 설정: 고를 수 있는 건 모두 미리 설계한 선택지 → 무엇을 골라도 보기 좋게.
import { html } from '../../../src/lib/html.js';
import { useState } from '../../../src/lib/ui.js';
import * as C from './core.js';
import { Icon, Sheet, Seg, Switch, Stepper, hue } from './kit.js';

const { D, PR, UI, setPrefs, openSheet, closeSheet, commit, toast, minutes, WD } = C;

const THEMES = [
  { id: 'paper', name: '종이', desc: '따뜻한 종이와 잉크', sw: ['#f4f1e8', '#fdfcf8', '#1f5c4a', '#b8552b'] },
  { id: 'crisp', name: '선명', desc: '가는 선, 또렷한 숫자', sw: ['#fafaf9', '#ffffff', '#18181a', '#c0501a'] },
  { id: 'soft', name: '부드러움', desc: '넉넉한 여백, 둥근 모서리', sw: ['#f1f2f5', '#ffffff', '#3d5afe', '#e85d22'] },
];

function Row({ label, small, children, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return html`<${Tag} class="set-row" onClick=${onClick}>
    <span class="l"><b>${label}</b>${small ? html`<small>${small}</small>` : null}</span>
    ${children}${onClick ? html`<${Icon} n="right" s=${18} />` : null}
  <//>`;
}

function Group({ title, children }) {
  return html`<div class="set-group">${title ? html`<h3>${title}</h3>` : null}<div class="set-list">${children}</div></div>`;
}

function Root({ nav }) {
  const p = PR();
  const pad = C.isPadDev();
  const toggleShow = (k) => setPrefs({ show: { ...p.show, [k]: !p.show[k] } });
  return html`<div>
    <${Group} title="화면">
      <div class="set-row col">
        <span class="l"><b>디자인</b><small>셋 다 밝게·어둡게 모두 맞춰 두었어요</small></span>
        <div class="preview-themes">${THEMES.map((t) => html`<button key=${t.id} class="theme-card" aria-pressed=${p.theme === t.id ? 'true' : 'false'} onClick=${() => setPrefs({ theme: t.id })}>
          <span class="sw">${t.sw.map((c, i) => html`<i key=${i} style=${{ background: c, border: '1px solid rgba(0,0,0,.08)' }}></i>`)}</span>
          <b>${t.name}</b><small>${t.desc}</small>
        </button>`)}</div>
      </div>
      <${Row} label="밝기"><${Seg} label="밝기" value=${p.mode} onChange=${(v) => setPrefs({ mode: v })} options=${[['auto', '기기 따라'], ['light', '밝게'], ['dark', '어둡게']]} /><//>
      <${Row} label="글자 크기"><${Seg} label="글자 크기" value=${p.size} onChange=${(v) => setPrefs({ size: v })} options=${[['sm', '작게'], ['md', '보통'], ['lg', '크게'], ['xl', '아주 크게']]} /><//>
      <${Row} label="간격" small="한 화면에 보이는 양"><${Seg} label="간격" value=${p.density} onChange=${(v) => setPrefs({ density: v })} options=${[['compact', '촘촘'], ['normal', '보통'], ['relaxed', '넉넉']]} /><//>
      ${!pad ? html`<${Row} label="＋ 단추 위치" small="쥐는 손 쪽으로"><${Seg} label="단추 위치" value=${p.hand} onChange=${(v) => setPrefs({ hand: v })} options=${[['left', '왼쪽'], ['right', '오른쪽']]} /><//>` : null}
    <//>

    <${Group} title="오늘 화면">
      <${Row} label="시험 D-day"><${Switch} label="시험 D-day" on=${p.show.dday} onChange=${() => toggleShow('dday')} /><//>
      <${Row} label="오늘 요약 막대" small="몇 개, 몇 쪽 했는지"><${Switch} label="오늘 요약" on=${p.show.summary} onChange=${() => toggleShow('summary')} /><//>
      <${Row} label="지난 날 못 끝낸 일 알림"><${Switch} label="못 끝낸 일 알림" on=${p.show.overdue} onChange=${() => toggleShow('overdue')} /><//>
      <${Row} label="끝낸 일은 아래로"><${Switch} label="끝낸 일은 아래로" on=${p.doneBottom} onChange=${(v) => setPrefs({ doneBottom: v })} /><//>
    <//>

    <${Group} title="진도 화면">
      <${Row} label="진도 칸 아래 단계 이름"><${Switch} label="단계 이름" on=${p.legend} onChange=${(v) => setPrefs({ legend: v })} /><//>
      <${Row} label="가장 적게 본 곳 알려주기" small="덜 본 쪽 구간을 한 줄로"><${Switch} label="가장 적게 본 곳" on=${p.lowest} onChange=${(v) => setPrefs({ lowest: v })} /><//>
      <${Row} label="최근 2주 기록"><${Switch} label="최근 2주" on=${p.recent} onChange=${(v) => setPrefs({ recent: v })} /><//>
    <//>

    ${pad
      ? html`<${Group} title="태블릿 화면">
          <${Row} label="오늘 옆에 보일 것"><${Seg} label="오늘 옆" value=${p.padAside} onChange=${(v) => setPrefs({ padAside: v })} options=${[['progress', '진도'], ['calendar', '달력'], ['none', '없음']]} /><//>
          <${Row} label="목록 너비" small="진도·성적 왼쪽 칸"><${Seg} label="목록 너비" value=${p.listWidth} onChange=${(v) => setPrefs({ listWidth: v })} options=${[['narrow', '좁게'], ['normal', '보통'], ['wide', '넓게']]} /><//>
        <//>`
      : null}

    <${Group} title="공부">
      <${Row} label="공부 가능 시간" small="요일마다 · 쉬는 요일" onClick=${() => nav('time')} />
      <${Row} label=${C.isGoal() ? '끝낼 날' : '시험'} small=${D().exam ? `${D().exam.name} · ${C.mdws(D().exam.date)}` : '안 정함'} onClick=${() => (D().exam ? nav('exam') : openSheet({ type: 'cycle', step: 'next' }))} />
      <${Row} label="과목" small=${`${D().subjects.length}개 · 색과 순서`} onClick=${() => nav('subjects')} />
    <//>

    <${Group} title="자료">
      <${Row} label="계정 · 동기화" small="실제 앱에서 로그인하면 휴대폰과 태블릿이 같은 기록을 써요" />
      <${Row} label="처음 설정부터 다시" onClick=${() => {
        C.resetAll();
        toast('처음 설정으로 돌아갔어요');
      }} />
      <${Row} label="예시 자료로 둘러보기" onClick=${() => {
        C.loadDemo();
        closeSheet();
        toast('예시 자료를 넣었어요');
      }} />
    <//>
    <p class="hint" style="text-align:center">여기 화면 설정은 이 기기에만 저장돼요.</p>
  </div>`;
}

function TimePage() {
  const p = PR();
  const order = [1, 2, 3, 4, 5, 6, 0];
  const total = order.reduce((a, w) => a + (p.rest.includes(w) ? 0 : p.avail[w]), 0);
  return html`<div>
    <p class="sub" style="margin:0 0 12px">학원 같은 고정 일정을 뺀, 혼자 공부할 수 있는 시간이에요. 날짜별로 나눌 때 시간이 긴 날에 더 많이 넣어요.</p>
    <${Group}>
      ${order.map((w) => html`<div class="set-row" key=${w}>
        <span class="l"><b style=${w === 0 ? 'color:#c9473f' : w === 6 ? 'color:#3a64c8' : ''}>${WD[w]}요일</b>${p.rest.includes(w) ? html`<small>쉬는 날</small>` : null}</span>
        <${Stepper} label=${WD[w] + '요일 공부 가능 시간'} value=${p.avail[w]} fmtv=${(v) => (v ? minutes(v) : '없음')} onChange=${(v) => {
          const a = [...p.avail];
          a[w] = v;
          setPrefs({ avail: a });
        }} />
        <button class="btn sm quiet" onClick=${() => setPrefs({ rest: p.rest.includes(w) ? p.rest.filter((x) => x !== w) : [...p.rest, w] })}>${p.rest.includes(w) ? '공부함' : '쉼'}</button>
      </div>`)}
      <div class="set-row"><span class="l"><b>일주일 합계</b></span><span class="num">${minutes(total)}</span></div>
    <//>
    <${Group} title="하루가 바뀌는 시각">
      <div class="set-row col"><span class="l"><small>밤늦게 공부해도 그날로 기록되도록</small></span>
        <${Seg} label="하루 시작" value=${p.dayStart} onChange=${(v) => setPrefs({ dayStart: v })} options=${[[0, '자정'], [2, '새벽 2시'], [4, '새벽 4시'], [6, '새벽 6시']]} />
      </div>
    <//>
    <${Group} title="쪽당 걸리는 시간 (기본)">
      <div class="set-row col"><span class="l"><small>오늘 화면의 예상 시간에 써요. 과목마다 따로 바꿀 수도 있어요.</small></span>
        <${Seg} label="쪽당 시간" value=${p.pace} onChange=${(v) => setPrefs({ pace: v })} options=${[[2, '2분'], [3, '3분'], [5, '5분'], [8, '8분']]} />
      </div>
    <//>
  </div>`;
}

function ExamPage() {
  const ex = D().exam;
  if (!ex)
    return html`<div><p class="muted">지금 준비 중인 시험이 없어요.</p><button class="btn pri block" onClick=${() => openSheet({ type: 'cycle', step: 'next' })}>다음 시험이나 끝낼 날 정하기</button></div>`;
  const goal = C.isGoal(ex);
  return html`<div>
    <span class="label">이름</span>
    <input class="input" key=${'n' + ex.id} defaultValue=${ex.name} onChange=${(e) => {
      ex.name = e.target.value.trim() || ex.name;
      commit();
    }} />
    <span class="label">${goal ? '끝낼 날' : '시험 첫날'}</span>
    <input class="input" type="date" style="max-width:220px" key=${'d' + ex.id} defaultValue=${ex.date} onChange=${(e) => {
      if (e.target.value > C.today()) {
        ex.date = e.target.value;
        commit();
      }
    }} />
    <p class="hint">날짜를 바꾼 뒤에는 진도 › 메뉴 › 모든 과목 다시 나누기를 하면 새 날짜에 맞춰져요.</p>
    <div class="set-list" style="margin-top:22px">
      <${Row} label=${goal ? '이 기간 정리하기' : '이 시험 정리하기'} small=${goal ? '남은 할 일을 치우고 다음을 정해요' : '결과를 적고, 다음 시험을 준비해요. 시험 날이 되면 오늘 화면에도 떠요.'} onClick=${() => openSheet({ type: 'cycle' })} />
    </div>
  </div>`;
}

function SubjectsPage() {
  const subs = D().subjects;
  const move = (i, d) => {
    [subs[i], subs[i + d]] = [subs[i + d], subs[i]];
    commit();
  };
  return html`<div>
    <p class="sub" style="margin:0 0 12px">과목 순서는 오늘 화면에서 묶이는 순서예요. 성적 계산에서는 학점과 평가 항목을 정해요.</p>
    <${Group}>
      ${subs.map((s, i) => html`<div class="set-row hue" key=${s.id} style=${hue(s.h)}>
        <button class="swatch" style="width:28px;height:28px" aria-label=${s.name + ' 색 바꾸기'} onClick=${() => openSheet({ type: 'color', id: s.id })}></button>
        <span class="l"><b>${s.name}</b><small>${s.books.length ? `교재 ${s.books.length}권 · ${s.stages.length}단계${C.isPsg(s) ? ' · 지문으로 세기' : ''}` : '교재 없음'}</small></span>
        <button class="btn sm quiet" onClick=${() => C.openGradeSetup(s.id)}>성적 계산</button>
        <button class="mini-ib" aria-label="위로" disabled=${i === 0} onClick=${() => move(i, -1)}>↑</button>
        <button class="mini-ib" aria-label="아래로" disabled=${i === subs.length - 1} onClick=${() => move(i, 1)}>↓</button>
      </div>`)}
    <//>
    <button class="btn block" onClick=${() => openSheet({ type: 'addSubject' })}>+ 과목 추가</button>
  </div>`;
}

const PAGES = { time: ['공부 시간', TimePage], exam: ['시험', ExamPage], subjects: ['과목', SubjectsPage] };

export function SettingsSheet({ page }) {
  const [cur, setCur] = useState(page || null);
  const P = cur && PAGES[cur];
  return html`<${Sheet} title=${P ? P[0] : '설정'} tall>
    ${P ? html`<button class="back" onClick=${() => setCur(null)}><${Icon} n="left" s=${20} />설정</button>` : null}
    ${P ? html`<${P[1]} />` : html`<${Root} nav=${setCur} />`}
  <//>`;
}
