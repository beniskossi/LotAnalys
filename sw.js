importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

if (workbox) {
  console.log(`Yay! Workbox is loaded 🎉`);

  // 1. Cache CSS, JS (StaleWhileRevalidate)
  // This allows the app to load fast from cache while updating in background
  workbox.routing.registerRoute(
    ({request}) => request.destination === 'script' || request.destination === 'style',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'static-resources',
    })
  );

  // 2. Cache Images (CacheFirst)
  workbox.routing.registerRoute(
    ({request}) => request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: 'images',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );

  // 3. Cache API Calls (NetworkFirst)
  // We want fresh data, but if offline, fallback to cached JSON response.
  // Note: We also have IndexedDB logic in the app code for finer control.
  workbox.routing.registerRoute(
    ({url}) => url.origin === 'https://lotobonheur.ci',
    new workbox.strategies.NetworkFirst({
      cacheName: 'api-responses',
      networkTimeoutSeconds: 3, // Fallback to cache if network takes > 3s
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60, // 1 Day
        }),
      ],
    })
  );
  
  // 4. App Shell / Navigation
  workbox.routing.registerRoute(
    ({request}) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
        cacheName: 'pages',
        networkTimeoutSeconds: 3
    })
  );

} else {
  console.log(`Boo! Workbox didn't load 😬`);
}