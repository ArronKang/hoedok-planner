// 서비스 워커 등록 (오프라인 실행 + 설치). 새 버전이 있으면 알려 준다.
import { toast } from './ui/toast.js';

export function registerSW() {
  const host = location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  let forced = false;
  try {
    forced = localStorage.getItem('sp.sw') === '1';
  } catch {
    /* 무시 */
  }
  // 개발 중(localhost)에는 캐시가 방해가 되므로 켜지 않는다 (sp.sw=1이면 켬)
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
      const offer = (worker) => {
        toast('새 버전이 준비됐습니다', {
          action: '새로 고침',
          duration: 15000,
          onAction: () => worker.postMessage({ type: 'SKIP_WAITING' }),
        });
      };
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
        });
      });
      // 앱을 다시 열 때마다 업데이트 확인
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    })
    .catch((e) => console.warn('서비스 워커 등록 실패', e));
}
