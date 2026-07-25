import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, RefreshControl, Modal,
  ActivityIndicator, Animated, Dimensions, Platform,
  TouchableOpacity,Pressable, useWindowDimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, router } from 'expo-router';
import { BarChart } from 'react-native-gifted-charts';
import { dashboardApi, authApi } from '../../lib/api';
import { storage } from '../../lib/storage';
import { DashboardData } from '../../types';
import { HamburgerButton, UserAvatarButton } from './_layout';
import { useUpgrade } from '../../lib/useUpgrade';
import { useLocalSearchParams } from 'expo-router';




const { width: SW } = Dimensions.get('window');
const IS_WEB = Platform.OS === 'web';
const MAX_W  = 1100;

function ContentWrap({ children }: { children: React.ReactNode }) {
  return (
    <View style={IS_WEB
      ? { maxWidth: MAX_W, alignSelf: 'center', width: '100%', paddingHorizontal: 28 }
      : { paddingHorizontal: 16 }}>
      {children}
    </View>
  );
}

function Counter({ value, prefix = '' }: { value: number; prefix?: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [disp, setDisp] = useState('0.00');
  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration: 900, useNativeDriver: false }).start();
    const id = anim.addListener(({ value: v }) => setDisp(v.toFixed(2)));
    return () => anim.removeListener(id);
  }, [value]);
  return (
    <Text className="text-white text-[38px] font-black tracking-tighter">{prefix}{disp}</Text>
  );
}

function StatCard({ emoji, label, value, bg }: {
  emoji: string; label: string; value: string; bg: string;
}) {
  return (
    <View className="flex-1 rounded-2xl py-4 px-2 items-center border border-white/[0.07]"
      style={{ backgroundColor: bg }}>
      <Text className="text-2xl mb-1.5">{emoji}</Text>
      <Text className="text-white text-2xl font-extrabold">{value}</Text>
      <Text className="text-white/50 text-xs mt-0.5 text-center">{label}</Text>
    </View>
  );
}

