// FitList — Service Worker mínimo (network-first)
//
// ESTRATÉGIA: vai sempre à rede primeiro. Só usa a cache
// se a rede falhar (offline). Isto garante que os utilizadores
// veem SEMPRE a versão mais recente do site — nunca uma versão
// antiga presa em cache.

const CACHE = 'fitlist-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Só interceptamos GET do próprio site (não Airtable, Cloudinary, etc.)
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  // Nunca cachear a API interna
  if (url.pathname.startsWith('/airtable')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
