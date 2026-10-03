// 서비스 워커: 인터넷 없이도 앱이 열리게 한다.
// - 앱 파일(FILES)은 설치할 때 한꺼번에 받아 두고, 버전이 바뀌면 새로 받는다 (섞이지 않게).
// - 글꼴처럼 다른 주소에서 오는 파일은 처음 쓸 때 저장해 두고 뒤에서 새로 고친다.
// - 서버(동기화) 요청은 건드리지 않는다.
// 파일을 고치면 `python tools/bump_sw.py`로 VERSION을 새로 계산한다 (테스트가 확인함).
const VERSION = 'b8110eb6b7d9';
const APP = 'hoedok-app-' + VERSION;
const RUNTIME = 'hoedok-runtime';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'styles/app.css',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'src/app/main.js',
  'src/app/core.js',
  'src/app/store.js',
  'src/app/photos.js',
  'src/app/pwa.js',
  'src/app/kit.js',
  'src/app/motion.js',
  'src/app/today.js',
  'src/app/progress.js',
  'src/app/grades.js',
  'src/app/cycle.js',
  'src/app/settings.js',
  'src/app/onboarding.js',
  'src/app/account.js',
  'src/app/fonts.js',
  'src/lib/html.js',
  'src/lib/ui.js',
  'src/core/date.js',
  'src/core/num.js',
  'src/core/calc/naesin.js',
  'src/data/db.js',
  'src/data/idb.js',
  'src/data/attachments.js',
  'src/sync/sync.js',
  'src/sync/supabase.js',
  'src/sync/state.js',
  'src/sync/settings.js',
  'src/sync/secure-store.js',
  'src/config.js',
  'src/env.js',
];
const RUNTIME_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('hoedok-app-') && k !== APP).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // 앱 화면을 열 때는 언제나 저장해 둔 index.html
    if (req.mode === 'navigate') {
      e.respondWith(caches.match('index.html', { cacheName: APP }).then((r) => r || fetch(req)));
      return;
    }
    e.respondWith(caches.match(req, { cacheName: APP, ignoreSearch: true }).then((r) => r || fetch(req)));
    return;
  }
  if (RUNTIME_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(RUNTIME).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || net;
      }),
    );
  }
});
