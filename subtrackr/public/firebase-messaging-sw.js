/**
 * public/firebase-messaging-sw.js
 *
 * The browser requires this file to be served from the root of the origin
 * (e.g. https://app.subtrackr.io/firebase-messaging-sw.js).
 *
 * For Expo web (Metro bundler) place this in the `public/` folder.
 * Expo copies everything in `public/` to the web build output root.
 *
 * IMPORTANT: The config values below must match the ones in lib/webPush.ts.
 * Both files intentionally duplicate them so the service worker (which has
 * no access to the JS module graph) can bootstrap Firebase independently.
 */

importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js",
);

const urlParams = new URLSearchParams(location.search);
firebase.initializeApp({
  apiKey: urlParams.get("apiKey"),
  authDomain: urlParams.get("authDomain"),
  projectId: urlParams.get("projectId"),
  storageBucket: urlParams.get("storageBucket"),
  messagingSenderId: urlParams.get("messagingSenderId"),
  appId: urlParams.get("appId"),
});

const messaging = firebase.messaging();

//  Background message handler 
// Called when a push arrives while the tab is in the background or closed.
// FCM already shows a system notification for "notification" payloads; this
// handler covers "data-only" payloads (which our backend sends via the
// putData() call in FirebaseService).
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Background message received:", payload);

  const { title = "SubTrackr", body = "" } = payload.notification ?? {};
  const notificationOptions = {
    body,
    icon: "/icon.png", // place a 192x192 PNG in public/
    badge: "/badge.png", // 96x96 monochrome PNG
    data: payload.data,
  };

  self.registration.showNotification(title, notificationOptions);
});

//  Notification click  focus / open the app tab 
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If the app tab is already open, just focus it
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        // Otherwise open a new tab
        if (clients.openWindow) return clients.openWindow("/");
      }),
  );
});
