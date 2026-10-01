// 설정: 고를 수 있는 건 모두 미리 설계한 선택지 → 무엇을 골라도 보기 좋게.
import { html } from '../lib/html.js';
import { useState } from '../lib/ui.js';
import * as C from './core.js';
import { Icon, Sheet, Seg, Switch, Stepper, hue } from './kit.js';
import { AccountPage, syncSmall } from './account.js';
import * as M from './motion.js';
import { ns } from '../env.js';
import { FONTS, fontById, loadPreviews, previewFamily } from './fonts.js';
import { installable, openInstall } from './pwa.js';
import { wipeThisDevice } from './store.js';
import { needsAttention } from '../sync/sync.js';
import { syncState } from '../sync/state.js';

const { D, PR, UI, setPrefs, openSheet, closeSheet, commit, toast, minutes, WD } = C;

const THEMES = [
  { id: 'paper', name: '종이', desc: '따뜻한 종이와 잉크', sw: ['#f4f1e8', '#fdfcf8', '#1f5c4a', '#b8552b'] },
  { id: 'crisp', name: '선명', desc: '가는 선, 또렷한 숫자', sw: ['#fafaf9', '#ffffff', '#18181a', '#c0501a'] },
  { id: 'soft', name: '부드러움', desc: '넉넉한 여백, 둥근 모서리', sw: ['#f1f2f5', '#ffffff', '#3d5afe', '#e85d22'] },
];

function Row({ label, small, children, onClick, danger, warn }) {
  const Tag = onClick ? 'button' : 'div';
  return html`<${Tag} class=${'set-row' + (danger ? ' danger' : '')} onClick=${onClick}>
    <span class="l"><b>${label}</b>${small ? html`<small class=${warn ? 'warn' : ''}>${small}</small>` : null}</span>
    ${children}${onClick ? html`<${Icon} n="right" s=${18} />` : null}
  <//>`;
}

function Group({ title, children }) {
  return html`<div class="set-group">${title ? html`<h3>${title}</h3>` : null}<div class="set-list">${children}</div></div>`;
}

function exportFile() {
  const blob = new Blob([JSON.stringify(C.backupObject())], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = C.backupFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  try {
    localStorage.setItem(LAST_EXPORT, C.today());
  } catch {
    /* 저장 공간이 막힌 환경 */
  }
  toast('파일로 내보냈어요');
}

// 마지막으로 파일로 내보낸 날 (이 기기에서)
const LAST_EXPORT = ns('hoedok.lastExport');
function lastExport() {
  try {
    return localStorage.getItem(LAST_EXPORT);
  } catch {
    return null;
  }
}

async function pickBackup(e) {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const info = C.readBackup(await f.text());
    openSheet({ type: 'backup', info });
  } catch (err) {
    toast(err.message);
  }
}

/** 불러오기 확인: 무엇이 들어 있는지 보여 주고 바꾼다 (되돌리기 가능) */
export function BackupSheet({ info }) {
  if (!info) return null;
  const c = info.counts;
  const when = info.exportedAt ? new Date(info.exportedAt) : null;
  return html`<${Sheet} title="파일에서 불러오기" footer=${html`<button class="btn" onClick=${closeSheet}>취소</button><button class="btn pri" onClick=${() => {
    C.withUndo('파일의 기록으로 바꿨어요', () => C.applyBackup(info.obj));
    closeSheet();
  }}>이 파일로 바꾸기</button>`}>
    <p class="sub" style="margin:0 0 12px">${when ? `${when.getMonth() + 1}월 ${when.getDate()}일 ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}에 내보낸 파일이에요.` : ''}</p>
    <div class="kv"><span class="k">과목</span><span class="v num">${c.subjects}개</span></div>
    <div class="kv"><span class="k">할 일</span><span class="v num">${c.tasks}개</span></div>
    <div class="kv"><span class="k">지난 시험</span><span class="v num">${c.exams}개</span></div>
    <div class="kv"><span class="k">학기 성적</span><span class="v num">${c.semesters}개</span></div>
    <p class="hint">지금 이 기기의 기록이 파일 내용으로 바뀌어요. 바꾼 직후에는 되돌릴 수 있어요. 화면 설정은 그대로예요.</p>
  <//>`;
}

const MODE_LABEL = { auto: '기기 따라', light: '밝게', dark: '어둡게' };
const SIZE_LABEL = { sm: '작게', md: '보통', lg: '크게', xl: '아주 크게' };
const MOTION_LABEL = Object.fromEntries(M.LEVELS);

