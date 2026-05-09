import { useCallback, useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  TextInput, ActivityIndicator, RefreshControl,
  Linking, Platform, KeyboardAvoidingView, Dimensions, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { trackersApi } from '../../lib/api';
import { HamburgerButton,UserAvatarButton } from './_layout';
import { PriceTracker } from '../../types';
import { Ionicons } from '@expo/vector-icons';

const IS_WEB = Platform.OS === 'web';
const { width: W, height: H } = Dimensions.get('window');
const MAX_W = 1100;

function ContentWrap({ children }: { children: React.ReactNode }) {
  return (
    <View style={IS_WEB
      ? { maxWidth: MAX_W, alignSelf: 'center', width: '100%', paddingHorizontal: 28 }
      : { paddingHorizontal: 16 }}>
      {children}
    </View>
  );
}

function DeleteConfirmRow({
  name, onConfirm, onCancel, loading,
}: {
  name: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <View className="mb-3 rounded-2xl overflow-hidden border border-red-500/30 bg-red-950/40">
      <View className="px-4 py-3">
        <Text className="text-red-300 text-[13px] font-semibold mb-3">
          Stop tracking &ldquo;{name}&rdquo;?
        </Text>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] items-center"
          >
            <Text className="text-slate-300 text-[13px] font-semibold">Keep tracking</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 items-center"
          >
            {loading
              ? <ActivityIndicator size="small" color="#f87171" />
              : <Text className="text-red-400 text-[13px] font-bold">Yes, remove</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function PriceHistoryChart({
  history,
}: {
  history: { price: number; date?: string; recordedAt?: string }[];
}) {
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area'>('area');
  if (!history || history.length === 0) return null;

  const pts    = history.map(h => ({ price: Number(h.price), date: h.date || h.recordedAt || '' }));
  const prices = pts.map(p => p.price);
  const minRaw = Math.min(...prices);
  const maxRaw = Math.max(...prices);
  const isFlat = minRaw === maxRaw;

  const yPad = isFlat ? minRaw * 0.02 || 1 : (maxRaw - minRaw) * 0.15;
  const yMin = Math.max(0, minRaw - yPad);
  const yMax = maxRaw + yPad;
  const yRange = yMax - yMin;

  const H_CHART = 100;
  const W_CHART = IS_WEB ? Math.min(MAX_W - 120, 800) : W - 80;
  const barW    = Math.max(6, Math.min(28, (W_CHART / pts.length) - 4));

  const points = pts.map((p, i) => ({
    x: pts.length === 1 ? W_CHART / 2 : (i / (pts.length - 1)) * W_CHART,
    y: H_CHART - 6 - ((p.price - yMin) / yRange) * (H_CHART - 12),
    price: p.price,
    date: p.date,
  }));

  const formatDate = (d: string) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit' });
    } catch { return ''; }
  };

  const latest    = pts[pts.length - 1]?.price;
  const prev      = pts.length > 1 ? pts[pts.length - 2]?.price : null;
  const priceDiff = prev !== null ? latest - prev : 0;
  const trendUp   = priceDiff > 0;
  const trendFlat = priceDiff === 0;

  return (
    <View className="bg-[#111827] rounded-2xl p-4 border border-white/[0.05]">
      <View className="flex-row justify-between items-center mb-3">
        <View>
          <Text className="text-white text-sm font-bold">Price History</Text>
          <Text className="text-slate-500 text-[11px] mt-0.5">
            {pts.length} data point{pts.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View className="flex-row gap-1.5 bg-[#0d1424] rounded-xl p-1">
          {(['area', 'line', 'bar'] as const).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setChartType(t)}
              className={`px-3 py-1.5 rounded-[9px] ${chartType === t ? 'bg-indigo-500' : ''}`}
            >
              <Text className={`text-[10px] font-semibold ${chartType === t ? 'text-white' : 'text-slate-500'}`}>
                {t === 'area' ? '▰' : t === 'line' ? '📈' : '📊'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {prev !== null && (
        <View
          className="flex-row items-center gap-1.5 mb-3 self-start px-2.5 py-1 rounded-full"
          style={{
            backgroundColor: trendFlat
              ? 'rgba(100,116,139,0.15)'
              : trendUp
              ? 'rgba(239,68,68,0.12)'
              : 'rgba(16,185,129,0.12)',
          }}
        >
          <Text className="text-xs">{trendFlat ? '•' : trendUp ? '▲' : '▼'}</Text>
          <Text
            className="text-xs font-semibold"
            style={{ color: trendFlat ? '#64748b' : trendUp ? '#f87171' : '#34d399' }}
          >
            {trendFlat ? 'No change' : `${trendUp ? '+' : ''}${priceDiff.toFixed(2)} from last check`}
          </Text>
        </View>
      )}

      {isFlat && pts.length > 1 && (
        <Text className="text-slate-600 text-[11px] mb-2 text-center">
          Price stable at {minRaw.toFixed(2)} across all {pts.length} checks
        </Text>
      )}

      <View style={{ height: H_CHART + 20, overflow: 'hidden' }}>
        {chartType === 'bar' ? (
          <View className="flex-row items-end justify-around" style={{ height: H_CHART, gap: 4 }}>
            {pts.map((p, i) => {
              const barFrac = isFlat ? 1 : (p.price - minRaw) / (maxRaw - minRaw);
              const h       = Math.max(8, barFrac * (H_CHART - 12) + 12);
              const isLatest = i === pts.length - 1;
              const isLow    = p.price === minRaw;
              return (
                <View key={i} className="items-center flex-1" style={{ maxWidth: barW + 8 }}>
                  <View style={{
                    width: barW, height: h, borderRadius: 4,
                    backgroundColor: isLow ? '#10b981' : isLatest ? '#6366F1' : '#1e3a5f',
                  }} />
                </View>
              );
            })}
          </View>
        ) : (
          <View style={{ height: H_CHART, position: 'relative' }}>
            {[0, 0.33, 0.67, 1].map(frac => (
              <View
                key={frac}
                style={{
                  position: 'absolute', left: 0, right: 0,
                  top: (1 - frac) * (H_CHART - 12),
                  height: 1, backgroundColor: 'rgba(255,255,255,0.04)',
                }}
              />
            ))}

            {points.map((p, i) => {
              const next = points[i + 1];
              return (
                <View key={i}>
                  {next && chartType === 'line' && (
                    <View style={(() => {
                      const dx = next.x - p.x;
                      const dy = next.y - p.y;
                      const len = Math.sqrt(dx * dx + dy * dy);
                      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                      return {
                        position: 'absolute', left: p.x, top: p.y,
                        width: len, height: 2, backgroundColor: '#6366F1',
                        transformOrigin: '0 50%',
                        transform: [{ rotate: `${angle}deg` }],
                      };
                    })() as any} />
                  )}
                  {chartType === 'area' && (
                    <View style={{
                      position: 'absolute', left: p.x - 1, top: p.y,
                      width: 2, height: H_CHART - p.y,
                      backgroundColor: 'rgba(99,102,241,0.15)',
                    }} />
                  )}
                  <View style={{
                    position: 'absolute', left: p.x - 4, top: p.y - 4,
                    width: 8, height: 8, borderRadius: 4,
                    backgroundColor:
                      p.price === minRaw ? '#10b981'
                      : p.price === maxRaw ? '#ef4444'
                      : '#6366F1',
                    borderWidth: 2, borderColor: '#111827',
                  }} />
                </View>
              );
            })}
          </View>
        )}
      </View>

      {chartType === 'bar' && pts.length <= 10 && (
        <View className="flex-row justify-around mt-1.5">
          {pts.map((p, i) => (
            <Text key={i} className="text-slate-600 text-[9px] text-center flex-1" numberOfLines={1}>
              {formatDate(p.date)}
            </Text>
          ))}
        </View>
      )}

      <View className="flex-row justify-between mt-3 pt-3 border-t border-white/[0.05]">
        <Text className="text-emerald-400 text-xs font-bold">Low: {minRaw.toFixed(2)}</Text>
        <View className="items-center">
          <Text className="text-slate-500 text-[10px]">Latest</Text>
          <Text className="text-slate-100 text-sm font-bold">{latest.toFixed(2)}</Text>
        </View>
        <Text className="text-red-400 text-xs font-bold">High: {maxRaw.toFixed(2)}</Text>
      </View>
    </View>
  );
}

function TrackerCard({
  t, onDeleteRequest,
}: {
  t: PriceTracker; onDeleteRequest: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const savings     = t.highestPrice != null && t.currentPrice != null
    ? Number(t.highestPrice) - Number(t.currentPrice) : null;
  const pctFromHigh = t.highestPrice != null && t.currentPrice != null && Number(t.highestPrice) > 0
    ? ((Number(t.highestPrice) - Number(t.currentPrice)) / Number(t.highestPrice) * 100) : null;

  let hostname = '';
  try { hostname = new URL(t.url).hostname.replace('www.', ''); } catch {}

  return (
    <View className="bg-[#0f172a] rounded-2xl border border-white/[0.06] overflow-hidden">
      <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.88} className="p-4">

        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1 mr-3">
            <Text className="text-slate-100 font-bold text-[15px] leading-5" numberOfLines={2}>
              {t.productName && t.productName !== 'Product' ? t.productName : 'Tracked Product'}
            </Text>
            <Text className="text-slate-500 text-xs mt-0.5">
              {t.shopName && t.shopName !== 'Shop' ? t.shopName : hostname}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            {t.belowTarget && (
              <View className="bg-emerald-500/15 rounded-full px-2.5 py-1">
                <Text className="text-emerald-400 text-[11px] font-bold">🎯 Target!</Text>
              </View>
            )}
            {pctFromHigh !== null && pctFromHigh > 0 && (
              <View className="bg-green-500/10 rounded-full px-2 py-0.5">
                <Text className="text-green-400 text-[10px] font-bold">-{pctFromHigh.toFixed(0)}%</Text>
              </View>
            )}
          </View>
        </View>

        <View className="flex-row gap-2 mb-3">
          <PBox label="Current" price={t.currentPrice} color="#f1f5f9" large />
          <PBox label="Target"  price={t.targetPrice}  color="#818cf8" />
          <PBox label="Lowest"  price={t.lowestPrice}  color="#34d399" />
          {t.highestPrice != null && (
            <PBox label="Highest" price={t.highestPrice} color="#f87171" />
          )}
        </View>

        {t.currentPrice != null && t.lowestPrice != null && t.highestPrice != null &&
          Number(t.highestPrice) > Number(t.lowestPrice) && (
          <View className="mb-3">
            <View className="bg-slate-800 rounded h-[6px] overflow-hidden">
              <View
                className="bg-indigo-500 h-[6px] rounded"
                style={{
                  width: `${Math.min(100, Math.max(0,
                    ((Number(t.currentPrice) - Number(t.lowestPrice)) /
                      (Number(t.highestPrice) - Number(t.lowestPrice))) * 100
                  ))}%` as any,
                }}
              />
            </View>
            <View className="flex-row justify-between mt-1">
              <Text className="text-emerald-400 text-[10px]">Low {Number(t.lowestPrice).toFixed(2)}</Text>
              {savings !== null && savings > 0 && (
                <Text className="text-emerald-400 text-[10px] font-semibold">
                   Saved {savings.toFixed(2)}
                </Text>
              )}
              <Text className="text-red-400 text-[10px]">High {Number(t.highestPrice).toFixed(2)}</Text>
            </View>
          </View>
        )}

        <View className="flex-row justify-between items-center">
          <Text className="text-slate-600 text-[11px]">
            {t.lastChecked
              ? `Updated ${new Date(t.lastChecked).toLocaleDateString('el-GR')}`
              : 'Pending first price check'}
          </Text>
          <Text className="text-indigo-400 text-[11px] font-bold">
            {expanded ? 'Less ▲' : 'Details ▼'}
          </Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View className="px-4 pb-4 border-t border-white/[0.05]">
          {t.history && t.history.length > 0 ? (
            <View className="mt-4 mb-3">
              <PriceHistoryChart history={t.history} />
            </View>
          ) : (
            <View className="my-4 items-center py-6 bg-[#111827] rounded-2xl border border-white/[0.05]">
              <Text className="text-3xl mb-2">⏳</Text>
              <Text className="text-slate-300 font-semibold text-sm">Waiting for first price check</Text>
              <Text className="text-slate-600 text-xs mt-1 text-center px-4">
                Price checks run every 8 hours. Check back soon!
              </Text>
            </View>
          )}
          <View className="flex-row gap-2">
            {/* ── FIXED: use buyUrl (affiliate-resolved) instead of raw url ── */}
            <TouchableOpacity
              onPress={() => Linking.openURL(t.buyUrl)}
              className="flex-1 bg-indigo-500/15 border border-indigo-500/25 rounded-xl py-3 items-center"
            >
              <Text className="text-indigo-400 text-xs font-semibold"> Visit Shop</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onDeleteRequest}
              className="flex-1 bg-red-500/10 border border-red-500/20 rounded-xl py-3 items-center"
            >
              <Text className="text-red-400 text-xs font-semibold"> Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function PBox({
  label, price, color, large,
}: {
  label: string; price?: number | null; color: string; large?: boolean;
}) {
  return (
    <View className="flex-1 bg-[#111827] rounded-[14px] py-3 px-2 items-center">
      <Text className="text-slate-500 text-[10px] mb-1">{label}</Text>
      <Text style={{ color, fontWeight: '800', fontSize: large ? 17 : 12 }}>
        {price != null ? `${Number(price).toFixed(2)}` : '—'}
      </Text>
    </View>
  );
}

export default function TrackersScreen() {
  const [trackers, setTrackers]         = useState<PriceTracker[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [form, setForm] = useState({ url: '', targetPrice: '', affiliateUrl: '' });
  const [formError, setFormError]       = useState('');
  const [deletingId, setDeletingId]     = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [page, setPage]               = useState(0);
  const [hasMore, setHasMore]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
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
      const res = await trackersApi.getAll(pageNum, 20);
      const { content, last } = res.data;
      setTrackers(prev => pageNum === 0 ? content : [...prev, ...content]);
      setHasMore(!last);
      setPage(pageNum);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); setLoadingMore(false); }
  };
  useFocusEffect(useCallback(() => { load(0); }, []));

  const closeModal = () => {
    setModalVisible(false);
    setForm({ url: '', targetPrice: '', affiliateUrl: '' });
    setFormError('');
  };

  const handleAdd = async () => {
    if (!form.url.trim() || !form.targetPrice) {
      setFormError('URL and target price are required');
      return;
    }
    if (!form.url.trim().startsWith('http')) {
      setFormError('URL must start with http:// or https://');
      return;
    }
    const tp = parseFloat(form.targetPrice);
    if (isNaN(tp) || tp <= 0) {
      setFormError('Enter a valid positive number');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await trackersApi.create({ url: form.url.trim(), targetPrice: tp, affiliateUrl: form.affiliateUrl.trim() || null });
      closeModal();
      load();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Could not add tracker. Check the URL and try again.');
    } finally { setSaving(false); }
  };

  const handleDeleteConfirm = async () => {
    if (deletingId === null) return;
    setDeleteLoading(true);
    try {
      await trackersApi.delete(deletingId);
      setTrackers(t => t.filter(x => x.id !== deletingId));
      setDeletingId(null);
    } catch (e) {
      console.error('Delete tracker failed:', e);
      setDeletingId(null);
    } finally { setDeleteLoading(false); }
  };

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
          <View className="flex-1">
            <HamburgerButton />
          </View>
          <View className="flex-row items-center gap-1">
            <Text className="text-white text-[17px] font-extrabold tracking-tight">
              Price Tracker
            </Text>
            <Ionicons
              name="pricetag-outline"
              size={20}
              color="#6366F1"
              style={{ marginLeft: 4 }}
            />
          </View>
          <View className="flex-1 items-end">
            <UserAvatarButton />
          </View>
        </View>
        {trackers.length > 0 && (
          <View className="px-4 pb-2.5">
            <Text className="text-slate-500 text-xs">
              {trackers.length} product{trackers.length !== 1 ? 's' : ''} tracked
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(0); }}
            tintColor="#6366F1"
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <ContentWrap>
            <View className="pt-5">

              {trackers.length === 0 ? (
                <View className="items-center py-24">
                  <Text className="text-5xl mb-4">🔍</Text>
                  <Text className="text-white text-[17px] font-bold mb-2">No products tracked yet</Text>
                  <Text className="text-slate-500 text-sm text-center max-w-[280px] mb-8">
                    Paste any product link to start monitoring the price 24/7
                  </Text>
                </View>
              ) : (
                <View className="gap-3">
                  {trackers.map(t => (
                    <View key={t.id}>
                      <TrackerCard
                        t={t}
                        onDeleteRequest={() => setDeletingId(t.id === deletingId ? null : t.id)}
                      />
                      {deletingId === t.id && (
                        <View className="mt-2">
                          <DeleteConfirmRow
                            name={t.productName || 'this product'}
                            onConfirm={handleDeleteConfirm}
                            onCancel={() => setDeletingId(null)}
                            loading={deleteLoading}
                          />
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {hasMore && (
                <TouchableOpacity
                  onPress={() => load(page + 1)}
                  disabled={loadingMore}
                  className="mt-2 mb-4 py-3 rounded-2xl border border-white/[0.08] items-center bg-white/[0.03]"
                >
                  {loadingMore
                    ? <ActivityIndicator size="small" color="#6366F1" />
                    : <Text className="text-slate-400 text-sm font-semibold">Load more</Text>
                  }
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => setModalVisible(true)}
                activeOpacity={0.85}
                className="mt-4 rounded-2xl overflow-hidden"
              >
                <LinearGradient
                  colors={['rgba(99,102,241,0.15)', 'rgba(124,58,237,0.10)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    paddingVertical: 18,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: 'rgba(99,102,241,0.25)',
                  }}
                >
                  <View className="w-7 h-7 rounded-full bg-indigo-500 items-center justify-center">
                    <Text className="text-white text-lg leading-[26px] font-light">+</Text>
                  </View>
                  <Text className="text-indigo-300 font-bold text-[14px]">
                    Track a Product
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

            </View>
          </ContentWrap>
        </Animated.View>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={IS_WEB ? undefined : 'padding'} style={{ flex: 1 }}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={closeModal}
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)' }}
          />
          <View style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: [
              { translateX: IS_WEB ? -230 : -(W * 0.44) },
              { translateY: IS_WEB ? -240 : -(H * 0.34) },
            ],
            width: IS_WEB ? 460 : W * 0.88,
            backgroundColor: '#0d1424',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
            ...(IS_WEB ? { boxShadow: '0 24px 80px rgba(0,0,0,0.8)' } : {}),
          } as any}>

            <LinearGradient
              colors={['#160826', '#0d1424']}
              style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 18 }}
            >
              <TouchableOpacity onPress={closeModal} className="mb-4 self-start">
                <View className="w-8 h-8 rounded-xl bg-white/[0.08] items-center justify-center">
                  <Text className="text-slate-400 text-sm">✕</Text>
                </View>
              </TouchableOpacity>
              <Text className="text-slate-100 text-xl font-extrabold">Track a Product</Text>
              <Text className="text-slate-500 text-xs mt-1.5 leading-[18px]">
                Paste any product URL. We'll monitor the price 24/7.
              </Text>
            </LinearGradient>

            <View style={{ padding: 24 }}>
              {formError ? (
                <View className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25">
                  <Text className="text-red-400 text-[13px]">{formError}</Text>
                </View>
              ) : null}

              <Text className="text-slate-500 text-[11px] font-semibold tracking-[0.8px] mb-2 uppercase">
                Product URL
              </Text>
              <TextInput
                placeholder="https://skroutz.gr/s/... or any shop URL"
                placeholderTextColor="#334155"
                value={form.url}
                onChangeText={v => setForm(f => ({ ...f, url: v }))}
                autoCapitalize="none"
                keyboardType="url"
                multiline={false}
                style={{
                  backgroundColor: '#111827', color: '#f1f5f9', fontSize: 13,
                  paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 18,
                  ...(IS_WEB ? { outlineStyle: 'none', width: '100%' } : {}),
                } as any}
              />

              <Text className="text-slate-500 text-[11px] font-semibold tracking-[0.8px] mb-2 uppercase">
                Target Price
              </Text>
              <TextInput
                placeholder="e.g. 100"
                placeholderTextColor="#334155"
                value={form.targetPrice}
                onChangeText={v => setForm(f => ({ ...f, targetPrice: v }))}
                keyboardType="decimal-pad"
                multiline={false}
                style={{
                  backgroundColor: '#111827', color: '#f1f5f9', fontSize: 16, fontWeight: '600',
                  paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 8,
                  ...(IS_WEB ? { outlineStyle: 'none', width: '100%' } : {}),
                } as any}
              />
              <Text className="text-slate-600 text-[11px] mb-6">
                We'll notify you when the price drops to or below this amount.
              </Text>

              <Text className="text-slate-500 text-[11px] font-semibold tracking-[0.8px] mb-2 uppercase">
                Affiliate URL (optional)
              </Text>
              <TextInput
                placeholder="https://affiliate-link.com/..."
                placeholderTextColor="#334155"
                value={form.affiliateUrl}
                onChangeText={v => setForm(f => ({ ...f, affiliateUrl: v }))}
                autoCapitalize="none"
                keyboardType="url"
                multiline={false}
                style={{
                  backgroundColor: '#111827', color: '#f1f5f9', fontSize: 13,
                  paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 24,
                  ...(IS_WEB ? { outlineStyle: 'none', width: '100%' } : {}),
                } as any}
              />

              <TouchableOpacity
                onPress={handleAdd}
                disabled={saving}
                className="rounded-[14px] overflow-hidden"
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={saving ? ['#3730a3', '#3730a3'] : ['#6366F1', '#7C3AED']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 14, alignItems: 'center' }}
                >
                  {saving ? (
                    <View className="flex-row items-center gap-2">
                      <ActivityIndicator color="#fff" size="small" />
                      <Text className="text-white font-bold text-sm">Scraping price</Text>
                    </View>
                  ) : (
                    <Text className="text-white font-bold text-sm">Start Tracking</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}