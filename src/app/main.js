// 앱 틀: 휴대폰(한 화면 + 아래 탭) / 태블릿·PC(왼쪽 막대 + 두 칸)
import { html } from '../lib/html.js';
import { render, useStore, useErrorBoundary } from '../lib/ui.js';
import * as C from './core.js';
import { initStore, isStorageOk } from './store.js';
import { gcPhotos } from './photos.js';
import { registerSW } from './pwa.js';
import { initSync } from '../sync/sync.js';
import { syncState } from '../sync/state.js';
import { Icon, Toast, hue, StageBar } from './kit.js';
import { TodayScreen, TodayMenu, TaskSheet, AddSheet, EndDaySheet, CalendarSheet, WeekSheet, PlanSheet, PhotoSheet } from './today.js';
import { ProgressList, SubjectPage, RecordSheet, SubjectMenu, ProgressMenu, ColorSheet, SetupSheet, RoutineSheet, EditSheet, AddSubjectSheet } from './progress.js';
import { GradesHome, ExamReport, SemesterPage, NaesinPage, GradesMenu, MockEntrySheet, WrongSheet, WrongStatsSheet, GradeSetupSheet, NaesinTrendSheet } from './grades.js';
import { CycleSheet } from './cycle.js';
import { SettingsSheet, BackupSheet } from './settings.js';
import { Onboarding } from './onboarding.js';

const { store, D, UI, PR } = C;

const SHEETS = {
  task: TaskSheet, add: AddSheet, endday: EndDaySheet, calendar: CalendarSheet, week: WeekSheet, plan: PlanSheet, todayMenu: TodayMenu,
  record: RecordSheet, subjectMenu: SubjectMenu, progressMenu: ProgressMenu, color: ColorSheet, setup: SetupSheet, routine: RoutineSheet, edit: EditSheet, addSubject: AddSubjectSheet,
  gradesMenu: GradesMenu, mockEntry: MockEntrySheet, wrong: WrongSheet, wrongStats: WrongStatsSheet, gradeSetup: GradeSetupSheet, naesinTrend: NaesinTrendSheet,
  cycle: CycleSheet, settings: SettingsSheet, photo: PhotoSheet, backup: BackupSheet,
};

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

function Phone() {
  const ui = UI();
  const tab = ui.tab;
  const t = C.top(tab);
  const back = () => C.pop(tab);
  let main;
  if (tab === 'today') main = html`<${TodayScreen} />`;
  else if (tab === 'progress') main = t ? html`<${SubjectPage} key=${t.id} id=${t.id} back=${back} />` : html`<${ProgressList} />`;
  else main = t ? gradeDetail(t, back) : html`<${GradesHome} />`;
  return html`<div style="display:contents">
    ${main}
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
  let cols;
  if (tab === 'today') {
    cols = html`<div class="col main"><${TodayScreen} /></div>
      ${p.padAside === 'progress' ? html`<div class="col aside"><${ProgressAside} /></div>` : null}
      ${p.padAside === 'calendar' ? html`<div class="col aside"><div class="screen"><header class="head"><div class="t"><h1>달력</h1></div></header><div class="scroll"><div class="body"><${CalendarSheet} inline /></div></div></div></div>` : null}`;
  } else if (tab === 'progress') {
    const first = D().subjects.find((s) => s.stages.length) || D().subjects[0];
    const id = t ? t.id : first && first.id;
    cols = html`<div class=${'col list w-' + p.listWidth}><${ProgressList} /></div><div class="col main">${id ? html`<${SubjectPage} key=${id} id=${id} />` : html`<div class="placeholder">과목을 넣어 주세요</div>`}</div>`;
  } else {
    cols = html`<div class=${'col list w-' + p.listWidth}><${GradesHome} /></div><div class="col main">${gradeDetail(t, ui.stacks.grades.length > 1 ? () => C.pop('grades') : null) || html`<div class="placeholder">왼쪽에서 시험이나 학기를 골라 주세요</div>`}</div>`;
  }
  return html`<div style="display:contents">
    <aside class="side" aria-label="주요 화면">
      ${TABS.map(([id, label, icon]) => html`<button key=${id} aria-current=${tab === id ? 'page' : 'false'} onClick=${() => C.go(id)}><${Icon} n=${icon} /><span>${label}</span></button>`)}
      <span class="sp"></span>
      <button onClick=${() => C.openSheet({ type: 'settings' })}><${Icon} n="gear" /><span>설정</span></button>
    </aside>
    ${cols}
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

function App() {
  const s = useStore(store);
  const [err, reset] = useErrorBoundary();
  const p = s.prefs;
  const ui = s.ui;
  const dark = isDark(p);
  const dev = ui.dev;
  const sh = ui.sheet;
  const Sh = sh && SHEETS[sh.type];
  return html`<div class=${`device ${dev} fullscreen`} data-theme=${p.theme} data-mode=${dark ? 'dark' : 'light'} data-size=${p.size} data-density=${p.density} data-hand=${p.hand} id="device">
    <${StorageNote} />
    ${err ? html`<${Crash} err=${err} reset=${reset} />` : !s.data.onboarded ? html`<${Onboarding} />` : dev === 'pad' ? html`<${Pad} />` : html`<${Phone} />`}
    ${Sh ? html`<${Sh} key=${sh.type + (sh.id || sh.stage || '') + (sh.pickFor || '') + (sh.name || '') + (sh.rec || '')} ...${sh} />` : null}
    <${Toast} t=${ui.toast} />
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
    localStorage.setItem('hoedok.bg', bg); // 다음 실행 첫 화면 색
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
  const root = document.getElementById('app');
  root.textContent = '';
  render(html`<${App} />`, root);
  store.subscribe(() => requestAnimationFrame(syncChrome));
  initBack();
  requestAnimationFrame(syncChrome);
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => C.setUI({}));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && C.UI().sheet) C.closeSheet();
  });
  // 날짜가 바뀐 채로 앱을 다시 열면 '오늘'을 새로 계산해 그린다
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && C.setUI({}));
  setTimeout(() => gcPhotos(D().tasks).catch(() => {}), 4000);
  if (isStorageOk()) {
    initSync().catch((e) => console.warn('동기화 시작 실패', e));
    // 설정이 열려 있으면 동기화 상태 글씨를 새로 그린다
    syncState.subscribe(() => C.UI().sheet && C.UI().sheet.type === 'settings' && C.setUI({}));
  }
  registerSW();
}

boot();