/** 예시 끝내기: 예시를 지우고 처음 화면으로. 서버로 보낼 것도 남기지 않는다 */
async function leaveDemo() {
  await wipeThisDevice();
  location.reload();
}

/** 설정 첫 화면: 자주 쓰는 것부터. 화면 꾸미기는 한 단계 안으로 */
function Root({ nav }) {
  const p = PR();
  const [wipeAsk, setWipeAsk] = useState(false);
  const theme = THEMES.find((t) => t.id === p.theme) || THEMES[0];
  const demo = C.isDemo();
  return html`<div>
    ${demo
      ? html`<div class="set-group"><div class="set-list"><button class="set-row key" onClick=${leaveDemo}>
          <span class="l"><b>예시 끝내고 내 기록으로 시작</b><small>지금은 예시 기록이에요. 누르면 예시를 지우고 처음 설정으로 가요</small></span><${Icon} n="right" s=${18} />
        </button></div></div>`
      : null}
    <${Group} title="공부">
      <${Row} label=${C.isGoal() ? '끝낼 날' : '시험'} small=${D().exam ? `${D().exam.name} · ${C.mdws(D().exam.date)}` : '안 정함'} onClick=${() => (D().exam ? nav('exam') : openSheet({ type: 'cycle', step: 'next' }))} />
      <${Row} label="과목" small=${`${D().subjects.length}개 · 색·순서·성적 계산`} onClick=${() => nav('subjects')} />
      <${Row} label="공부 가능 시간" small="요일마다 · 쉬는 요일 · 날짜마다" onClick=${() => nav('time')} />
    <//>

    <${Group}>
      <${Row} label="계정 · 동기화" small=${syncSmall()} warn=${needsAttention()} onClick=${() => nav('account')} />
      ${installable() ? html`<${Row} label="홈 화면에 앱으로 추가" small="아이콘을 눌러 앱처럼 열기 · 인터넷 없이도 열려요" onClick=${openInstall} />` : null}
    <//>

    <${Group} title="화면">
      <${Row} label="디자인 · 글꼴 · 움직임" small=${`${theme.name} · ${MODE_LABEL[p.mode]} · ${fontById(p.font).name} · 글자 ${SIZE_LABEL[p.size]}`} onClick=${() => nav('display')} />
      <${Row} label="보일 것 고르기" small="오늘·진도 화면에 무엇을 보일지" onClick=${() => nav('views')} />
    <//>

    <${Group} title="자료">
      <${Row} label="파일로 내보내기" small=${`기록을 파일 하나로 · ${lastExport() ? `마지막 ${C.mdws(lastExport())}` : '아직 안 함'}`} onClick=${exportFile} />
      <label class="set-row" style="cursor:pointer">
        <span class="l"><b>파일에서 불러오기</b><small>내보낸 파일로 지금 기록을 바꿔요</small></span><${Icon} n="right" s=${18} />
        <input type="file" accept="application/json,.json" style="display:none" onChange=${pickBackup} />
      </label>
      ${demo
        ? null
        : html`<${Row}
            danger
            label=${wipeAsk ? '한 번 더 누르면 모두 지워져요' : '모든 기록 지우고 처음부터'}
            small=${wipeAsk ? '지운 직후에는 되돌릴 수 있어요' : syncState.get().user ? '과목·할 일·성적을 모두 지워요. 계정과 다른 기기에서도 지워져요' : '과목·할 일·성적을 모두 지워요. 먼저 파일로 내보내 두면 안전해요'}
            onClick=${() => {
              if (!wipeAsk) return setWipeAsk(true);
              C.withUndo('모든 기록을 지웠어요', () => C.resetAll());
            }}
          />`}
    <//>
  </div>`;
}

