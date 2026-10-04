// 앱 틀: 휴대폰(한 화면 + 아래 탭) / 태블릿·PC(왼쪽 막대 + 두 칸)
import { html } from '../lib/html.js';
import { render, useStore, useErrorBoundary, useRef, useLayoutEffect, useEffect } from '../lib/ui.js';
import * as C from './core.js';
import * as M from './motion.js';
import { initStore, isStorageOk } from './store.js';
import { gcPhotos } from './photos.js';
import { registerSW, isStandalone, canPrompt, promptInstall, platform, keepStorage } from './pwa.js';
import { initSync, needsAttention } from '../sync/sync.js';
import { PREVIEW, ns, previewLabel } from '../env.js';
import { syncState } from '../sync/state.js';
import { ensureFont } from './fonts.js';
import { Icon, Toast, hue, StageBar, useCross, Sheet, glassBar } from './kit.js';
import { TodayScreen, TodayMenu, TaskSheet, AddSheet, EndDaySheet, CalendarSheet, WeekSheet, PlanSheet, PhotoSheet, DueSheet, RepeatsSheet } from './today.js';
import { ProgressList, SubjectPage, RecordSheet, SubjectMenu, ProgressMenu, ColorSheet, SetupSheet, RoutineSheet, EditSheet, AddSubjectSheet, LabelsSheet } from './progress.js';
import { GradesHome, ExamReport, SemesterPage, NaesinPage, GradesMenu, MockEntrySheet, WrongSheet, WrongStatsSheet, GradeSetupSheet, NaesinTrendSheet } from './grades.js';
import { CycleSheet } from './cycle.js';
import { SettingsSheet, BackupSheet } from './settings.js';
import { Onboarding } from './onboarding.js';

const { store, D, UI, PR } = C;

const SHEETS = {
  task: TaskSheet, add: AddSheet, endday: EndDaySheet, calendar: CalendarSheet, week: WeekSheet, plan: PlanSheet, todayMenu: TodayMenu, due: DueSheet, repeats: RepeatsSheet,
  record: RecordSheet, subjectMenu: SubjectMenu, progressMenu: ProgressMenu, color: ColorSheet, setup: SetupSheet, routine: RoutineSheet, edit: EditSheet, addSubject: AddSubjectSheet, labels: LabelsSheet,
  gradesMenu: GradesMenu, mockEntry: MockEntrySheet, wrong: WrongSheet, wrongStats: WrongStatsSheet, gradeSetup: GradeSetupSheet, naesinTrend: NaesinTrendSheet,
  cycle: CycleSheet, settings: SettingsSheet, photo: PhotoSheet, backup: BackupSheet, install: InstallSheet,
};

// ─────────── 미리 보기 ───────────

/** 맨 위 주황색 줄. 홈 화면 앱으로 연 게 아니면 누르면 '홈 화면에 추가' */
function PreviewBar() {
  const label = previewLabel();
  const text = html`<span class="lbl"><b>미리 보기</b>${label ? ` · ${label}` : ''}</span>`;
  if (isStandalone()) return html`<div class="preview-bar" role="note">${text}</div>`;
  return html`<button class="preview-bar go" onClick=${() => (canPrompt() ? promptInstall() : C.openSheet({ type: 'install' }))}>
    ${text}<span class="add">홈 화면에 추가 ›</span>
  </button>`;
}

// ─────────── 홈 화면에 추가 (앱처럼 열기) ───────────

const APP_NAME = PREVIEW ? '미리 보기' : '회독 플래너';
const INSTALL_STEPS = {
  ios: ['화면 아래(아이패드는 위)의 공유 단추 □↑ 를 눌러요', "목록을 내려 '홈 화면에 추가'를 눌러요", `이름이 '${APP_NAME}'인지 보고 오른쪽 위 '추가'를 눌러요`],
  samsung: ['화면 아래 메뉴 ≡ 를 눌러요', "'현재 페이지 추가'(버전에 따라 '페이지 추가')를 눌러요", "'홈 화면'을 골라요"],
  android: ['오른쪽 위 ⋮ 메뉴를 눌러요', "'홈 화면에 추가' 또는 '앱 설치'를 눌러요", "'설치'나 '추가'를 눌러요"],
  desktop: ['주소창 오른쪽의 설치 표시나 브라우저 메뉴를 눌러요', "'앱 설치' 또는 '바로가기 만들기'를 골라요"],
};
const OTHER = { ios: '아이폰·아이패드 (Safari)', samsung: '갤럭시 (삼성 인터넷)', android: '안드로이드 (크롬)', desktop: 'PC' };

