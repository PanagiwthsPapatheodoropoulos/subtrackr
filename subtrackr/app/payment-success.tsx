import { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { authApi } from '../lib/api';
import { storage } from '../lib/storage';

const MAX_ATTEMPTS  = 10;   // 20 × 2s = 40s maximum wait
const POLL_INTERVAL = 1500; // ms between each profile check

export default function PaymentSuccess() {
  const [status, setStatus]   = useState<'polling' | 'confirmed' | 'timeout'>('polling');
  const [attempt, setAttempt] = useState(0);
  const progressAnim          = useRef(new Animated.Value(0)).current;
  const timeoutRef            = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Animate the progress bar over the full polling window
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: MAX_ATTEMPTS * POLL_INTERVAL,
      useNativeDriver: false,
    }).start();

    let currentAttempt = 0;

    const poll = async () => {
      currentAttempt++;
      setAttempt(currentAttempt);

      try {
        const res = await authApi.getProfile();
        if (res.data.plan === 'PREMIUM') {
          // Webhook processed — update local storage and redirect
          const current = await storage.getUser();
          await storage.setUser({ ...current, plan: 'PREMIUM' });
          setStatus('confirmed');
          // Pass ?upgraded=1 so the dashboard keeps polling until badge updates
          timeoutRef.current = setTimeout(
            () => router.replace('/(tabs)/?upgraded=1'),
            1800,
          );
          return; // stop polling
        }
      } catch (e) {
        console.warn('[PaymentSuccess] Profile fetch failed, retrying…', e);
      }

      if (currentAttempt >= MAX_ATTEMPTS) {
        // Webhook took too long — redirect anyway; dashboard will keep checking
        setStatus('timeout');
        timeoutRef.current = setTimeout(
          () => router.replace('/(tabs)/?upgraded=1'),
          3000,
        );
        return;
      }

      // Schedule next attempt
      timeoutRef.current = setTimeout(poll, POLL_INTERVAL);
    };

    // First check after a short delay so the webhook has a head-start
    timeoutRef.current = setTimeout(poll, 1200);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  /* ─── UI ─────────────────────────────────────────────────────────────────── */

  if (status === 'confirmed') {
    return (
      <View className="flex-1 bg-[#020617] items-center justify-center px-8">
        <LinearGradient
          colors={['#065f46', '#047857']}
          style={{
            width: 88, height: 88, borderRadius: 44,
            alignItems: 'center', justifyContent: 'center', marginBottom: 24,
          }}
        >
          <Text style={{ fontSize: 40 }}>✅</Text>
        </LinearGradient>
        <Text className="text-white text-2xl font-black text-center mb-2">
          You're Premium! 🎉
        </Text>
        <Text className="text-slate-400 text-sm text-center mb-8">
          Your subscription is now active. Enjoy unlimited tracking.
        </Text>
        <ActivityIndicator color="#7c3aed" />
        <Text className="text-slate-600 text-xs mt-3">Redirecting to dashboard…</Text>
      </View>
    );
  }

  if (status === 'timeout') {
    return (
      <View className="flex-1 bg-[#020617] items-center justify-center px-8">
        <Text style={{ fontSize: 48, marginBottom: 20 }}>⏳</Text>
        <Text className="text-white text-xl font-bold text-center mb-2">
          Still processing…
        </Text>
        <Text className="text-slate-400 text-sm text-center mb-6">
          Your payment was received. The plan upgrade may take a moment to reflect.
          Your dashboard will refresh automatically.
        </Text>
        <ActivityIndicator color="#7c3aed" />
        <Text className="text-slate-600 text-xs mt-3">Redirecting…</Text>
      </View>
    );
  }

  // 'polling' state
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View className="flex-1 bg-[#020617] items-center justify-center px-8">
      {/* Animated icon */}
      <LinearGradient
        colors={['#4c1d95', '#7c3aed']}
        style={{
          width: 88, height: 88, borderRadius: 44,
          alignItems: 'center', justifyContent: 'center', marginBottom: 24,
        }}
      >
        <ActivityIndicator color="#fff" size="large" />
      </LinearGradient>

      <Text className="text-white text-2xl font-black text-center mb-2">
        Confirming your upgrade…
      </Text>
      <Text className="text-slate-400 text-sm text-center mb-8">
        Waiting for payment confirmation
        {attempt > 0 ? ` (${attempt}/${MAX_ATTEMPTS})` : ''}
      </Text>

      {/* Progress bar */}
      <View
        style={{
          width: '100%', maxWidth: 280,
          height: 4, backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: 2, overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            height: '100%',
            width: progressWidth,
            backgroundColor: '#7c3aed',
            borderRadius: 2,
          }}
        />
      </View>

      <Text className="text-slate-700 text-xs mt-4">
        This usually takes 2–5 seconds
      </Text>
    </View>
  );
}