/** 디자인·밝기·글꼴·글자·간격 (+ 태블릿 배치). 이 기기에만 저장 */
function DisplayPage({ nav }) {
  const p = PR();
  const pad = C.isPadDev();
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
    <//>
    <${Group} title="글자">
      <${Row} label="글꼴" small=${fontById(p.font).name} onClick=${() => nav('font')} />
      <${Row} label="글자 크기"><${Seg} label="글자 크기" value=${p.size} onChange=${(v) => setPrefs({ size: v })} options=${[['sm', '작게'], ['md', '보통'], ['lg', '크게'], ['xl', '아주 크게']]} /><//>
      <${Row} label="간격" small="한 화면에 보이는 양"><${Seg} label="간격" value=${p.density} onChange=${(v) => setPrefs({ density: v })} options=${[['compact', '촘촘'], ['normal', '보통'], ['relaxed', '넉넉']]} /><//>
      ${!pad ? html`<${Row} label="＋ 단추 위치" small="쥐는 손 쪽으로"><${Seg} label="단추 위치" value=${p.hand} onChange=${(v) => setPrefs({ hand: v })} options=${[['left', '왼쪽'], ['right', '오른쪽']]} /><//>` : null}
    <//>
    <${MotionGroup} />
    ${pad
      ? html`<${Group} title="태블릿 화면">
          <${Row} label="오늘 옆에 보일 것"><${Seg} label="오늘 옆" value=${p.padAside} onChange=${(v) => setPrefs({ padAside: v })} options=${[['progress', '진도'], ['calendar', '달력'], ['none', '없음']]} /><//>
          <${Row} label="목록 너비" small="진도·성적 왼쪽 칸"><${Seg} label="목록 너비" value=${p.listWidth} onChange=${(v) => setPrefs({ listWidth: v })} options=${[['narrow', '좁게'], ['normal', '보통'], ['wide', '넓게']]} /><//>
        <//>`
      : null}
    <p class="hint" style="text-align:center">화면 설정은 이 기기에만 저장돼요. 다른 기기는 따로 정해요.</p>
  </div>`;
}

/**
 * 한글 글꼴: 이름과 설명을 각 글꼴로 보여 주고, 누르면 앱 전체가 바로 그 글꼴로 바뀐다.
 * 처음 쓰는 글꼴은 인터넷에서 받아 오는 동안 잠깐 기본 글꼴로 보인다.
 */
function FontPage() {
  const p = PR();
  const cur = fontById(p.font).id;
  loadPreviews();
  return html`<div>
    <p class="sub" style="margin:0 0 12px">누르면 바로 바뀌어요. 숫자 모양은 디자인마다 정해져 있어요.</p>
    <div class="set-list font-list" role="radiogroup" aria-label="글꼴">
      ${FONTS.map((f) => html`<button key=${f.id} class="set-row font-opt" role="radio" aria-checked=${cur === f.id ? 'true' : 'false'} onClick=${() => setPrefs({ font: f.id })}>
        <span class="l" style=${{ fontFamily: previewFamily(f) }}><b>${f.name}</b><small>${f.desc}</small></span>
        ${cur === f.id ? html`<${Icon} n="check" s=${18} />` : null}
      </button>`)}
    </div>
    <p class="hint" style="text-align:center">처음 고른 글꼴은 인터넷에서 받아 와요. 한 번 받으면 인터넷 없이도 보여요.</p>
  </div>`;
}

/** 움직임: 속도 하나 + 화면 옮길 때 하나. 고르는 순간 아래 알림이 그 속도로 떠서 바로 느껴 볼 수 있다 */
function MotionGroup() {
  const p = PR();
  const lv = M.level();
  const pick = (v) => {
    setPrefs({ motion: v });
    toast(v === 'off' ? '움직임을 껐어요' : `움직임: ${MOTION_LABEL[v]}`);
  };
  return html`<${Group} title="움직임">
    <div class="set-row col">
      <span class="l"><b>움직이는 속도</b><small>창이 열리고 닫힐 때, 체크할 때 부드럽게 바뀌어요</small></span>
      <${Seg} label="움직이는 속도" value=${lv} onChange=${pick} options=${M.LEVELS} />
      ${p.motion == null && M.osReduce() ? html`<small class="muted">기기에서 '동작 줄이기'를 켜 두어서 꺼 두었어요. 여기서 고르면 그대로 따라요.</small>` : null}
    </div>
    ${lv !== 'off'
      ? html`<${Row} label="화면을 옮길 때도 부드럽게" small="탭을 옮기거나 과목·날짜를 바꿀 때">
          <${Switch} label="화면을 옮길 때도 부드럽게" on=${p.motionView !== false} onChange=${(v) => setPrefs({ motionView: v })} />
        <//>`
      : null}
  <//>`;
}