function PlanStatusCard({
  plan, totalSubsCreated, totalTrackersCreated, maxSubs, maxTrackers, onPress,
}: {
  plan: string; totalSubsCreated: number; totalTrackersCreated: number;
  maxSubs: number; maxTrackers: number; onPress: () => void;
}) {
  const isPremium = plan === 'PREMIUM';
  const subsUsed  = Math.min(totalSubsCreated, maxSubs);
  const trackUsed = Math.min(totalTrackersCreated, maxTrackers);
  const [checking, setChecking] = useState(false);

  const handleRefresh = async () => {
    setChecking(true);
    try {
      const p = await authApi.getProfile();
      if (p?.data?.plan === 'PREMIUM') {
        const cached = await storage.getUser();
        await storage.setUser({ ...cached, plan: 'PREMIUM' });
        // Force full reload
        onPress(); // closes modal if open — or just reload
        router.replace('/(tabs)/');
      }
    } catch {}
    setChecking(false);
  };

  if (isPremium) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} className="mb-3">
        <View className="rounded-2xl border border-emerald-500/25 overflow-hidden">
          <LinearGradient
            colors={['rgba(5,150,105,0.20)', 'rgba(6,95,70,0.12)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}
          >
            <View className="w-9 h-9 rounded-xl bg-emerald-500/20 items-center justify-center mr-3">
              <Text className="text-[18px]">👑</Text>
            </View>
            <View className="flex-1">
              <Text className="text-emerald-300 font-extrabold text-[14px]">Premium Plan Active</Text>
              <Text className="text-emerald-600 text-[11px] mt-0.5">
                Unlimited tracking · Real-time alerts
              </Text>
            </View>
            <Text className="text-emerald-500 text-[11px] font-semibold">Active ✓</Text>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    );
  }

  const subsPercent  = maxSubs > 0 ? (subsUsed / maxSubs) * 100 : 0;
  const trackPercent = maxTrackers > 0 ? (trackUsed / maxTrackers) * 100 : 0;
  const isMaxedSubs  = totalSubsCreated >= maxSubs;
  const isMaxedTrack = totalTrackersCreated >= maxTrackers;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} className="mb-3">
      <View className="rounded-2xl border border-violet-500/25 overflow-hidden">
        <LinearGradient
          colors={['rgba(124,58,237,0.15)', 'rgba(236,72,153,0.08)', 'rgba(15,23,42,0.9)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ padding: 16 }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2.5">
              <View className="w-8 h-8 rounded-xl bg-violet-500/20 items-center justify-center">
                <Text className="text-[16px]">🔒</Text>
              </View>
              <View>
                <Text className="text-violet-200 font-extrabold text-[13px]">Free Plan</Text>
                <Text className="text-slate-600 text-[10px]">Limited to {maxSubs} subs · {maxTrackers} trackers</Text>
              </View>
            </View>
            <View className="flex-row items-center gap-2">
                    <View className="bg-violet-500/20 border border-violet-500/30 px-3 py-1.5 rounded-full">
                      <Text className="text-violet-300 text-[11px] font-bold">Upgrade ✨</Text>
                    </View>

                    {/* Refresh button — separate, outside the pill */}
                    <TouchableOpacity
                      onPress={handleRefresh}
                      disabled={checking}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.08)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {checking
                        ? <ActivityIndicator size="small" color="#94a3b8" />
                        : <Text className="text-slate-400 text-[11px]">↻</Text>
                      }
                    </TouchableOpacity>
              </View>
          </View>
          <View className="gap-2">
            <View>
              <View className="flex-row justify-between mb-1">
                <Text className="text-slate-400 text-[11px]">Subscriptions created</Text>
                <Text className={`text-[11px] font-bold ${isMaxedSubs ? 'text-red-400' : 'text-slate-300'}`}>
                  {totalSubsCreated} / {maxSubs}
                  {isMaxedSubs ? ' · Limit reached' : ''}
                </Text>
              </View>
              <View className="bg-white/[0.06] rounded h-[5px] overflow-hidden">
                <View className="h-[5px] rounded"
                  style={{ width: `${subsPercent}%` as any, backgroundColor: isMaxedSubs ? '#ef4444' : '#6366F1' }} />
              </View>
            </View>
            <View>
              <View className="flex-row justify-between mb-1">
                <Text className="text-slate-400 text-[11px]">Price trackers created</Text>
                <Text className={`text-[11px] font-bold ${isMaxedTrack ? 'text-red-400' : 'text-slate-300'}`}>
                  {totalTrackersCreated} / {maxTrackers}
                  {isMaxedTrack ? ' · Limit reached' : ''}
                </Text>
              </View>
              <View className="bg-white/[0.06] rounded h-[5px] overflow-hidden">
                <View className="h-[5px] rounded"
                  style={{ width: `${trackPercent}%` as any, backgroundColor: isMaxedTrack ? '#ef4444' : '#10b981' }} />
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
}

