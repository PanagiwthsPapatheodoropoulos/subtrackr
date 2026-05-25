import { useCallback, useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Modal,Animated, ScrollView, Share,
  ActivityIndicator, Linking, Platform, KeyboardAvoidingView, Dimensions,Clipboard
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { subscriptionsApi, emailDrafterApi, authApi } from '../../lib/api';
import { HamburgerButton, UserAvatarButton } from './_layout';
import { Subscription } from '../../types';
import * as MailComposer from 'expo-mail-composer';

const IS_WEB = Platform.OS === 'web';
const MAX_W  = 800;
const { width: W, height: H } = Dimensions.get('window');

function ContentWrap({ children }: { children: React.ReactNode }) {
  return (
    <View style={IS_WEB
      ? { maxWidth: MAX_W, alignSelf: 'center', width: '100%', paddingHorizontal: 28 }
      : { paddingHorizontal: 16 }}>
      {children}
    </View>
  );
}

type EmailType = 'CANCEL' | 'NEGOTIATE' | 'PAUSE' | 'COMPLAINT' | 'RETENTION';

const EMAIL_TYPES: {
  type: EmailType;
  emoji: string;
  label: string;
  desc: string;
  color: string;
}[] = [
  { type: 'CANCEL',    emoji: '🗑️', label: 'Cancel Subscription',  desc: 'Formal cancellation request with confirmation checklist', color: '#ef4444' },
  { type: 'NEGOTIATE', emoji: '🤝', label: 'Negotiate a Lower Price', desc: 'Leverage loyalty & competition to request a discount',    color: '#10b981' },
  { type: 'PAUSE',     emoji: '⏸️', label: 'Request a Pause',       desc: 'Temporarily suspend billing without losing your account', color: '#f59e0b' },
  { type: 'COMPLAINT', emoji: '⚠️', label: 'File a Complaint',      desc: 'Professional complaint requesting acknowledgement & compensation', color: '#f97316' },
  { type: 'RETENTION', emoji: '🔄', label: 'Counter a Retention Offer', desc: 'Push back on a weak discount and ask for more',      color: '#6366F1' },
];

function SubPill({ sub, selected, onPress }: { sub: Subscription; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="flex-row items-center px-[14px] py-2.5 rounded-[14px] border-[1.5px] mr-2 mb-2"
      style={{
        borderColor: selected ? '#7c3aed' : 'rgba(255,255,255,0.08)',
        backgroundColor: selected ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
        ...(IS_WEB && selected ? { boxShadow: '0 0 0 3px rgba(124,58,237,0.2)' } : {}),
      } as any}
    >
      <View className="w-2.5 h-2.5 rounded-full mr-2"
        style={{ backgroundColor: selected ? '#7c3aed' : (sub.color || '#6366F1') }} />
      <Text className="text-[13px]"
        style={{ color: selected ? '#c4b5fd' : '#94a3b8', fontWeight: selected ? '700' : '500' }}
        numberOfLines={1}>
        {sub.name}
      </Text>
    </TouchableOpacity>
  );
}

function TypeCard({ item, selected, onPress }: {
  item: (typeof EMAIL_TYPES)[number]; selected: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="flex-1 rounded-2xl border-[1.5px] p-[14px] mb-2 mr-2"
      style={{
        minWidth: IS_WEB ? 200 : '48%',
        borderColor: selected ? item.color : 'rgba(255,255,255,0.07)',
        backgroundColor: selected ? item.color + '18' : '#0d1424',
        ...(IS_WEB && selected ? { boxShadow: `0 0 0 3px ${item.color}28` } : {}),
      } as any}
    >
      <View className="flex-row items-center mb-1.5">
        <Text className="text-lg mr-2">{item.emoji}</Text>
        <Text className="text-[13px] flex-1 font-bold" style={{ color: selected ? '#f1f5f9' : '#94a3b8' }}>
          {item.label}
        </Text>
        {selected && (
          <View className="w-[18px] h-[18px] rounded-full items-center justify-center" style={{ backgroundColor: item.color }}>
            <Text className="text-white text-[10px] font-extrabold">✓</Text>
          </View>
        )}
      </View>
      <Text className="text-slate-600 text-[11px] leading-4">{item.desc}</Text>
    </TouchableOpacity>
  );
}

export function DraftCard({ subject, body, tip, emailType, onShare, onSend, sharing }: {
  subject: string; body: string; tip: string; emailType: string;
  onShare: () => void; onSend: () => void; sharing: boolean;
}) {
  const [copied, setCopied] = useState(false);
 
  const handleCopy = () => {
    const full = `Subject: ${subject}\n\n${body}`;
    if (IS_WEB) {
      navigator.clipboard.writeText(full).then(() => {
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      });
    } else {
      // dynamic import keeps it compatible with both old and new Clipboard API
      import('expo-clipboard').then(Clipboard => {
        Clipboard.setStringAsync(full);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };
 
  return (
    <View
      className="bg-[#0d1424] rounded-[20px] border border-white/5 overflow-hidden"
      style={IS_WEB ? { boxShadow: '0 8px 32px rgba(0,0,0,0.3)' } : {}}
    >
      {/* Header */}
      <LinearGradient
        colors={['rgba(124,58,237,0.2)', 'rgba(236,72,153,0.12)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        className="px-[18px] py-[14px]"
      >
        <View className="flex-row items-center gap-2">
          <Text className="text-lg">✍️</Text>
          <View className="flex-1">
            <Text className="text-violet-300 text-[10px] font-bold tracking-widest">GENERATED DRAFT</Text>
            <Text className="text-slate-100 font-bold text-[13px] mt-0.5">{subject}</Text>
          </View>
        </View>
      </LinearGradient>
 
      {/* Body */}
      <View className="p-[18px]">
        <Text
          className="text-slate-400 text-[13px] leading-[22px]"
          style={{ fontFamily: IS_WEB ? 'monospace' : undefined }}
          selectable
        >
          {body}
        </Text>
      </View>
 
      {/* Tip */}
      {tip ? (
        <View className="mx-[18px] mb-[18px] bg-indigo-500/10 rounded-xl border border-indigo-500/20 p-3">
          <Text className="text-indigo-300 text-xs leading-[18px]">{tip}</Text>
        </View>
      ) : null}
 
      {/* Action row — Copy | Send | Share */}
      <View className="flex-row gap-2 px-[18px] pb-[18px]">
        {/* Copy */}
        <TouchableOpacity
          onPress={handleCopy}
          className="flex-1 py-3 rounded-xl border items-center"
          style={{
            backgroundColor: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
            borderColor:     copied ? 'rgba(16,185,129,0.3)'  : 'rgba(255,255,255,0.08)',
          }}
        >
          <Text className="text-[12px] font-semibold"
            style={{ color: copied ? '#34d399' : '#94a3b8' }}>
            {copied ? '✓ Copied' : '📋 Copy'}
          </Text>
        </TouchableOpacity>
 
        {/* Send — opens mail app */}
        <TouchableOpacity onPress={onSend} activeOpacity={0.85}
          className="flex-1 rounded-xl overflow-hidden">
          <LinearGradient
            colors={['#7c3aed', '#6d28d9']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
            <Text style={{ fontSize: 13 }}>📧</Text>
            <Text className="text-white text-[12px] font-bold">Send</Text>
          </LinearGradient>
        </TouchableOpacity>
 
        {/* Share */}
        <TouchableOpacity onPress={onShare} disabled={sharing}
          className="flex-1 rounded-xl overflow-hidden">
          <LinearGradient
            colors={['#ec4899', '#db2777']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
            {sharing
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                  <Text style={{ fontSize: 13 }}>📤</Text>
                  <Text className="text-white text-[12px] font-bold">Share</Text>
                </>
            }
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── SendModal ─────────────────────────────────────────────────────────────────
// Drop this component into email-drafter.tsx (above EmailDrafterScreen)
export function SendModal({
  subject, body, onClose,
}: {
  subject: string;
  body: string;
  onClose: () => void;
}) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sending,        setSending]        = useState(false);
  const [sent,           setSent]           = useState(false);
  const [canCompose,     setCanCompose]     = useState(false);
 
  useEffect(() => {
    MailComposer.isAvailableAsync().then(setCanCompose);
  }, []);
 
  // Native mail composer — pre-fills To, Subject, Body in the system mail app
  const handleNative = async () => {
    setSending(true);
    try {
      const result = await MailComposer.composeAsync({
        subject,
        body,
        isHtml: false,
        ...(recipientEmail.trim() ? { recipients: [recipientEmail.trim()] } : {}),
      });
      if (result.status === MailComposer.MailComposerStatus.SENT ||
          result.status === MailComposer.MailComposerStatus.SAVED) {
        setSent(true);
        setTimeout(onClose, 1400);
      }
    } catch {
      // Fall back to mailto on error
      handleMailto();
    } finally { setSending(false); }
  };
 
  // mailto: fallback — works everywhere including web
  const handleMailto = () => {
    const to  = recipientEmail.trim();
    const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (IS_WEB) { window.open(url, '_blank'); }
    else        { Linking.openURL(url); }
    setSent(true);
    setTimeout(onClose, 1200);
  };
 
  const handlePress = () => {
    if (!IS_WEB && canCompose) handleNative();
    else handleMailto();
  };
 
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={IS_WEB ? undefined : 'padding'} style={{ flex: 1 }}>
        <TouchableOpacity activeOpacity={1} onPress={onClose}
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)' }} />
 
        <View style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: [
            { translateX: IS_WEB ? -210 : -(W * 0.44) },
            { translateY: IS_WEB ? -220 : -(H * 0.36) },
          ],
          width: IS_WEB ? 420 : W * 0.88,
          backgroundColor: '#0d1424', borderRadius: 24,
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
          ...(IS_WEB ? { boxShadow: '0 24px 80px rgba(0,0,0,0.85)' } : {}),
        } as any}>
 
          {/* Header */}
          <LinearGradient colors={['#160826', '#0d1424']}
            style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 18 }}>
            <TouchableOpacity onPress={onClose} className="mb-4 self-start">
              <View className="w-8 h-8 rounded-xl bg-white/[0.08] items-center justify-center">
                <Text className="text-slate-400 text-sm">✕</Text>
              </View>
            </TouchableOpacity>
            <Text className="text-slate-100 text-[18px] font-extrabold">
              {sent ? '✅ Mail app opened!' : '📤 Send Email'}
            </Text>
            <Text className="text-slate-500 text-xs mt-1.5">
              {sent
                ? 'Review the draft in your mail app and hit send when ready.'
                : 'Optionally enter the support address, or leave blank to fill it yourself.'}
            </Text>
          </LinearGradient>
 
          {!sent ? (
            <View className="p-5 gap-4">
              {/* Subject preview */}
              <View className="bg-white/[0.04] rounded-xl border border-white/[0.06] px-3 py-2.5">
                <Text className="text-slate-600 text-[10px] font-bold uppercase tracking-wide mb-1">Subject</Text>
                <Text className="text-slate-300 text-[12px]" numberOfLines={2}>{subject}</Text>
              </View>
 
              {/* Recipient */}
              <View>
                <Text className="text-slate-500 text-[11px] font-semibold uppercase tracking-wide mb-1.5">
                  Recipient email (optional)
                </Text>
                <TextInput
                  placeholder="support@netflix.com"
                  placeholderTextColor="#334155"
                  value={recipientEmail}
                  onChangeText={setRecipientEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  className="bg-[#111827] text-slate-100 text-[13px] px-[14px] py-[11px] rounded-xl border border-white/[0.07]"
                  style={IS_WEB ? { outlineStyle: 'none' } as any : undefined}
                />
                <Text className="text-slate-700 text-[10px] mt-1.5">
                  Leave blank to add the address yourself in the mail app
                </Text>
              </View>
 
              {/* Send button */}
              <TouchableOpacity onPress={handlePress} disabled={sending}
                className="rounded-2xl overflow-hidden" activeOpacity={0.85}>
                <LinearGradient
                  colors={sending ? ['#3730a3','#3730a3'] : ['#7c3aed','#ec4899']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                  {sending
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <>
                        <Text style={{ fontSize: 16 }}>📧</Text>
                        <Text className="text-white font-bold text-sm">Open in Mail App</Text>
                      </>
                  }
                </LinearGradient>
              </TouchableOpacity>
 
              <TouchableOpacity onPress={onClose}
                className="py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] items-center">
                <Text className="text-slate-500 text-sm font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="p-6 items-center gap-3">
              <Text style={{ fontSize: 48 }}>✅</Text>
              <Text className="text-emerald-400 font-bold text-base">Mail app opened!</Text>
              <Text className="text-slate-500 text-xs text-center leading-5">
                Review the pre-filled draft and hit send{'\n'}when you're ready.
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
 

// ── Main screen ───────────────────────────────────────────────────────────────

export default function EmailDrafterScreen() {
  const [subs, setSubs]               = useState<Subscription[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [emailType, setEmailType]     = useState<EmailType>('CANCEL');
  const [context, setContext]         = useState('');
  const [generating, setGenerating]   = useState(false);
  const [draft, setDraft]             = useState<{ subject: string; body: string; tip: string; emailType: string } | null>(null);
  const [sharing, setSharing]         = useState(false);
  const [error, setError]             = useState('');
  const [userProfile, setUserProfile] = useState<{ fullName?: string; email?: string } | null>(null);
  const [sendModal, setSendModal] = useState(false);

  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 160 }),
    ]).start();
  }, []);

  const load = async () => {
    try {
      const [subsRes, profileRes] = await Promise.all([
        subscriptionsApi.getAll(),
        authApi.getProfile(),
      ]);
      const c      = subsRes.data?.content ?? subsRes.data ?? [];
      const active = (Array.isArray(c) ? c : []).filter((s: Subscription) => !s.isPaused);
      setSubs(active);
      setUserProfile({
        fullName: profileRes.data?.fullName,
        email:    profileRes.data?.email,
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const fillPlaceholders = (text: string): string => {
    if (!text) return text;
    let filled = text;
    if (userProfile?.fullName) {
      filled = filled.replace(/\[Your Full Name\]/g, userProfile.fullName);
    }
    if (userProfile?.email) {
      filled = filled.replace(/\[Your Account Email\]/g, userProfile.email);
    }
    return filled;
  };

  const handleGenerate = async () => {
    if (!selectedSub) { setError('Please select a subscription first.'); return; }
    setError('');
    setGenerating(true);
    setDraft(null);
    try {
      const res = await emailDrafterApi.generate({
        subscriptionName: selectedSub.name,
        billingCycle:     selectedSub.billingCycle,
        amount:           Number(selectedSub.amount),
        currency:         (selectedSub as any).currency ?? 'EUR',
        category:         selectedSub.category ?? 'Other',
        emailType,
        context: context.trim() || undefined,
      });
      const rawDraft = res.data;
      setDraft({
        ...rawDraft,
        body: fillPlaceholders(rawDraft.body),
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not generate draft. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!draft) return;
    setSharing(true);
    try {
      const text = `Subject: ${draft.subject}\n\n${draft.body}`;
      if (IS_WEB) {
        if (navigator.share) {
          await navigator.share({ title: draft.subject, text });
        } else {
          await navigator.clipboard.writeText(text);
          (window as any).alert('Email copied to clipboard! ✅');
        }
      } else {
        await Share.share({ message: text, title: draft.subject });
      }
    } catch (e) { console.error(e); }
    finally { setSharing(false); }
  };

  if (loading) return (
    <View className="flex-1 bg-slate-950 items-center justify-center">
      <ActivityIndicator size="large" color="#7C3AED" />
    </View>
  );

  const selectedTypeConfig = EMAIL_TYPES.find(t => t.type === emailType)!;

  return (
    <View className="flex-1 bg-slate-950">

      <View className="bg-slate-950 border-b border-white/5" style={{ paddingTop: IS_WEB ? 0 : (Platform.OS === 'ios' ? 56 : 52) }}>
        <View className="flex-row items-center w-full px-4 py-3">
          <View style={{ flex: 1 }}>
            <HamburgerButton />
          </View>
          <View className="items-center">
            <Text className="text-white text-[17px] font-extrabold tracking-tight">Email Drafter ✍️</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <UserAvatarButton />
          </View>
        </View>
        <Text className="text-slate-700 text-[11px] px-4 pb-2.5">
          Generate professional emails to cancel, negotiate, or manage subscriptions
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient colors={['#130826', '#020617']} className="absolute top-0 left-0 right-0 h-40" />

        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <ContentWrap>
            <View className="pt-5">

              {/* Step 1 */}
              <StepHeader num="1" label="Select a subscription" />

              {subs.length === 0 ? (
                <View className="bg-[#0d1424] rounded-2xl p-5 items-center border border-white/5 mb-5">
                  <Text className="text-[32px] mb-2">📋</Text>
                  <Text className="text-slate-500 text-[13px] text-center">
                    No active subscriptions found.{'\n'}Add one first from the Subscriptions tab.
                  </Text>
                </View>
              ) : (
                <View className="flex-row flex-wrap mb-3">
                  {subs.map(sub => (
                    <SubPill
                      key={sub.id}
                      sub={sub}
                      selected={selectedSub?.id === sub.id}
                      onPress={() => { setSelectedSub(sub); setDraft(null); setError(''); }}
                    />
                  ))}
                </View>
              )}

              {selectedSub && (
                <View className="bg-violet-600/10 rounded-[14px] border border-violet-600/20 p-[14px] flex-row items-center gap-3 mb-5">
                  <View className="w-10 h-10 rounded-xl items-center justify-center"
                    style={{ backgroundColor: (selectedSub.color || '#6366F1') + '33' }}>
                    <View className="w-[14px] h-[14px] rounded-full"
                      style={{ backgroundColor: selectedSub.color || '#6366F1' }} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-100 font-bold text-sm">{selectedSub.name}</Text>
                    <Text className="text-slate-600 text-[11px] mt-0.5">
                      {selectedSub.category ?? 'Other'} · €{Number(selectedSub.amount).toFixed(2)} / {selectedSub.billingCycle.toLowerCase()}
                    </Text>
                  </View>
                  <Text className="text-violet-600 text-[11px] font-bold">Selected ✓</Text>
                </View>
              )}

              {/* Step 2 */}
              <StepHeader num="2" label="What do you want to achieve?" />
              <View className="flex-row flex-wrap mb-5">
                {EMAIL_TYPES.map(item => (
                  <TypeCard
                    key={item.type}
                    item={item}
                    selected={emailType === item.type}
                    onPress={() => { setEmailType(item.type); setDraft(null); }}
                  />
                ))}
              </View>

              {/* Step 3 */}
              <StepHeader num="3" label="Add context (optional)" />
              <View className="bg-[#0d1424] rounded-2xl border-[1.5px] border-white/5 mb-5 overflow-hidden">
                <TextInput
                  value={context}
                  onChangeText={setContext}
                  placeholder={placeholderFor(emailType)}
                  placeholderTextColor="#334155"
                  multiline
                  numberOfLines={3}
                  className="text-slate-100 text-[13px] px-4 py-3.5 min-h-[80px]"
                  style={{
                    textAlignVertical: 'top',
                    ...(IS_WEB ? { outlineStyle: 'none', width: '100%', resize: 'none' } : {}),
                  } as any}
                />
              </View>

              {userProfile?.fullName && (
                <View className="rounded-xl border border-emerald-500/20 px-3 py-2 mb-4 flex-row items-center gap-2"
                  style={{ backgroundColor: 'rgba(16,185,129,0.06)' }}>
                  <Text className="text-emerald-400 text-[11px]">✓</Text>
                  <Text className="text-emerald-600 text-[11px] flex-1">
                    Draft will be personalised with your name &amp; email automatically
                  </Text>
                </View>
              )}

              {error ? (
                <View className="bg-red-500/10 rounded-xl border border-red-500/25 p-3 mb-4">
                  <Text className="text-red-400 text-[13px]">{error}</Text>
                </View>
              ) : null}

              {/* Generate button */}
              <TouchableOpacity
                onPress={handleGenerate}
                disabled={generating}
                activeOpacity={0.85}
                className="rounded-2xl overflow-hidden mb-6"
              >
                <LinearGradient
                  colors={generating ? ['#3b1f6e', '#3b1f6e'] : ['#7c3aed', '#ec4899']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  className="py-4 items-center flex-row justify-center gap-2.5"
                  style={IS_WEB && !generating ? { boxShadow: '0 0 28px rgba(124,58,237,0.3)' } : {}}
                >
                  {generating
                    ? <><ActivityIndicator size="small" color="#fff" /><Text className="text-white font-bold text-[15px]">Drafting your email…</Text></>
                    : <><Text className="text-xl">{selectedTypeConfig.emoji}</Text><Text className="text-white font-bold text-[15px]">Generate {selectedTypeConfig.label} Email</Text></>}
                </LinearGradient>
              </TouchableOpacity>

              {draft && (
                <View className="mb-4">
                  <Text className="text-slate-400 text-[10px] font-bold tracking-widest mb-3 uppercase">
                    Your Draft — Ready to send!
                  </Text>
                  <DraftCard
                    subject={draft.subject}
                    body={draft.body}
                    tip={draft.tip}
                    emailType={draft.emailType}
                    onShare={handleShare}
                    onSend={() => setSendModal(true)}
                    sharing={sharing}
                  />
                </View>
              )}

              {!draft && (
                <View className="bg-[#0d1424] rounded-2xl p-[18px] border border-white/5">
                  <Text className="text-violet-300 font-bold text-[13px] mb-3">💡 How the Email Drafter works</Text>
                  {[
                    ['✍️', 'Professionally worded', 'Each draft uses proven templates that get results — clear, firm, and polite.'],
                    ['✨', 'Personalised to you', 'Your name, email, subscription amount and billing cycle are woven in automatically.'],
                    ['🚀', 'Ready to send', 'No placeholders to fill in — just paste into Gmail and hit send.'],
                  ].map(([icon, title, desc], i) => (
                    <View key={i} className="flex-row gap-3" style={{ marginBottom: i < 2 ? 12 : 0 }}>
                      <Text className="text-lg">{icon}</Text>
                      <View className="flex-1">
                        <Text className="text-slate-200 font-semibold text-[13px]">{title}</Text>
                        <Text className="text-slate-600 text-xs mt-0.5 leading-[17px]">{desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {sendModal && draft && (
                <SendModal
                  subject={draft.subject}
                    body={draft.body}
                    onClose={() => setSendModal(false)}
                />
              )}
            </View>
          </ContentWrap>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function StepHeader({ num, label }: { num: string; label: string }) {
  return (
    <View className="flex-row items-center gap-2.5 mb-3">
      <LinearGradient colors={['#7c3aed', '#ec4899']} className="w-6 h-6 rounded-full items-center justify-center">
        <Text className="text-white text-[11px] font-extrabold">{num}</Text>
      </LinearGradient>
      <Text className="text-slate-300 text-[13px] font-bold">{label}</Text>
    </View>
  );
}

function placeholderFor(type: EmailType): string {
  switch (type) {
    case 'CANCEL':    return "e.g. I'm on a tight budget and rarely use this service…";
    case 'NEGOTIATE': return "e.g. I've seen Netflix offering 3 months at half price to others…";
    case 'PAUSE':     return "e.g. I'm travelling for 2 months and won't be using it…";
    case 'COMPLAINT': return "e.g. The app has been crashing every time I open it for the past week…";
    case 'RETENTION': return "e.g. They offered me 1 month free but I want at least 3 months at 50% off…";
  }
}