const CACHE_NAME = 'mantresi-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './icon-192.png',
  './icon-512.png',
  'https://unpkg.com/lucide@latest'
];

// El resto del código que ya tienes abajo (install, activate, fetch) déjalo exactamente como está.


// Instalación del Service Worker y almacenamiento en caché de los archivos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Abriendo caché y guardando recursos...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activación y limpieza de cachés antiguas si las hubiera
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Borrando caché antigua:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia: Cache First, fallback to Network (Carga instantánea offline)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Devuelve el recurso si está en caché, si no, lo busca en la red
        return response || fetch(event.request);
      })
  );
});