/** 홈 화면에 추가하는 법 — 지금 기기에 맞는 것부터 */
function InstallSheet() {
  const me = platform();
  const steps = (k) => html`<ol class="steps-list">${INSTALL_STEPS[k].map((s, i) => html`<li key=${i}>${s}</li>`)}</ol>`;
  return html`<${Sheet} title=${PREVIEW ? '미리 보기를 홈 화면에' : '홈 화면에 앱으로 추가'} footer=${canPrompt() ? html`<button class="btn pri" onClick=${() => promptInstall().then(C.closeSheet)}>지금 추가하기</button>` : html`<button class="btn pri" onClick=${C.closeSheet}>알겠어요</button>`}>
    <p class="sub" style="margin:0 0 14px">${PREVIEW
      ? '한 번만 추가해 두면 앱처럼 아이콘을 눌러 열 수 있어요. 새로 올린 수정본은 다음에 열 때 저절로 보여요.'
      : '한 번만 추가해 두면 아이콘을 눌러 앱처럼 열려요. 주소창 없이 화면을 꽉 채우고, 인터넷이 없어도 열려요.'}</p>
    <div class="sec-title" style="margin-top:0">${OTHER[me]}</div>
    ${steps(me)}
    ${me === 'samsung' ? html`<p class="hint">주소창에 설치 표시(⬇)가 보이면 그걸 눌러도 돼요.</p>` : null}
    ${me === 'ios'
      ? html`<p class="hint">Safari에서 해야 해요. 아이콘으로 연 앱은 Safari와 기록이 따로라, ${PREVIEW ? "처음 열면 '예시로 먼저 둘러보기'부터 시작해요" : '처음 설정과 로그인은 아이콘으로 연 앱에서 하세요'}.</p>`
      : null}
    <p class="hint">${PREVIEW
      ? "주황색 아이콘 '미리 보기'가 생겨요. 실제 앱(초록 아이콘)과 기록이 따로라 무엇을 해도 실제 기록은 그대로예요."
      : "초록색 아이콘 '회독 플래너'가 생겨요. 다음부터는 그 아이콘을 눌러 여세요."}</p>
    <details class="other-dev">
      <summary>다른 기기라면</summary>
      ${Object.keys(INSTALL_STEPS).filter((k) => k !== me).map((k) => html`<div key=${k}><div class="sec-title">${OTHER[k]}</div>${steps(k)}</div>`)}
    </details>
  <//>`;
}

/** 설정 단추: 로그인이 풀렸거나 오래 못 맞출 때만 작은 점 */
const SettingsDot = () => (needsAttention() ? html`<i class="att-dot" aria-label="계정 확인 필요"></i>` : null);

const TABS = [
  ['today', '오늘', 'today'],
  ['progress', '진도', 'progress'],
  ['grades', '성적', 'grades'],
];

function gradeDetail(e, back) {
  if (!e) return null;
  if (e.view === 'exam') return html`<${ExamReport} key=${'e' + e.id} id=${e.id} back=${back} />`;
  if (e.view === 'semester') return html`<${SemesterPage} key=${'s' + e.id} id=${e.id} back=${back} />`;
  if (e.view === 'naesin') return html`<${NaesinPage} key=${'n' + e.rec} sem=${e.sem} rec=${e.rec} back=${back} />`;
  return null;
}

function ProgressAside() {
  return html`<div class="screen">
    <header class="head"><div class="t"><span class="kicker">체크하면 바로 채워져요</span><h1>진도</h1></div></header>
    <div class="scroll"><div class="body">
      ${D().subjects.filter((s) => s.stages.length).map((s) => html`<button class="sj hue" key=${s.id} style=${hue(s.h)} onClick=${() => C.push('progress', { view: 'subject', id: s.id }, true)}>
        <div class="top"><span class="dot"></span><span class="name">${s.name}</span><span class="pct">${C.P(C.pct(s))}</span></div>
        <${StageBar} sub=${s} />
      </button>`)}
    </div></div>
  </div>`;
}