function UpgradeModal({ visible, onClose, currentPlan }: {
  visible: boolean; onClose: () => void; currentPlan: string;
}) {
  const isPremium = currentPlan === 'PREMIUM';
  const { startUpgrade, loading, error } = useUpgrade();

  const handleUpgrade = async () => {
    onClose();
    await startUpgrade();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ width: '100%', maxWidth: 420 }}>
          <View
            className="bg-[#0d1424] rounded-3xl overflow-hidden border border-white/[0.08]"
            style={IS_WEB ? { boxShadow: '0 32px 80px rgba(0,0,0,0.8)' } as any : undefined}
          >
            <LinearGradient
              colors={isPremium ? ['#065f46', '#047857'] : ['#4c1d95', '#7c3aed', '#9333ea']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ padding: 28, alignItems: 'center' }}
            >
              <Text className="text-[40px] mb-2">{isPremium ? '👑' : '⚡'}</Text>
              <Text className="text-white text-[22px] font-black tracking-tight text-center">
                {isPremium ? 'Premium Active' : 'Upgrade to Premium'}
              </Text>
              {!isPremium && (
                <View className="flex-row items-end gap-1 mt-2">
                  <Text className="text-white text-[36px] font-black tracking-tight">2.99</Text>
                  <Text className="text-white/60 text-sm mb-2">/month</Text>
                </View>
              )}
            </LinearGradient>
            <View className="p-6">
              {error ? (
                <View className="mb-4 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25">
                  <Text className="text-red-400 text-[12px]">{error}</Text>
                </View>
              ) : null}
              {isPremium ? (
                <View className="gap-3 mb-5">
                  {['✓ Unlimited subscriptions', '✓ Unlimited price trackers',
                    '✓ Real-time push notifications', '✓ Hourly price checks',
                    '✓ Full analytics & 6-month trends', '✓ Email notifications on all devices',
                  ].map((f, i) => (
                    <Text key={i} className="text-emerald-300 text-[13px]">{f}</Text>
                  ))}
                </View>
              ) : (
                <>
                  <View className="gap-3 mb-5">
                    {[['⚡', 'Unlimited subscriptions & trackers'],
                      ['🔔', 'Real-time push + email notifications'],
                      ['⏱', 'Hourly price checks (vs. every 12h)'],
                      ['📊', 'Full analytics & 6-month trends'],
                      ['📤', 'Savings report for social sharing'],
                    ].map(([icon, text], i) => (
                      <View key={i} className="flex-row items-start gap-2">
                        <Text className="text-[13px]">{icon}</Text>
                        <Text className="text-slate-200 text-[13px] flex-1">{text}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity onPress={handleUpgrade} disabled={loading}
                    className="rounded-xl overflow-hidden mb-3" activeOpacity={0.85}>
                    <LinearGradient
                      colors={loading ? ['#3b1f6e', '#3b1f6e'] : ['#7c3aed', '#ec4899']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={{ paddingVertical: 15, alignItems: 'center' }}
                    >
                      {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text className="text-white font-bold text-[15px]">Upgrade for 2.99/month ⚡</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity onPress={onClose}
                className="py-3 items-center rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <Text className="text-slate-500 text-[13px] font-medium">
                  {isPremium ? 'Close' : 'Maybe later'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const compactTopBar = IS_WEB ? width < 700 : width < 430;
  const [data, setData]                 = useState<DashboardData | null>(null);
  const [user, setUser]                 = useState<any>(null);
  const [profile, setProfile]           = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [upgradeModal, setUpgradeModal] = useState(false);
  const { upgraded } = useLocalSearchParams<{ upgraded?: string }>();
  const upgradePollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  const load = async () => {
    try {
      // Run dashboard + storage in parallel, but getProfile separately so we
      // can always sync storage with the live plan value from the API.
      const [r, u] = await Promise.all([
        dashboardApi.get(),
        storage.getUser(),
      ]);
      setData(r.data);
      setUser(u);

      // ─── Always fetch the live profile so the plan is never stale ───────
      // We do this AFTER setting the initial user so the screen renders fast,
      // then immediately corrects the plan badge if it changed.
      try {
        const p = await authApi.getProfile();
        if (p?.data) {
          setProfile(p.data);

          // ── Sync storage whenever the live plan differs from cached plan ──
          // This covers the Stripe upgrade path: payment-success confirms
          // PREMIUM, but if the user force-refreshes or the storage write
          // raced, we always win here with the authoritative backend value.
          if (u?.plan !== p.data.plan) {
            const updated = { ...u, plan: p.data.plan };
            await storage.setUser(updated);
            setUser(updated); // also update local state so badges re-render
          }
        }
      } catch (profileErr) {
        // getProfile failed (network hiccup) — fall back to cached storage.
        // The plan badge will still show whatever was last stored.
        console.warn('[Dashboard] getProfile failed:', profileErr);
      }
    } catch (e) {
      console.error('[Dashboard] load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    load();

    // If arriving from a successful payment, poll every 3s until plan flips
    if (upgraded === '1') {
      upgradePollerRef.current = setInterval(async () => {
        try {
          const p = await authApi.getProfile();
          if (p?.data?.plan === 'PREMIUM') {
            clearInterval(upgradePollerRef.current!);
            upgradePollerRef.current = null;
            const cached = await storage.getUser();
            await storage.setUser({ ...cached, plan: 'PREMIUM' });
            setUser((u: any) => ({ ...u, plan: 'PREMIUM' }));
            setProfile((prev: any) => ({ ...prev, plan: 'PREMIUM' }));
          }
        } catch {}
      }, 3000);
    }

    return () => {
      if (upgradePollerRef.current) {
        clearInterval(upgradePollerRef.current);
        upgradePollerRef.current = null;
      }
    };
  }, [upgraded]));

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? '🌅 Good morning' : h < 17 ? '☀️ Good afternoon' : '🌙 Good evening';
  };
  const firstName = user?.fullName?.split(' ')[0] ?? 'User';

  // ── Plan is always derived from the live profile first, then storage ──────
  const currentPlan = profile?.plan ?? user?.plan ?? 'FREE';
  const isPremium   = currentPlan === 'PREMIUM';
  const hasAnyData  = (data?.activeSubscriptions ?? 0) > 0 || (data?.activeTrackers ?? 0) > 0;
  const hasSubs     = (data?.activeSubscriptions ?? 0) > 0;

  const COLORS = ['#6366F1', '#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD', '#EC4899'];
  const bars   = (data?.monthlyTrend ?? []).map((m, i) => ({
    value: Math.max(0, Number(m.total)),
    label: m.label,
    frontColor: COLORS[i % COLORS.length],
  }));
  const maxBar  = bars.length ? Math.max(...bars.map(b => b.value), 10) * 1.3 : 100;
  const chartW  = IS_WEB ? Math.min(MAX_W - 100, SW - 100) : SW - 64;

  if (loading) return (
    <View className="flex-1 bg-[#020617] items-center justify-center">
      <ActivityIndicator size="large" color="#7C3AED" />
    </View>
  );

  return (
    <View className="flex-1 bg-[#020617]">

      {/* Header */}
      <View className="bg-[#020617] border-b border-white/[0.06]" style={{ paddingTop: IS_WEB ? 0 : (Platform.OS === 'ios' ? 56 : 52) }}>
        {compactTopBar ? (
          <View className="w-full px-4 pt-3 pb-2">
            <View className="flex-row items-center justify-between relative">
              <HamburgerButton />
              <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }} pointerEvents="none">
                <Text className="text-white text-[18px] font-extrabold tracking-tight">Dashboard</Text>
              </View>
              <UserAvatarButton />
            </View>

            <View className="flex-row items-center mt-2.5">
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text className="text-slate-500 text-xs font-medium">{greeting()},</Text>
                <Text className="text-slate-100 text-[17px] font-black tracking-tight" numberOfLines={1}>
                  {firstName} 👋
                </Text>
              </View>

              <Pressable
                onPress={() => setUpgradeModal(true)}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              >
                <LinearGradient
                  colors={isPremium ? ['#065f46', '#047857'] : ['#5b21b6', '#7c3aed']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6,
                    borderRadius: 18,
                    ...(IS_WEB ? {
                      boxShadow: isPremium
                        ? '0 0 14px rgba(5,150,105,.3)'
                        : '0 0 14px rgba(124,58,237,.3)',
                    } : {}),
                  } as any}
                >
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }}>
                    {isPremium ? '👑 PREMIUM' : '🔒 FREE'}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="flex-row items-center w-full px-4 py-3">
            {/* LEFT */}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <HamburgerButton />
              <View style={{ marginLeft: 12 }}>
                <Text className="text-slate-500 text-xs font-medium">{greeting()},</Text>
                <Text className="text-slate-100 text-[20px] font-black tracking-tight">
                  {firstName} 👋
                </Text>
              </View>
            </View>

            {/* CENTER — Pressable fires onPress on the first tap on web,
                unlike TouchableOpacity which needs a focus pass first */}
            <Pressable
              onPress={() => setUpgradeModal(true)}
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
            >
              <LinearGradient
                colors={isPremium ? ['#065f46', '#047857'] : ['#5b21b6', '#7c3aed']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{
                  paddingHorizontal: 14, paddingVertical: 6,
                  borderRadius: 20,
                  ...(IS_WEB ? {
                    boxShadow: isPremium
                      ? '0 0 14px rgba(5,150,105,.3)'
                      : '0 0 14px rgba(124,58,237,.3)',
                  } : {}),
                } as any}
              >
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }}>
                  {isPremium ? '👑 PREMIUM' : '🔒 FREE'}
                </Text>
              </LinearGradient>
            </Pressable>
 
            {/* RIGHT */}
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <UserAvatarButton />
            </View>
          </View>
        )}
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }} tintColor="#7C3AED" />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        <LinearGradient colors={['#130826', '#020617']} className="absolute top-0 left-0 right-0 h-44" />
        <Animated.View style={{ opacity: fade }}>
          <ContentWrap>
            <View className="pt-5">

              {/* Monthly Spend card */}
              <LinearGradient
                colors={['#4c1d95', '#6d28d9', '#7c3aed']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                className="rounded-2xl p-6 mb-3"
                style={IS_WEB ? { boxShadow: '0 6px 24px rgba(109,40,217,.3)' } as any : undefined}
              >
                <Text className="text-purple-200/70 text-[10px] font-semibold tracking-[2px] mb-1">
                  MONTHLY SPEND
                </Text>
                <Counter value={Number(data?.monthlyTotal ?? 0)} prefix="€" />
                <View className="flex-row justify-between items-center mt-2">
                  <Text className="text-purple-200/55 text-[13px]">
                    €{Number(data?.yearlyTotal ?? 0).toFixed(2)} / year
                  </Text>
                  {Number(data?.totalSavings ?? 0) > 0 && (
                    <View className="bg-white/[0.16] rounded-full px-2.5 py-[3px]">
                      <Text className="text-white text-xs font-bold">
                        💰 Saved €{Number(data?.totalSavings).toFixed(2)}
                      </Text>
                    </View>
                  )}
                </View>
              </LinearGradient>

              {/* Plan Status Card */}
              <PlanStatusCard
                plan={currentPlan}
                totalSubsCreated={profile?.totalSubscriptionsCreated ?? 0}
                totalTrackersCreated={profile?.totalTrackersCreated ?? 0}
                maxSubs={3}
                maxTrackers={2}
                onPress={() => setUpgradeModal(true)}
              />

              {/* Stat row */}
              <View className="flex-row gap-3 mb-4">
                <StatCard emoji="📋" label="Active Subs"  value={String(data?.activeSubscriptions ?? 0)} bg="rgba(59,130,246,.16)" />
                <StatCard emoji="🎯" label="Tracking"     value={String(data?.activeTrackers ?? 0)}     bg="rgba(16,185,129,.16)" />
                <StatCard emoji="🔔" label="Alerts"       value={String(data?.unreadNotifications ?? 0)} bg="rgba(249,115,22,.16)" />
              </View>

              {/* Empty state */}
              {!hasAnyData && (
                <View className="bg-[#0d1424] rounded-2xl p-8 items-center border border-white/[0.07]">
                  <Text className="text-[36px] mb-3">📊</Text>
                  <Text className="text-slate-100 text-[16px] font-bold mb-2 text-center">
                    Start tracking your spending
                  </Text>
                  <Text className="text-slate-500 text-sm text-center leading-[18px] max-w-[300px] mb-6">
                    Add subscriptions or paste product links to monitor prices and get alerts.
                  </Text>
                  <View className="flex-row gap-3 flex-wrap justify-center">
                    <TouchableOpacity onPress={() => router.push('/(tabs)/subscriptions')} className="rounded-[14px] overflow-hidden">
                      <LinearGradient colors={['#6366F1', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={{ paddingVertical: 12, paddingHorizontal: 20 }}>
                        <Text className="text-white font-bold text-sm">📋 Add Subscription</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => router.push('/(tabs)/trackers')}
                      className="py-3 px-5 rounded-[14px] bg-white/[0.05] border border-white/[0.1]">
                      <Text className="text-slate-300 font-semibold text-sm">🎯 Track a Price</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Nudge to add subs when only trackers exist */}
              {hasAnyData && !hasSubs && (
                <View className="bg-[#0d1424] rounded-2xl p-5 mb-3 border border-indigo-500/20">
                  <View className="flex-row items-center gap-2 mb-2">
                    <Text className="text-lg">📋</Text>
                    <Text className="text-slate-100 font-bold text-sm">Track your subscriptions too</Text>
                  </View>
                  <Text className="text-slate-500 text-xs leading-[18px] mb-3.5">
                    See spending breakdowns, upcoming billing dates, and monthly trends.
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/subscriptions')} className="rounded-xl overflow-hidden">
                    <LinearGradient colors={['#6366F1', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={{ paddingVertical: 12, alignItems: 'center' }}>
                      <Text className="text-white font-bold text-xs">Add your first subscription →</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* Category breakdown */}
              {(data?.categoryBreakdown?.length ?? 0) > 0 && (
                <View className="bg-[#0d1424] rounded-[18px] p-5 mb-3 border border-white/[0.06]">
                  <Text className="text-slate-100 text-[14px] font-extrabold mb-3">By Category 📊</Text>
                  {data!.categoryBreakdown.map((c, i) => {
                    const PIE = ['#7C3AED', '#EC4899', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];
                    const color = PIE[i % PIE.length];
                    const pct   = data?.monthlyTotal && Number(data.monthlyTotal) > 0
                      ? ((Number(c.total) / Number(data.monthlyTotal)) * 100).toFixed(0) : '0';
                    return (
                      <View key={i} className="mb-3">
                        <View className="flex-row justify-between mb-1">
                          <Text className="text-slate-400 text-[13px]">{c.category || 'Other'}</Text>
                          <Text className="text-slate-100 text-[13px] font-bold">
                            €{Number(c.total).toFixed(2)}{' '}
                            <Text className="text-slate-500 font-normal">({pct}%)</Text>
                          </Text>
                        </View>
                        <View className="bg-white/[0.07] rounded h-1.5">
                          <View className="rounded h-1.5"
                            style={{ backgroundColor: color, width: `${pct}%` as any }} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Bar chart */}
              {bars.some(b => b.value > 0) && (
                <View className="bg-[#0d1424] rounded-[18px] p-5 mb-3 border border-white/[0.06]">
                  <Text className="text-slate-100 text-[14px] font-extrabold mb-0.5">6-Month Trend 📈</Text>
                  <Text className="text-slate-500 text-xs mb-4">Monthly spending overview</Text>
                  <BarChart
                    data={bars}
                    barWidth={IS_WEB ? 36 : 28}
                    spacing={IS_WEB ? 14 : 10}
                    roundedTop hideRules
                    xAxisThickness={0} yAxisThickness={0}
                    yAxisTextStyle={{ color: '#475569', fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: '#64748b', fontSize: 10 }}
                    noOfSections={4} maxValue={maxBar}
                    isAnimated animationDuration={800}
                    width={chartW}
                  />
                </View>
              )}

              {/* Upcoming billings */}
              {(data?.upcomingBillings?.length ?? 0) > 0 && (
                <View className="mb-3">
                  <Text className="text-slate-100 text-[14px] font-extrabold mb-3">Upcoming 📅</Text>
                  <View className="gap-2">
                    {data!.upcomingBillings.map(sub => (
                      <LinearGradient
                        key={sub.id}
                        colors={sub.daysUntilBilling <= 2 ? ['#3b0764', '#6d28d9'] : ['#0f172a', '#0f172a']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        className="rounded-2xl p-4 flex-row justify-between items-center"
                      >
                        <View className="flex-row items-center gap-3 flex-1">
                          <View className="w-9 h-9 rounded-xl items-center justify-center"
                            style={{ backgroundColor: (sub.color || '#6366F1') + '33' }}>
                            <Text className="text-base">📋</Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-slate-100 font-bold text-[13px]" numberOfLines={1}>{sub.name}</Text>
                            <Text className="text-slate-500 text-xs mt-0.5">
                              {sub.daysUntilBilling === 0 ? '🔴 Today!'
                                : sub.daysUntilBilling === 1 ? '🟠 Tomorrow'
                                : `📅 In ${sub.daysUntilBilling} days`}
                            </Text>
                          </View>
                        </View>
                        <Text className="text-white font-extrabold text-[15px]">
                          €{Number(sub.amount).toFixed(2)}
                        </Text>
                      </LinearGradient>
                    ))}
                  </View>
                </View>
              )}

            </View>
          </ContentWrap>
        </Animated.View>
      </ScrollView>

      <UpgradeModal
        visible={upgradeModal}
        onClose={() => setUpgradeModal(false)}
        currentPlan={currentPlan}
      />
    </View>
  );
}