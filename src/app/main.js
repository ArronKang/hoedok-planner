// 앱 틀: 휴대폰(한 화면 + 아래 탭) / 태블릿·PC(왼쪽 막대 + 두 칸)
import { html } from '../lib/html.js';
import { render, useStore, useErrorBoundary, useRef, useLayoutEffect } from '../lib/ui.js';
import * as C from './core.js';
import * as M from './motion.js';
import { initStore, isStorageOk } from './store.js';
import { gcPhotos } from './photos.js';
import { registerSW, isStandalone, canPrompt, promptInstall, platform } from './pwa.js';
import { initSync } from '../sync/sync.js';
import { PREVIEW, ns, previewLabel } from '../env.js';
import { syncState } from '../sync/state.js';
import { Icon, Toast, hue, StageBar, useFade, Sheet } from './kit.js';
import { TodayScreen, TodayMenu, TaskSheet, AddSheet, EndDaySheet, CalendarSheet, WeekSheet, PlanSheet, PhotoSheet, DueSheet, RepeatsSheet } from './today.js';
import { ProgressList, SubjectPage, RecordSheet, SubjectMenu, ProgressMenu, ColorSheet, SetupSheet, RoutineSheet, EditSheet, AddSubjectSheet } from './progress.js';
import { GradesHome, ExamReport, SemesterPage, NaesinPage, GradesMenu, MockEntrySheet, WrongSheet, WrongStatsSheet, GradeSetupSheet, NaesinTrendSheet } from './grades.js';
import { CycleSheet } from './cycle.js';
import { SettingsSheet, BackupSheet } from './settings.js';
import { Onboarding } from './onboarding.js';

const { store, D, UI, PR } = C;