/** 지금 보고 있는 화면을 가리키는 글자 (바뀌면 새 화면이 겹쳐 바뀌며 나타난다) */
const entryKey = (e) => (e ? `${e.view}:${e.id || ''}:${e.sem || ''}:${e.rec || ''}` : '');

/** 지금 탭을 한 번 더 누르면: 들어간 화면이 있으면 처음으로, 이미 처음이면 맨 위로 (아이폰 기본) */
function tapTab(id) {
  const ui = UI();
  if (ui.tab !== id) return C.go(id);
  if (ui.stacks[id].length) return C.setUI({ stacks: { ...ui.stacks, [id]: [] } });
  const sc = document.querySelector('.view .scroll');
  if (sc && sc.scrollTop > 0) sc.scrollTo({ top: 0, behavior: M.on() ? 'smooth' : 'auto' });
}

/** 할 일 추가: 과목 화면에서 누르면 그 과목을 골라 둔다 */
function addTask() {
  const t = C.top('progress');
  C.openSheet({ type: 'add', subjectId: UI().tab === 'progress' && t ? t.id : null });
}

function Phone() {
  const ui = UI();
  const p = PR();
  const tab = ui.tab;
  const t = C.top(tab);
  const back = () => C.pop(tab);
  const view = useRef(null);
  const lens = useRef(null);
  const bubble = useRef(null);
  const glass = glassBar();
  useCross(view, `${tab}|${entryKey(t)}|${tab === 'today' ? C.viewDay() : ''}`, 4);
  const idx = TABS.findIndex(([id]) => id === tab);
  // 유리 막대 (아이폰 전화 앱처럼): 쉴 때는 고른 탭 뒤의 회색 알약.
  // 탭을 바꾸면 알약이 막대보다 큰 투명 유리 방울로 떠올라 새 탭으로 미끄러지고, 다시 알약으로 내려앉는다.
  const lastIdx = useRef(idx);
  useLayoutEffect(() => {
    const from = lastIdx.current;
    lastIdx.current = idx;
    if (!glass || from === idx || from < 0 || idx < 0 || !lens.current) return;
    const d = (from - idx) * 100;
    const ease = 'cubic-bezier(.32, .72, .2, 1)';
    M.play(lens.current, [{ opacity: 1, transform: `translateX(${d}%)` }, { opacity: 0, transform: `translateX(${d}%)`, offset: 0.14 }, { opacity: 0, transform: 'translateX(0)', offset: 0.8 }, { opacity: 1, transform: 'translateX(0)' }], 560, 'linear');
    M.play(bubble.current, [
      { opacity: 0, transform: `translateX(${d}%) scale(1, 1)` },
      { opacity: 1, transform: `translateX(${d}%) scale(1.16, 1.3)`, offset: 0.16 },
      { opacity: 1, transform: 'translateX(0) scale(1.16, 1.3)', offset: 0.74 },
      { opacity: 0, transform: 'translateX(0) scale(1, 1)' },
    ], 560, ease);
  }, [idx]);
  let main;
  if (tab === 'today') main = html`<${TodayScreen} />`;
  else if (tab === 'progress') main = t ? html`<${SubjectPage} key=${t.id} id=${t.id} back=${back} />` : html`<${ProgressList} />`;
  else main = t ? gradeDetail(t, back) : html`<${GradesHome} />`;
  const labels = p.tabLabels !== false;
  const btns = [
    ...TABS.map(([id, label, icon]) => html`<button key=${id} aria-current=${tab === id ? 'page' : 'false'} aria-label=${labels ? undefined : label} onClick=${() => tapTab(id)}><span class="ic"><${Icon} n=${icon} s=${glass ? 24 : 25} /></span>${labels ? html`<span class="lb">${label}</span>` : null}</button>`),
    html`<button key="set" aria-label=${labels ? undefined : '설정'} onClick=${() => C.openSheet({ type: 'settings' })}><span class="ic"><${Icon} n="gear" s=${glass ? 24 : 25} /><${SettingsDot} /></span>${labels ? html`<span class="lb">설정</span>` : null}</button>`,
  ];
  if (glass)
    return html`<div style="display:contents">
      <div class="view glass-view" ref=${view}>${main}</div>
      <div class=${'dock' + (labels ? '' : ' bare')}>
        <nav class="tabbar glass" aria-label="주요 화면" style=${{ '--n': TABS.length + 1, '--i': Math.max(0, idx) }}>
          ${idx >= 0 ? html`<i class="lens" ref=${lens} aria-hidden="true"></i><i class="lens-glass" ref=${bubble} aria-hidden="true"></i>` : null}
          ${btns}
        </nav>
        <button class="dock-add" aria-label="할 일 추가" onClick=${addTask}><${Icon} n="plus" w=${2.2} /></button>
      </div>
    </div>`;
  return html`<div style="display:contents">
    <div class="view" ref=${view}>${main}</div>
    <nav class=${'tabbar' + (labels ? '' : ' bare')} aria-label="주요 화면">${btns}</nav>
  </div>`;
}

