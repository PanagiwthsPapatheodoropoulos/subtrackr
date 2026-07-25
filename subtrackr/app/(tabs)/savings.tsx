import { useCallback, useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, Platform, Clipboard,
  RefreshControl, Dimensions, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { dashboardApi, subscriptionsApi, insightsApi } from '../../lib/api';
import { HamburgerButton,UserAvatarButton } from './_layout';
import { PlatformInsights } from '../../types';
import { InsightsBenchmark } from '../../components/ui/InsightsBenchmark';
import { downloadSavingsReport, shareSavingsReport } from '../../lib/savingsReportPdf';

const IS_WEB = Platform.OS === 'web';
const { width: SW } = Dimensions.get('window');
const MAX_W = 800;

function ContentWrap({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={
        IS_WEB
          ? { maxWidth: MAX_W, alignSelf: 'center', width: '100%', paddingHorizontal: 28 }
          : { paddingHorizontal: 16 }
      }
    >
      {children}
    </View>
  );
}

function AnimatedNumber({
  value, prefix = '', suffix = '', decimals = 2, style,
}: {
  value: number; prefix?: string; suffix?: string; decimals?: number; style?: any;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [disp, setDisp] = useState('0');

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: value, duration: 1200, useNativeDriver: false }).start();
    const id = anim.addListener(({ value: v }) =>
      setDisp(decimals > 0 ? v.toFixed(decimals) : Math.floor(v).toString()),
    );
    return () => anim.removeListener(id);
  }, [value]);

  return <Text style={style}>{prefix}{disp}{suffix}</Text>;
}

function StatTile({
  emoji, label, value, sub, color,
}: {
  emoji: string; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <View
      className="flex-1 rounded-2xl p-4 items-center border border-white/[0.06]"
      style={{ backgroundColor: color + '18' }}
    >
      <Text className="text-2xl mb-1">{emoji}</Text>
      <Text className="text-white font-extrabold text-[22px]">{value}</Text>
      <Text className="text-slate-400 text-[11px] text-center mt-0.5">{label}</Text>
      {sub ? <Text className="text-slate-600 text-[10px] text-center mt-0.5">{sub}</Text> : null}
    </View>
  );
}

