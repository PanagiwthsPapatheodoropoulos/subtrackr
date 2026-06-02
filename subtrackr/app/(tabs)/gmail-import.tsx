import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from 'expo-router';
import { gmailApi, subscriptionsApi } from '../../lib/api';
import { HamburgerButton,UserAvatarButton } from './_layout';

WebBrowser.maybeCompleteAuthSession();

const IS_WEB = Platform.OS === 'web';
const MAX_W  = 800;

const generateState = () => Math.random().toString(36).substring(2, 15);

function ContentWrap({ children }: { children: React.ReactNode }) {
  return (
    <View style={IS_WEB
      ? { maxWidth: MAX_W, alignSelf: 'center' as const, width: '100%', paddingHorizontal: 28 }
      : { paddingHorizontal: 16 }}>
      {children}
    </View>
  );
}

interface DetectedSub {
  name:        string;
  amount:      number | null;
  currency:    string;
  billingCycle: string;
  category:    string;
  color:       string;
  confidence:  'HIGH' | 'LOW';
  fromEmail:   string;
  subject:     string;
  nextBilling: string;
  id:     string;
  selected: boolean;
  status: 'pending' | 'adding' | 'added' | 'error';
}

type Step = 'idle' | 'connecting' | 'scanning' | 'results' | 'error';

function ConfidenceBadge({ level }: { level: 'HIGH' | 'LOW' }) {
  const cfg = level === 'HIGH'
    ? { label: 'Price found', bg: 'rgba(16,185,129,0.15)', color: '#34d399' }
    : { label: 'Review amount', bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' };

  return (
    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: cfg.bg }}>
      <Text className="text-[9px] font-bold" style={{ color: cfg.color }}>{cfg.label}</Text>
    </View>
  );
}

function SubCard({
  sub,
  onToggle,
  onAddOne,
  addingAll,
}: {
  sub:      DetectedSub;
  onToggle: () => void;
  onAddOne: () => void;
  addingAll: boolean;
}) {
  const statusIcon =
    sub.status === 'added'  ? '✓' :
    sub.status === 'adding' ? '…' :
    sub.status === 'error'  ? '✕' : null;

  const statusColor =
    sub.status === 'added' ? '#34d399' :
    sub.status === 'error' ? '#f87171' : '#a78bfa';

  const cardBg =
    sub.status === 'added'  ? 'rgba(16,185,129,0.07)' :
    sub.selected            ? '#0d1424' :
                              'rgba(15,23,42,0.5)';

  const cardBorder =
    sub.status === 'added'  ? 'rgba(16,185,129,0.3)' :
    sub.selected            ? 'rgba(99,102,241,0.25)' :
                              'rgba(255,255,255,0.05)';

  return (
    <View>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.85}
        className="rounded-2xl border overflow-hidden mb-1"
        style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
      >
        <View className="p-4 flex-row items-center gap-3">
          <View
            className="w-10 h-10 rounded-[13px] items-center justify-center flex-shrink-0"
            style={{ backgroundColor: sub.color + (sub.selected ? '30' : '15') }}
          >
            {statusIcon ? (
              <Text className="text-base font-extrabold" style={{ color: statusColor }}>
                {statusIcon}
              </Text>
            ) : (
              <View
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: sub.selected ? sub.color : '#334155' }}
              />
            )}
          </View>

          <View className="flex-1">
            <View className="flex-row items-center gap-2 flex-wrap">
              <Text
                className="text-slate-100 font-bold text-[14px]"
                style={{ opacity: sub.selected ? 1 : 0.4 }}
              >
                {sub.name}
              </Text>
              <ConfidenceBadge level={sub.confidence} />
            </View>
            <Text className="text-slate-500 text-[11px] mt-0.5">
              {sub.category} · {sub.billingCycle.toLowerCase()}
            </Text>
            <Text className="text-slate-700 text-[10px] mt-0.5" numberOfLines={1}>
              {sub.fromEmail}
            </Text>
          </View>

          <Text
            className="text-[16px] font-extrabold"
            style={{ color: sub.selected ? '#f1f5f9' : '#334155' }}
          >
            {sub.amount ? `€${sub.amount.toFixed(2)}` : '—'}
          </Text>
        </View>
      </TouchableOpacity>

      {sub.status === 'pending' && sub.selected && !addingAll && (
        <TouchableOpacity
          onPress={onAddOne}
          className="mb-3 mx-1 py-2.5 rounded-xl border items-center"
          style={{
            backgroundColor: 'rgba(99,102,241,0.1)',
            borderColor: 'rgba(99,102,241,0.25)',
          }}
        >
          <Text className="text-indigo-400 text-[12px] font-bold">+ Add {sub.name}</Text>
        </TouchableOpacity>
      )}

      {sub.status === 'error' && (
        <View className="mb-3 mx-1 py-2 px-3 rounded-xl" style={{ backgroundColor: 'rgba(239,68,68,0.08)' }}>
          <Text className="text-red-400 text-[11px]">Failed to add — tap to retry</Text>
        </View>
      )}
    </View>
  );
}

