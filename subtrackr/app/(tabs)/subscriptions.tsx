import { useCallback, useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  TextInput, ActivityIndicator, RefreshControl,
  Platform, KeyboardAvoidingView, Dimensions, Animated, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { subscriptionsApi } from '../../lib/api';
import { HamburgerButton, UserAvatarButton } from './_layout';
import { Subscription } from '../../types';

const IS_WEB = Platform.OS === 'web';
const { width: W, height: H } = Dimensions.get('window');
const MAX_W = 1100;

const CATEGORIES = ['Streaming', 'Music', 'Software', 'Gaming', 'News', 'Fitness', 'Cloud', 'Other'];
const CYCLES     = ['MONTHLY', 'YEARLY', 'WEEKLY'];
const COLORS     = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#06B6D4'];
const CYCLE_LBL: Record<string, string> = { MONTHLY: '/mo', YEARLY: '/yr', WEEKLY: '/wk' };

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa'];
function getSmartDefault(cycle: string): string {
  const d = new Date();
  if (cycle === 'WEEKLY') {
    d.setDate(d.getDate() + 7);
  } else if (cycle === 'YEARLY') {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split('T')[0];
}

function formatDateDisplay(iso: string): string {
  if (!iso) return '';
  try {
    const [y, m, day] = iso.split('-').map(Number);
    return `${MONTH_NAMES[m - 1].slice(0, 3)} ${day}, ${y}`;
  } catch { return iso; }
}

const BLANK = {
  name: '', amount: '', billingCycle: 'MONTHLY',
  nextBilling: '',
  category: 'Streaming', color: '#6366F1', description: '',
};

type FilterTab = 'all' | 'active' | 'paused';
function buildGoogleCalendarUrl(sub: Subscription): string {
  // Normalize date array if backend sent it as [YYYY, MM, DD]
  const dateStr = Array.isArray(sub.nextBilling)
    ? `${sub.nextBilling[0]}-${String(sub.nextBilling[1]).padStart(2, '0')}-${String(sub.nextBilling[2]).padStart(2, '0')}`
    : String(sub.nextBilling || '');

  // Google Calendar requires YYYYMMDD format for all-day events
  const startDate = dateStr.replace(/-/g, '');
  // End date = same day for all-day (Google interprets end as exclusive, so +1 day)
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  const endDate = d.toISOString().split('T')[0].replace(/-/g, '');

  const title = `SubTrackr: ${sub.name} — ${Number(sub.amount).toFixed(2)} ${sub.currency}`;
  const details = [
    `Recurring ${sub.billingCycle.toLowerCase()} charge tracked by SubTrackr.`,
    `Amount: ${Number(sub.amount).toFixed(2)} ${sub.currency}`,
    `Category: ${sub.category ?? 'Other'}`,
    '',
    'Manage your subscriptions at https://app.subtrackr.io',
  ].join('\n');

  const rrule = {
    WEEKLY:  'RRULE:FREQ=WEEKLY',
    MONTHLY: 'RRULE:FREQ=MONTHLY',
    YEARLY:  'RRULE:FREQ=YEARLY',
  }[sub.billingCycle] ?? 'RRULE:FREQ=MONTHLY';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startDate}/${endDate}`,
    details,
    recur: rrule,
    // Pre-set a 2-day reminder to match the billing reminder job
    reminder: '2880', // minutes = 2 days
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildOutlookUrl(sub: Subscription): string {
  const title = `SubTrackr: ${sub.name}`;
  const body = [
    `Recurring ${sub.billingCycle.toLowerCase()} charge tracked by SubTrackr.`,
    `Amount: ${Number(sub.amount).toFixed(2)} ${sub.currency}`,
    `Category: ${sub.category ?? 'Other'}`,
    '',
    'Note: Set this event to repeat to track future charges.',
    'Manage at https://app.subtrackr.io',
  ].join('\n');

  const params = new URLSearchParams({
    subject: title,
    startdt: Array.isArray(sub.nextBilling) ? `${sub.nextBilling[0]}-${String(sub.nextBilling[1]).padStart(2, '0')}-${String(sub.nextBilling[2]).padStart(2, '0')}` : String(sub.nextBilling || ''),
    enddt:   Array.isArray(sub.nextBilling) ? `${sub.nextBilling[0]}-${String(sub.nextBilling[1]).padStart(2, '0')}-${String(sub.nextBilling[2]).padStart(2, '0')}` : String(sub.nextBilling || ''),
    body,
    allday: 'true',
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
async function downloadIcs(subscriptionId: number) {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const token   = await AsyncStorage.getItem('accessToken');
  const baseUrl = subscriptionsApi.calendarUrl(subscriptionId);
  const url     = token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl;
  if (IS_WEB) { window.open(url, '_blank'); }
  else {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  }
}
function CalendarOptionsModal({
  sub, onClose,
}: {
  sub: Subscription;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const openUrl = async (url: string, key: string) => {
    setBusy(key);
    try {
      if (IS_WEB) { window.open(url, '_blank'); }
      else        { await Linking.openURL(url); }
    } catch (e) { console.error('Calendar open failed:', e); }
    finally     { setBusy(null); onClose(); }
  };

  const handleGoogle = () =>
    openUrl(buildGoogleCalendarUrl(sub), 'google');

  const handleOutlook = () =>
    openUrl(buildOutlookUrl(sub), 'outlook');

  const handleIcs = async () => {
    setBusy('ics');
    try { await downloadIcs(sub.id); }
    catch (e) { console.error('iCal download failed:', e); }
    finally   { setBusy(null); onClose(); }
  };

  const cycleLabel: Record<string, string> = {
    MONTHLY: 'monthly', YEARLY: 'yearly', WEEKLY: 'weekly',
  };

  const options = [
    {
      key: 'google',
      icon: '🗓',
      label: 'Google Calendar',
      sublabel: 'Opens Google Calendar in browser',
      accent: 'rgba(66,133,244,0.15)',
      border: 'rgba(66,133,244,0.3)',
      textColor: '#93c5fd',
      onPress: handleGoogle,
    },
    {
      key: 'outlook',
      icon: '📅',
      label: 'Outlook Calendar',
      sublabel: 'Opens Outlook.live.com in browser',
      accent: 'rgba(0,114,198,0.15)',
      border: 'rgba(0,114,198,0.3)',
      textColor: '#7dd3fc',
      onPress: handleOutlook,
    },
    {
      key: 'ics',
      icon: '⬇️',
      label: 'Apple Calendar / iCal',
      sublabel: 'Downloads .ics file with recurring event',
      accent: 'rgba(99,102,241,0.15)',
      border: 'rgba(99,102,241,0.3)',
      textColor: '#a5b4fc',
      onPress: handleIcs,
    },
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.78)' }}
      />

      {/* Sheet */}
      <View style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: [
          { translateX: IS_WEB ? -210 : -(W * 0.44) },
          { translateY: IS_WEB ? -220 : -(H * 0.32) },
        ],
        width: IS_WEB ? 420 : W * 0.88,
        backgroundColor: '#0d1424',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
        ...(IS_WEB ? { boxShadow: '0 24px 80px rgba(0,0,0,0.85)' } : {}),
      } as any}>

        {/* Header */}
        <LinearGradient
          colors={['#160826', '#0d1424']}
          style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 18 }}
        >
          <TouchableOpacity onPress={onClose} className="mb-4 self-start">
            <View className="w-8 h-8 rounded-xl bg-white/[0.08] items-center justify-center">
              <Text className="text-slate-400 text-sm">✕</Text>
            </View>
          </TouchableOpacity>
          <Text className="text-slate-100 text-[18px] font-extrabold">Add to Calendar</Text>
          <Text className="text-slate-500 text-xs mt-1.5" numberOfLines={1}>
            {sub.name} · {Number(sub.amount).toFixed(2)} {sub.currency} {cycleLabel[sub.billingCycle] ?? ''}
          </Text>
        </LinearGradient>

        {/* Options */}
        <View style={{ padding: 16, gap: 10 }}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.key}
              onPress={opt.onPress}
              disabled={busy !== null}
              activeOpacity={0.82}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                backgroundColor: opt.accent,
                borderWidth: 1, borderColor: opt.border,
                borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
                opacity: busy && busy !== opt.key ? 0.45 : 1,
              }}
            >
              {busy === opt.key ? (
                <ActivityIndicator size="small" color={opt.textColor} />
              ) : (
                <Text style={{ fontSize: 22 }}>{opt.icon}</Text>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: opt.textColor, fontSize: 14, fontWeight: '700' }}>
                  {opt.label}
                </Text>
                <Text style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
                  {opt.sublabel}
                </Text>
              </View>
              <Text style={{ color: opt.textColor, fontSize: 16, opacity: 0.7 }}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer note */}
        <View style={{
          marginHorizontal: 16, marginBottom: 18,
          paddingHorizontal: 14, paddingVertical: 10,
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
        }}>
          <Text style={{ color: '#334155', fontSize: 11, lineHeight: 16, textAlign: 'center' }}>
            A recurring event is added starting {formatDateDisplay(sub.nextBilling)} with a reminder 2 days before each charge.
          </Text>
        </View>
      </View>
    </Modal>
  );
}
function CalendarPicker({
  value, onChange, onClose,
}: {
  value: string;
  onChange: (iso: string) => void;
  onClose: () => void;
}) {
  const todayIso = new Date().toISOString().split('T')[0];
  const init     = value ? new Date(value + 'T00:00:00') : new Date();

  const [viewYear,  setViewYear]  = useState(init.getFullYear());
  const [viewMonth, setViewMonth] = useState(init.getMonth());

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectDay = (day: number) => {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    onChange(iso);
    onClose();
  };

  return (
    <View
      className="bg-[#0d1424] rounded-2xl overflow-hidden border border-white/[0.12]"
      style={IS_WEB ? { boxShadow: '0 16px 48px rgba(0,0,0,0.7)' } as any : undefined}
    >
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-white/[0.07]">
        <TouchableOpacity
          onPress={prevMonth}
          className="w-8 h-8 rounded-xl bg-white/[0.06] items-center justify-center"
          activeOpacity={0.7}
        >
          <Text className="text-slate-300 font-bold" style={{ fontSize: 16, lineHeight: 18 }}>‹</Text>
        </TouchableOpacity>
        <Text className="text-slate-100 text-[14px] font-extrabold">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity
          onPress={nextMonth}
          className="w-8 h-8 rounded-xl bg-white/[0.06] items-center justify-center"
          activeOpacity={0.7}
        >
          <Text className="text-slate-300 font-bold" style={{ fontSize: 16, lineHeight: 18 }}>›</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row px-3 pt-2.5 pb-1">
        {DAY_NAMES.map(d => (
          <View key={d} className="flex-1 items-center">
            <Text className="text-slate-600 text-[11px] font-bold">{d}</Text>
          </View>
        ))}
      </View>

      <View className="px-3 pb-2">
        {Array.from({ length: cells.length / 7 }, (_, row) => (
          <View key={row} className="flex-row mb-0.5">
            {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
              if (!day) return <View key={col} className="flex-1" style={{ height: 34 }} />;
              const iso        = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const isToday    = iso === todayIso;
              const isSelected = iso === value;
              const isPast     = iso < todayIso;
              return (
                <TouchableOpacity
                  key={col}
                  onPress={() => { if (!isPast) selectDay(day); }}
                  activeOpacity={isPast ? 1 : 0.75}
                  className="flex-1 items-center justify-center"
                  style={{ height: 34 }}
                >
                  <View
                    className="w-[30px] h-[30px] rounded-full items-center justify-center"
                    style={{
                      backgroundColor: isSelected
                        ? '#7c3aed'
                        : isToday
                        ? 'rgba(124,58,237,0.18)'
                        : 'transparent',
                    }}
                  >
                    <Text
                      className="text-[13px] font-semibold"
                      style={{
                        color: isSelected ? '#fff'
                          : isPast        ? '#1e293b'
                          : isToday       ? '#a78bfa'
                          :                 '#cbd5e1',
                      }}
                    >
                      {day}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <View className="flex-row gap-2 px-3 pb-3 pt-2 border-t border-white/[0.06]">
        {([
          { label: '+1 week',  days: 7  },
          { label: '+1 month', months: 1 },
          { label: '+1 year',  years: 1  },
        ] as any[]).map(({ label, days, months, years }) => {
          const d = new Date();
          if (days)   d.setDate(d.getDate() + days);
          if (months) d.setMonth(d.getMonth() + months);
          if (years)  d.setFullYear(d.getFullYear() + years);
          const iso = d.toISOString().split('T')[0];
          return (
            <TouchableOpacity
              key={label}
              onPress={() => { onChange(iso); onClose(); }}
              className="flex-1 py-2 rounded-xl border border-violet-500/30 bg-violet-500/10 items-center"
              activeOpacity={0.75}
            >
              <Text className="text-violet-400 text-[11px] font-bold">{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
function DateInput({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="mb-4">
      <TouchableOpacity
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.85}
        className="flex-row items-center rounded-xl border border-white/[0.07] overflow-hidden"
        style={{ backgroundColor: '#111827', marginBottom: open ? 8 : 0 }}
      >
        <Text
          className="flex-1 px-[14px] py-3 text-[13px]"
          style={{ color: value ? '#f1f5f9' : '#334155' }}
          numberOfLines={1}
        >
          {value ? formatDateDisplay(value) : 'Select a date'}
        </Text>
        <View
          className="px-3 items-center justify-center border-l border-white/[0.07]"
          style={{
            paddingVertical: 10,
            backgroundColor: open ? 'rgba(124,58,237,0.18)' : 'transparent',
          }}
        >
          <Text style={{ fontSize: 16 }}>📅</Text>
        </View>
      </TouchableOpacity>
      {open && (
        <CalendarPicker
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </View>
  );
}
function ContentWrap({ children }: { children: React.ReactNode }) {
  return (
    <View style={IS_WEB
      ? { maxWidth: MAX_W, alignSelf: 'center', width: '100%', paddingHorizontal: 28 }
      : { paddingHorizontal: 16 }}>
      {children}
    </View>
  );
}

function SInput({ value, onChangeText, placeholder, keyboardType, style }: any) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#334155"
      keyboardType={keyboardType}
      multiline={false}
      style={[{
        backgroundColor: '#111827', color: '#f1f5f9', fontSize: 13,
        paddingHorizontal: 14, paddingVertical: 12,
        borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
        ...(IS_WEB ? { outlineStyle: 'none' } : {}),
      } as any, style]}
    />
  );
}

function ML({ children }: { children: string }) {
  return (
    <Text className="text-slate-500 text-[10px] font-semibold tracking-[0.9px] uppercase mb-[7px]">
      {children}
    </Text>
  );
}

function DeleteConfirmRow({ name, onConfirm, onCancel, loading }: {
  name: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <View className="mx-4 mb-3 rounded-2xl overflow-hidden border border-red-500/30 bg-red-950/40">
      <View className="px-4 py-3">
        <Text className="text-red-300 text-[13px] font-semibold mb-3">Remove &ldquo;{name}&rdquo;?</Text>
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] items-center">
            <Text className="text-slate-300 text-[13px] font-semibold">Keep it</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 items-center">
            {loading ? <ActivityIndicator size="small" color="#f87171" />
              : <Text className="text-red-400 text-[13px] font-bold">Yes, remove</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function PausedSubsBanner({ count, savings }: { count: number; savings: number }) {
  return (
    <View className="bg-amber-500/[0.08] border border-amber-500/20 rounded-2xl p-4 mb-4 flex-row items-center gap-3">
      <Text className="text-2xl">⏸</Text>
      <View className="flex-1">
        <Text className="text-amber-300 font-bold text-[13px]">
          {count} subscription{count !== 1 ? 's' : ''} paused
        </Text>
        <Text className="text-amber-600 text-[11px] mt-0.5">
          Saving ~{savings.toFixed(2)}/mo while paused
        </Text>
      </View>
    </View>
  );
}
export default function SubscriptionsScreen() {
  const [subs, setSubs]                 = useState<Subscription[]>([]);
  const [loading, setLoading]           = useState(true);
  const [page, setPage]                 = useState(0);
  const [hasMore, setHasMore]           = useState(false);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [form, setForm]                 = useState({ ...BLANK });
  const [editId, setEditId]             = useState<number | null>(null);
  const [filterTab, setFilterTab]       = useState<FilterTab>('all');
  const [catFilter, setCatFilter]       = useState<string | null>(null);
  const [deletingId, setDeletingId]     = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pausingId, setPausingId]       = useState<number | null>(null);
  const [calendarModalSub, setCalendarModalSub] = useState<Subscription | null>(null);
  const [formError, setFormError]       = useState('');
  const dateManuallySet = useRef(false);

  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 160 }),
    ]).start();
  }, []);

  const load = async (pageNum = 0) => {
    if (pageNum === 0) { setLoading(true); } else { setLoadingMore(true); }
    try {
      const res = await subscriptionsApi.getAll(pageNum, 20);
      const { content, last } = res.data;
      
      const normalizedContent = content.map((sub: any) => ({
        ...sub,
        nextBilling: Array.isArray(sub.nextBilling)
          ? `${sub.nextBilling[0]}-${String(sub.nextBilling[1]).padStart(2, '0')}-${String(sub.nextBilling[2]).padStart(2, '0')}`
          : sub.nextBilling || ''
      }));

      setSubs(prev => pageNum === 0 ? normalizedContent : [...prev, ...normalizedContent]);
      setHasMore(!last);
      setPage(pageNum);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); setLoadingMore(false); }
  };
  useFocusEffect(useCallback(() => { load(0); }, []));

  const openAdd = () => {
    setEditId(null);
    dateManuallySet.current = false;
    setForm({ ...BLANK, nextBilling: getSmartDefault('MONTHLY') });
    setFormError('');
    setModalVisible(true);
  };

  const openEdit = (s: Subscription) => {
    setEditId(s.id);
    dateManuallySet.current = true;
    setForm({
      name: s.name, amount: String(s.amount), billingCycle: s.billingCycle,
      nextBilling: s.nextBilling, category: s.category ?? 'Other',
      color: s.color || '#6366F1', description: s.description ?? '',
    });
    setFormError('');
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setForm({ ...BLANK });
    setEditId(null);
    setFormError('');
    dateManuallySet.current = false;
  };

  const handleCycleChange = (cycle: string) => {
    setForm(f => ({
      ...f,
      billingCycle: cycle,
      nextBilling: dateManuallySet.current ? f.nextBilling : getSmartDefault(cycle),
    }));
  };

  const handleDateChange = (iso: string) => {
    dateManuallySet.current = true;
    setForm(f => ({ ...f, nextBilling: iso }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.amount) { setFormError('Name and amount are required'); return; }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) { setFormError('Enter a valid positive amount'); return; }
    if (!form.nextBilling) { setFormError('Please select a billing date'); return; }
    setSaving(true); setFormError('');
    try {
      if (editId) await subscriptionsApi.update(editId, { ...form, amount });
      else        await subscriptionsApi.create({ ...form, amount });
      closeModal(); load();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to save. Please try again.');
    } finally { setSaving(false); }
  };

  const handleDeleteConfirm = async () => {
    if (deletingId === null) return;
    setDeleteLoading(true);
    try {
      await subscriptionsApi.delete(deletingId);
      setSubs(s => s.filter(x => x.id !== deletingId));
      setDeletingId(null);
    } catch (e) { console.error(e); setDeletingId(null); }
    finally { setDeleteLoading(false); }
  };

  const handlePauseToggle = async (sub: Subscription) => {
    setPausingId(sub.id);
    try {
      if (sub.isPaused) await subscriptionsApi.resume(sub.id);
      else              await subscriptionsApi.pause(sub.id);
      setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, isPaused: !s.isPaused } : s));
    } catch (err: any) { console.error('Pause/resume failed:', err); }
    finally { setPausingId(null); }
  };
  const activeSubs = subs.filter(s => !s.isPaused);
  const pausedSubs = subs.filter(s => s.isPaused);

  const monthlyTotal = activeSubs.reduce((sum, s) => {
    const a = Number(s.amount);
    return sum + (s.billingCycle === 'YEARLY' ? a / 12 : s.billingCycle === 'WEEKLY' ? a * 4.33 : a);
  }, 0);

  const pausedSavings = pausedSubs.reduce((sum, s) => {
    const a = Number(s.amount);
    return sum + (s.billingCycle === 'YEARLY' ? a / 12 : s.billingCycle === 'WEEKLY' ? a * 4.33 : a);
  }, 0);

  const displaySubs = (() => {
    let base = filterTab === 'active' ? activeSubs : filterTab === 'paused' ? pausedSubs : subs;
    if (catFilter) base = base.filter(s => (s.category || 'Other') === catFilter);
    return base;
  })();

  const usedCategories = [...new Set(subs.map(s => s.category || 'Other'))];

  if (loading) return (
    <View className="flex-1 bg-[#020617] items-center justify-center">
      <ActivityIndicator size="large" color="#6366F1" />
    </View>
  );

  return (
    <View className="flex-1 bg-[#020617]">

      {/* Header */}
      <View className="bg-[#020617] border-b border-white/[0.06]" style={{ paddingTop: IS_WEB ? 0 : (Platform.OS === 'ios' ? 56 : 52) }}>
        <View className="flex-row items-center w-full px-4 py-3">
          <View className="flex-1"><HamburgerButton /></View>
          <View className="items-center">
            <Text className="text-white text-[17px] font-extrabold tracking-tight">Subscriptions 📋</Text>
          </View>
          <View className="flex-1 items-end"><UserAvatarButton /></View>
        </View>
        {subs.length > 0 && (
          <View className="px-4 pb-2.5">
            <Text className="text-slate-500 text-xs">
              {monthlyTotal.toFixed(2)}/month · {activeSubs.length} active
              {pausedSubs.length > 0 ? ` · ${pausedSubs.length} paused` : ''}
            </Text>
          </View>
        )}
        <View className="flex-row gap-2 px-4 pb-3">
          {(['all', 'active', 'paused'] as FilterTab[]).map(tab => (
            <TouchableOpacity key={tab} onPress={() => setFilterTab(tab)}
              className={`px-4 py-1.5 rounded-xl border ${
                filterTab === tab ? 'bg-indigo-500 border-indigo-500' : 'bg-transparent border-white/[0.08]'
              }`}>
              <Text className={`text-xs font-semibold ${filterTab === tab ? 'text-white' : 'text-slate-500'}`}>
                {tab === 'all' ? `All (${subs.length})` :
                 tab === 'active' ? `Active (${activeSubs.length})` :
                 `Paused (${pausedSubs.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(0); }} tintColor="#6366F1" />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <ContentWrap>
            <View className="pt-5">

              {pausedSubs.length > 0 && filterTab !== 'paused' && (
                <PausedSubsBanner count={pausedSubs.length} savings={pausedSavings} />
              )}

              {usedCategories.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 -mx-1">
                  <View className="flex-row gap-2 px-1">
                    {[null, ...usedCategories].map((cat, i) => (
                      <TouchableOpacity key={i} onPress={() => setCatFilter(cat)}
                        className={`px-4 py-2 rounded-xl border ${
                          (!cat && !catFilter) || catFilter === cat
                            ? 'bg-indigo-500 border-indigo-500' : 'bg-transparent border-white/[0.08]'
                        }`}>
                        <Text className={`text-xs font-semibold ${
                          (!cat && !catFilter) || catFilter === cat ? 'text-white' : 'text-slate-500'
                        }`}>{cat ?? 'All'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}

              {subs.length === 0 ? (
                <View className="items-center py-24">
                  <Text className="text-5xl mb-4">📋</Text>
                  <Text className="text-white text-[17px] font-bold mb-2">No subscriptions yet</Text>
                  <Text className="text-slate-500 text-[13px] text-center max-w-[280px] mb-8">
                    Track all your recurring charges in one place.
                  </Text>
                </View>
              ) : displaySubs.length === 0 ? (
                <View className="items-center py-16">
                  <Text className="text-4xl mb-3">{filterTab === 'paused' ? '⏸' : '🔍'}</Text>
                  <Text className="text-slate-400 text-sm text-center">
                    {filterTab === 'paused' ? 'No paused subscriptions' : 'No subscriptions match this filter'}
                  </Text>
                </View>
              ) : (
                <View>
                  {displaySubs.map(sub => (
                    <View key={sub.id} className="mb-3">
                      <View
                        className="rounded-2xl border overflow-hidden"
                        style={{
                          backgroundColor: sub.isPaused ? 'rgba(30,41,59,0.5)' : '#0f172a',
                          borderColor: sub.isPaused ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.06)',
                        }}
                      >
                        <TouchableOpacity onPress={() => openEdit(sub)} activeOpacity={0.88}>
                          <View className="p-4">
                            {sub.isPaused && (
                              <View className="flex-row items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1 self-start mb-2.5">
                                <Text className="text-amber-400 text-[10px] font-bold">⏸ PAUSED</Text>
                              </View>
                            )}
                            <View className="flex-row justify-between items-center">
                              <View className="flex-row items-center gap-3 flex-1">
                                <View className="w-11 h-11 rounded-[14px] items-center justify-center"
                                  style={{ backgroundColor: (sub.color || '#6366F1') + (sub.isPaused ? '11' : '22') }}>
                                  <View className="w-[18px] h-[18px] rounded-full"
                                    style={{ backgroundColor: sub.isPaused ? '#94a3b8' : (sub.color || '#6366F1') }} />
                                </View>
                                <View className="flex-1">
                                  <Text className="font-bold text-sm" numberOfLines={1}
                                    style={{ color: sub.isPaused ? '#64748b' : '#f1f5f9' }}>
                                    {sub.name}
                                  </Text>
                                  <Text className="text-slate-500 text-[11px] mt-0.5">
                                    {sub.category ?? 'Other'} · {sub.billingCycle}
                                  </Text>
                                </View>
                              </View>
                              <View className="items-end">
                                <Text className="font-extrabold text-[15px]"
                                  style={{ color: sub.isPaused ? '#475569' : '#f1f5f9' }}>
                                  {Number(sub.amount).toFixed(2)}
                                  <Text className="text-slate-500 font-normal text-[11px]">
                                    {CYCLE_LBL[sub.billingCycle] ?? ''}
                                  </Text>
                                </Text>
                                {!sub.isPaused && (
                                  <View className="mt-1.5 px-2 py-0.5 rounded-full" style={{
                                    backgroundColor: sub.daysUntilBilling <= 2 ? 'rgba(239,68,68,0.15)'
                                      : sub.daysUntilBilling <= 7 ? 'rgba(249,115,22,0.15)'
                                      : 'rgba(16,185,129,0.12)',
                                  }}>
                                    <Text className="text-[10px] font-bold" style={{
                                      color: sub.daysUntilBilling <= 2 ? '#f87171'
                                        : sub.daysUntilBilling <= 7 ? '#fb923c' : '#34d399',
                                    }}>
                                      {sub.daysUntilBilling === 0 ? '🔴 Today'
                                        : sub.daysUntilBilling === 1 ? '🟠 Tomorrow'
                                        : `${sub.daysUntilBilling}d`}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>
                        </TouchableOpacity>

                        <View className="flex-row gap-2 px-4 pb-4">
                          <TouchableOpacity onPress={() => openEdit(sub)}
                            className="px-3 py-2 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex-row items-center gap-1">
                            <Text className="text-indigo-400 text-[11px] font-semibold">✏️ Edit</Text>
                          </TouchableOpacity>

                          <TouchableOpacity onPress={() => handlePauseToggle(sub)} disabled={pausingId === sub.id}
                            className={`flex-1 py-2 rounded-xl items-center justify-center flex-row gap-1.5 border ${
                              sub.isPaused ? 'bg-emerald-500/15 border-emerald-500/25' : 'bg-amber-500/10 border-amber-500/20'
                            }`}>
                            {pausingId === sub.id
                              ? <ActivityIndicator size="small" color={sub.isPaused ? '#34d399' : '#fbbf24'} />
                              : <Text className="text-[11px] font-bold" style={{ color: sub.isPaused ? '#34d399' : '#fbbf24' }}>
                                  {sub.isPaused ? '▶️ Resume' : '⏸ Pause'}
                                </Text>}
                          </TouchableOpacity>

                          {/* ── UPDATED: calendar button now opens the options modal ── */}
                          <TouchableOpacity
                            onPress={() => setCalendarModalSub(sub)}
                            className="px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 flex-row items-center gap-1"
                            style={IS_WEB ? { cursor: 'pointer' } as any : undefined}
                          >
                            <Text className="text-sky-400 text-[11px] font-semibold">📅</Text>
                          </TouchableOpacity>

                          <TouchableOpacity onPress={() => setDeletingId(sub.id === deletingId ? null : sub.id)}
                            className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                            <Text className="text-red-400 text-[11px] font-semibold">🗑</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {deletingId === sub.id && (
                        <DeleteConfirmRow
                          name={sub.name}
                          onConfirm={handleDeleteConfirm}
                          onCancel={() => setDeletingId(null)}
                          loading={deleteLoading}
                        />
                      )}
                    </View>
                  ))}
                </View>
              )}

              {hasMore && (
                <TouchableOpacity onPress={() => load(page + 1)} disabled={loadingMore}
                  className="mt-2 mb-4 py-3 rounded-2xl border border-white/[0.08] items-center bg-white/[0.03]">
                  {loadingMore
                    ? <ActivityIndicator size="small" color="#6366F1" />
                    : <Text className="text-slate-400 text-sm font-semibold">Load more</Text>}
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={openAdd} activeOpacity={0.85} className="mt-4 rounded-2xl overflow-hidden">
                <LinearGradient
                  colors={['rgba(99,102,241,0.15)', 'rgba(124,58,237,0.10)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{
                    paddingVertical: 18, flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'center', gap: 10, borderRadius: 16,
                    borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)',
                  }}
                >
                  <View className="w-7 h-7 rounded-full bg-indigo-500 items-center justify-center">
                    <Text className="text-white text-lg leading-[26px] font-light">+</Text>
                  </View>
                  <Text className="text-indigo-300 font-bold text-[14px]">Add Subscription</Text>
                </LinearGradient>
              </TouchableOpacity>

            </View>
          </ContentWrap>
        </Animated.View>
      </ScrollView>

      {/* ── Add / Edit Modal ───────────────────────────────────────────────── */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={IS_WEB ? undefined : 'padding'} style={{ flex: 1 }}>
          <TouchableOpacity activeOpacity={1} onPress={closeModal}
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.78)' }} />
          <View style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: [
              { translateX: IS_WEB ? -240 : -(W * 0.44) },
              { translateY: IS_WEB ? -320 : -(H * 0.44) },
            ],
            width: IS_WEB ? 480 : W * 0.88,
            maxHeight: IS_WEB ? 720 : H * 0.92,
            backgroundColor: '#0d1424', borderRadius: 24,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
            ...(IS_WEB ? { boxShadow: '0 24px 80px rgba(0,0,0,0.8)' } : {}),
          } as any}>

            <LinearGradient
              colors={['#160826', '#0d1424']}
              style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 }}
            >
              <TouchableOpacity onPress={closeModal} className="mb-4 self-start">
                <View className="w-8 h-8 rounded-xl bg-white/[0.08] items-center justify-center">
                  <Text className="text-slate-400 text-sm">✕</Text>
                </View>
              </TouchableOpacity>
              <Text className="text-slate-100 text-xl font-extrabold">
                {editId ? 'Edit Subscription' : 'Add Subscription'}
              </Text>
              <Text className="text-slate-500 text-xs mt-1.5">
                {editId ? 'Update details' : 'Track a recurring charge'}
              </Text>
            </LinearGradient>

            <ScrollView contentContainerStyle={{ padding: 24 }}
              keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

              {formError ? (
                <View className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25">
                  <Text className="text-red-400 text-[13px]">{formError}</Text>
                </View>
              ) : null}

              <View className="flex-row gap-3 mb-4">
                <View style={{ flex: 2 }}>
                  <ML>Service Name</ML>
                  <SInput placeholder="Netflix, Spotify"
                    value={form.name}
                    onChangeText={(v: string) => setForm(f => ({ ...f, name: v }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <ML>Amount €</ML>
                  <SInput placeholder="9.99"
                    value={form.amount}
                    onChangeText={(v: string) => setForm(f => ({ ...f, amount: v }))}
                    keyboardType="decimal-pad" />
                </View>
              </View>

              <ML>Billing Cycle</ML>
              <View className="flex-row gap-2 mb-4">
                {CYCLES.map(c => (
                  <TouchableOpacity key={c} onPress={() => handleCycleChange(c)}
                    className={`px-4 py-2.5 rounded-[10px] border ${
                      form.billingCycle === c ? 'bg-indigo-500 border-indigo-500' : 'bg-[#111827] border-white/[0.07]'
                    }`}>
                    <Text className={`text-xs font-bold ${form.billingCycle === c ? 'text-white' : 'text-slate-500'}`}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ML>Next Billing Date</ML>
              <DateInput value={form.nextBilling} onChange={handleDateChange} />

              <ML>Category</ML>
              <View className="flex-row flex-wrap gap-[7px] mb-4">
                {CATEGORIES.map(c => (
                  <TouchableOpacity key={c} onPress={() => setForm(f => ({ ...f, category: c }))}
                    className={`px-3.5 py-[7px] rounded-[9px] border ${
                      form.category === c ? 'bg-indigo-500 border-indigo-500' : 'bg-[#111827] border-white/[0.06]'
                    }`}>
                    <Text className={`text-xs ${form.category === c ? 'text-white font-bold' : 'text-slate-500 font-medium'}`}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ML>Color</ML>
              <View className="flex-row gap-2.5 flex-wrap mb-6">
                {COLORS.map(c => (
                  <TouchableOpacity key={c} onPress={() => setForm(f => ({ ...f, color: c }))}
                    style={{
                      width: 32, height: 32, borderRadius: 16, backgroundColor: c,
                      borderWidth: form.color === c ? 2.5 : 0, borderColor: '#fff',
                      transform: [{ scale: form.color === c ? 1.15 : 1 }],
                    }} />
                ))}
              </View>

              <TouchableOpacity onPress={handleSave} disabled={saving}
                className="rounded-[14px] overflow-hidden" activeOpacity={0.85}>
                <LinearGradient
                  colors={saving ? ['#3730a3', '#3730a3'] : ['#6366F1', '#7C3AED']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 14, alignItems: 'center' }}
                >
                  {saving ? <ActivityIndicator color="#fff" size="small" />
                    : <Text className="text-white font-bold text-sm">
                        {editId ? 'Save Changes' : 'Add Subscription'}
                      </Text>}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Calendar options modal ─────────────────────────────────────────── */}
      {calendarModalSub && (
        <CalendarOptionsModal
          sub={calendarModalSub}
          onClose={() => setCalendarModalSub(null)}
        />
      )}

    </View>
  );
}