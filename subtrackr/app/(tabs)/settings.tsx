import { useCallback, useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, Platform, Modal, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, router } from 'expo-router';
import { authApi } from '../../lib/api';
import { HamburgerButton, UserAvatarButton } from './_layout';

const IS_WEB = Platform.OS === 'web';

const PREFS_KEY = 'subtrackr_settings_prefs';

// App store URLs — update with your real store IDs when published
const APP_STORE_URL     = 'https://apps.apple.com/app/subtrackr/id000000000'; // replace id
const PLAY_STORE_URL    = 'https://play.google.com/store/apps/details?id=io.subtrackr.app';
const SUPPORT_EMAIL     = 'support@subtrackr.app';
const PRIVACY_POLICY_URL = 'https://subtrackr.app/privacy';
const TERMS_URL          = 'https://subtrackr.app/terms';

const CURRENCIES = [
  { code: 'EUR', symbol: '€', label: 'Euro',           region: 'Europe' },
  { code: 'USD', symbol: '$', label: 'US Dollar',      region: 'United States' },
  { code: 'GBP', symbol: '£', label: 'British Pound',  region: 'United Kingdom' },
];

interface LocalPrefs {
  billingReminders: boolean;
  priceDropAlerts:  boolean;
  weeklyDigest:     boolean;
  currency:         string;
  language:         string;
}

const DEFAULT_PREFS: LocalPrefs = {
  billingReminders: true,
  priceDropAlerts:  true,
  weeklyDigest:     false,
  currency:         'EUR',
  language:         'English',
};

