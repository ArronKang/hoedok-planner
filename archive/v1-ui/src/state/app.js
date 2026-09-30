// 앱 실행 중 상태 (저장하지 않음): 기기 형태, 방향, 선택한 날짜, 온라인 여부
import { createStore } from '../lib/ui.js';

function measure() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  // 태블릿 판정: 짧은 변이 600px 이상 (아이폰 가로 모드는 휴대폰으로 취급)
  const isTablet = Math.min(w, h) >= 600;
  return { w, h, isTablet, orientation: w >= h ? 'landscape' : 'portrait' };
}

export const appState = createStore({
  ...measure(),
  selectedDate: null, // null이면 오늘
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  now: Date.now(),
});

let raf = 0;
function onResize() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const m = measure();
    const s = appState.get();
    if (m.w !== s.w || m.h !== s.h) appState.set(m);
    updateKeyboardInset();
  });
}

function updateKeyboardInset() {
  const vv = window.visualViewport;
  if (!vv) return;
  const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  document.documentElement.style.setProperty('--kb', kb > 60 ? kb + 'px' : '0px');
}

export function initAppState() {
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateKeyboardInset);
    window.visualViewport.addEventListener('scroll', updateKeyboardInset);
  }
  window.addEventListener('online', () => appState.set({ online: true }));
  window.addEventListener('offline', () => appState.set({ online: false }));
  // 날짜가 바뀌는 것을 감지하기 위한 시계 (1분마다, 화면이 보일 때)
  setInterval(() => {
    if (document.visibilityState === 'visible') appState.set({ now: Date.now() });
  }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') appState.set({ now: Date.now() });
  });
}

export function setSelectedDate(date) {
  appState.set({ selectedDate: date });
}