function Pad() {
  const ui = UI();
  const p = PR();
  const tab = ui.tab;
  const t = C.top(tab);
  // 탭을 옮기면 오른쪽 전체가, 같은 탭에서 고른 것만 바뀌면 오른쪽 큰 칸만 겹쳐 바뀐다
  const view = useRef(null);
  const mainCol = useRef(null);
  const last = useRef({ tab, detail: null });
  const job = useRef(null);
  const detail = `${entryKey(t)}|${tab === 'today' ? C.viewDay() : ''}`;
  if (last.current.detail === null) last.current.detail = detail;
  if (last.current.tab !== tab || last.current.detail !== detail) {
    const whole = last.current.tab !== tab;
    job.current = M.viewOn() ? { whole, g: M.viewCapture(whole ? view.current : mainCol.current) } : null;
    last.current = { tab, detail };
  }
  useLayoutEffect(() => {
    const j = job.current;
    job.current = null;
    if (!j || !M.viewOn()) return;
    M.crossfade(j.g, j.whole ? view.current : mainCol.current, 200, j.whole ? 4 : 0);
  });
  let cols;
  if (tab === 'today') {
    cols = html`<div class="col main" ref=${mainCol}><${TodayScreen} /></div>
      ${p.padAside === 'progress' ? html`<div class="col aside"><${ProgressAside} /></div>` : null}
      ${p.padAside === 'calendar' ? html`<div class="col aside"><div class="screen"><header class="head"><div class="t"><h1>달력</h1></div></header><div class="scroll"><div class="body"><${CalendarSheet} inline /></div></div></div></div>` : null}`;
  } else if (tab === 'progress') {
    const first = D().subjects.find((s) => s.stages.length) || D().subjects[0];
    const id = t ? t.id : first && first.id;
    cols = html`<div class=${'col list w-' + p.listWidth}><${ProgressList} /></div><div class="col main" ref=${mainCol}>${id ? html`<${SubjectPage} key=${id} id=${id} />` : html`<div class="placeholder">과목을 넣어 주세요</div>`}</div>`;
  } else {
    cols = html`<div class=${'col list w-' + p.listWidth}><${GradesHome} /></div><div class="col main" ref=${mainCol}>${gradeDetail(t, ui.stacks.grades.length > 1 ? () => C.pop('grades') : null) || html`<div class="placeholder">왼쪽에서 시험이나 학기를 골라 주세요</div>`}</div>`;
  }
  const labels = p.tabLabels !== false;
  return html`<div style="display:contents">
    <aside class=${'side' + (labels ? '' : ' bare')} aria-label="주요 화면">
      ${TABS.map(([id, label, icon]) => html`<button key=${id} aria-current=${tab === id ? 'page' : 'false'} aria-label=${labels ? undefined : label} onClick=${() => tapTab(id)}><${Icon} n=${icon} />${labels ? html`<span>${label}</span>` : null}</button>`)}
      <span class="sp"></span>
      <button aria-label=${labels ? undefined : '설정'} onClick=${() => C.openSheet({ type: 'settings' })}><span class="ic"><${Icon} n="gear" /><${SettingsDot} /></span>${labels ? html`<span>설정</span>` : null}</button>
    </aside>
    <div class="view pad-view" ref=${view}>${cols}</div>
  </div>`;
}

