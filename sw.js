// PowerLogger service worker: makes the app work offline.
// Strategy: network first (so updates show up immediately), cache as fallback.
// Bump CACHE_VERSION when the list of files changes.
const CACHE_VERSION = "powerlogger-v4";

const APP_FILES = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json",
  "./src/assets/css/styles.css",
  "./src/components/buttons.js",
  "./src/components/dialog.js",
  "./src/components/forms.js",
  "./src/components/mood-editor.js",
  "./src/components/top-nav.js",
  "./src/components/ui.js",
  "./src/config/appconfig.json",
  "./src/config/emotiondata.json",
  "./src/pages/app-analytics.js",
  "./src/pages/app-home.js",
  "./src/pages/app-settings.js",
  "./src/pages/item-editor.js",
  "./src/utils/app-navigation.js",
  "./src/utils/app-stats.js",
  "./src/utils/backup.js",
  "./src/utils/charts-tables.js",
  "./src/utils/common.js",
  "./src/utils/create-mockdata.js",
  "./src/utils/data-processing.js",
  "./src/utils/data-validation.js",
  "./src/utils/date.js",
  "./src/utils/reminder.js",
  "./src/vendor/chart.umd.min.js",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Keep the cache up to date with what the network returns
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      })
  );
});
