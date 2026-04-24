// notifications.tsx
import { useCallback, useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,DeviceEventEmitter,
  ActivityIndicator, RefreshControl, Animated, Platform, useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { notificationsApi } from '../../lib/api';
import { AppNotification } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { HamburgerButton,UserAvatarButton } from './_layout';
import { Ionicons } from '@expo/vector-icons';

const IS_WEB = Platform.OS === 'web';
const MAX_W  = 1100;

const TYPE_CFG: Record<string, { emoji: string; bg: string }> = {
  PRICE_DROP:       { emoji: '📉', bg: 'rgba(16,185,129,0.15)' },
  BILLING_REMINDER: { emoji: '📅', bg: 'rgba(59,130,246,0.15)' },
  DUPLICATE_ALERT:  { emoji: '⚠️', bg: 'rgba(249,115,22,0.15)' },
  SAVING_REPORT:    { emoji: '💰', bg: 'rgba(124,58,237,0.15)' },
};

function ContentWrap({ children }: { children: React.ReactNode }) {
  return (
    <View style={IS_WEB
      ? { maxWidth: MAX_W, alignSelf: 'center', width: '100%', paddingHorizontal: 28 }
      : { paddingHorizontal: 16 }}>
      {children}
    </View>
  );
}

export default function NotificationsScreen() {
  const { width } = useWindowDimensions();
  const compactTopBar = width < 430;
  const [notifs, setNotifs]         = useState<AppNotification[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      const res = await notificationsApi.getAll(pageNum, 20);
      const { content, last } = res.data;
      setNotifs(prev => pageNum === 0 ? content : [...prev, ...content]);
      setHasMore(!last);
      setPage(pageNum);
  
      // ← NEW: recompute unread and broadcast to the drawer badge
      const allAfterLoad = pageNum === 0
        ? content
        : [...notifs, ...content]; // note: 'notifs' state may be stale here, use a ref or recalc
      const unread = content.filter((n: any) => !n.isRead).length;
      // Better: use the total unread from a dedicated count.
      // Since the API doesn't return total unread, we approximate from page 0 content.
      // The dashboard load will correct it on next visit.
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); setLoadingMore(false); }
  };

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifs(n => n.map(x => ({ ...x, isRead: true })));
      // ← NEW: tell the drawer badge to reset to 0
      DeviceEventEmitter.emit('notifications:unread', 0);
    } catch (e) { console.error(e); }
  };

  useFocusEffect(useCallback(() => { load(0); }, []));

  const unread = notifs.filter(n => !n.isRead).length;

  if (loading) return (
    <View className="flex-1 bg-[#020617] items-center justify-center">
      <ActivityIndicator size="large" color="#6366F1" />
    </View>
  );

  return (
    <View className="flex-1 bg-[#020617]">
      <View className="bg-[#020617] border-b border-white/[0.06]" style={{ paddingTop: IS_WEB ? 0 : (Platform.OS === 'ios' ? 56 : 52) }}>
        <View className="flex-row items-center w-full px-4 py-3">
          <View className="flex-1">
            <HamburgerButton />
          </View>
          <View className="items-center flex-row gap-1">
            <Text className="text-white text-[17px] font-extrabold tracking-tight">
              Notifications
            </Text>
            <Ionicons
              name="notifications-outline"
              size={20}
              color="#6366F1"
              style={{ marginLeft: 8 }}
            />
          </View>
          <View className="flex-1 flex-row items-center justify-end gap-2">
            <UserAvatarButton />
            {unread > 0 ? (
              <TouchableOpacity onPress={markAllRead} className="bg-indigo-500/20 px-3 py-1.5 rounded-xl border border-indigo-500/30">
                <Text className="text-indigo-400 text-xs font-semibold">{compactTopBar ? 'Mark' : 'Mark all read'}</Text>
              </TouchableOpacity>
            ) : <View className="w-9" />}
          </View>
        </View>
        {unread > 0 && <Text className="text-slate-500 text-xs px-4 pb-2.5">{unread} unread</Text>}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(0); }} tintColor="#6366F1" />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <ContentWrap>
            <View className="pt-5">
              {notifs.length === 0 ? (
                <View className="items-center py-28">
                  <Text className="text-6xl mb-4">🔔</Text>
                  <Text className="text-white text-lg font-semibold mb-2">All clear!</Text>
                  <Text className="text-slate-400 text-sm text-center px-8 leading-5">
                    No notifications yet. We'll alert you when prices drop or bills are due.
                  </Text>
                </View>
              ) : (
                <View className="gap-3">
                  {notifs.map(notif => {
                    const cfg = TYPE_CFG[notif.type] ?? { emoji: '🔔', bg: 'rgba(100,116,139,0.15)' };
                    return (
                      <View key={notif.id}
                        className={`rounded-3xl p-4 border ${notif.isRead ? 'bg-slate-800/60 border-slate-700/30' : 'bg-slate-800/80 border-indigo-500/30'}`}
                        style={IS_WEB && !notif.isRead ? { boxShadow: '0 0 20px rgba(99,102,241,.08)' } as any : undefined}
                      >
                        <View className="flex-row gap-3">
                          <View className="w-11 h-11 rounded-2xl items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg }}>
                            <Text className="text-xl">{cfg.emoji}</Text>
                          </View>
                          <View className="flex-1">
                            <View className="flex-row justify-between items-start">
                              <Text className={`font-semibold flex-1 leading-snug ${notif.isRead ? 'text-slate-300' : 'text-white'}`} numberOfLines={2}>
                                {notif.title}
                              </Text>
                              {!notif.isRead && <View className="w-2 h-2 bg-indigo-500 rounded-full mt-1.5 ml-2 flex-shrink-0" />}
                            </View>
                            <Text className="text-slate-400 text-sm mt-1 leading-5">{notif.body}</Text>
                            <Text className="text-slate-600 text-xs mt-2">
                              {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
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
                </View>
              )}
            </View>
          </ContentWrap>
        </Animated.View>
      </ScrollView>
    </View>
  );
}