/* 템트리 노트 설치형 앱: 오프라인에서도 열리도록 화면과 이미지를 기기에 보관 */
const SHELL = 'ttn-shell-00b8009174', IMG = 'ttn-img';
const CORE = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== IMG).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if(req.method !== 'GET' || u.origin !== location.origin) return;   /* GitHub 동기화 등 외부 요청은 그대로 */
  if(u.pathname.endsWith('.webp')){   /* 이미지: 주소에 내용 지문이 있어 한 번 받으면 계속 사용, 예전 지문 파일은 정리 */
    e.respondWith(caches.open(IMG).then(async c => {
      const hit = await c.match(req); if(hit) return hit;
      const r = await fetch(req);
      if(r.ok){ (await c.keys()).forEach(k => { const ku = new URL(k.url); if(ku.pathname === u.pathname && ku.search !== u.search) c.delete(k); }); c.put(req, r.clone()); }
      return r;
    }));
    return;
  }
  if(req.mode === 'navigate'){   /* 화면: 최신 우선. 연결이 없거나 2.5초 넘게 걸리면 보관본 */
    e.respondWith((async () => {
      const cache = await caches.open(SHELL), saved = await cache.match('./');
      const net = fetch(req).then(r => { if(r.ok) cache.put('./', r.clone()); return r; });
      if(!saved) return net;
      return Promise.race([net.catch(() => saved), new Promise(res => setTimeout(() => res(saved), 2500))]);
    })());
    return;
  }
  if(CORE.some(p => u.pathname.endsWith(p.replace('./', '/')))) e.respondWith(caches.match(req).then(h => h || fetch(req)));
  /* data.json·skills.json은 앱이 직접 기기에 저장하므로 그대로 네트워크 */
});
