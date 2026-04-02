import { useEffect, useState, useRef } from 'react';
import { Slot, router, useSegments } from 'expo-router';
import { View, Text, DeviceEventEmitter, StyleSheet, Platform, Animated, TouchableOpacity } from 'react-native';
import { authApi } from '../lib/api';
import { storage } from '../lib/storage';
import { setupNotificationListeners } from '../lib/notifications';
// Import Icons
import { Bell, X } from 'lucide-react-native';
import '../global.css';
import 'expo-router/entry';

if (Platform.OS === 'web') {
  (StyleSheet as any).setFlag?.('darkMode', 'class');
}

// """ In-app push toast (web-only) """""""""""""""""""""""""""""""""""""""""
interface ToastMsg { title: string; body: string; id: number }

function PushToast({ msg, onDismiss }: { msg: ToastMsg; onDismiss: () => void }) {
  const slideY  = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY,  { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => dismissAnim(), 5000);
    return () => clearTimeout(timer);
  }, []);

  const dismissAnim = () => {
    Animated.parallel([
      Animated.timing(slideY,  { toValue: -80, duration: 240, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0,   duration: 200, useNativeDriver: true }),
    ]).start(onDismiss);
  };

  return (
    <Animated.View
      style={[
        {
          position: 'fixed' as any,
          top: 16,
          right: 16,
          zIndex: 99999,
          maxWidth: 360,
          width: 'calc(100vw - 32px)' as any,
          transform: [{ translateY: slideY }],
          opacity,
        },
      ]}
    >
      <View
        style={{
          backgroundColor: '#0d1424',
          borderRadius: 16,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
          borderWidth: 1,
          borderColor: 'rgba(124,58,237,0.35)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.1)',
          overflow: 'hidden',
        } as any}
      >
        {/* Icon */}
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(124,58,237,0.2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Bell size={20} color="#a78bfa" />
        </View>

        {/* Text */}
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#f1f5f9', fontWeight: '700', fontSize: 13, marginBottom: 3, lineHeight: 18 }} numberOfLines={1}>
            {msg.title}
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 17 }} numberOfLines={2}>
            {msg.body}
          </Text>
        </View>

        {/* Dismiss */}
        <TouchableOpacity onPress={dismissAnim} style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <X size={18} color="#475569" />
        </TouchableOpacity>

        {/* Progress bar (MOVED INSIDE THE MAIN VIEW) */}
        <ProgressBar duration={5000} />
      </View>
    </Animated.View>
  );
}

function ProgressBar({ duration }: { duration: number }) {
  const width = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: 0,
      duration,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <View
      style={{
        position: 'absolute' as any,
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: 'rgba(124,58,237,0.15)',
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          height: '100%',
          width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          backgroundColor: '#7c3aed',
          borderRadius: 2,
        }}
      />
    </View>
  );
}

// """ Toast manager """""""""""""""""""""""""""""""""""""""""""""""""""""""""
function PushToastManager() {
  const [current, setCurrent] = useState<ToastMsg | null>(null);
  const counterRef = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let unsubscribe: (() => void) | null = null;

    import('../lib/webPush').then(({ onWebPushMessage }) => {
      unsubscribe = onWebPushMessage((title, body) => {
        setCurrent({ title, body, id: ++counterRef.current });
      });
    }).catch(e => {
      console.warn('[layout] onWebPushMessage import failed:', e);
    });

    return () => { unsubscribe?.(); };
  }, []);

  if (!current) return null;

  return (
    <PushToast
      key={current.id}
      msg={current}
      onDismiss={() => setCurrent(null)}
    />
  );
}

// """ Root layout """""""""""""""""""""""""""""""""""""""""""""""""""""""""""
export default function RootLayout() {
  const [checked, setChecked] = useState(false);
  const segments = useSegments();

  // 1. Setup Notifications
  useEffect(() => {
    const cleanup = setupNotificationListeners();
    return cleanup;
  }, []);

  // 2. Auth Routing (Runs when route segments change)
  useEffect(() => {
    storage.getToken().then(token => {
      const inAuth = segments[0] === '(auth)';
      const inTabs = segments[0] === '(tabs)';
      const isRoot = segments[0] === undefined;

      if (token && (inAuth || isRoot)) {
        router.replace('/(tabs)/');
      } else if (!token && inTabs) {
        router.replace('/(auth)/login');
      }

      setChecked(true);
    });
  }, [segments]);

  // 3. Web Push Setup (Runs ONLY ONCE when app loads)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    storage.getToken().then(async token => {
      if (!token) return; // Only register if user is logged in

      try {
        const { registerWebPush } = await import('../lib/webPush');
        const fcmToken = await registerWebPush();
        if (fcmToken) {
          await authApi.updateFcmToken(fcmToken);
          console.log('[layout] Web FCM token registered');
        }
      } catch (e) {
        console.warn('[layout] Web push registration failed:', e);
      }
    });
  }, []); // <-- Empty array ensures this doesn't spam  backend on tab changes

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('auth:logout', () => {
      storage.clear().then(() => {
        router.replace('/(auth)/login');
      });
    });
    return () => sub.remove();
  }, []);

  if (!checked) return <View className="flex-1 bg-[#020617]" />;

  return (
    <View style={{ flex: 1 }}>
      <Slot />
      {Platform.OS === 'web' && <PushToastManager />}
    </View>
  );
}