function Crash({ err, reset }) {
  return html`<div class="placeholder"><h3>화면을 그리다 문제가 생겼어요</h3><p>기록은 안전하게 저장돼 있어요. 아래를 눌러 다시 그려 보세요.</p><button class="btn pri" onClick=${reset}>다시 시도</button><pre style="white-space:pre-wrap;font-size:12px;text-align:left;margin-top:16px;opacity:.7">${String((err && err.stack) || err)}</pre></div>`;
}

/** 저장이 안 되는 환경일 때만 뜨는 한 줄 */
function StorageNote() {
  if (isStorageOk()) return null;
  return html`<div class="storage-note" role="alert">이 브라우저에서는 기록을 저장할 수 없어요. 창을 닫으면 사라져요. (사생활 보호 모드라면 일반 창에서 열어 주세요)</div>`;
}

const sheetKey = (sh) => sh.type + (sh.id || sh.stage || '') + (sh.pickFor || '') + (sh.name || '') + (sh.rec || '') + (sh.book || '');

/**
 * 창·알림이 사라지는 움직임: 다시 그리기 **직전**의 모습을 복사해 두었다가(motion.capture),
 * 다시 그린 뒤 화면 맨 위에서 흐리게 지운다(motion.release). 실제 화면은 바로 바뀐다.
 */
