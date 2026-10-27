/* Service Worker — تخزين ذكي: الهيكل مسبقاً + الصفحات أثناء القراءة */
const CACHE = "mushaf-v2";
const SHELL = ["./", "./index.html", "./manifest.json", "./cover.webp",
               "./mushaf.webp", "./icon-192.png", "./icon-512.png",
               "./nav-data.json", "./audio/click.mp3"];
const MAX_PAGES = 400; /* أقصى عدد صفحات تتخزن */

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  /* الصفحات: كاش أولاً، وخزّن الجديد + نظّف القديم لو عدينا الحد */
  if (url.pathname.includes("/pages/")) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(async c => {
              await c.put(e.request, copy);
              const keys = await c.keys();
              const pageKeys = keys.filter(k => k.url.includes("/pages/"));
              if (pageKeys.length > MAX_PAGES) {
                for (let i = 0; i < pageKeys.length - MAX_PAGES; i++)
                  await c.delete(pageKeys[i]);
              }
            });
          }
          return res;
        }).catch(() => caches.match("./index.html"));
      })
    );
    return;
  }

  /* خطوط جوجل: كاش أثناء التصفح (أول زيارة بتنزل، الباقي أوفلاين) */
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res && (res.ok || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }))
    );
    return;
  }

  /* باقي الملفات: كاش ثم شبكة */
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok && url.origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
