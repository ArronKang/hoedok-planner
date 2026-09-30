// 서비스 워커(인터넷 없이 열기 + 홈 화면 설치). 새 버전이 준비되면 한 줄로 알려 준다.
import { toast } from './core.js';

export function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const host = location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  let forced = false;
  try {
    forced = localStorage.getItem('hoedok.sw') === '1';
  } catch {
    /* 무시 */
  }
  // 개발 중(localhost)에는 고친 파일이 바로 보이도록 켜지 않는다 (hoedok.sw=1이면 켬)
  if (isLocal && !forced) return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
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
