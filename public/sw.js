/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Ubutaka Smart Land - Service Worker for Offline Caching and Intermittent Connectivity
 */

const CACHE_NAME = "ubutaka-smart-land-cache-v3";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html"
];

// Install Event: cache pre-defined core shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching app shell and static assets...");
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn("[Service Worker] Cache pre-fill skipped (non-blocking):", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event: clear out older caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Clearing old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: intercept requests and serve from cache if offline
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Intercept GET requests only
  if (request.method !== "GET") return;

  // Handle Socket.IO, Live API and main Express endpoints: Network-first
  if (url.pathname.includes("socket.io") || url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() => {
        if (request.headers.get("accept")?.includes("application/json")) {
          return new Response(
            JSON.stringify({ 
              offline: true, 
              message: "Offline: Land Registry API is operating in intermittent local fallback read-only mode." 
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        }
      })
    );
    return;
  }

  // Assets (scripts, CSS, html, local resources): Network-first falling back to Cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful requests on the fly
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If HTML navigation request falls back to cache, return root
          if (request.mode === "navigate") {
            return caches.match("/");
          }
          return new Response("Resource unavailable in offline mode.", { 
            status: 503, 
            statusText: "Offline Unavailable" 
          });
        });
      })
  );
});
