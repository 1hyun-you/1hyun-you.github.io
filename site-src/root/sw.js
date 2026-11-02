/* 최상위 오프라인 기능 해제용: 예전 템트리 노트(최상위 설치) 기기의 오프라인 기능을 대체해 스스로 해제.
   다른 앱(/temtree/, /loop-game/ 등)의 보관함은 지우지 않음. 요청 가로채기 없음 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    // 예전 최상위 앱 보관본만 정리 (새 주소 앱 보관본은 유지)
    for (const k of ks) {
      if (k.startsWith('ttn-shell-')) { const c = await caches.open(k); await c.delete(new Request(self.registration.scope)); }
      if (k === 'ttn-img') { const c = await caches.open(k); for (const r of await c.keys()) if (!new URL(r.url).pathname.startsWith('/temtree/')) await c.delete(r); }   // 예전 최상위 그림 보관본 정리
    }
    await self.registration.unregister();
    const cs = await self.clients.matchAll({ type: 'window' });
    cs.forEach(c => { try { if (new URL(c.url).pathname === '/') c.navigate(c.url); } catch (e) {} });
  })());
});