export default function GmailImportScreen() {
  const [step,       setStep]       = useState<Step>('idle');
  const [subs,       setSubs]       = useState<DetectedSub[]>([]);
  const [scanned,    setScanned]    = useState(0);
  const [addingAll,  setAddingAll]  = useState(false);
  const [totalAdded, setTotalAdded] = useState(0);
  const [errorMsg,   setErrorMsg]   = useState('');

  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 160 }),
    ]).start();
  }, []);

  const animateIn = useCallback(() => {
    fade.setValue(0); slide.setValue(18);
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 160 }),
    ]).start();
  }, []);

  const handleConnect = async () => {
    setErrorMsg('');
    setStep('connecting');

    try {
      // 1. Generate the secure state string
      const localState = generateState();

      // 2. Pass it to the API
      const { data } = await gmailApi.getAuthUrl(localState);
      const { authUrl, redirectUri } = data as { authUrl: string; redirectUri: string };

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type === 'cancel') {
        setStep('idle');
        return;
      }

      if (result.type !== 'success') {
        setErrorMsg('Google sign-in was cancelled or failed. Please try again.');
        setStep('error');
        return;
      }

      const redirectUrl = result.url;
      let code: string | null = null;
      let returnedState: string | null = null;

      // Extract both the code AND the state from Google's redirect
      try {
        const urlObj = new URL(redirectUrl);
        code = urlObj.searchParams.get('code');
        returnedState = urlObj.searchParams.get('state');
      } catch {
        const codeMatch = redirectUrl.match(/[?&]code=([^&]+)/);
        code = codeMatch ? decodeURIComponent(codeMatch[1]) : null;
        const stateMatch = redirectUrl.match(/[?&]state=([^&]+)/);
        returnedState = stateMatch ? decodeURIComponent(stateMatch[1]) : null;
      }

      // 3. THE SECURITY FIX: Block the login if the states don't match
      if (returnedState !== localState) {
        setErrorMsg('Security Warning: State mismatch. Possible CSRF attack detected.');
        setStep('error');
        return;
      }

      if (!code) {
        const errorParam = redirectUrl.match(/[?&]error=([^&]+)/)?.[1];
        setErrorMsg(errorParam
          ? `Google returned an error: ${decodeURIComponent(errorParam)}`
          : 'No authorization code received. Please try again.');
        setStep('error');
        return;
      }

      setStep('scanning');
      animateIn();

      // 4. Send BOTH code and state to backend
      const importResp = await gmailApi.importSubscriptions(code, localState);
      
      const { detected, emailsScanned } = importResp.data as {
        detected: Omit<DetectedSub, 'id' | 'selected' | 'status'>[];
        emailsScanned: number;
      };

      setScanned(emailsScanned);
      setSubs(detected.map(d => ({
        ...d,
        id:       d.name + '-' + Date.now(),
        selected: d.confidence === 'HIGH',
        status:   'pending' as const,
      })));
      setStep('results');
      animateIn();

    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.message ?? 'Unknown error';
      setErrorMsg(msg);
      setStep('error');
    }
  };

  const addOne = async (sub: DetectedSub): Promise<boolean> => {
    setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'adding' } : s));
    try {
      await subscriptionsApi.create({
        name:        sub.name,
        amount:      sub.amount ?? 1,
        billingCycle: sub.billingCycle,
        nextBilling: sub.nextBilling,
        category:    sub.category,
        color:       sub.color,
        currency:    sub.currency,
      });
      setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'added' } : s));
      return true;
    } catch {
      setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'error' } : s));
      return false;
    }
  };

  const handleAddAll = async () => {
    const toAdd = subs.filter(s => s.selected && s.status === 'pending');
    if (!toAdd.length) return;
    setAddingAll(true);
    let count = 0;
    for (const sub of toAdd) {
      const ok = await addOne(sub);
      if (ok) count++;
    }
    setTotalAdded(t => t + count);
    setAddingAll(false);
  };

  const handleAddOne = async (sub: DetectedSub) => {
    if (sub.status !== 'pending') return;
    const ok = await addOne(sub);
    if (ok) setTotalAdded(t => t + 1);
  };

  const handleReset = () => {
    setStep('idle');
    setSubs([]);
    setScanned(0);
    setTotalAdded(0);
    setErrorMsg('');
    animateIn();
  };

  const updateSub = (id: string, patch: Partial<DetectedSub>) =>
    setSubs(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));

  const selectedCount = subs.filter(s => s.selected && s.status === 'pending').length;
  const addedCount    = subs.filter(s => s.status === 'added').length;
  const highConf      = subs.filter(s => s.confidence === 'HIGH');
  const lowConf       = subs.filter(s => s.confidence === 'LOW');

  return (
    <View className="flex-1 bg-[#020617]">

      {/* Header */}
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
              Gmail Import 📬
            </Text>
          </View>
          <View className="flex-1 flex-row items-center justify-end gap-2">
            {step === 'results' && (
              <TouchableOpacity
                onPress={handleReset}
                className="border px-3 py-1.5 rounded-xl"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.09)' }}
              >
                <Text className="text-slate-400 text-xs font-semibold">Reset</Text>
              </TouchableOpacity>
            )}
            <UserAvatarButton />
          </View>
        </View>
        <Text className="text-slate-700 text-[11px] px-4 pb-2.5">
          Auto-detect subscriptions from your inbox
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <LinearGradient
          colors={['#130826', '#020617']}
          className="absolute top-0 left-0 right-0 h-40"
        />

        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <ContentWrap>
            <View className="pt-5">

              {/* ── IDLE ── */}
              {step === 'idle' && (
                <>
                  <View className="flex-row gap-3 mb-5 flex-wrap">
                    {[
                      ['🔗', 'Connect Gmail', 'Sign in with Google — read-only access'],
                      ['🔍', 'We scan',       'Receipt & billing emails from past 90 days'],
                      ['✅', 'You confirm',   'Pick what to add — nothing automatic'],
                    ].map(([icon, title, desc], i) => (
                      <View
                        key={i}
                        className="flex-1 rounded-2xl p-4 border border-white/[0.06]"
                        style={{ backgroundColor: '#0d1424', minWidth: 110 }}
                      >
                        <Text className="text-2xl mb-1.5">{icon}</Text>
                        <Text className="text-slate-100 text-[12px] font-bold mb-0.5">{title}</Text>
                        <Text className="text-slate-600 text-[10px] leading-[14px]">{desc}</Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    onPress={handleConnect}
                    activeOpacity={0.85}
                    className="rounded-2xl overflow-hidden mb-4"
                  >
                    <LinearGradient
                      colors={['#7c3aed', '#ec4899']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={{
                        paddingVertical: 18,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                        ...(IS_WEB ? { boxShadow: '0 0 28px rgba(124,58,237,0.4)' } : {}),
                      } as any}
                    >
                      <Text className="text-[22px]">📬</Text>
                      <Text className="text-white font-extrabold text-[16px]">
                        Connect Gmail
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <View
                    className="rounded-2xl p-4 border border-white/[0.05] mb-5"
                    style={{ backgroundColor: '#0d1424' }}
                  >
                    <Text className="text-slate-400 text-[12px] font-bold mb-2">🔒 Privacy first</Text>
                    {[
                      'Read-only access — we never send, delete or modify any emails',
                      'Your Gmail token is used only during this session and is never stored',
                      'Only emails matching billing/receipt keywords are fetched',
                      'You review every subscription before it\'s added',
                    ].map((line, i) => (
                      <View key={i} className="flex-row gap-2 mb-1.5">
                        <Text className="text-emerald-400 text-[10px] mt-0.5">✓</Text>
                        <Text className="text-slate-500 text-[11px] leading-[16px] flex-1">{line}</Text>
                      </View>
                    ))}
                  </View>

                  <View
                    className="rounded-2xl p-4 border border-white/[0.05]"
                    style={{ backgroundColor: '#0d1424' }}
                  >
                    <Text className="text-slate-500 text-[10px] font-bold tracking-wider mb-3">
                      WE DETECT 35+ SERVICES
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {['Netflix', 'Spotify', 'Disney+', 'Apple TV+', 'iCloud+', 'Google One',
                        'Adobe CC', 'Xbox Game Pass', 'ChatGPT Plus', 'Dropbox', 'Notion',
                        'Amazon Prime', 'YouTube Premium', 'NordVPN', '+ more'].map((name, i) => (
                        <View
                          key={i}
                          className="px-2.5 py-1 rounded-lg border border-white/[0.06]"
                          style={{ backgroundColor: 'rgba(99,102,241,0.08)' }}
                        >
                          <Text className="text-slate-400 text-[11px]">{name}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </>
              )}

              {/* ── CONNECTING ── */}
              {step === 'connecting' && (
                <View className="items-center py-16 gap-5">
                  <LinearGradient
                    colors={['rgba(124,58,237,0.3)', 'rgba(236,72,153,0.2)']}
                    className="w-20 h-20 rounded-[24px] items-center justify-center"
                  >
                    <Text className="text-[36px]">📬</Text>
                  </LinearGradient>
                  <View className="items-center gap-2">
                    <Text className="text-slate-100 font-extrabold text-[18px]">
                      Opening Google sign-in…
                    </Text>
                    <Text className="text-slate-500 text-[13px] text-center px-8">
                      Complete the sign-in in the browser window that just opened
                    </Text>
                  </View>
                  <ActivityIndicator color="#7c3aed" size="large" />
                </View>
              )}

              {/* ── SCANNING ── */}
              {step === 'scanning' && (
                <View className="items-center py-16 gap-5">
                  <LinearGradient
                    colors={['rgba(124,58,237,0.3)', 'rgba(236,72,153,0.2)']}
                    className="w-20 h-20 rounded-[24px] items-center justify-center"
                  >
                    <Text className="text-[36px]">🔍</Text>
                  </LinearGradient>
                  <View className="items-center gap-2">
                    <Text className="text-slate-100 font-extrabold text-[18px]">
                      Scanning your inbox…
                    </Text>
                    <Text className="text-slate-500 text-[13px] text-center px-8">
                      Searching for receipt & billing emails from the past 90 days
                    </Text>
                  </View>
                  <ActivityIndicator color="#7c3aed" size="large" />
                  <View className="flex-row gap-2 flex-wrap justify-center px-8">
                    {['Fetching messages', 'Detecting services', 'Extracting amounts'].map((label, i) => (
                      <View
                        key={i}
                        className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
                        style={{ backgroundColor: 'rgba(99,102,241,0.1)' }}
                      >
                        <ActivityIndicator size="small" color="#6366f1" />
                        <Text className="text-indigo-400 text-[10px] font-semibold">{label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* ── ERROR ── */}
              {step === 'error' && (
                <View className="items-center py-12 gap-5">
                  <Text className="text-[48px]">⚠️</Text>
                  <View className="items-center gap-2">
                    <Text className="text-slate-100 font-extrabold text-[18px]">
                      Something went wrong
                    </Text>
                    <Text className="text-slate-500 text-[13px] text-center px-8 leading-[20px]">
                      {errorMsg}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleReset}
                    className="rounded-2xl overflow-hidden"
                  >
                    <LinearGradient
                      colors={['#7c3aed', '#ec4899']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={{ paddingVertical: 14, paddingHorizontal: 32 }}
                    >
                      <Text className="text-white font-bold text-[15px]">Try Again</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── RESULTS ── */}
              {step === 'results' && (
                <>
                  <LinearGradient
                    colors={subs.length > 0
                      ? ['rgba(124,58,237,0.2)', 'rgba(236,72,153,0.12)']
                      : ['rgba(30,41,59,0.6)', 'rgba(15,23,42,0.6)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    className="rounded-2xl p-5 mb-5 border border-violet-500/20"
                  >
                    {subs.length === 0 ? (
                      <View className="items-center py-4 gap-2">
                        <Text className="text-4xl">🤷</Text>
                        <Text className="text-slate-300 font-bold text-[15px]">
                          No subscriptions found
                        </Text>
                        <Text className="text-slate-500 text-[12px] text-center px-4">
                          Scanned {scanned} email{scanned !== 1 ? 's' : ''} — try connecting a different Gmail account or check if billing emails exist.
                        </Text>
                      </View>
                    ) : (
                      <View className="flex-row items-center">
                        <View className="flex-1">
                          <Text className="text-slate-400 text-[10px] font-bold tracking-widest mb-1">
                            SCAN COMPLETE · {scanned} EMAILS
                          </Text>
                          <Text className="text-white font-extrabold text-[22px]">
                            {subs.length} service{subs.length !== 1 ? 's' : ''} found
                          </Text>
                          <Text className="text-slate-500 text-[12px] mt-0.5">
                            {selectedCount} selected · {addedCount} added
                          </Text>
                        </View>
                        {selectedCount > 0 && (
                          <TouchableOpacity
                            onPress={handleAddAll}
                            disabled={addingAll}
                            className="rounded-[14px] overflow-hidden"
                          >
                            <LinearGradient
                              colors={addingAll ? ['#3b1f6e', '#3b1f6e'] : ['#6366F1', '#7C3AED']}
                              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                              style={{
                                paddingVertical: 12,
                                paddingHorizontal: 18,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              {addingAll
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text className="text-white font-bold text-[13px]">
                                    Add {selectedCount} ✓
                                  </Text>
                              }
                            </LinearGradient>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </LinearGradient>

                  {totalAdded > 0 && (
                    <View
                      className="rounded-2xl border px-4 py-3 mb-4 flex-row items-center gap-3"
                      style={{
                        backgroundColor: 'rgba(16,185,129,0.08)',
                        borderColor: 'rgba(16,185,129,0.25)',
                      }}
                    >
                      <Text className="text-2xl">🎉</Text>
                      <View className="flex-1">
                        <Text className="text-emerald-300 font-bold text-[13px]">
                          {totalAdded} subscription{totalAdded !== 1 ? 's' : ''} added!
                        </Text>
                        <Text className="text-emerald-700 text-[11px] mt-0.5">
                          Visible on your dashboard and subscriptions tab.
                        </Text>
                      </View>
                    </View>
                  )}

                  {highConf.length > 0 && (
                    <>
                      <Text className="text-slate-700 text-[10px] font-bold tracking-wider mb-2.5">
                        DETECTED — PRICE CONFIRMED ({highConf.length})
                      </Text>
                      {highConf.map(sub => (
                        <SubCard
                          key={sub.id}
                          sub={sub}
                          onToggle={() => updateSub(sub.id, { selected: !sub.selected })}
                          onAddOne={() => handleAddOne(sub)}
                          addingAll={addingAll}
                        />
                      ))}
                    </>
                  )}

                  {lowConf.length > 0 && (
                    <>
                      <Text className="text-slate-700 text-[10px] font-bold tracking-wider mt-3 mb-2.5">
                        ALSO DETECTED — ENTER AMOUNT MANUALLY ({lowConf.length})
                      </Text>
                      {lowConf.map(sub => (
                        <SubCard
                          key={sub.id}
                          sub={sub}
                          onToggle={() => updateSub(sub.id, { selected: !sub.selected })}
                          onAddOne={() => handleAddOne(sub)}
                          addingAll={addingAll}
                        />
                      ))}
                    </>
                  )}

                  <TouchableOpacity
                    onPress={handleReset}
                    className="mt-4 py-4 rounded-2xl items-center border border-white/[0.07]"
                    style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                  >
                    <Text className="text-slate-400 text-[13px] font-semibold">
                      ← Connect another account
                    </Text>
                  </TouchableOpacity>
                </>
              )}

            </View>
          </ContentWrap>
        </Animated.View>
      </ScrollView>
    </View>
  );
}