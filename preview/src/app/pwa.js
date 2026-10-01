// 서비스 워커(인터넷 없이 열기 + 홈 화면 설치). 새 버전이 준비되면 한 줄로 알려 준다.
import { toast, setUI, openSheet } from './core.js';
import { PREVIEW, ns } from '../env.js';

// ─────────── 홈 화면에 추가 (앱처럼 열기) ───────────
// 갤럭시(삼성 인터넷·크롬)는 설치 창을 바로 띄울 수 있다(beforeinstallprompt).
// 아이폰은 그런 방법이 없어서 공유 › 홈 화면에 추가 안내를 보여 준다 (main.js InstallSheet).
let installEvent = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    setUI({});
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    toast(PREVIEW ? "홈 화면에 '미리 보기'를 추가했어요" : '홈 화면에 추가했어요. 이제 아이콘을 눌러 열어 주세요');
  });
}

/** 기기가 공간이 모자랄 때도 기록을 지우지 않게 해 달라고 한 번 요청한다 (홈 화면 앱이면 대개 바로 허락됨) */
export async function keepStorage() {
  try {
    const st = typeof navigator !== 'undefined' && navigator.storage;
    if (!st || !st.persist || !st.persisted) return false;
    if (await st.persisted()) return true;
    return await st.persist();
  } catch {
    return false;
  }
}
/** 홈 화면 아이콘으로 연 것인가 (주소창 없이) */
export const isStandalone = () =>
  (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) || (typeof navigator !== 'undefined' && navigator.standalone === true);
/** 설치 창을 바로 띄울 수 있나 */
export const canPrompt = () => !!installEvent;
export async function promptInstall() {
  const e = installEvent;
  if (!e) return false;
  installEvent = null;
  e.prompt();
  try {
    const r = await e.userChoice;
    return r && r.outcome === 'accepted';
  } finally {
    setUI({});
  }
}
/** 홈 화면에 추가하라는 안내를 보여도 되나: 브라우저 창으로 열었을 때만 (미리 보기는 맨 위 주황 줄이 대신한다) */
export const installable = () => !PREVIEW && !isStandalone();
/** 설치 창을 바로 띄울 수 있으면 띄우고, 아니면 기기별 안내 */
export const openInstall = () => (canPrompt() ? promptInstall() : openSheet({ type: 'install' }));

// '홈 화면에 추가' 한 줄을 닫았는지 (이 기기에만)
const HINT_KEY = ns('hoedok.installHint');
export function installHintOn() {
  if (!installable() || platform() === 'desktop') return false;
  try {
    return localStorage.getItem(HINT_KEY) !== 'off';
  } catch {
    return true;
  }
}
export function hideInstallHint() {
  try {
    localStorage.setItem(HINT_KEY, 'off');
  } catch {
    /* 저장 공간이 막힌 환경 */
  }
  setUI({});
}

/** 안내에 쓸 기기 종류 */
export function platform() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
  if (ios) return 'ios';
  if (/SamsungBrowser/.test(ua)) return 'samsung';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/**
 * 미리 보기: 아무것도 저장하지 않는 서비스 워커(preview-sw.js)로 미리 보기 폴더만 맡는다.
 * - 실제 앱의 서비스 워커가 미리 보기 주소까지 가로채서 옛 화면 틀을 주는 것을 막는다.
 * - 실제 앱의 오프라인 저장(캐시)은 건드리지 않는다.
 * 처음 한 번은 실제 앱의 서비스 워커가 옛 화면 틀을 줄 수 있다 → 미리 보기가 자리 잡으면 한 번 새로 연다.
 */
function registerPreviewSW() {
  const wrongShell = !document.documentElement.hasAttribute('data-preview');
  const KEY = 'preview.reloaded';
  let reloaded = false;
  try {
    reloaded = sessionStorage.getItem(KEY) === '1';
  } catch {
    /* 무시 */
  }
  navigator.serviceWorker
    .register('preview-sw.js', { scope: './' })
    .then((reg) => {
      if (!wrongShell || reloaded) return;
      const again = () => {
        try {
          sessionStorage.setItem(KEY, '1');
        } catch {
          /* 무시 */
        }
        location.reload();
      };
      const mine = () => navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL.endsWith('/preview-sw.js');
      if (mine()) return again();
      navigator.serviceWorker.addEventListener('controllerchange', () => mine() && again());
      if (reg.active) reg.active.postMessage({ type: 'CLAIM' });
    })
    .catch((e) => console.warn('미리 보기 서비스 워커 등록 실패', e));
}

export function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (PREVIEW) return registerPreviewSW();
  const host = location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  let forced = false;
  try {
    forced = localStorage.getItem(ns('hoedok.sw')) === '1';
  } catch {
    /* 무시 */
  }
  // 개발 중(localhost)에는 고친 파일이 바로 보이도록 켜지 않는다 (hoedok.sw=1이면 켬)
  if (isLocal && !forced) return;
  let refreshing = false;
  // 처음 설치될 때는 새로 고치지 않는다 (이미 최신 파일로 떠 있으므로). 새 버전으로 바뀔 때만.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return;
    refreshing = true;
    location.reload();
  });
  navigator.serviceWorker
    .register('sw.js')
    .then((reg) => {
      const offer = (w) => toast('새 버전이 준비됐어요', () => w.postMessage({ type: 'SKIP_WAITING' }), '새로 고침', 20000);
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
        });
      });
      // 앱을 다시 열 때마다 새 버전 확인
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    })
    .catch((e) => console.warn('서비스 워커 등록 실패', e));
}
