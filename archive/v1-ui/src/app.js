// 앱 진입점
import { html } from './lib/html.js';
import { render, useStore, useErrorBoundary, setErrorHandler } from './lib/ui.js';
import { initDB, getWriteError } from './data/db.js';
import { useDB } from './data/hooks.js';
import { prefs, activeSubjects } from './data/model.js';
import { appState, initAppState } from './state/app.js';
import { device, initDevice } from './state/device.js';
import { syncState } from './sync/state.js';
import { initSync } from './sync/sync.js';
import { OverlayHost, MenuHost } from './ui/overlay.js';
import { ToastHost, toast } from './ui/toast.js';
import { PhoneShell } from './shell/PhoneShell.js';
import { TabletShell } from './shell/TabletShell.js';
import { Onboarding } from './views/onboarding.js';
import { AuthScreen } from './views/auth.js';

function Crash({ error, reset }) {
  return html`<div class="crash">
    <h2>화면을 그리다 문제가 생겼습니다</h2>
    <p class="sub">기록은 안전하게 저장되어 있습니다. 다시 시도하거나 앱을 새로 고침하세요.</p>
    <pre>${String((error && error.stack) || error)}</pre>
    <div class="hstack">
      <button class="btn" onClick=${reset}>다시 시도</button>
      <button class="btn primary" onClick=${() => location.reload()}>새로 고침</button>
    </div>
  </div>`;
}

function Loading({ text }) {
  return html`<div class="boot"><div class="boot-mark"></div><p>${text}</p></div>`;
}

function App() {
  const dbv = useDB();
  const [err, reset] = useErrorBoundary();
  const isTablet = useStore(appState, (s) => s.isTablet);
  const sync = useStore(syncState);
  const localOnly = useStore(device, (s) => s.localOnly);
  if (err) return html`<${Crash} error=${err} reset=${reset} />`;
  const p = prefs();
  const hasSubjects = activeSubjects().length > 0;
  let body;
  if (sync.configured && !sync.user && !localOnly) body = html`<${AuthScreen} />`;
  else if (!p.onboarded && !hasSubjects && sync.user && !sync.lastSync) body = html`<${Loading} text="서버에서 기록을 받는 중…" />`;
  else if (!p.onboarded) body = html`<${Onboarding} />`;
  else body = isTablet ? html`<${TabletShell} dbv=${dbv} />` : html`<${PhoneShell} dbv=${dbv} />`;
  return html`<div class="app-root">
    ${body}
    <${OverlayHost} />
    <${MenuHost} />
    <${ToastHost} />
  </div>`;
}

async function boot() {
  const root = document.getElementById('app');
  initDevice();
  initAppState();
  setErrorHandler((e) => {
    console.error(e);
    toast('문제가 생겼습니다: ' + ((e && e.message) || e));
  });
  try {
    await initDB();
  } catch (e) {
    root.innerHTML = '';
    render(html`<div class="crash"><h2>저장소를 열 수 없습니다</h2><p class="sub">${String(e.message || e)}</p><p class="sub">사파리의 개인정보 보호 브라우징에서는 저장이 막힐 수 있습니다. 일반 창에서 열어 주세요.</p></div>`, root);
    return;
  }
  try {
    await initSync();
  } catch (e) {
    console.error('sync init', e);
  }
  render(html`<${App} />`, root);
  window.addEventListener('pagehide', () => {
    if (getWriteError()) console.warn('저장 대기 중');
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    import('./pwa.js').then((m) => m.registerSW()).catch(() => {});
  }
}

boot();