const SHEETS = {
  task: TaskSheet, add: AddSheet, endday: EndDaySheet, calendar: CalendarSheet, week: WeekSheet, plan: PlanSheet, todayMenu: TodayMenu, due: DueSheet, repeats: RepeatsSheet,
  record: RecordSheet, subjectMenu: SubjectMenu, progressMenu: ProgressMenu, color: ColorSheet, setup: SetupSheet, routine: RoutineSheet, edit: EditSheet, addSubject: AddSubjectSheet,
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

const INSTALL_STEPS = {
  ios: ['화면 아래(아이패드는 위)의 공유 단추 □↑ 를 눌러요', "목록을 내려 '홈 화면에 추가'를 눌러요", "이름이 '미리 보기'인지 보고 오른쪽 위 '추가'를 눌러요"],
  samsung: ['화면 아래 메뉴 ≡ 를 눌러요', "'현재 페이지 추가'(버전에 따라 '페이지 추가')를 눌러요", "'홈 화면'을 골라요"],
  android: ['오른쪽 위 ⋮ 메뉴를 눌러요', "'홈 화면에 추가' 또는 '앱 설치'를 눌러요", "'설치'나 '추가'를 눌러요"],
  desktop: ['주소창 오른쪽의 설치 표시나 브라우저 메뉴를 눌러요', "'앱 설치' 또는 '바로가기 만들기'를 골라요"],
};
const OTHER = { ios: '아이폰·아이패드 (Safari)', samsung: '갤럭시 (삼성 인터넷)', android: '안드로이드 (크롬)', desktop: 'PC' };

/** 홈 화면에 추가하는 법 — 지금 기기에 맞는 것부터 */
function InstallSheet() {
  const me = platform();
  const steps = (k) => html`<ol class="steps-list">${INSTALL_STEPS[k].map((s, i) => html`<li key=${i}>${s}</li>`)}</ol>`;
  return html`<${Sheet} title="미리 보기를 홈 화면에" footer=${canPrompt() ? html`<button class="btn pri" onClick=${() => promptInstall().then(C.closeSheet)}>지금 추가하기</button>` : html`<button class="btn pri" onClick=${C.closeSheet}>알겠어요</button>`}>
    <p class="sub" style="margin:0 0 14px">한 번만 추가해 두면 앱처럼 아이콘을 눌러 열 수 있어요. 새로 올린 수정본은 다음에 열 때 저절로 보여요.</p>
    <div class="sec-title" style="margin-top:0">${OTHER[me]}</div>
    ${steps(me)}
    ${me === 'samsung' ? html`<p class="hint">주소창에 설치 표시(⬇)가 보이면 그걸 눌러도 돼요.</p>` : null}
    ${me === 'ios' ? html`<p class="hint">Safari에서 하는 게 가장 확실해요. 홈 화면의 미리 보기는 Safari와 저장 공간이 따로라, 처음 열면 '예시로 먼저 둘러보기'부터 시작해요.</p>` : null}
    <p class="hint">주황색 아이콘 '미리 보기'가 생겨요. 실제 앱(초록 아이콘)과 기록이 따로라 무엇을 해도 실제 기록은 그대로예요.</p>
    <details class="other-dev">
      <summary>다른 기기라면</summary>
      ${Object.keys(INSTALL_STEPS).filter((k) => k !== me).map((k) => html`<div key=${k}><div class="sec-title">${OTHER[k]}</div>${steps(k)}</div>`)}
    </details>
  <//>`;
}

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

/** 지금 보고 있는 화면을 가리키는 글자 (바뀌면 새 화면이 부드럽게 나타난다) */
const entryKey = (e) => (e ? `${e.view}:${e.id || ''}:${e.sem || ''}:${e.rec || ''}` : '');

function Phone() {
  const ui = UI();
  const tab = ui.tab;
  const t = C.top(tab);
  const back = () => C.pop(tab);
  const view = useRef(null);
  useFade(view, `${tab}|${entryKey(t)}|${tab === 'today' ? C.viewDay() : ''}`);
  let main;
  if (tab === 'today') main = html`<${TodayScreen} />`;
  else if (tab === 'progress') main = t ? html`<${SubjectPage} key=${t.id} id=${t.id} back=${back} />` : html`<${ProgressList} />`;
  else main = t ? gradeDetail(t, back) : html`<${GradesHome} />`;
  return html`<div style="display:contents">
    <div class="view" ref=${view}>${main}</div>
    <nav class="tabbar" aria-label="주요 화면">
      ${TABS.map(([id, label, icon]) => html`<button key=${id} aria-current=${tab === id ? 'page' : 'false'} onClick=${() => {
        if (tab === id && ui.stacks[id].length) C.setUI({ stacks: { ...ui.stacks, [id]: [] } });
        else C.go(id);
      }}><${Icon} n=${icon} s=${25} /><span>${label}</span></button>`)}
      <button onClick=${() => C.openSheet({ type: 'settings' })}><${Icon} n="gear" s=${25} /><span>설정</span></button>
    </nav>
  </div>`;
}

function Pad() {
  const ui = UI();
  const p = PR();
  const tab = ui.tab;
  const t = C.top(tab);
  // 탭을 옮기면 오른쪽 전체가, 같은 탭에서 고른 것만 바뀌면 오른쪽 큰 칸만 부드럽게
  const view = useRef(null);
  const mainCol = useRef(null);
  const last = useRef(null);
  const detail = `${entryKey(t)}|${tab === 'today' ? C.viewDay() : ''}`;
  useLayoutEffect(() => {
    const prev = last.current;
    last.current = { tab, detail };
    if (!prev || !M.viewOn()) return;
    const fr = [{ opacity: 0, translate: '0 6px' }, { opacity: 1, translate: '0 0' }];
    if (prev.tab !== tab) M.play(view.current, fr, 220);
    else if (prev.detail !== detail) M.play(mainCol.current, fr, 220);
  }, [tab, detail]);
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
  return html`<div style="display:contents">
    <aside class="side" aria-label="주요 화면">
      ${TABS.map(([id, label, icon]) => html`<button key=${id} aria-current=${tab === id ? 'page' : 'false'} onClick=${() => C.go(id)}><${Icon} n=${icon} /><span>${label}</span></button>`)}
      <span class="sp"></span>
      <button onClick=${() => C.openSheet({ type: 'settings' })}><${Icon} n="gear" /><span>설정</span></button>
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

const sheetKey = (sh) => sh.type + (sh.id || sh.stage || '') + (sh.pickFor || '') + (sh.name || '') + (sh.rec || '');

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
    if (root) {
      // 창이 없어지면 배경까지, 다른 창으로 넘어가면 창만
      const close = !sheetK;
      const g = M.capture(close ? root : root.querySelector('.sheet'));
      if (g) out.current.push(() => M.sheetOut(g, close));
    }
    M.setSheetSwap(!!(prev.sheet && sheetK));
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
  return html`<div class=${`device ${dev} fullscreen${PREVIEW ? ' preview' : ''}`} data-theme=${p.theme} data-mode=${dark ? 'dark' : 'light'} data-size=${p.size} data-density=${p.density} data-hand=${p.hand} data-motion=${M.level()} id="device">
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
  let ignore = 0; // 앱이 스스로 되돌린 기록에서 오는 popstate는 무시
  store.subscribe((s) => {
    const d = depthOf(s);
    if (d > depth) for (let i = depth; i < d; i++) history.pushState({ hoedok: i + 1 }, '');
    else if (d < depth && history.state && history.state.hoedok) {
      ignore++;
      history.go(-Math.min(depth - d, history.state.hoedok));
    }
    depth = d;
  });
  window.addEventListener('popstate', () => {
    if (ignore > 0) {
      ignore--;
      return;
    }
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
  const bg = getComputedStyle(dev).getPropertyValue('--bg').trim();
  if (!bg || bg === lastBg) return;
  lastBg = bg;
  document.body.style.background = bg;
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', bg);
  try {
    localStorage.setItem(ns('hoedok.bg'), bg); // 다음 실행 첫 화면 색
  } catch {
    /* 무시 */
  }
}

async function boot() {
  C.setUI({ dev: detectDev() });
  window.addEventListener('resize', () => {
    const d = detectDev();
    if (d !== C.UI().dev) C.setUI({ dev: d });
  });
  await initStore();
  if (C.fillRepeats()) C.commit(); // 반복하는 일: 오늘부터 2주 앞까지
  const root = document.getElementById('app');
  root.textContent = '';
  render(html`<${App} />`, root);
  M.play(document.getElementById('device'), [{ opacity: 0 }, { opacity: 1 }], 200);
  // 아이폰 Safari는 터치 신호를 받는 곳이 있어야 눌림 표시(:active)를 보여 준다
  document.addEventListener('touchstart', () => {}, { passive: true });
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
  // 미리 보기는 동기화하지 않는다 (실제 계정 기록을 건드리지 않게)
  if (isStorageOk() && !PREVIEW) {
    initSync().catch((e) => console.warn('동기화 시작 실패', e));
    // 설정이 열려 있으면 동기화 상태 글씨를 새로 그린다
    syncState.subscribe(() => C.UI().sheet && C.UI().sheet.type === 'settings' && C.setUI({}));
  }
  registerSW();
}

boot();
