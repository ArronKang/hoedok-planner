// 미리 보기 전용 서비스 워커 (…/preview/ 폴더만 맡는다).
// - 아무것도 저장하지 않는다. 같은 사이트의 파일은 열 때마다 새것인지 확인한다(cache: no-cache)
//   → 새로 올린 수정본이 바로 보인다 (GitHub Pages는 파일을 10분쯤 기억해 두기 때문).
// - 이 워커가 있어야 실제 앱의 서비스 워커(sw.js)가 미리 보기 주소를 가로채지 않는다.
// - 요청을 직접 처리하므로 홈 화면에 '앱'으로 설치할 수 있다 (manifest-preview.webmanifest).
// - 실제 앱의 캐시('hoedok-app-…')는 절대 건드리지 않는다.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'CLAIM') self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return; // 글꼴 등은 그대로
  // 화면 열기(navigate) 요청은 옵션을 바꿀 수 없어서 주소로 다시 요청한다
  e.respondWith(req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache' }) : fetch(req, { cache: 'no-cache' }));
});
