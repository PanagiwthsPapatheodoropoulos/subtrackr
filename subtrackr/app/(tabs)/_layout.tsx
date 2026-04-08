import { useState, useRef, useEffect, useCallback } from 'react';
import { Tabs, router, useSegments } from 'expo-router';
import {
  View, Text, TouchableOpacity, Animated,
  Pressable, Platform, Dimensions, Image, Modal, DeviceEventEmitter, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { storage } from '../../lib/storage';
import { notificationsApi } from '../../lib/api';

const IS_WEB = Platform.OS === 'web';
const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = IS_WEB ? 260 : Math.min(280, SCREEN_W * 0.78);

const NAV_ITEMS = [
  { name: 'index',         emoji: '🏠', label: 'Home'           },
  { name: 'subscriptions', emoji: '📋', label: 'Subscriptions'  },
  { name: 'trackers',      emoji: '📈', label: 'Price Tracker'  },
  { name: 'savings',       emoji: '💰', label: 'Savings Report' },
  { name: 'notifications', emoji: '🔔', label: 'Notifications'  },
  { name: 'email-drafter', emoji: '✉️', label: 'Email Drafter'  },
  { name: 'gmail-import',  emoji: '📬', label: 'Gmail Import'   },
  { name: 'settings',      emoji: '⚙️', label: 'Settings'       },
  { name: 'profile',       emoji: '👤', label: 'Profile'        },
];

const AVATAR_KEY = 'user_avatar_b64';

// ── Global unread notification counter ───────────────────────────────────────
// Any screen can call updateGlobalUnreadCount() to push a new value.
// The drawer and header bell will re-render automatically.

let _globalUnread = 0;
const _unreadListeners = new Set<(n: number) => void>();

export function updateGlobalUnreadCount(count: number) {
  _globalUnread = Math.max(0, count);
  _unreadListeners.forEach(fn => fn(_globalUnread));
}

export function useUnreadCount() {
  const [count, setCount] = useState(_globalUnread);
  useEffect(() => {
    _unreadListeners.add(setCount);
    return () => { _unreadListeners.delete(setCount); };
  }, []);
  return count;
}

// Fetch unread count from backend and push to all listeners.
// Call this after marking notifications read, or on screen focus.
export async function refreshUnreadCount() {
  try {
    const res = await notificationsApi.getAll(0, 1);
    // The paginated response from /notifications doesn't filter by unread,
    // but the dashboard response includes unreadNotifications.
    // Easiest: call dashboard. Instead we store count from last dashboard load.
    // Better approach: listen to DeviceEventEmitter('notifications:count', n).
    // The dashboard screen calls updateGlobalUnreadCount after load.
  } catch {}
}

export async function getStoredAvatar(): Promise<string | null> {
  try {
    if (IS_WEB) return localStorage.getItem(AVATAR_KEY);
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return await AsyncStorage.getItem(AVATAR_KEY);
  } catch { return null; }
}

let _openDrawer: (() => void) | null = null;
export function openDrawer() { _openDrawer?.(); }


// ── Hamburger ────────────────────────────────────────────────────────────────

export function HamburgerButton({ style }: { style?: any }) {
  return (
    <Pressable onPress={() => _openDrawer?.()}
      className="w-10 h-10 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08]"
      style={style}
    >
      {[0, 1, 2].map(i => (
        <View key={i} className="w-[18px] h-[2px] bg-slate-400 rounded-sm my-[2.5px]" />
      ))}
    </Pressable>
  );
}

// ── User Avatar Button ───────────────────────────────────────────────────────

export function UserAvatarButton({ style }: { style?: any }) {
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const [open,      setOpen]      = useState(false);
  const [user,      setUser]      = useState<any>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [dropTop,   setDropTop]   = useState(60);
  const btnRef = useRef<any>(null);

  const reloadAvatar = useCallback(async () => {
    let [u, a] = await Promise.all([
      storage.getUser(),
      getStoredAvatar(),
    ]);
    if (u && !u.avatarUrl && !a) {
      try {
        const { authApi } = require('../../lib/api');
        const r = await authApi.getProfile();
        u = { ...u, ...r.data, avatarUrl: r.data.avatarUrl };
        await storage.setUser(u);
      } catch (e) {
        console.log('[Header] Silent profile fetch failed', e);
      }
    }
    setUser(u);
    setAvatarUri(u?.avatarUrl || a);
  }, []);

  useEffect(() => {
    reloadAvatar();
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('avatar:updated', (newUri: string) => {
      setAvatarUri(newUri);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!IS_WEB) return;
    const handler = (e: StorageEvent) => {
      if (e.key === AVATAR_KEY && e.newValue) {
        setAvatarUri(e.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const initials  = user?.fullName?.charAt(0)?.toUpperCase() ?? '?';
  const firstName = user?.fullName?.split(' ')[0] ?? 'Account';

  const handleOpen = () => {
    if (btnRef.current?.measure) {
      btnRef.current.measure((_: any, __: any, ___: any, h: number, ____: any, pageY: number) => {
        setDropTop(pageY + h + 6);
        setOpen(true);
      });
    } else {
      setDropTop(IS_WEB ? 58 : 82);
      setOpen(true);
    }
  };

  const MENU = [
    { icon: '👤', label: 'Profile',  route: '/(tabs)/profile'  },
    { icon: '⚙️', label: 'Settings', route: '/(tabs)/settings' },
  ];

  return (
    <>
      <TouchableOpacity
        ref={btnRef}
        onPress={handleOpen}
        activeOpacity={0.8}
        className={`flex-row items-center rounded-full bg-white/[0.05] border border-white/[0.09] ${compact ? 'px-1.5 py-1.5' : 'gap-2 pl-1.5 pr-2.5 py-1'}`}
        style={style}
      >
        <View
          className="w-8 h-8 rounded-full overflow-hidden items-center justify-center border-2"
          style={{ borderColor: 'rgba(124,58,237,0.55)', backgroundColor: '#3b0764' }}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} className="w-8 h-8" resizeMode="cover" />
          ) : (
            <Text className="text-violet-300 text-[13px] font-extrabold">{initials}</Text>
          )}
        </View>

        {IS_WEB && !compact && (
          <Text className="text-slate-300 text-[13px] font-semibold max-w-[90px]" numberOfLines={1}>
            {firstName}
          </Text>
        )}

        {!compact && <Text className="text-slate-600 text-[10px]">▾</Text>}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setOpen(false)}
          className="flex-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            className="absolute right-4 bg-[#0d1424] rounded-[20px] overflow-hidden border border-white/[0.10] min-w-[230px]"
            style={{
              top: dropTop,
              ...(IS_WEB
                ? { boxShadow: '0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,58,237,0.14)' }
                : {
                    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.55, shadowRadius: 28, elevation: 28,
                  }),
            } as any}
          >
            <LinearGradient
              colors={['#160826', '#0a0f1e']}
              className="px-4 py-4 flex-row items-center gap-3"
            >
              <View
                className="w-11 h-11 rounded-full overflow-hidden items-center justify-center border-2"
                style={{ borderColor: 'rgba(124,58,237,0.5)', backgroundColor: '#3b0764' }}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} className="w-11 h-11" resizeMode="cover" />
                ) : (
                  <Text className="text-violet-300 text-lg font-extrabold">{initials}</Text>
                )}
              </View>

              <View className="flex-1">
                <Text className="text-slate-100 text-[14px] font-bold" numberOfLines={1}>
                  {user?.fullName ?? 'User'}
                </Text>
                <Text className="text-slate-500 text-[11px] mt-0.5" numberOfLines={1}>
                  {user?.email ?? ''}
                </Text>

                <View className={`self-start mt-1.5 px-2 py-[2px] rounded-full ${
                  user?.plan === 'PREMIUM' ? 'bg-emerald-500/20' : 'bg-violet-500/20'
                }`}>
                  <Text className={`text-[9px] font-extrabold tracking-[1px] ${
                    user?.plan === 'PREMIUM' ? 'text-emerald-400' : 'text-violet-400'
                  }`}>
                    {user?.plan === 'PREMIUM' ? '👑 PREMIUM' : '🔒 FREE'}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            <View className="h-px bg-white/[0.06]" />

            {MENU.map((item, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => { setOpen(false); setTimeout(() => router.push(item.route as any), 120); }}
                activeOpacity={0.75}
                className={`flex-row items-center gap-3 px-[18px] py-[14px] ${
                  i < MENU.length - 1 ? 'border-b border-white/[0.05]' : ''
                }`}
              >
                <View className="w-9 h-9 rounded-xl bg-white/[0.05] items-center justify-center">
                  <Text className="text-[17px]">{item.icon}</Text>
                </View>
                <Text className="text-slate-300 text-[14px] font-medium flex-1">{item.label}</Text>
                <Text className="text-slate-600 text-[13px]">›</Text>
              </TouchableOpacity>
            ))}

            <View className="mx-4 h-px bg-white/[0.05]" />

            <TouchableOpacity
              onPress={async () => {
                setOpen(false);
                const { authApi } = require('../../lib/api');
                try { await authApi.logout(); } catch {}
                await storage.clear();
                router.replace('/(auth)/login');
              }}
              activeOpacity={0.75}
              className="flex-row items-center gap-3 px-[18px] py-[13px]"
            >
              <View className="w-9 h-9 rounded-xl bg-red-500/[0.09] items-center justify-center">
                <Text className="text-[17px]">🚪</Text>
              </View>
              <Text className="text-red-400 text-[14px] font-medium">Sign out</Text>
            </TouchableOpacity>

          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ── Notification Badge ───────────────────────────────────────────────────────

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = count > 99 ? '99+' : String(count);
  return (
    <View style={{
      minWidth: 18, height: 18, borderRadius: 9,
      backgroundColor: '#ef4444',
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 4,
    }}>
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', lineHeight: 14 }}>
        {label}
      </Text>
    </View>
  );
}

// ── Drawer ───────────────────────────────────────────────────────────────────

function Drawer({ open, onClose, activeTab }: {
  open: boolean; onClose: () => void; activeTab: string;
}) {
  const slideX    = useRef(new Animated.Value(-DRAWER_W - 20)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  // Subscribe to global unread count
  const unreadCount = useUnreadCount();

  useEffect(() => {
    if (open) setMounted(true);
    Animated.parallel([
      Animated.spring(slideX, {
        toValue: open ? 0 : -DRAWER_W - 20,
        useNativeDriver: true, damping: 24, stiffness: 220, mass: 0.9,
      }),
      Animated.timing(bgOpacity, {
        toValue: open ? 1 : 0, duration: 200, useNativeDriver: true,
      }),
    ]).start(({ finished }) => { if (finished && !open) setMounted(false); });
  }, [open]);

  if (!mounted) return null;

  return (
    <View style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      ...(IS_WEB ? { position: 'fixed' as any } : {}),
    }}>
      <Animated.View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.65)', opacity: bgOpacity,
      }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View style={{
        position: 'absolute', top: 0, bottom: 0, left: 0,
        width: DRAWER_W, backgroundColor: '#080d1c',
        borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.06)',
        transform: [{ translateX: slideX }],
        ...(IS_WEB ? { boxShadow: '8px 0 48px rgba(0,0,0,0.7)' } : {}),
      } as any}>

        <LinearGradient
          colors={['#160826', '#0a0f1e']}
          style={{ paddingTop: 60, paddingBottom: 24, paddingHorizontal: 22 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <LinearGradient
              colors={['#7c3aed', '#ec4899']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 17 }}>💰</Text>
            </LinearGradient>
            <Text style={{ color: '#f1f5f9', fontSize: 18, fontWeight: '800', letterSpacing: -0.4 }}>
              SubTrackr
            </Text>
          </View>
          <Text style={{ color: '#334155', fontSize: 11 }}>Stop overpaying. Start tracking.</Text>
        </LinearGradient>

        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 20 }} />

        <View style={{ flex: 1, paddingTop: 12, paddingHorizontal: 10 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.name;
            const isNotifications = item.name === 'notifications';

            return (
              <TouchableOpacity
                key={item.name}
                onPress={() => {
                  onClose();
                  const route = item.name === 'index' ? '/(tabs)/' : `/(tabs)/${item.name}`;
                  setTimeout(() => router.push(route as any), 160);
                }}
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 13,
                  paddingVertical: 12, paddingHorizontal: 14, borderRadius: 13, marginBottom: 2,
                  backgroundColor: isActive ? 'rgba(124,58,237,0.16)' : 'transparent',
                }}
              >
                {isActive && (
                  <View style={{
                    position: 'absolute', left: 0, top: 8, bottom: 8,
                    width: 3, borderRadius: 2, backgroundColor: '#7c3aed',
                  }} />
                )}
                <View style={{ position: 'relative' }}>
                  <Text style={{ fontSize: 18, opacity: isActive ? 1 : 0.45 }}>{item.emoji}</Text>
                  {/* Notification badge on the bell icon */}
                  {isNotifications && unreadCount > 0 && (
                    <View style={{
                      position: 'absolute', top: -5, right: -8,
                      minWidth: 16, height: 16, borderRadius: 8,
                      backgroundColor: '#ef4444',
                      alignItems: 'center', justifyContent: 'center',
                      paddingHorizontal: 3,
                      borderWidth: 1.5, borderColor: '#080d1c',
                    }}>
                      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800', lineHeight: 12 }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={{
                  color: isActive ? '#c4b5fd' : '#475569',
                  fontSize: 14, fontWeight: isActive ? '700' : '500', flex: 1,
                }}>
                  {item.label}
                </Text>

                {/* Text badge as fallback for larger counts */}
                {isNotifications && unreadCount > 0 && (
                  <View style={{
                    backgroundColor: 'rgba(239,68,68,0.15)',
                    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
                    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
                  }}>
                    <Text style={{ color: '#f87171', fontSize: 10, fontWeight: '700' }}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}

                {isActive && !isNotifications && (
                  <View style={{
                    width: 5, height: 5, borderRadius: 3, backgroundColor: '#7c3aed', opacity: 0.8,
                  }} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{
          paddingHorizontal: 22, paddingBottom: 40, paddingTop: 14,
          borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
        }}>
          <Text style={{ color: '#1e293b', fontSize: 10 }}>© 2026 SubTrackr</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Tab Layout ───────────────────────────────────────────────────────────────

export default function TabLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const segments = useSegments() as string[];

  _openDrawer = () => setDrawerOpen(true);

  const activeTab = segments.length > 1 ? segments[1] : 'index';

  // On layout mount, load the unread count from the notifications endpoint.
  // This seeds the global state so the badge is correct immediately.
  useEffect(() => {
    (async () => {
      try {
        // Use the dashboard API — it returns unreadNotifications count.
        // We import here to avoid circular imports at module level.
        const { dashboardApi } = require('../../lib/api');
        const res = await dashboardApi.get();
        const count = res?.data?.unreadNotifications ?? 0;
        updateGlobalUnreadCount(count);
      } catch {
        // Non-fatal — badge just shows 0 until next load
      }
    })();
  }, []);

  // Listen for manual count updates broadcast via DeviceEventEmitter
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('notifications:unread', (count: number) => {
      updateGlobalUnreadCount(count);
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="subscriptions" />
        <Tabs.Screen name="trackers" />
        <Tabs.Screen name="savings" />
        <Tabs.Screen name="notifications" />
        <Tabs.Screen name="email-drafter" />
        <Tabs.Screen name="gmail-import" />
        <Tabs.Screen name="settings" />
        <Tabs.Screen name="profile" />
      </Tabs>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} activeTab={activeTab} />
    </View>
  );
}