function useExits(sheetK, toastId) {
  const sheetLayer = useRef(null);
  const toastLayer = useRef(null);
  const last = useRef({ sheet: null, toast: null });
  const out = useRef([]);
  const prev = last.current;
  M.setSheetSwap(false);
  if (prev.sheet !== sheetK) {
    const root = prev.sheet && sheetLayer.current && sheetLayer.current.firstElementChild;
    // 휴대폰 창을 끝까지 끌어내려 닫았으면 이미 화면 밖 → 복사본 없이, 다음 창은 처음 열리듯 올라온다
    const dragged = M.takeSkipExit();
    if (root && !dragged) {
      // 창이 없어지면 배경까지, 다른 창으로 넘어가면 창만
      const close = !sheetK;
      const g = close ? M.capture(root) : M.capture(root.querySelector('.sheet'), true);
      if (g) out.current.push(() => M.sheetOut(g, close));
    }
    M.setSheetSwap(!!(prev.sheet && sheetK) && !dragged);
  }
  if (prev.toast && prev.toast !== toastId && !toastId) {
    const el = toastLayer.current && toastLayer.current.querySelector('.toast');
    const g = M.capture(el);
    if (g) out.current.push(() => M.release(g, [[null, [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 8px' }]]], 160));
  }
  last.current = { sheet: sheetK, toast: toastId };
  useLayoutEffect(() => {
    const jobs = out.current;
    out.current = [];
    for (const j of jobs) j();
    M.setSheetSwap(false);
  });
  return [sheetLayer, toastLayer];
}

function App() {
  const s = useStore(store);
  const [err, reset] = useErrorBoundary();
  const p = s.prefs;
  const ui = s.ui;
  const dark = isDark(p);
  const dev = ui.dev;
  const sh = ui.sheet;
  const Sh = sh && SHEETS[sh.type];
  const sk = Sh ? sheetKey(sh) : null;
  const [sheetLayer, toastLayer] = useExits(sk, ui.toast ? ui.toast.id : null);
  useEffect(() => ensureFont(p.font), [p.font]);
  return html`<div class=${`device ${dev} fullscreen${PREVIEW ? ' preview' : ''}`} data-theme=${p.theme} data-mode=${dark ? 'dark' : 'light'} data-size=${p.size} data-font=${p.font || 'pretendard'} data-density=${p.density} data-hand=${p.hand} data-motion=${M.level()} data-bar=${dev === 'phone' && glassBar() ? 'glass' : 'classic'} data-accent=${p.accent || 'theme'} data-bold=${p.bold ? 'on' : 'off'} id="device">
    ${PREVIEW ? html`<${PreviewBar} />` : null}
    <${StorageNote} />
    ${err ? html`<${Crash} err=${err} reset=${reset} />` : !s.data.onboarded ? html`<${Onboarding} />` : dev === 'pad' ? html`<${Pad} />` : html`<${Phone} />`}
    <div class="sheet-layer" ref=${sheetLayer}>${Sh ? html`<${Sh} key=${sk} ...${sh} />` : null}</div>
    <div class="toast-layer" ref=${toastLayer}><${Toast} t=${ui.toast} /></div>
  </div>`;
}

const isDark = (p) => p.mode === 'dark' || (p.mode === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);

// ─────────── 뒤로 가기 ───────────
// 안드로이드 뒤로 가기(와 아이폰 Safari의 뒤로 밀기)가 앱을 끄지 않고
// 열린 창을 닫거나 한 단계 앞 화면으로 가게 한다. 화면 깊이만큼 브라우저 기록을 맞춰 둔다.
function initBack() {
  const depthOf = (s) => (s.ui.sheet ? 1 : 0) + ((s.ui.stacks || {})[s.ui.tab] || []).length;
  let depth = depthOf(store.get());
  // 앱이 스스로 기록을 되돌리는 중이면 도착할 깊이. 그 popstate는 무시한다.
  // (전에는 횟수로 세서, 닫자마자 다시 여는 등으로 되돌리기가 취소되면 숫자가 남아 다음 '뒤로'를 무시했다)
  let expect = null;
  const at = () => (history.state && history.state.hoedok) || 0;
  store.subscribe((s) => {
    const d = depthOf(s);
    if (d > depth) {
      for (let i = depth; i < d; i++) history.pushState({ hoedok: i + 1 }, '');
      expect = null;
    } else if (d < depth && at()) {
      const n = Math.min(depth - d, at());
      expect = at() - n;
      history.go(-n);
    }
    depth = d;
  });
  window.addEventListener('popstate', () => {
    const a = at();
    const e = expect;
    expect = null;
    if (e != null && a === e) return;
    // 사용자의 '뒤로'는 언제나 지금 깊이보다 얕은 곳에 도착한다. 같거나 깊으면 앱이 되돌리다 남은 것
    if (a >= depth) return;
    const ui = C.UI();
    const stack = (ui.stacks || {})[ui.tab] || [];
    if (ui.sheet) {
      depth--;
      C.closeSheet();
    } else if (stack.length) {
      depth--;
      C.pop(ui.tab);
    }
  });
}

// ─────────── 시작 ───────────

function detectDev() {
  return Math.min(window.innerWidth, window.innerHeight) >= 600 ? 'pad' : 'phone';
}

/** 주소창·상태 표시줄 색을 지금 디자인 배경색에 맞춘다 */
let lastBg = '';
function syncChrome() {
  const dev = document.getElementById('device');
  if (!dev) return;
  const cs = getComputedStyle(dev);
  const bg = cs.getPropertyValue('--bg').trim();
  const key = bg + cs.getPropertyValue('--accent');
  if (!bg || key === lastBg) return;
  lastBg = key;
  document.body.style.background = bg;
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', bg);
  try {
    localStorage.setItem(ns('hoedok.bg'), bg); // 다음 실행 첫 화면 색
    localStorage.setItem(ns('hoedok.ink'), cs.getPropertyValue('--ink').trim()); // 시작 화면 글자·칸 색
    localStorage.setItem(ns('hoedok.ac'), cs.getPropertyValue('--accent').trim());
  } catch {
    /* 무시 */
  }
}

/**
 * 시작 화면 걷어 내기: 칸이 채워지고 이름이 다 써진 뒤(앱을 연 지 약 1.3초) 흐려지며 앱이 떠오른다.
 * 앱을 늦게 불러왔으면 바로, 누르면 바로, 움직임을 껐으면 기다리지 않는다.
 */
function hideSplash() {
  const sp = document.getElementById('splash');
  if (!sp) return;
  const still = document.documentElement.classList.contains('sp-still') || !M.on();
  const f = parseFloat(getComputedStyle(sp).getPropertyValue('--f')) || 1;
  const go = () => {
    if (sp.dataset.gone) return;
    sp.dataset.gone = '1';
    if (still) return sp.remove();
    sp.classList.add('out');
    M.play(document.getElementById('device'), [{ opacity: 0, transform: 'translateY(14px) scale(.985)' }, { opacity: 1, transform: 'none' }], 460, M.EASE_SHEET);
    setTimeout(() => sp.remove(), 460 * f + 80);
  };
  if (still) return go();
  sp.addEventListener('pointerdown', go, { once: true });
  setTimeout(go, Math.max(0, 1300 * f - performance.now()));
}

/** 고른 글꼴을 저장소를 열기 전에 먼저 부른다 → 첫 화면부터 그 글꼴 */
function earlyFont() {
  try {
    const dev = JSON.parse(localStorage.getItem(ns('hoedok.device.v1')) || 'null');
    if (dev && dev.font) ensureFont(dev.font);
  } catch {
    /* 무시 */
  }
}

/** 로그인 뒤 처음 맞추면 무엇을 받아 왔는지 한 줄로. 처음 화면에서 로그인했으면 기록이 들어온 뒤 창을 닫는다 */
function onFirstSync(r) {
  const got = r.pulled || {};
  const subj = got.subjects || 0, tasks = got.tasks || 0;
  if (subj || tasks) C.toast(`계정에서 ${[subj ? `과목 ${subj}개` : '', tasks ? `할 일 ${tasks}개` : ''].filter(Boolean).join(' · ')}를 받아 왔어요`);
  else C.toast('로그인했어요. 이제 이 기기 기록이 계정과 맞춰져요');
  const sh = C.UI().sheet;
  if (sh && sh.from === 'ob' && D().onboarded) C.closeSheet();
}

async function boot() {
  earlyFont();
  C.setUI({ dev: detectDev() });
  window.addEventListener('resize', () => {
    const d = detectDev();
    if (d !== C.UI().dev) C.setUI({ dev: d });
  });
  await initStore();
  // 앱을 열면 볼 화면 (설정 › 화면)
  const st = PR().startTab;
  const first = st === 'last' ? PR().lastTab : st;
  if (first && first !== 'today' && ['progress', 'grades'].includes(first)) C.setUI({ tab: first });
  if (C.fillRepeats()) C.commit(); // 반복하는 일: 오늘부터 2주 앞까지
  const root = document.getElementById('app');
  root.textContent = '';
  render(html`<${App} />`, root);
  hideSplash();
  // 아이폰 Safari는 터치 신호를 받는 곳이 있어야 눌림 표시(:active)를 보여 준다
  document.addEventListener('touchstart', () => {}, { passive: true });
  // 두 손가락으로 확대하지 않는다 (아이폰 Safari는 화면 설정만으로는 안 막힌다). 글자 크기는 설정 › 글자에서.
  for (const t of ['gesturestart', 'gesturechange']) document.addEventListener(t, (e) => e.preventDefault(), { passive: false });
  // 기기의 '동작 줄이기'를 바꾸면 바로 반영 (사용자가 직접 고른 적 없을 때)
  M.onOsChange(() => C.setUI({}));
  store.subscribe(() => requestAnimationFrame(syncChrome));
  initBack();
  requestAnimationFrame(syncChrome);
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => C.setUI({}));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && C.UI().sheet) C.closeSheet();
  });
  // 날짜가 바뀐 채로 앱을 다시 열면 '오늘'을 새로 계산해 그리고, 반복하는 일도 2주 앞까지 채운다
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (C.fillRepeats()) C.commit();
    else C.setUI({});
  });
  setTimeout(() => gcPhotos(D().tasks).catch(() => {}), 4000);
  // 동기화: 미리 보기도 같은 계정을 쓰되 서버의 기록 공간이 따로다 (src/env.js SPACE)
  if (isStorageOk()) {
    let att = false, firstAt = null;
    syncState.subscribe((s) => {
      if (s.firstDone && s.firstDone.at !== firstAt) {
        firstAt = s.firstDone.at;
        setTimeout(() => onFirstSync(s.firstDone), 300); // 받아 온 기록이 화면에 들어간 뒤에
      }
      // 설정이 열려 있거나 설정 단추의 점이 바뀔 때만 새로 그린다
      const a = needsAttention(s);
      if (a !== att || (C.UI().sheet && C.UI().sheet.type === 'settings')) C.setUI({});
      att = a;
    });
    initSync().catch((e) => console.warn('동기화 시작 실패', e));
  }
  registerSW();
  // 홈 화면 앱으로 쓰거나 처음 설정을 마친 기기는 기록을 지우지 말아 달라고 요청
  if (isStandalone() || D().onboarded) keepStorage();
}

boot();