async function loadLocalPrefs(): Promise<LocalPrefs> {
  try {
    if (IS_WEB) {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
    }
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch { return DEFAULT_PREFS; }
}

async function saveLocalPrefs(prefs: LocalPrefs): Promise<void> {
  try {
    const json = JSON.stringify(prefs);
    if (IS_WEB) { localStorage.setItem(PREFS_KEY, json); return; }
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(PREFS_KEY, json);
  } catch {}
}

function ContentWrap({ children }: { children: React.ReactNode }) {
  return (
    <View className={IS_WEB ? 'max-w-[800px] self-center w-full px-7' : 'px-4'}>
      {children}
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <Text className="text-slate-700 text-[10px] font-bold tracking-[1.5px] uppercase mb-2 mt-6 px-1">
      {label}
    </Text>
  );
}

function ToggleRow({
  icon, title, subtitle, value, onToggle, loading = false, tint = '#6366F1',
}: {
  icon: string; title: string; subtitle?: string;
  value: boolean; onToggle: () => void; loading?: boolean; tint?: string;
}) {
  return (
    <View className="flex-row items-center bg-[#0d1424] rounded-2xl px-4 py-[14px] mb-[3px] border border-white/[0.06]">
      <View className="w-9 h-9 rounded-xl items-center justify-center mr-3"
        style={{ backgroundColor: tint + '1a' }}>
        <Text className="text-[17px]">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-slate-200 text-[14px] font-semibold">{title}</Text>
        {subtitle ? <Text className="text-slate-500 text-[11px] mt-0.5">{subtitle}</Text> : null}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <TouchableOpacity
          onPress={onToggle}
          activeOpacity={0.8}
          className="w-11 h-[26px] rounded-full justify-center px-[3px]"
          style={{
            backgroundColor: value ? tint : '#1e293b',
            ...(IS_WEB ? { transition: 'background-color .2s' } : {}),
          } as any}
        >
          <View
            className="w-5 h-5 rounded-full bg-white"
            style={{
              transform: [{ translateX: value ? 18 : 0 }],
              ...(IS_WEB ? { transition: 'transform .2s' } : {}),
              shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.25, shadowRadius: 2,
            } as any}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

function NavRow({
  icon, title, subtitle, onPress, tint = '#6366F1', danger = false, badge,
}: {
  icon: string; title: string; subtitle?: string;
  onPress: () => void; tint?: string; danger?: boolean; badge?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className={`flex-row items-center rounded-2xl px-4 py-[14px] mb-[3px] border ${
        danger ? 'bg-red-500/[0.07] border-red-500/[0.18]' : 'bg-[#0d1424] border-white/[0.06]'
      }`}
    >
      <View className="w-9 h-9 rounded-xl items-center justify-center mr-3"
        style={{ backgroundColor: (danger ? '#ef4444' : tint) + '1a' }}>
        <Text className="text-[17px]">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text className={`text-[14px] font-semibold ${danger ? 'text-red-400' : 'text-slate-200'}`}>
          {title}
        </Text>
        {subtitle ? <Text className="text-slate-500 text-[11px] mt-0.5">{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View className="rounded-xl px-2 py-[3px]" style={{ backgroundColor: tint + '28' }}>
          <Text className="text-[10px] font-bold" style={{ color: tint }}>{badge}</Text>
        </View>
      ) : (
        <Text className="text-slate-700 text-base">›</Text>
      )}
    </TouchableOpacity>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View className="flex-row items-center bg-[#0d1424] rounded-2xl px-4 py-[13px] mb-[3px] border border-white/[0.06]">
      <View className="w-9 h-9 rounded-xl bg-white/[0.04] items-center justify-center mr-3">
        <Text className="text-[17px]">{icon}</Text>
      </View>
      <Text className="text-slate-400 text-[14px] flex-1">{label}</Text>
      <Text className="text-slate-500 text-[13px] font-medium">{value}</Text>
    </View>
  );
}

// ── Language modal ─────────────────────────────────────────────────────────────
function LanguageModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1} onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
      >
        <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
          <View style={{
            backgroundColor: '#0d1424', borderRadius: 24, padding: 28,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
            width: IS_WEB ? 380 : 320,
            ...(IS_WEB ? { boxShadow: '0 24px 80px rgba(0,0,0,0.85)' } : {}),
          } as any}>
            <Text style={{ fontSize: 36, textAlign: 'center', marginBottom: 16 }}>🌍</Text>
            <Text style={{ color: '#f1f5f9', fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>
              Language
            </Text>

            {/* Current language */}
            <View style={{
              backgroundColor: 'rgba(99,102,241,0.15)', borderWidth: 1,
              borderColor: 'rgba(99,102,241,0.35)', borderRadius: 14,
              paddingHorizontal: 16, paddingVertical: 12,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 16,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 20 }}>🇬🇧</Text>
                <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '700' }}>English</Text>
              </View>
              <View style={{
                backgroundColor: 'rgba(99,102,241,0.3)', borderRadius: 8,
                paddingHorizontal: 8, paddingVertical: 3,
              }}>
                <Text style={{ color: '#a5b4fc', fontSize: 10, fontWeight: '800' }}>ACTIVE</Text>
              </View>
            </View>

            {/* Coming soon */}
            <View style={{
              backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1,
              borderColor: 'rgba(245,158,11,0.2)', borderRadius: 14,
              padding: 16, marginBottom: 20,
            }}>
              <Text style={{ color: '#fbbf24', fontSize: 13, fontWeight: '700', marginBottom: 4 }}>
                🚧 More languages coming soon
              </Text>
              <Text style={{ color: '#78716c', fontSize: 12, lineHeight: 18 }}>
                We're actively working on Greek, German, French, and Spanish support. Stay tuned for updates.
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={{
                backgroundColor: '#6366F1', borderRadius: 14,
                paddingVertical: 13, alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Currency modal ─────────────────────────────────────────────────────────────
function CurrencyModal({
  current, onSelect, onClose,
}: {
  current: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1} onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
      >
        <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
          <View style={{
            backgroundColor: '#0d1424', borderRadius: 24, padding: 24,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
            width: IS_WEB ? 400 : 340,
            ...(IS_WEB ? { boxShadow: '0 24px 80px rgba(0,0,0,0.85)' } : {}),
          } as any}>
            <Text style={{ color: '#f1f5f9', fontSize: 18, fontWeight: '800', marginBottom: 6 }}>
              💱 Display Currency
            </Text>
            <Text style={{ color: '#475569', fontSize: 12, lineHeight: 18, marginBottom: 18 }}>
              Choose how amounts are displayed in the app. All subscription amounts are stored in the currency you enter them — this is a display preference only.
            </Text>

            {CURRENCIES.map(c => {
              const isSelected = current === c.code;
              return (
                <TouchableOpacity
                  key={c.code}
                  onPress={() => { onSelect(c.code); onClose(); }}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    backgroundColor: isSelected ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                    borderWidth: 1,
                    borderColor: isSelected ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)',
                    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
                    marginBottom: 8,
                  }}
                >
                  <View style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: isSelected ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ color: isSelected ? '#a5b4fc' : '#64748b', fontSize: 18, fontWeight: '800' }}>
                      {c.symbol}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: isSelected ? '#f1f5f9' : '#94a3b8', fontSize: 14, fontWeight: '700' }}>
                      {c.label}
                    </Text>
                    <Text style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>{c.region}</Text>
                  </View>
                  {isSelected && (
                    <View style={{
                      backgroundColor: 'rgba(99,102,241,0.3)', borderRadius: 8,
                      paddingHorizontal: 8, paddingVertical: 3,
                    }}>
                      <Text style={{ color: '#a5b4fc', fontSize: 10, fontWeight: '800' }}>ACTIVE</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Note about payments */}
            <View style={{
              backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 1,
              borderColor: 'rgba(16,185,129,0.2)', borderRadius: 12,
              padding: 12, marginTop: 8, marginBottom: 16,
            }}>
              <Text style={{ color: '#34d399', fontSize: 12, fontWeight: '700', marginBottom: 2 }}>
                ℹ️ About payments
              </Text>
              <Text style={{ color: '#64748b', fontSize: 11, lineHeight: 17 }}>
                SubTrackr Premium is billed in EUR. USD and GBP users are charged at the equivalent rate by Stripe at checkout.
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                borderRadius: 14, paddingVertical: 12, alignItems: 'center',
              }}
            >
              <Text style={{ color: '#94a3b8', fontSize: 14, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const [loading,          setLoading]          = useState(true);
  const [profile,          setProfile]          = useState<any>(null);
  const [error,            setError]            = useState('');
  const [successMsg,       setSuccessMsg]       = useState('');

  const [emailNotifs,      setEmailNotifs]      = useState(true);
  const [emailLoading,     setEmailLoading]     = useState(false);

  const [prefs,            setPrefs]            = useState<LocalPrefs>(DEFAULT_PREFS);
  const [billingLoading,   setBillingLoading]   = useState(false);
  const [priceDropLoading, setPriceDropLoading] = useState(false);
  const [digestLoading,    setDigestLoading]    = useState(false);

  const [showLanguage,  setShowLanguage]  = useState(false);
  const [showCurrency,  setShowCurrency]  = useState(false);

  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 160 }),
    ]).start();
  }, []);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setError('');

    (async () => {
      try {
        const [profileRes, localPrefs] = await Promise.all([
          authApi.getProfile(),
          loadLocalPrefs(),
        ]);
        if (cancelled) return;
        setProfile(profileRes.data);
        setEmailNotifs(profileRes.data.emailNotifications ?? true);
        setPrefs(localPrefs);
      } catch (e: any) {
        if (!cancelled) setError('Could not load settings. Pull to retry.');
        console.error('[Settings] load failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []));

  const handleEmailNotifs = async () => {
    const next = !emailNotifs;
    setEmailNotifs(next);
    setEmailLoading(true);
    setError('');
    try {
      await authApi.updateEmailNotifications(next);
      flash(`Email notifications ${next ? 'enabled' : 'disabled'}`);
    } catch (e: any) {
      setEmailNotifs(!next);
      setError(e?.response?.data?.error ?? 'Failed to update email notifications');
    } finally {
      setEmailLoading(false);
    }
  };

  const makeLocalToggle = (
    key: keyof LocalPrefs,
    loadSetter: (v: boolean) => void,
  ) => async () => {
    const next = !prefs[key] as boolean;
    const updated = { ...prefs, [key]: next };
    setPrefs(updated);
    loadSetter(true);
    await saveLocalPrefs(updated);
    loadSetter(false);
    flash(
      `${key === 'billingReminders' ? 'Billing reminders'
        : key === 'priceDropAlerts' ? 'Price drop alerts'
        : 'Weekly digest'} ${next ? 'enabled' : 'disabled'}`
    );
  };

  const handleCurrencySelect = async (code: string) => {
    const updated = { ...prefs, currency: code };
    setPrefs(updated);
    await saveLocalPrefs(updated);
    flash(`Display currency set to ${code}`);
  };

  const handleRateApp = async () => {
    const url = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else if (IS_WEB) window.open(url, '_blank');
    } catch (e) {
      console.error('Could not open store URL:', e);
    }
  };

  const handleBugReport = async () => {
    const subject = encodeURIComponent('SubTrackr Bug Report');
    const body = encodeURIComponent(
      `Device: ${Platform.OS}\nApp Version: 1.0.0\n\nDescribe the bug:\n\n`
    );
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    try {
      await Linking.openURL(url);
    } catch {
      if (IS_WEB) window.open(url, '_blank');
    }
  };

  const handlePrivacyPolicy = async () => {
    router.push('/privacy-policy');
  };

  const handleTerms = async () => {
    router.push('/terms');
  };

  const flash = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const isPremium = profile?.plan === 'PREMIUM';
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';

  const currentCurrencyLabel = CURRENCIES.find(c => c.code === prefs.currency)?.label ?? 'Euro';

  if (loading) return (
    <View className="flex-1 bg-[#020617] items-center justify-center">
      <ActivityIndicator size="large" color="#7C3AED" />
    </View>
  );

  return (
    <View className="flex-1 bg-[#020617]">

      <View
        className="bg-[#020617] border-b border-white/[0.06]"
        style={{ paddingTop: IS_WEB ? 0 : (Platform.OS === 'ios' ? 56 : 52) }}
      >
        <View className="flex-row items-center w-full px-4 py-3">
          <View className="flex-1"><HamburgerButton /></View>
          <View className="items-center">
            <Text className="text-white text-[17px] font-extrabold tracking-tight">Settings ⚙️</Text>
          </View>
          <View className="flex-1 items-end"><UserAvatarButton /></View>
        </View>
        <Text className="text-slate-700 text-[11px] px-4 pb-2.5">
          Notifications, preferences and account
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
      >
        <LinearGradient
          colors={['#130826', '#020617']}
          className="absolute top-0 left-0 right-0 h-40"
        />

        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <ContentWrap>
            <View className="pt-5">

              {error ? (
                <View className="bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-3 mb-4">
                  <Text className="text-red-400 text-[13px]">{error}</Text>
                </View>
              ) : null}
              {successMsg ? (
                <View className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl px-4 py-3 mb-4 flex-row items-center gap-2">
                  <Text className="text-emerald-400 text-[11px] font-bold">✓</Text>
                  <Text className="text-emerald-400 text-[13px]">{successMsg}</Text>
                </View>
              ) : null}

              {/* Plan card */}
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/profile')}
                activeOpacity={0.88}
                className="mb-1"
              >
                <View className={`rounded-2xl overflow-hidden border ${
                  isPremium ? 'border-emerald-500/25' : 'border-violet-500/25'
                }`}>
                  <LinearGradient
                    colors={isPremium
                      ? ['rgba(5,150,105,0.18)', 'rgba(6,95,70,0.10)']
                      : ['rgba(124,58,237,0.16)', 'rgba(236,72,153,0.08)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    className="px-[18px] py-[14px] flex-row items-center"
                  >
                    <View className="mr-3">
                      <Text className="text-[22px]">{isPremium ? '👑' : '🔒'}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className={`font-bold text-[14px] ${isPremium ? 'text-emerald-400' : 'text-violet-300'}`}>
                        {isPremium ? 'Premium Plan' : 'Free Plan'}
                      </Text>
                      <Text className="text-slate-500 text-[11px] mt-0.5">
                        {isPremium
                          ? `${profile?.subscriptionCount ?? 0} subs · ${profile?.trackerCount ?? 0} trackers · Unlimited`
                          : `${profile?.subscriptionCount ?? 0}/3 subs · ${profile?.trackerCount ?? 0}/2 trackers · Tap to upgrade`}
                      </Text>
                    </View>
                    <Text className={`text-[12px] font-semibold ${isPremium ? 'text-emerald-500' : 'text-violet-400'}`}>
                      {isPremium ? 'Active ✓' : 'Upgrade →'}
                    </Text>
                  </LinearGradient>
                </View>
              </TouchableOpacity>

              <SectionLabel label="Notifications" />

              <ToggleRow
                icon="📧" title="Email Notifications"
                subtitle={emailNotifs ? 'Billing reminders & price alerts via email' : 'Email alerts are off'}
                value={emailNotifs} onToggle={handleEmailNotifs}
                loading={emailLoading} tint="#6366F1"
              />
              <ToggleRow
                icon="📅" title="Billing Reminders"
                subtitle="In-app alert 2 days before each charge"
                value={prefs.billingReminders}
                onToggle={makeLocalToggle('billingReminders', setBillingLoading)}
                loading={billingLoading} tint="#3b82f6"
              />
              <ToggleRow
                icon="📉" title="Price Drop Alerts"
                subtitle="Notify when a tracked price hits your target"
                value={prefs.priceDropAlerts}
                onToggle={makeLocalToggle('priceDropAlerts', setPriceDropLoading)}
                loading={priceDropLoading} tint="#10b981"
              />
              <ToggleRow
                icon="📊" title="Weekly Digest"
                subtitle="Spending summary every Monday"
                value={prefs.weeklyDigest}
                onToggle={makeLocalToggle('weeklyDigest', setDigestLoading)}
                loading={digestLoading} tint="#f59e0b"
              />

              <SectionLabel label="Subscriptions" />

              <NavRow icon="📋" title="Manage Subscriptions"
                subtitle={`${profile?.subscriptionCount ?? 0} active · tap to add, edit or pause`}
                onPress={() => router.push('/(tabs)/subscriptions')} tint="#6366F1" />
              <NavRow icon="📬" title="Import from Gmail"
                subtitle="Auto-detect subscriptions in your inbox"
                onPress={() => router.push('/(tabs)/gmail-import')} tint="#ec4899" />
              <NavRow icon="🎯" title="Price Trackers"
                subtitle={`${profile?.trackerCount ?? 0} products monitored`}
                onPress={() => router.push('/(tabs)/trackers')} tint="#10b981" />
              <NavRow icon="✉️" title="Email Drafter"
                subtitle="Cancel, negotiate & pause email templates"
                onPress={() => router.push('/(tabs)/email-drafter')} tint="#f97316" />

              <SectionLabel label="Account" />

              <NavRow icon="👤" title="Edit Profile"
                subtitle="Change name, avatar or password"
                onPress={() => router.push('/(tabs)/profile')} tint="#8b5cf6" />
              <NavRow icon="💰" title="Savings Report"
                subtitle="See your total savings and spending breakdown"
                onPress={() => router.push('/(tabs)/savings')} tint="#ec4899" />
              <NavRow icon="🔔" title="Notifications"
                subtitle="View all your alerts and reminders"
                onPress={() => router.push('/(tabs)/notifications')} tint="#f59e0b" />

              <SectionLabel label="Preferences" />

              <NavRow icon="💬" title="Language"
                subtitle="App display language"
                onPress={() => setShowLanguage(true)}
                tint="#06b6d4" badge="English" />
              <NavRow icon="💱" title="Display Currency"
                subtitle="How amounts are shown in the app"
                onPress={() => setShowCurrency(true)}
                tint="#10b981" badge={prefs.currency} />

              <SectionLabel label="Support" />

              <NavRow icon="⭐" title="Rate SubTrackr"
                subtitle="Love the app? Leave us a review"
                onPress={handleRateApp} tint="#f59e0b" />
              <NavRow icon="🐛" title="Report a Bug"
                subtitle="Something broken? Let us know"
                onPress={handleBugReport} tint="#ef4444" />
              <NavRow icon="💬" title="Contact Support"
                subtitle={SUPPORT_EMAIL}
                onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} tint="#6366F1" />

              <SectionLabel label="Legal" />

              <NavRow icon="🔒" title="Privacy Policy"
                subtitle="How we collect and protect your data"
                onPress={handlePrivacyPolicy} tint="#475569" />
              <NavRow icon="📋" title="Terms of Service"
                subtitle="Rules and conditions for using SubTrackr"
                onPress={handleTerms} tint="#475569" />

              <View className="mt-3">
                <InfoRow icon="📱" label="App Version"  value="1.0.0"       />
                <InfoRow icon="🌐" label="Region"       value="EU (Greece)" />
                <InfoRow icon="📅" label="Member since" value={memberSince} />
                <InfoRow icon="📧" label="Account"      value={profile?.email ?? '—'} />
              </View>

              <View className="items-center pt-6 pb-2 gap-2">
                <LinearGradient
                  colors={['#7c3aed', '#ec4899']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  className="rounded-full px-4 py-1.5"
                >
                  <Text className="text-white text-[11px] font-bold tracking-wide">SubTrackr</Text>
                </LinearGradient>
                <Text className="text-slate-800 text-[11px]">Stop overpaying. Start tracking.</Text>
              </View>

            </View>
          </ContentWrap>
        </Animated.View>
      </ScrollView>

      {showLanguage && <LanguageModal onClose={() => setShowLanguage(false)} />}
      {showCurrency && (
        <CurrencyModal
          current={prefs.currency}
          onSelect={handleCurrencySelect}
          onClose={() => setShowCurrency(false)}
        />
      )}
    </View>
  );
}