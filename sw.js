/* No almacenar HTML/CSS/JS en caché: facilita actualizar la V2 en GitHub Pages. */
const CACHE='rally-copilot-v2-2026-10';
self.addEventListener('install',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rally-copilot-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
// Las rutas y los mapas necesitan conexión; no se afirma funcionamiento offline.
