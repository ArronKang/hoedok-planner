// 기기별 설정 (이 기기에만 저장, 동기화하지 않음): 화면 배치, 글자 크기, 테마 등
import { createStore } from '../lib/ui.js';

const KEY = 'sp.device.v1';

export const PHONE_TABS = [
  { id: 'today', label: '오늘', icon: 'today' },
  { id: 'calendar', label: '캘린더', icon: 'calendar' },
  { id: 'exams', label: '시험·회독', icon: 'book' },
  { id: 'grades', label: '성적', icon: 'report' },
  { id: 'analysis', label: '분석', icon: 'chart' },
];

/** 패널/탭에 올릴 수 있는 화면 */
export const PANEL_VIEWS = [
  { id: 'today', label: '오늘 할 일', icon: 'today' },
  { id: 'calendar', label: '캘린더', icon: 'calendar' },
  { id: 'exams', label: '회독 트랙', icon: 'book' },
  { id: 'progress', label: '진도 현황', icon: 'target' },
  { id: 'grades', label: '성적', icon: 'report' },
  { id: 'analysis', label: '분석', icon: 'chart' },
];

/** 화면별 카드 (표시·숨김·순서 변경 가능) */
export const VIEW_CARDS = {
  today: [
    { id: 'overdue', label: '지난 미완료 알림' },
    { id: 'dday', label: '시험 D-day' },
    { id: 'load', label: '계획 시간 / 가용 시간' },
    { id: 'tasks', label: '할 일 목록' },
    { id: 'progress', label: '진도 현황 숫자 (가까운 시험)' },
  ],
  calendar: [
    { id: 'month', label: '월 달력' },
    { id: 'day', label: '선택한 날의 할 일' },
  ],
  analysis: [
    { id: 'report', label: '시험 리포트' },
    { id: 'lost', label: '감점 분해' },
    { id: 'compare', label: '직전 시험 대비' },
    { id: 'trend', label: '추이' },
    { id: 'exec', label: '계획 실행 통계' },
    { id: 'wrong', label: '오답 원인 누적' },
  ],
};

export const DEFAULT_HIDDEN = { today: ['progress'] };

const L = (panels, dir = 'row') => ({ dir, panels });
const P = (view, size) => ({ view, size });

export const DEFAULT_PRESETS = [
  {
    id: 'study',
    name: '공부 중',
    layouts: {
      landscape: L([P('today', 0.58), P('exams', 0.42)]),
      portrait: L([P('today', 0.6), P('progress', 0.4)], 'column'),
    },
  },
  {
    id: 'plan',
    name: '계획 세우기',
    layouts: {
      landscape: L([P('calendar', 0.38), P('today', 0.32), P('exams', 0.3)]),
      portrait: L([P('calendar', 0.46), P('today', 0.54)], 'column'),
    },
  },
  {
    id: 'review',
    name: '시험 분석',
    layouts: {
      landscape: L([P('grades', 0.45), P('analysis', 0.55)]),
      portrait: L([P('analysis', 0.56), P('grades', 0.44)], 'column'),
    },
  },
];

const DEFAULTS = {
  theme: 'system', // system | light | dark
  fontSize: 'md', // sm | md | lg | xl
  density: 'comfortable', // comfortable | compact
  toolSide: 'right', // right | left
  dayMode: 'subject', // subject | due | time
  phoneTabs: PHONE_TABS.map((t) => t.id),
  phoneCards: { order: VIEW_CARDS.today.map((c) => c.id), hidden: DEFAULT_HIDDEN.today },
  lastSubjectId: null,
  presets: DEFAULT_PRESETS,
  activePreset: 'study',
  sync: null, // { url, key } — 앱에 기본 설정이 없을 때 직접 입력한 값
  localOnly: false, // 로그인 없이 이 기기에서만 쓰기로 선택
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const v = JSON.parse(raw);
    return { ...DEFAULTS, ...v };
  } catch {
    return { ...DEFAULTS };
  }
}

export const device = createStore(load());

device.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 저장 공간이 막힌 환경 */
  }
  applyDocumentSettings(s);
});

let mql = null;
export function resolvedTheme(s = device.get()) {
  if (s.theme === 'light' || s.theme === 'dark') return s.theme;
  return mql && mql.matches ? 'dark' : 'light';
}

export function applyDocumentSettings(s = device.get()) {
  const root = document.documentElement;
  const theme = resolvedTheme(s);
  root.dataset.theme = theme;
  root.dataset.fs = s.fontSize;
  root.dataset.density = s.density;
  root.dataset.tool = s.toolSide;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0e1218' : '#f5f7fa');
}

export function initDevice() {
  mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (mql) {
    const on = () => applyDocumentSettings();
    if (mql.addEventListener) mql.addEventListener('change', on);
    else if (mql.addListener) mql.addListener(on);
  }
  applyDocumentSettings();
}

export function setDevice(patch) {
  device.set(patch);
}

// ---------- 태블릿 레이아웃 ----------

export function activePreset(s = device.get()) {
  return s.presets.find((p) => p.id === s.activePreset) || s.presets[0];
}

export function layoutFor(preset, orientation) {
  return (preset && preset.layouts && preset.layouts[orientation]) || L([P('today', 1)]);
}

export function updateLayout(presetId, orientation, fn) {
  device.set((s) => ({
    ...s,
    presets: s.presets.map((p) => (p.id === presetId ? { ...p, layouts: { ...p.layouts, [orientation]: fn(layoutFor(p, orientation)) } } : p)),
  }));
}

/** 카드 설정 결합: 저장된 순서 + 새로 생긴 카드 */
export function resolveCards(viewId, cfg) {
  const all = VIEW_CARDS[viewId] || [];
  const order = (cfg && cfg.order) || all.map((c) => c.id);
  const hidden = new Set((cfg && cfg.hidden) || DEFAULT_HIDDEN[viewId] || []);
  const ids = [...order.filter((id) => all.some((c) => c.id === id)), ...all.map((c) => c.id).filter((id) => !order.includes(id))];
  return ids.map((id) => ({ ...all.find((c) => c.id === id), hidden: hidden.has(id) }));
}