function ShareCard({
  savings, monthlySpend, subs, trackers, year, onCopy, copied,
}: {
  savings: number; monthlySpend: number; subs: number; trackers: number; year: number;
  onCopy: () => void; copied: boolean;
}) {
  return (
    <View
      className="rounded-3xl overflow-hidden border border-violet-500/30"
      style={IS_WEB ? { boxShadow: '0 0 60px rgba(124,58,237,0.2)' } as any : undefined}
    >
      <LinearGradient
        colors={['#1a0836', '#0d1424', '#04050d']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ padding: 32 }}
      >
        <View className="flex-row items-center gap-3 mb-6">
          <LinearGradient
            colors={['#7c3aed', '#ec4899']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 20 }}>📊</Text>
          </LinearGradient>
          <View>
            <Text className="text-white font-extrabold text-[16px]">SubTrackr</Text>
            <Text className="text-slate-500 text-[11px]">{year} Savings Report</Text>
          </View>
        </View>

        <View className="items-center mb-6 py-6 rounded-2xl border border-white/[0.06] bg-white/[0.03]">
          <Text className="text-slate-400 text-[11px] font-semibold tracking-[2px] mb-2">YOU SAVED</Text>
          <AnimatedNumber
            value={savings}
            prefix="€"
            style={{
              color: '#fff',
              fontSize: 64,
              fontWeight: '900',
              letterSpacing: -2,
              lineHeight: 68,
              ...(IS_WEB ? {
                background: 'linear-gradient(135deg,#a78bfa,#ec4899)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              } : {}),
            } as any}
          />
          <Text className="text-slate-500 text-[13px] mt-1">
            from tracking {trackers} product{trackers !== 1 ? 's' : ''}
          </Text>
        </View>

        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 rounded-xl p-3 bg-indigo-500/10 border border-indigo-500/20 items-center">
            <Text className="text-indigo-300 text-[22px] font-extrabold">{subs}</Text>
            <Text className="text-slate-500 text-[11px] text-center">Subs managed</Text>
          </View>
          <View className="flex-1 rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/20 items-center">
            <Text className="text-emerald-300 text-[22px] font-extrabold">€{(monthlySpend * 12).toFixed(0)}</Text>
            <Text className="text-slate-500 text-[11px] text-center">Yearly spend</Text>
          </View>
          <View className="flex-1 rounded-xl p-3 bg-violet-500/10 border border-violet-500/20 items-center">
            <Text className="text-violet-300 text-[22px] font-extrabold">€{monthlySpend.toFixed(0)}</Text>
            <Text className="text-slate-500 text-[11px] text-center">Monthly avg</Text>
          </View>
        </View>

        {savings > 0 && (
          <View className="rounded-2xl overflow-hidden mb-4">
            <LinearGradient
              colors={['rgba(124,58,237,0.25)', 'rgba(236,72,153,0.25)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <Text style={{ fontSize: 26 }}>🎉</Text>
              <View className="flex-1">
                <Text className="text-white font-bold text-[14px]">
                  {savings >= 100
                    ? `That's ${Math.floor(savings / 10)} coffees saved!`
                    : savings >= 50
                    ? 'Great job staying on budget!'
                    : 'Every euro saved counts!'}
                </Text>
                <Text className="text-slate-400 text-[11px] mt-0.5">
                  SubTrackr watched prices so you didn't have to.
                </Text>
              </View>
            </LinearGradient>
          </View>
        )}

        <View className="flex-row items-center justify-between">
          <Text className="text-slate-700 text-[11px]">subtrackr.app</Text>
          <View className="flex-row items-center gap-1.5 bg-violet-500/15 rounded-full px-3 py-1">
            <Text className="text-violet-400 text-[10px] font-semibold">Stop overpaying.</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onCopy}
          activeOpacity={0.7}
          className="mt-3 flex-row items-center justify-center gap-1.5"
        >
          <Text className="text-[11px]">{copied ? '✅' : '📋'}</Text>
          <Text style={{ color: copied ? '#34d399' : '#334155', fontSize: 11 }}>
            {copied ? 'Copied to clipboard' : 'Copy stats summary'}
          </Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

function CategoryRow({
  category, total, pct, color,
}: {
  category: string; total: number; pct: number; color: string;
}) {
  const barAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(barAnim, { toValue: pct, duration: 800, useNativeDriver: false }).start();
  }, [pct]);

  return (
    <View className="mb-3">
      <View className="flex-row justify-between mb-1">
        <Text className="text-slate-400 text-[13px]">{category || 'Other'}</Text>
        <Text className="text-slate-100 text-[13px] font-bold">€{total.toFixed(2)}/mo</Text>
      </View>
      <View className="bg-white/[0.06] rounded-full h-[6px] overflow-hidden">
        <Animated.View
          style={{
            height: 6, borderRadius: 3, backgroundColor: color,
            width: barAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          }}
        />
      </View>
    </View>
  );
}

export default function SavingsScreen() {
  const [dashboard,     setDashboard]     = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [insights,      setInsights]      = useState<PlatformInsights | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [pdfSaving,     setPdfSaving]     = useState(false);
  const [pdfSharing,    setPdfSharing]    = useState(false);
  const [copied,        setCopied]        = useState(false);

  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const load = async () => {
    try {
      const [dashRes, subsRes, insRes] = await Promise.all([
        dashboardApi.get(),
        subscriptionsApi.getAll(0, 100),
        insightsApi.get().catch(() => null),
      ]);
      setDashboard(dashRes.data);
      setSubscriptions(subsRes.data?.content ?? subsRes.data ?? []);
      if (insRes?.data) setInsights(insRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleSavePdf = async () => {
    if (!dashboard) return;
    setPdfSaving(true);
    try {
      await downloadSavingsReport({ dashboard, subscriptions, insights });
    } catch (err: any) {
      Alert.alert('PDF Failed', err?.message ?? 'Could not save the PDF. Please try again.');
    } finally {
      setPdfSaving(false);
    }
  };

  const handleSharePdf = async () => {
    if (!dashboard) return;
    setPdfSharing(true);
    try {
      await shareSavingsReport({ dashboard, subscriptions, insights });
    } catch (err: any) {
      Alert.alert('PDF Failed', err?.message ?? 'Could not generate the PDF. Please try again.');
    } finally {
      setPdfSharing(false);
    }
  };

  const handleCopy = () => {
    const d = dashboard;
    if (!d) return;
    const monthly = Number(d.monthlyTotal ?? 0);
    const savings = Number(d.totalSavings ?? 0);
    const subs    = d.activeSubscriptions ?? 0;
    const text    = [
      `📊 My ${new Date().getFullYear()} SubTrackr Report`,
      `💳 ${subs} active subscriptions — €${monthly.toFixed(2)}/mo`,
      savings > 0 ? `🏆 Saved €${savings.toFixed(2)} from price drops` : null,
      `📅 Projected yearly spend: €${(monthly * 12).toFixed(2)}`,
      `Track yours ➡️ subtrackr.app`,
    ].filter(Boolean).join('\n');

    if (IS_WEB) {
      navigator.clipboard?.writeText(text);
    } else {
      Clipboard.setString(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-[#020617] items-center justify-center">
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  const savings  = Number(dashboard?.totalSavings  ?? 0);
  const monthly  = Number(dashboard?.monthlyTotal  ?? 0);
  const subs     = dashboard?.activeSubscriptions  ?? 0;
  const trackers = dashboard?.activeTrackers        ?? 0;
  const yr       = new Date().getFullYear();

  const PIE_COLORS = ['#7C3AED', '#EC4899', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];
  const breakdown  = dashboard?.categoryBreakdown ?? [];
  const maxTotal   = breakdown.length ? Math.max(...breakdown.map((c: any) => Number(c.total))) : 1;

  return (
    <View className="flex-1 bg-[#020617]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View
        className="bg-[#020617] border-b border-white/[0.06]"
        style={{ paddingTop: IS_WEB ? 0 : (Platform.OS === 'ios' ? 56 : 52) }}
      >
        <View className="flex-row items-center w-full px-4 py-3">
          <View className="flex-1">
            <HamburgerButton />
          </View>
          <View className="items-center">
            <Text className="text-white text-[17px] font-extrabold tracking-tight">
              Savings Report 💰
            </Text>
          </View>
          <View className="flex-1 items-end">
            <UserAvatarButton />
          </View>
        </View>
      </View>

      {/* ── Scroll body ────────────────────────────────────────────────────── */}
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor="#7C3AED"
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
      >
        <LinearGradient
          colors={['#130826', '#020617']}
          className="absolute top-0 left-0 right-0 h-56"
        />

        <Animated.View style={{ opacity: fade }}>
          <ContentWrap>
            <View className="pt-5">

              <View className="mb-5">
                <ShareCard
                  savings={savings}
                  monthlySpend={monthly}
                  subs={subs}
                  trackers={trackers}
                  year={yr}
                  onCopy={handleCopy}
                  copied={copied}
                />
              </View>

              {savings === 0 && subs === 0 && trackers === 0 && (
                <View className="bg-[#0d1424] rounded-2xl p-8 items-center border border-white/[0.07] mb-5">
                  <Text className="text-4xl mb-3">🌱</Text>
                  <Text className="text-slate-100 text-[16px] font-bold mb-2 text-center">
                    Nothing to report yet
                  </Text>
                  <Text className="text-slate-500 text-[13px] text-center leading-[18px] max-w-[280px]">
                    Add subscriptions and track product prices to build your savings report.
                  </Text>
                </View>
              )}

              {(subs > 0 || trackers > 0) && (
                <>
                  <Text className="text-slate-100 text-[14px] font-extrabold mb-3">
                    Your Numbers 📈
                  </Text>
                  <View className="flex-row gap-3 mb-5 flex-wrap">
                    <StatTile
                      emoji="💳" label="Active subs"
                      value={String(subs)} sub={`€${monthly.toFixed(2)}/mo`}
                      color="#6366F1"
                    />
                    <StatTile
                      emoji="🎯" label="Products tracked"
                      value={String(trackers)} color="#10B981"
                    />
                    <StatTile
                      emoji="🏆" label="Total saved"
                      value={`€${savings.toFixed(2)}`} sub="from price drops"
                      color="#EC4899"
                    />
                  </View>
                </>
              )}

              {monthly > 0 && (
                <View className="bg-[#0d1424] rounded-2xl p-5 mb-5 border border-white/[0.06]">
                  <Text className="text-slate-100 text-[14px] font-extrabold mb-4">
                    Yearly Projection 📅
                  </Text>
                  {[
                    { label: 'This month',           amount: monthly,            color: '#6366F1'  },
                    { label: 'This year (projected)', amount: monthly * 12,       color: '#EC4899'  },
                    { label: 'Saved from price drops',amount: savings,            color: '#10B981', highlight: true },
                    { label: 'Net yearly cost',       amount: monthly * 12 - savings, color: '#F59E0B' },
                  ].map(({ label, amount, color, highlight }, i) => (
                    <View
                      key={i}
                      className={`flex-row justify-between items-center py-2.5 ${i < 3 ? 'border-b border-white/[0.05]' : ''}`}
                    >
                      <Text className="text-slate-400 text-[13px]">{label}</Text>
                      <Text className="font-extrabold text-[15px]" style={{ color: highlight ? '#34d399' : color }}>
                        {highlight && amount > 0 ? '-€' : '€'}{Math.abs(amount).toFixed(2)}
                        {highlight && amount > 0 ? ' saved' : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {breakdown.length > 0 && (
                <View className="bg-[#0d1424] rounded-2xl p-5 mb-5 border border-white/[0.06]">
                  <Text className="text-slate-100 text-[14px] font-extrabold mb-4">
                    Spend by Category 🥧
                  </Text>
                  {breakdown.map((c: any, i: number) => (
                    <CategoryRow
                      key={i}
                      category={c.category || 'Other'}
                      total={Number(c.total)}
                      pct={maxTotal > 0 ? (Number(c.total) / maxTotal) * 100 : 0}
                      color={PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  ))}
                </View>
              )}

              <View className="bg-[#0d1424] rounded-2xl p-5 mb-5 border border-white/[0.06]">
                <Text className="text-slate-100 text-[14px] font-extrabold mb-4">
                  Money-Saving Tips 💡
                </Text>
                {[
                  {
                    icon: '🔍', title: 'Audit streaming services',
                    desc: 'Rotate subscriptions — watch one, pause the rest. Save ~€15/month.',
                  },
                  {
                    icon: '📆', title: 'Switch to yearly billing',
                    desc: 'Most services give 2 months free when you pay annually.',
                  },
                  {
                    icon: '🎯', title: 'Track before you buy',
                    desc: "Paste any product URL — we'll tell you if the current price is the lowest in months.",
                  },
                  {
                    icon: '💰', title: 'Set a monthly budget',
                    desc: `You're spending €${monthly.toFixed(2)}/mo on subscriptions. Is that within your budget?`,
                  },
                ].map(({ icon, title, desc }, i) => (
                  <View key={i} className={`flex-row gap-3 ${i < 3 ? 'mb-4' : ''}`}>
                    <View className="w-9 h-9 rounded-xl bg-white/[0.05] items-center justify-center flex-shrink-0">
                      <Text className="text-lg">{icon}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-200 font-semibold text-[13px]">{title}</Text>
                      <Text className="text-slate-500 text-[12px] mt-0.5 leading-[17px]">{desc}</Text>
                    </View>
                  </View>
                ))}

                {insights && (
                  <View className="mt-5 border-t border-white/[0.06] pt-5">
                    <InsightsBenchmark
                      insights={insights}
                      myMonthly={monthly}
                      mySubCount={subs}
                    />
                  </View>
                )}
              </View>

              <View className="flex-row gap-3 mb-2">
                <TouchableOpacity
                  onPress={handleSavePdf}
                  disabled={pdfSaving || pdfSharing}
                  activeOpacity={0.85}
                  className="flex-1 rounded-2xl overflow-hidden"
                >
                  <LinearGradient
                    colors={pdfSaving ? ['#1e1b4b', '#1e1b4b'] : ['#1d4ed8', '#4f46e5']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{
                      paddingVertical: 16,
                      alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'row', gap: 8,
                      ...(IS_WEB && !pdfSaving ? { boxShadow: '0 0 24px rgba(29,78,216,.35)' } : {}),
                    } as any}
                  >
                    {pdfSaving
                      ? <><ActivityIndicator size="small" color="#818cf8" /><Text className="text-indigo-300 font-bold text-[14px]">Saving…</Text></>
                      : <><Text style={{ fontSize: 18 }}>{IS_WEB ? '🖨️' : '💾'}</Text><Text className="text-white font-bold text-[14px]">{IS_WEB ? 'Print / Save PDF' : 'Save to Files'}</Text></>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSharePdf}
                  disabled={pdfSaving || pdfSharing}
                  activeOpacity={0.85}
                  className="flex-1 rounded-2xl overflow-hidden"
                >
                  <LinearGradient
                    colors={pdfSharing ? ['#2d1654', '#2d1654'] : ['#7c3aed', '#ec4899']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{
                      paddingVertical: 16,
                      alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'row', gap: 8,
                      ...(IS_WEB && !pdfSharing ? { boxShadow: '0 0 24px rgba(124,58,237,.35)' } : {}),
                    } as any}
                  >
                    {pdfSharing
                      ? <><ActivityIndicator size="small" color="#c4b5fd" /><Text className="text-violet-300 font-bold text-[14px]">Generating…</Text></>
                      : <><Text style={{ fontSize: 18 }}>📤</Text><Text className="text-white font-bold text-[14px]">Share PDF</Text></>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <Text className="text-slate-700 text-[11px] text-center mb-6">
                {IS_WEB
                  ? 'Choose "Save as PDF" in the print dialog.'
                  : 'Share PDF via WhatsApp, Email, AirDrop & more.'}
              </Text>

            </View>
          </ContentWrap>
        </Animated.View>
      </ScrollView>
    </View>
  );
}