import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Animated, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const IS_WEB = Platform.OS === 'web';

interface PlatformInsights {
  avgMonthlySpend: number;
  avgSubscriptionsPerUser: number;
  totalActiveUsers: number;
  popularServices: { name: string; userCount: number; sharePercent: number }[];
  pauseRates: { category: string; total: number; paused: number; pausePercent: number }[];
  totalActiveTrackers: number;
  avgTargetPriceDrop: number;
}

/** Animated horizontal bar that grows from 0 → `pct`% */
function AnimBar({
  pct, color, delay = 0,
}: { pct: number; color: string; delay?: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 900,
      delay,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  return (
    <View className="bg-white/[0.06] rounded-full h-[6px] overflow-hidden flex-1">
      <Animated.View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: color,
          width: anim.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
          }),
        }}
      />
    </View>
  );
}

/** Single "you vs. platform" comparison row */
function BenchmarkRow({
  label,
  yours,
  platform,
  prefix = '',
  suffix = '',
  yourColor,
}: {
  label: string;
  yours: number;
  platform: number;
  prefix?: string;
  suffix?: string;
  yourColor: string;
}) {
  // Normalise both bars relative to the larger value
  const max       = Math.max(yours, platform, 0.01);
  const yourPct   = (yours / max) * 100;
  const platPct   = (platform / max) * 100;
  const youHigher = yours > platform;

  return (
    <View className="mb-4">
      <View className="flex-row justify-between mb-1.5">
        <Text className="text-slate-400 text-[12px]">{label}</Text>
        <View className="flex-row gap-3">
          <Text className="text-[12px] font-bold" style={{ color: yourColor }}>
            You: {prefix}{yours.toFixed(2)}{suffix}
          </Text>
          <Text className="text-slate-500 text-[12px]">
            Avg: {prefix}{platform.toFixed(2)}{suffix}
          </Text>
        </View>
      </View>
      <View className="gap-1.5">
        <View className="flex-row items-center gap-2">
          <Text className="text-[10px] w-10 text-slate-600">You</Text>
          <AnimBar pct={yourPct} color={yourColor} delay={0} />
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-[10px] w-10 text-slate-600">Avg</Text>
          <AnimBar pct={platPct} color="#475569" delay={120} />
        </View>
      </View>
      {/* Verdict pill */}
      <View className="flex-row mt-1.5">
        <View
          className="self-start px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: youHigher
              ? 'rgba(239,68,68,0.12)'
              : 'rgba(16,185,129,0.12)',
          }}
        >
          <Text
            className="text-[10px] font-semibold"
            style={{ color: youHigher ? '#f87171' : '#34d399' }}
          >
            {youHigher
              ? `↑ ${((yours - platform) / Math.max(platform, 0.01) * 100).toFixed(0)}% above average`
              : `↓ ${((platform - yours) / Math.max(platform, 0.01) * 100).toFixed(0)}% below average`}
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * InsightsBenchmark
 *
 * Shows:
 *  - "You vs. the average SubTrackr user" spend & sub-count bars
 *  - Top 5 most-popular services platform-wide
 *  - Pause-rate leaderboard by category
 *
 * Props:
 *   insights  – data from GET /api/insights
 *   myMonthly – current user's monthly total (from DashboardResponse)
 *   mySubCount – current user's active subscription count
 */
export function InsightsBenchmark({
  insights,
  myMonthly,
  mySubCount,
}: {
  insights: PlatformInsights;
  myMonthly: number;
  mySubCount: number;
}) {
  const PIE = ['#7C3AED', '#EC4899', '#06B6D4', '#10B981', '#F59E0B'];

  return (
    <View className="mb-5">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <Text className="text-slate-100 text-[14px] font-extrabold mb-1">
        How You Compare 🌍
      </Text>
      <Text className="text-slate-500 text-[11px] mb-4">
        Anonymous averages across {insights.totalActiveUsers.toLocaleString()} SubTrackr users
      </Text>

      {/* ── You vs. Average ─────────────────────────────────────────────────── */}
      <View
        className="bg-[#0d1424] rounded-2xl p-5 border border-white/[0.06] mb-4"
        style={IS_WEB ? { boxShadow: '0 4px 20px rgba(0,0,0,.2)' } as any : undefined}
      >
        <BenchmarkRow
          label="Monthly spend"
          yours={myMonthly}
          platform={Number(insights.avgMonthlySpend)}
          prefix="€"
          yourColor="#6366F1"
        />
        <BenchmarkRow
          label="Active subscriptions"
          yours={mySubCount}
          platform={Number(insights.avgSubscriptionsPerUser)}
          yourColor="#EC4899"
        />
      </View>

      {/* ── Most popular services ────────────────────────────────────────────── */}
      {insights.popularServices.length > 0 && (
        <View className="bg-[#0d1424] rounded-2xl p-5 border border-white/[0.06] mb-4">
          <Text className="text-slate-100 text-[13px] font-extrabold mb-1">
            🔥 Most Tracked Services
          </Text>
          <Text className="text-slate-500 text-[10px] mb-4">
            Percentage of users tracking each service
          </Text>
          {insights.popularServices.map((s, i) => (
            <View key={i} className="mb-3">
              <View className="flex-row justify-between mb-1">
                <Text className="text-slate-300 text-[12px] font-semibold">{s.name}</Text>
                <Text className="text-[12px] font-bold" style={{ color: PIE[i % PIE.length] }}>
                  {s.sharePercent.toFixed(1)}%
                </Text>
              </View>
              <AnimBar pct={s.sharePercent} color={PIE[i % PIE.length]} delay={i * 80} />
            </View>
          ))}
        </View>
      )}

      {/* ── Pause rates ──────────────────────────────────────────────────────── */}
      {insights.pauseRates.length > 0 && (
        <View className="bg-[#0d1424] rounded-2xl p-5 border border-white/[0.06] mb-4">
          <Text className="text-slate-100 text-[13px] font-extrabold mb-1">
            ⏸ Pause Rates by Category
          </Text>
          <Text className="text-slate-500 text-[10px] mb-4">
            How often users pause each type of subscription
          </Text>
          {insights.pauseRates.slice(0, 6).map((r, i) => (
            <View key={i} className="mb-3">
              <View className="flex-row justify-between mb-1">
                <Text className="text-slate-400 text-[12px]">{r.category}</Text>
                <Text className="text-amber-400 text-[12px] font-bold">
                  {r.pausePercent.toFixed(1)}% paused
                </Text>
              </View>
              <AnimBar pct={r.pausePercent} color="#F59E0B" delay={i * 60} />
            </View>
          ))}
        </View>
      )}

      {/* ── Tracker stat pill ───────────────────────────────────────────────── */}
      <LinearGradient
        colors={['rgba(99,102,241,0.12)', 'rgba(236,72,153,0.08)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 16, padding: 16,
          borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)',
          flexDirection: 'row', alignItems: 'center', gap: 14,
        }}
      >
        <Text style={{ fontSize: 26 }}>🎯</Text>
        <View className="flex-1">
          <Text className="text-slate-200 text-[13px] font-bold">
            {insights.totalActiveTrackers.toLocaleString()} products tracked platform-wide
          </Text>
          {insights.avgTargetPriceDrop > 0 && (
            <Text className="text-slate-500 text-[11px] mt-0.5">
              Users set targets ~{insights.avgTargetPriceDrop.toFixed(1)}% below current price on average
            </Text>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}