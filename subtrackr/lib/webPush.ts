/**
 * lib/webPush.ts
 *
 * Registers the browser for Firebase web push notifications and returns
 * the FCM registration token.  The token is then sent to the backend via
 * the existing /api/auth/update-fcm-token endpoint, exactly like the
 * native flow in lib/notifications.ts.
 *
 * This module is intentionally web-only  call it only after checking
 * Platform.OS === 'web'.
 *
 * Setup checklist
 * 
 * 1. Set the six EXPO_PUBLIC_FIREBASE_* environment variables in .env
 *    (and in your Railway / Vercel dashboard for production).
 * 2. Copy public/firebase-messaging-sw.js to your project's public/ folder.
 * 3. Replace the VAPID_PUBLIC_KEY constant below with the "Web Push
 *    certificates" key pair from Firebase Console  Project Settings 
 *    Cloud Messaging  Web configuration.
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';

//  Firebase web config 
// Values come from EXPO_PUBLIC_* env vars so they're safely embedded in the
// client bundle (they are not secret  Firebase API keys are designed to be
// public; security is enforced via Firebase Security Rules).
const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY            || '',
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN        || '',
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID         || '',
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET     || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID             || '',
};

// VAPID public key
const VAPID_PUBLIC_KEY =
  process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY || '';

//  Singleton helpers 
let _app: FirebaseApp | null       = null;
let _messaging: Messaging | null   = null;

function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseConfig.projectId || !firebaseConfig.apiKey) return null;
  if (!_app) {
    _app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return _app;
}

function getFirebaseMessaging(): Messaging | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (!_messaging) {
    _messaging = getMessaging(app);
  }
  return _messaging;
}

//  Public API 

/**
 * Requests notification permission, registers the service worker, and
 * returns the FCM token.
 *
 * Returns null if:
 *   - The browser doesn't support push (no service worker / no Notification API)
 *   - The user denies permission
 *   - Firebase config is missing / misconfigured
 */
export async function registerWebPush(): Promise<string | null> {
  // Guard: only runs in a real browser environment
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('[webPush] Service workers not supported');
    return null;
  }

  if (!('Notification' in window)) {
    console.log('[webPush] Notifications API not supported');
    return null;
  }

  // Bail out early if the user has already blocked notifications
  if (Notification.permission === 'denied') {
    console.log('[webPush] Notifications blocked by user');
    return null;
  }

  // Sanity-check config  avoids a cryptic Firebase error in development
  if (!firebaseConfig.projectId) {
    console.warn(
      '[webPush] Firebase config is empty. ' +
      'Set EXPO_PUBLIC_FIREBASE_* env vars and restart the dev server.',
    );
    return null;
  }

  try {
    // Register (or reuse) the service worker
    const params = new URLSearchParams(firebaseConfig as any).toString();
    const registration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${params}`,
      { scope: '/' },
    );
    console.log('[webPush] Service worker registered successfully');

    const messaging = getFirebaseMessaging();
    if (!messaging) return null;

    // getToken() will prompt the user for permission if not yet granted
    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY.trim(),
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log('[webPush] Web Push notification token generated successfully');
      return token;
    }

    console.warn('[webPush] getToken() returned empty  check VAPID key');
    return null;

  } catch (err) {
    console.error('[webPush] Registration failed:', err);
    return null;
  }
}

/**
 * Listens for messages while the web tab is in the foreground.
 * FCM suppresses the system notification when the tab is focused, so we
 * show a lightweight in-app toast instead.
 *
 * Pass any function that renders a toast / banner in your UI.
 *
 * Returns an unsubscribe function  call it on component unmount.
 */
export function onWebPushMessage(
  handler: (title: string, body: string) => void,
): () => void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {};
  }

  try {
    const messaging = getFirebaseMessaging();
    if (!messaging) return () => {};
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[webPush] Foreground message:', payload);
      const title = payload.notification?.title ?? 'SubTrackr';
      const body  = payload.notification?.body  ?? '';
      handler(title, body);
    });
    return unsubscribe;
  } catch {
    return () => {};
  }
}