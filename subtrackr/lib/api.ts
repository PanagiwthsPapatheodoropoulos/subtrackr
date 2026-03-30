import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter, Platform } from 'react-native';

//  Base URL resolution 
const getBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl + '/api';

  if (__DEV__) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const { protocol, hostname } = window.location;
      return `${protocol}//${hostname}:8080/api`;
    }
    return 'http://192.168.1.101:8080/api';
  }

  return 'https://api.subtrackr.app/api';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

//  Attach JWT 
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  (config as any)._sentAccessToken = token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

//  token refresh helper 
async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  try {
    const response = await axios.post(`${getBaseUrl()}/auth/refresh`, {
      refreshToken,
    });
    const { accessToken, refreshToken: newRefresh } = response.data;
    await AsyncStorage.setItem('accessToken', accessToken);
    if (newRefresh) await AsyncStorage.setItem('refreshToken', newRefresh);
    return accessToken;
  } catch {
    return null;
  }
}

//  401 / 403  force logout 
let _loggingOut = false;
let _refreshPromise: Promise<string | null> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status   = err.response?.status;
    const original = err.config;
    const sentToken = original?._sentAccessToken as string | null | undefined;

    // Only retry once, only on 401, not on auth endpoints themselves
    if (
      status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/login') &&
      !original.url?.includes('/auth/register') &&
      !original.url?.includes('/auth/refresh')
    ) {
      original._retry = true;

      // Deduplicate: if a refresh is already in flight, wait for it
      if (!_refreshPromise) {
        _refreshPromise = tryRefreshToken().finally(() => {
          _refreshPromise = null;
        });
      }

      const newToken = await _refreshPromise;

      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }

    // Refresh failed or 403 -> force logout only if this failing request
    // used the currently active token. This avoids wiping a fresh token
    // when an older in-flight request returns late.
    if ((status === 401 || status === 403) && !_loggingOut) {
      const currentToken = await AsyncStorage.getItem('accessToken');
      const sameToken = !!sentToken && sentToken === currentToken;

      if (sameToken) {
        _loggingOut = true;
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
        DeviceEventEmitter.emit('auth:logout');
        setTimeout(() => { _loggingOut = false; }, 2000);
      }
    }

    return Promise.reject(err);
  },
);

export default api;

//  AUTH 
export const authApi = {
  register: (data: { email: string; password: string; fullName: string, emailNotifications: boolean }) =>
    api.post('/auth/register', data),

  login: (data: { email: string; password: string; fcmToken?: string }) =>
    api.post('/auth/login', data),

  logout: () => api.post('/auth/logout'),

  /** Current user profile */
  getProfile: () => api.get('/auth/me'),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/auth/change-password', data),

  deleteAccount: () => api.delete('/auth/account'),

  updateFcmToken: (fcmToken: string) =>
    api.put('/auth/update-fcm-token', { fcmToken }),

  updateEmailNotifications: (enabled: boolean) =>
    api.put('/auth/email-notifications', { enabled }),

  updateAvatar: (avatarBase64: string) => api.put('/auth/avatar', { avatarBase64 }),
};

//  DASHBOARD 
export const dashboardApi = {
  get: () => api.get('/dashboard'),
};

//  SUBSCRIPTIONS 
export const subscriptionsApi = {
  getAll:  (page = 0, size = 20) => api.get(`/subscriptions?page=${page}&size=${size}`),
  create:  (data: any)           => api.post('/subscriptions', data),
  update:  (id: number, data: any) => api.put(`/subscriptions/${id}`, data),
  delete:  (id: number)          => api.delete(`/subscriptions/${id}`),
  pause:   (id: number)          => api.patch(`/subscriptions/${id}/pause`),
  resume:  (id: number)          => api.patch(`/subscriptions/${id}/resume`),
  calendarUrl: (id: number): string =>
    `${api.defaults.baseURL}/subscriptions/${id}/calendar`
};

//  PRICE TRACKERS 
export const trackersApi = {
  getAll:  (page = 0, size = 10) => api.get(`/trackers?page=${page}&size=${size}`),
  create:  (data: { url: string; targetPrice: number; affiliateUrl?: string | null }) => api.post('/trackers', data),
  delete:  (id: number) => api.delete(`/trackers/${id}`),
};

//  NOTIFICATIONS 
export const notificationsApi = {
  getAll:      (page = 0, size = 20) => api.get(`/notifications?page=${page}&size=${size}`),
  markAllRead: ()                     => api.post('/notifications/read-all'),
};

//  PAYMENTS 
export const paymentsApi = {
  createCheckoutSession: () =>
    api.post<{ url: string }>('/payments/create-checkout-session'),
};

//  INSIGHTS 
export const insightsApi = {
  /**
   * GET /api/insights
   * Returns anonymous platform-wide aggregate statistics.
   * Backend caches for 1 hour — safe to call on every screen focus.
   */
  get: () => api.get('/insights'),
};

//  EMAIL DRAFTER 
export const emailDrafterApi = {
  generate: (data: {
    subscriptionName: string;
    billingCycle: string;
    amount: number;
    currency: string;
    category: string;
    emailType: string;
    context?: string;
  }) => api.post('/email-drafter', data),
};

//  GMAIL IMPORT 
export const gmailApi = {
  /**
   * GET /api/gmail/auth-url
   *
   * Returns { authUrl, redirectUri }.
   * - authUrl:     Full Google OAuth consent URL to open in WebBrowser
   * - redirectUri: The URI Google will redirect to after consent (used by
   *                WebBrowser.openAuthSessionAsync as the intercept signal)
   *
   * NOTE: google.oauth.redirect-uri in application.properties must exactly
   * match a URI registered in your Google Cloud Console OAuth credentials.
   * For native builds, use a custom scheme (e.g. subtrackr://gmail-callback).
   * For web builds, use your HTTPS frontend URL (e.g. https://app.subtrackr.io/gmail-callback).
   */
  getAuthUrl: (state: string) => api.get(`/gmail/auth-url?state=${state}`),

  /**
   * POST /api/gmail/import   body: { code }
   *
   * Exchanges the OAuth authorization code for an access token, fetches up to
   * 30 billing/receipt emails from the past 90 days, and returns detected
   * subscriptions. The access token is never stored server-side.
   *
   * Returns { detected: GmailDetectedSubscription[], emailsScanned: number }
   */
  importSubscriptions: (code: string, state: string) =>
    api.post('/gmail/import', { code, state }),
};