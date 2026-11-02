// Service worker d'Elrond : rend l'appli installable et l'ouvre même hors ligne.
// Réseau d'abord (pour avoir toujours la dernière version), copie locale en secours.
// Les appels aux API de cours ne sont jamais mis en cache : l'appli gère elle-même le hors-ligne.
const CACHE = 'elrond-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Écran demandé hors ligne : on renvoie l'appli (page unique).
        if (request.mode === 'navigate') return caches.match('/elrond/');
        return Response.error();
      }),
  );
});