/** 오늘·진도 화면에 보일 것 */
function ViewsPage() {
  const p = PR();
  const toggleShow = (k) => setPrefs({ show: { ...p.show, [k]: !p.show[k] } });
  return html`<div>
    <${Group} title="오늘 화면">
      <${Row} label="시험 D-day"><${Switch} label="시험 D-day" on=${p.show.dday} onChange=${() => toggleShow('dday')} /><//>
      <${Row} label="오늘 요약 막대" small="몇 개, 몇 쪽 했는지"><${Switch} label="오늘 요약" on=${p.show.summary} onChange=${() => toggleShow('summary')} /><//>
      <${Row} label="지난 날 못 끝낸 일 알림"><${Switch} label="못 끝낸 일 알림" on=${p.show.overdue} onChange=${() => toggleShow('overdue')} /><//>
      <${Row} label="다가오는 마감 알림" small=${`마감이 ${C.DUE_SOON}일 안인데 다른 날로 잡아 둔 일`}><${Switch} label="다가오는 마감 알림" on=${p.show.due !== false} onChange=${() => setPrefs({ show: { ...p.show, due: p.show.due === false } })} /><//>
      <${Row} label="끝낸 일은 아래로"><${Switch} label="끝낸 일은 아래로" on=${p.doneBottom} onChange=${(v) => setPrefs({ doneBottom: v })} /><//>
    <//>

    <${Group} title="진도 화면">
      <${Row} label="진도 칸 아래 단계 이름"><${Switch} label="단계 이름" on=${p.legend} onChange=${(v) => setPrefs({ legend: v })} /><//>
      <${Row} label="가장 적게 본 곳 알려주기" small="덜 본 쪽 구간을 한 줄로"><${Switch} label="가장 적게 본 곳" on=${p.lowest} onChange=${(v) => setPrefs({ lowest: v })} /><//>
      <${Row} label="최근 2주 기록"><${Switch} label="최근 2주" on=${p.recent} onChange=${(v) => setPrefs({ recent: v })} /><//>
    <//>
    <p class="hint" style="text-align:center">겉에는 적게, 필요한 것만 켜 두세요.</p>
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
    <${DayChanges} />
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

/** 그날만 바꾼 공부 가능 시간 (학원 보충, 학교 행사, 여행…) */
function DayChanges() {
  const p = PR();
  const td = C.today();
  const [pick, setPick] = useState(C.addDays(td, 1));
  const list = Object.keys(p.dayMin || {}).filter((d) => d >= td).sort();
  return html`<${Group} title="날짜마다 바꾼 시간">
    ${list.map((d) => html`<div class="set-row" key=${d}>
      <span class="l"><b>${C.mdws(d)}</b><small>요일 기본 ${C.weekdayCap(d) ? minutes(C.weekdayCap(d)) : '쉬는 날'}</small></span>
      <${Stepper} label=${C.mdws(d) + ' 공부 가능 시간'} value=${C.capacity(d)} fmtv=${(v) => (v ? minutes(v) : '쉼')} onChange=${(v) => C.setDayCap(d, v)} />
      <button class="btn sm quiet" onClick=${() => C.setDayCap(d, null)}>되돌리기</button>
    </div>`)}
    <div class="set-row">
      <span class="l"><b>날짜 하나 바꾸기</b><small>그날만 시간을 다르게. 다시 나눌 때 반영돼요</small></span>
      <input class="input" type="date" style="width:auto" value=${pick} min=${td} onChange=${(e) => e.target.value && setPick(e.target.value)} aria-label="바꿀 날짜" />
      <button class="btn sm" onClick=${() => C.setDayCap(pick, C.capacity(pick) ? 0 : 180)}>${C.capacity(pick) ? '이날 쉬기' : '이날 공부'}</button>
    </div>
  <//>`;
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

// [제목, 화면, 뒤로 갈 곳(없으면 설정 첫 화면)]
const PAGES = {
  time: ['공부 시간', TimePage],
  exam: ['시험', ExamPage],
  subjects: ['과목', SubjectsPage],
  account: ['계정 · 동기화', AccountPage],
  display: ['디자인 · 글꼴 · 움직임', DisplayPage],
  font: ['글꼴', FontPage, 'display'],
  views: ['보일 것 고르기', ViewsPage],
};

export function SettingsSheet({ page }) {
  const [cur, setCur] = useState(page || null);
  const P = cur && PAGES[cur];
  const up = P && P[2];
  return html`<${Sheet} title=${P ? P[0] : '설정'} tall>
    <div class="appear" key=${cur || 'root'}>
      ${P ? html`<button class="back" onClick=${() => setCur(up || null)}><${Icon} n="left" s=${20} />${up ? PAGES[up][0] : '설정'}</button>` : null}
      ${P ? html`<${P[1]} nav=${setCur} />` : html`<${Root} nav=${setCur} />`}
    </div>
  <//>`;
}
