// 미리 보기 전용 서비스 워커 (…/preview/ 폴더만 맡는다).
// 아무것도 저장하지 않고 모든 요청을 그대로 인터넷으로 보낸다 → 늘 방금 올린 수정본이 보인다.
// 이 워커가 있어야 실제 앱의 서비스 워커(sw.js)가 미리 보기 주소를 가로채지 않는다.
// 실제 앱의 캐시('hoedok-app-…')는 절대 건드리지 않는다.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'CLAIM') self.clients.claim();
});
