// 앱 틀: 휴대폰(한 화면 + 아래 탭) / 태블릿(왼쪽 막대 + 두 칸)
import { html } from '../../../src/lib/html.js';
import { render, useStore, useErrorBoundary } from '../../../src/lib/ui.js';
import * as C from './core.js';
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

const FULL = new URLSearchParams(location.search).has('full') || (window.matchMedia && matchMedia('(pointer: coarse)').matches);

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
  return html`<div class="placeholder"><h3>화면을 그리다 문제가 생겼어요</h3><pre style="white-space:pre-wrap;font-size:12px;text-align:left">${String((err && err.stack) || err)}</pre><button class="btn" onClick=${reset}>다시 시도</button></div>`;
}

function App() {
  const s = useStore(store);
  const [err, reset] = useErrorBoundary();
  const p = s.prefs;
  const ui = s.ui;
  const dark = p.mode === 'dark' || (p.mode === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  const dev = ui.dev;
  const sh = ui.sheet;
  const Sh = sh && SHEETS[sh.type];
  const cls = `device ${dev} ${FULL ? 'fullscreen' : 'frame ' + dev}`;
  return html`<div class=${cls} data-theme=${p.theme} data-mode=${dark ? 'dark' : 'light'} data-size=${p.size} data-density=${p.density} data-hand=${p.hand} id="device">
    ${dev === 'phone' ? html`<div class="statusbar"><span class="num">9:41</span><span>●●●</span></div>` : null}
    ${err ? html`<${Crash} err=${err} reset=${reset} />` : !s.data.onboarded ? html`<${Onboarding} />` : dev === 'pad' ? html`<${Pad} />` : html`<${Phone} />`}
    ${Sh ? html`<${Sh} key=${sh.type + (sh.id || sh.stage || '') + (sh.pickFor || '') + (sh.name || '') + (sh.rec || '')} ...${sh} />` : null}
    <${Toast} t=${ui.toast} />
  </div>`;
}

// ─────────── 시작 ───────────

const root = document.getElementById('root');

function fit() {
  if (FULL) return;
  const sc = document.getElementById('scaler');
  const dev = document.getElementById('device');
  if (!sc || !dev) return;
  const W = dev.offsetWidth, H = dev.offsetHeight;
  const k = Math.min(1, (window.innerWidth - 36) / (W + 4));
  sc.style.transform = `scale(${k})`;
  sc.style.height = `${H * k}px`;
  sc.style.width = `${W}px`;
}

function detectDev() {
  return Math.min(window.innerWidth, window.innerHeight) >= 600 ? 'pad' : 'phone';
}

if (FULL) {
  document.body.classList.add('full');
  document.querySelector('.lab').remove();
  C.setUI({ dev: detectDev() });
  window.addEventListener('resize', () => {
    const d = detectDev();
    if (d !== C.UI().dev) C.setUI({ dev: d });
  });
} else {
  const saved = localStorage.getItem('hoedok-proto-dev');
  if (saved) C.setUI({ dev: saved });
  document.querySelectorAll('.lab [data-dev]').forEach((b) =>
    b.addEventListener('click', () => {
      localStorage.setItem('hoedok-proto-dev', b.dataset.dev);
      C.setUI({ dev: b.dataset.dev, stacks: { today: [], progress: [], grades: [] } });
    }),
  );
  document.querySelector('.lab [data-act="reset"]').addEventListener('click', () => C.resetAll());
  document.querySelector('.lab [data-act="demo"]').addEventListener('click', () => C.loadDemo());
  document.querySelector('.lab [data-act="examday"]').addEventListener('click', () => {
    if (!C.D().onboarded) C.loadDemo();
    if (C.jumpToExamDay()) C.setUI({ tab: 'today', day: null, sheet: null });
    else C.toast('지금 준비 중인 시험이 없어요');
  });
  const syncLab = () => document.querySelectorAll('.lab [data-dev]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.dev === C.UI().dev ? 'true' : 'false'));
  store.subscribe(syncLab);
  syncLab();
  window.addEventListener('resize', fit);
  store.subscribe(() => requestAnimationFrame(fit));
}

if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => C.commit());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && C.UI().sheet) C.closeSheet();
});

render(html`<${App} />`, root);
requestAnimationFrame(fit);
