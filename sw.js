// ===== CodeHub Service Worker =====
const CACHE_NAME = 'codehub-v1';

// الملفات اللي هتتخزن فوراً (App Shell)
const SHELL_URLS = [
    '/',
    '/index.html',
    'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=JetBrains+Mono:wght@400;600&display=swap',
];

// ── تثبيت: خزّن الـ App Shell ──
self.addEventListener('install', function(e) {
    e.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(SHELL_URLS);
        })
    );
    self.skipWaiting();
});

// ── تفعيل: امسح الكاش القديم ──
self.addEventListener('activate', function(e) {
    e.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            );
        })
    );
    self.clients.claim();
});

// ── Fetch: Network First للـ Firebase، Cache First للباقي ──
self.addEventListener('fetch', function(e) {
    const url = e.request.url;

    // Firebase و Google APIs → حاول النت أول، لو فشل جيب من الكاش
    if (url.includes('firestore.googleapis.com') ||
        url.includes('firebase') ||
        url.includes('googleapis.com')) {
        e.respondWith(
            fetch(e.request)
                .then(function(res) {
                    // خزّن نسخة من الرد
                    if (res && res.status === 200) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                    }
                    return res;
                })
                .catch(function() {
                    return caches.match(e.request);
                })
        );
        return;
    }

    // الخطوط والملفات الثابتة → Cache First
    if (url.includes('fonts.googleapis.com') ||
        url.includes('fonts.gstatic.com') ||
        url.includes('gstatic.com')) {
        e.respondWith(
            caches.match(e.request).then(function(cached) {
                return cached || fetch(e.request).then(function(res) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                    return res;
                });
            })
        );
        return;
    }

    // index.html والملفات المحلية → Network First مع Fallback
    e.respondWith(
        fetch(e.request)
            .then(function(res) {
                const clone = res.clone();
                caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                return res;
            })
            .catch(function() {
                return caches.match(e.request) || caches.match('/index.html');
            })
    );
});
