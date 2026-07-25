import { useCallback, useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Animated, Platform, Image, DeviceEventEmitter,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, router } from 'expo-router';
import { authApi } from '../../lib/api';
import { storage } from '../../lib/storage';
import { HamburgerButton } from './_layout';
import { useUpgrade } from '../../lib/useUpgrade';

const IS_WEB = Platform.OS === 'web';
const MAX_W  = 1100;

const wa = (msg: string) =>
  IS_WEB ? (window as any).alert(msg) : require('react-native').Alert.alert('', msg);
const wc = (msg: string) =>
  IS_WEB ? (window as any).confirm(msg) : false;

function ContentWrap({ children }: { children: React.ReactNode }) {
  return (
    <View style={IS_WEB
      ? { maxWidth: MAX_W, alignSelf: 'center', width: '100%', paddingHorizontal: 28 }
      : { paddingHorizontal: 16 }}>
      {children}
    </View>
  );
}

function ConfirmBanner({ message, confirmLabel, onConfirm, onCancel, loading, danger = true }: {
  message: string; confirmLabel: string; onConfirm: () => void;
  onCancel: () => void; loading: boolean; danger?: boolean;
}) {
  return (
    <View className={`mb-2 rounded-2xl overflow-hidden border ${
      danger ? 'border-red-500/30 bg-red-950/40' : 'border-orange-500/30 bg-orange-950/30'
    }`}>
      <View className="px-4 py-3">
        <Text className={`text-[13px] font-semibold mb-3 ${danger ? 'text-red-300' : 'text-orange-300'}`}>
          {message}
        </Text>
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] items-center">
            <Text className="text-slate-300 text-[13px] font-semibold">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onConfirm} disabled={loading}
            className={`flex-1 py-2.5 rounded-xl items-center border ${
              danger ? 'bg-red-500/20 border-red-500/40' : 'bg-orange-500/20 border-orange-500/40'
            }`}>
            {loading
              ? <ActivityIndicator size="small" color={danger ? '#f87171' : '#fb923c'} />
              : <Text className={`text-[13px] font-bold ${danger ? 'text-red-400' : 'text-orange-400'}`}>
                  {confirmLabel}
                </Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_STORAGE_KEY = 'user_avatar_b64';

async function loadStoredAvatar(): Promise<string | null> {
  try {
    if (IS_WEB) return localStorage.getItem(AVATAR_STORAGE_KEY);
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return await AsyncStorage.getItem(AVATAR_STORAGE_KEY);
  } catch { return null; }
}

async function saveAvatarLocally(b64: string): Promise<void> {
  try {
    if (IS_WEB) { localStorage.setItem(AVATAR_STORAGE_KEY, b64); return; }
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(AVATAR_STORAGE_KEY, b64);
  } catch {}
}

/** Notify all listeners (UserAvatarButton etc.) that the avatar changed. */
function broadcastAvatarUpdate(b64: string) {
  DeviceEventEmitter.emit('avatar:updated', b64);
}

/** Resize an image file to ≤256 px and return a base64 data-URL (web only). */
function resizeOnWeb(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 256;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ──────────────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { startUpgrade, loading: upgradeLoading } = useUpgrade();
  const [profile, setProfile]     = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [showPass, setShowPass]   = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw]         = useState('');
  const [changing, setChanging]   = useState(false);
  const [pwError, setPwError]     = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [emailNotifs,        setEmailNotifs]        = useState(true);
  const [emailNotifsLoading, setEmailNotifsLoading] = useState(false);

  // ── Avatar state ─────────────────────────────────────────────────────────────
  const [avatarUri,        setAvatarUri]        = useState<string | null>(null);
  const [avatarUploading,  setAvatarUploading]  = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    loadStoredAvatar().then(v => { if (v) setAvatarUri(v); });
  }, []);

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const r = await authApi.getProfile();
        setProfile(r.data);
        setEmailNotifs(r.data.emailNotifications ?? true);

        // --- NEW SYNC LOGIC ---
        // 1. Get current cached user
        const cached = await storage.getUser();
        
        // 2. Determine the best URI (Prefer backend URL, then local B64)
        const bestUri = r.data.avatarUrl || await loadStoredAvatar();
        setAvatarUri(bestUri);

        // 3. Update the global user storage so UserAvatarButton sees it
        await storage.setUser({ 
          ...cached, 
          ...r.data, 
          avatarUrl: r.data.avatarUrl // Ensure the URL is stored
        });

        // 4. Force the header to refresh immediately
        if (bestUri) {
          broadcastAvatarUpdate(bestUri);
        }
        // -----------------------

      } catch (e) {
        console.error('[Profile] getProfile failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []));

  // ── Avatar picker ─────────────────────────────────────────────────────────────

  const pickAvatarWeb = () => {
    if (!fileInputRef.current) {
      const input = document.createElement('input');
      input.type   = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAvatarUploading(true);
        try {
          const b64 = await resizeOnWeb(file);

          setAvatarUri(b64);
          await saveAvatarLocally(b64);
          
          // --- NEW: Sync the global user object ---
          const cachedUser = await storage.getUser();
          if (cachedUser) {
            await storage.setUser({ ...cachedUser, avatarUrl: b64 });
          }
          // ----------------------------------------
          
          broadcastAvatarUpdate(b64); // ← notify UserAvatarButton immediately
          
          await authApi.updateAvatar(b64).catch(() => {
            console.warn('[Avatar] Backend upload failed, keeping local copy');
          });
        } catch (err) {
          console.error('[Avatar] pick failed', err);
          wa('Failed to update photo. Please try a smaller image.');
        } finally {
          setAvatarUploading(false);
          input.value = '';
        }
      };
      document.body.appendChild(input);
      (fileInputRef as any).current = input;
    }
    fileInputRef.current!.click();
  };

  const pickAvatarNative = async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { wa('Gallery permission is required to change your photo.'); return; }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setAvatarUploading(true);
      const asset  = result.assets[0];
      const b64Uri = `data:image/jpeg;base64,${asset.base64}`;

      setAvatarUri(b64Uri);
      await saveAvatarLocally(b64Uri);
      
      // --- NEW: Sync the global user object ---
      const cachedUser = await storage.getUser();
      if (cachedUser) {
        await storage.setUser({ ...cachedUser, avatarUrl: b64Uri });
      }
      // ----------------------------------------

      broadcastAvatarUpdate(b64Uri); // ← notify UserAvatarButton immediately
      
      await authApi.updateAvatar(b64Uri).catch(() => {
        console.warn('[Avatar] Backend upload failed, keeping local copy');
      });
    } catch (err) {
      console.error('[Avatar] native pick failed', err);
      wa('Failed to update photo.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handlePickAvatar = () => IS_WEB ? pickAvatarWeb() : pickAvatarNative();

  // ── Other handlers ─────────────────────────────────────────────────────────────

  const handleEmailNotifsToggle = async () => {
    const next = !emailNotifs;
    setEmailNotifs(next);
    setEmailNotifsLoading(true);
    try {
      await authApi.updateEmailNotifications(next);
    } catch (e) {
      console.error('Failed to update email notifications', e);
      setEmailNotifs(!next);
    } finally {
      setEmailNotifsLoading(false);
    }
  };

  const doLogout = async () => {
    setLoggingOut(true);
    try { await authApi.logout(); } catch {}
    await storage.clear();
    router.replace('/(auth)/login');
  };

  const handleLogout = () => {
    if (IS_WEB) { if (wc('Sign out of SubTrackr?')) doLogout(); return; }
    setShowLogoutConfirm(true);
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await authApi.deleteAccount();
      await storage.clear();
      router.replace('/(auth)/login');
    } catch (err: any) {
      setDeleting(false);
      setShowDeleteConfirm(false);
      wa(err.response?.data?.error || 'Failed to delete account');
    }
  };

  const handleDelete = () => {
    if (IS_WEB) {
      if (wc('⚠️ Permanently delete your account and ALL data? This cannot be undone.')) doDelete();
      return;
    }
    setShowDeleteConfirm(true);
  };

  const handleChangePassword = async () => {
    if (!currentPw.trim() || !newPw.trim()) { setPwError('Both fields are required'); return; }
    if (newPw.length < 6) { setPwError('New password must be at least 6 characters'); return; }
    setChanging(true); setPwError(''); setPwSuccess(false);
    try {
      await authApi.changePassword({ currentPassword: currentPw, newPassword: newPw });
      setPwSuccess(true); setCurrentPw(''); setNewPw('');
      setTimeout(() => { setShowPass(false); setPwSuccess(false); }, 1800);
    } catch (err: any) {
      setPwError(err.response?.data?.error || 'Failed to change password');
    } finally { setChanging(false); }
  };

  if (loading) return (
    <View className="flex-1 bg-[#020617] items-center justify-center">
      <ActivityIndicator size="large" color="#7C3AED" />
    </View>
  );

  // Support Java LocalDate array format: [year, month, day, hour, minute, second, nano]
  function parseJavaDateArray(arr: any): Date | null {
    if (!Array.isArray(arr) || arr.length < 3) return null;
    return new Date(
      arr[0],
      (arr[1] || 1) - 1, // Java months are 1-based
      arr[2] || 1,
      arr[3] || 0,
      arr[4] || 0,
      arr[5] || 0,
      Math.floor((arr[6] || 0) / 1_000_000) // nanoseconds to ms
    );
  }

  let memberSince = '';
  if (profile?.createdAt) {
    let dateObj = null;
    if (Array.isArray(profile.createdAt)) {
      dateObj = parseJavaDateArray(profile.createdAt);
    } else if (typeof profile.createdAt === 'string' || typeof profile.createdAt === 'number') {
      dateObj = new Date(profile.createdAt);
    }
    if (dateObj && !isNaN(dateObj.getTime())) {
      memberSince = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
  }
  const isPremium = profile?.plan === 'PREMIUM';
  const initials  = profile?.fullName?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <View className="flex-1 bg-[#020617]">

      {/* Header */}
      <View className="bg-[#020617] border-b border-white/[0.06]" style={{ paddingTop: IS_WEB ? 0 : (Platform.OS === 'ios' ? 56 : 52) }}>
        <View className="flex-row items-center w-full px-4 py-3">
          <HamburgerButton />
          <View className="flex-1 items-center">
            <Text className="text-white text-[17px] font-extrabold tracking-tight">Profile 👤</Text>
          </View>
          <View className="w-10" />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <LinearGradient colors={['#130826', '#020617']} className="absolute top-0 left-0 right-0 h-44" />
        <Animated.View style={{ opacity: fade }}>
          <ContentWrap>
            <View className="pt-5">

              {/* Avatar / stats card */}
              <View
                className="bg-[#0d1424] rounded-2xl overflow-hidden border border-white/[0.07] mb-5"
                style={IS_WEB ? { boxShadow: '0 4px 20px rgba(0,0,0,.25)' } as any : undefined}
              >
                <LinearGradient
                  colors={isPremium ? ['#065f46', '#047857'] : ['#4c1d95', '#7c3aed', '#9333ea']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  className="py-6 px-5 flex-row items-center gap-4"
                >
                  {/* ── Tappable avatar circle ── */}
                  <TouchableOpacity
                    onPress={handlePickAvatar}
                    disabled={avatarUploading}
                    activeOpacity={0.8}
                    style={{ position: 'relative' }}
                  >
                    <View className="w-[60px] h-[60px] rounded-full bg-white/20 items-center justify-center border-2 border-white/30 overflow-hidden">
                      {avatarUploading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : avatarUri ? (
                        <Image
                          source={{ uri: avatarUri }}
                          style={{ width: 60, height: 60 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text className="text-white text-2xl font-black">{initials}</Text>
                      )}
                    </View>
                    {!avatarUploading && (
                      <View style={{
                        position: 'absolute', bottom: -2, right: -2,
                        width: 20, height: 20, borderRadius: 10,
                        backgroundColor: '#6366F1',
                        borderWidth: 2, borderColor: '#1e1b4b',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: 9, lineHeight: 12 }}>📷</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <View className="flex-1">
                    <Text className="text-white text-[18px] font-extrabold tracking-tight" numberOfLines={1}>
                      {profile?.fullName ?? 'User'}
                    </Text>
                    <Text className="text-white/60 text-[13px] mt-0.5" numberOfLines={1}>
                      {profile?.email ?? ''}
                    </Text>
                    <View className={`rounded-full px-2.5 py-[3px] self-start mt-1.5 ${
                      isPremium ? 'bg-emerald-400/25' : 'bg-white/20'
                    }`}>
                      <Text className="text-white text-[10px] font-extrabold tracking-[1.5px]">
                        {isPremium ? '👑 PREMIUM' : '🔒 FREE'}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
                <View className="flex-row">
                  {([
                    [profile?.subscriptionCount ?? 0, 'Subscriptions'],
                    [profile?.trackerCount       ?? 0, 'Trackers'],
                    [memberSince,                      'Member since'],
                  ] as [any, string][]).map(([v, l], i) => (
                    <View key={i}
                      className={`flex-1 items-center py-3.5 ${i < 2 ? 'border-r border-white/[0.06]' : ''}`}>
                      <Text className="text-slate-100 text-[15px] font-extrabold">{v}</Text>
                      <Text className="text-slate-500 text-[10px] mt-0.5 text-center">{l}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Premium upgrade card (free users only) */}
              {!isPremium && (
                <View className="items-center mb-5">
                  <View
                    className="w-full rounded-2xl overflow-hidden border border-violet-500/30"
                    style={{
                      maxWidth: IS_WEB ? 480 : undefined,
                      ...(IS_WEB ? { boxShadow: '0 0 40px rgba(124,58,237,0.12)' } : {}),
                    } as any}
                  >
                    <LinearGradient
                      colors={['rgba(124,58,237,0.20)', 'rgba(236,72,153,0.12)', 'rgba(124,58,237,0.08)']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={{ padding: 24 }}
                    >
                      <View className="items-center mb-4">
                        <View className="w-14 h-14 rounded-2xl bg-violet-500/20 items-center justify-center mb-3 border border-violet-500/30">
                          <Text className="text-2xl">⚡</Text>
                        </View>
                        <Text className="text-violet-200 text-[17px] font-extrabold mb-1">Upgrade to Premium</Text>
                        <View className="flex-row items-end gap-1">
                          <Text className="text-white text-[32px] font-black tracking-tight">2.99</Text>
                          <Text className="text-slate-400 text-sm mb-1.5">/month</Text>
                        </View>
                      </View>
                      <View className="gap-2.5 mb-5">
                        {['Unlimited subscriptions & trackers',
                          'Real-time push notifications',
                          'Hourly price checks',
                          'Full analytics & charts',
                          'Savings report & export',
                        ].map((f, i) => (
                          <View key={i} className="flex-row items-center gap-2.5">
                            <View className="w-5 h-5 rounded-full bg-emerald-500/20 items-center justify-center">
                              <Text className="text-emerald-400 text-[10px] font-extrabold">✓</Text>
                            </View>
                            <Text className="text-slate-300 text-[13px]">{f}</Text>
                          </View>
                        ))}
                      </View>
                      <TouchableOpacity onPress={startUpgrade} disabled={upgradeLoading}
                        activeOpacity={0.85} className="rounded-xl overflow-hidden">
                        <LinearGradient
                          colors={['#7c3aed', '#ec4899']}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={{
                            paddingVertical: 14, alignItems: 'center',
                            ...(IS_WEB ? { boxShadow: '0 0 24px rgba(124,58,237,.35)' } : {}),
                          } as any}
                        >
                          <Text className="text-white font-bold text-[15px]">Upgrade Now ⚡</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                      <Text className="text-slate-600 text-[11px] text-center mt-3">
                        Free plan: 3 subscriptions · 2 trackers · In-app only
                      </Text>
                    </LinearGradient>
                  </View>
                </View>
              )}

              {/* Account section */}
              <Text className="text-slate-700 text-[10px] font-bold tracking-[1.5px] mb-2">ACCOUNT</Text>

              <TouchableOpacity
                onPress={() => { setShowPass(!showPass); setPwError(''); setPwSuccess(false); }}
                className="bg-[#0d1424] rounded-[14px] px-4 py-3.5 mb-1.5 flex-row items-center justify-between border border-white/[0.06]"
                activeOpacity={0.85}
              >
                <View className="flex-row items-center gap-2.5">
                  <Text className="text-lg">🔑</Text>
                  <Text className="text-slate-200 text-[14px] font-semibold">Change Password</Text>
                </View>
                <Text className="text-slate-600 text-[12px]">{showPass ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {showPass && (
                <View className="bg-[#090f1c] rounded-[14px] p-4 mb-1.5 border border-violet-500/20">
                  {pwError ? (
                    <View className="mb-3 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25">
                      <Text className="text-red-400 text-[12px]">{pwError}</Text>
                    </View>
                  ) : null}
                  {pwSuccess ? (
                    <View className="mb-3 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                      <Text className="text-emerald-400 text-[12px] font-semibold">✓ Password changed!</Text>
                    </View>
                  ) : null}
                  <PwField label="CURRENT PASSWORD" value={currentPw} onChange={setCurrentPw} />
                  <PwField label="NEW PASSWORD"     value={newPw}     onChange={setNewPw} placeholder="Min 6 characters" />
                  <TouchableOpacity onPress={handleChangePassword} disabled={changing}
                    className="rounded-xl overflow-hidden mt-1" activeOpacity={0.85}>
                    <LinearGradient
                      colors={changing ? ['#3730a3', '#3730a3'] : ['#6366F1', '#7C3AED']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={{ paddingVertical: 12, alignItems: 'center' }}
                    >
                      {changing
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text className="text-white font-bold text-[14px]">Update Password</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* Settings section */}
              <Text className="text-slate-700 text-[10px] font-bold tracking-[1.5px] mb-2 mt-5">SETTINGS</Text>

              <View className="bg-[#0d1424] rounded-[14px] px-4 py-3.5 mb-1.5 flex-row items-center justify-between border border-white/[0.06]">
                <View className="flex-row items-center gap-2.5 flex-1">
                  <Text className="text-lg">📧</Text>
                  <View className="flex-1">
                    <Text className="text-slate-200 text-[14px] font-semibold">Email Notifications</Text>
                    <Text className="text-slate-500 text-[10px] mt-0.5">
                      {emailNotifs ? 'Receive alerts via email' : 'Email alerts disabled'}
                    </Text>
                  </View>
                </View>
                {emailNotifsLoading ? (
                  <ActivityIndicator size="small" color="#6366F1" />
                ) : (
                  <TouchableOpacity onPress={handleEmailNotifsToggle} activeOpacity={0.8}
                    style={{
                      width: 44, height: 26, borderRadius: 13,
                      backgroundColor: emailNotifs ? '#6366F1' : '#1e293b',
                      justifyContent: 'center', paddingHorizontal: 3,
                      ...(IS_WEB ? { transition: 'background-color .2s' } : {}),
                    } as any}
                  >
                    <View style={{
                      width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
                      transform: [{ translateX: emailNotifs ? 18 : 0 }],
                      ...(IS_WEB ? { transition: 'transform .2s' } : {}),
                    } as any} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Danger zone */}
              <Text className="text-slate-700 text-[10px] font-bold tracking-[1.5px] mb-2 mt-5">DANGER ZONE</Text>

              <TouchableOpacity onPress={handleLogout}
                className="bg-[#0d1424] rounded-[14px] px-4 py-3.5 mb-1.5 flex-row items-center gap-2.5 border border-white/[0.06]"
                activeOpacity={0.85}>
                <Text className="text-lg">🚪</Text>
                <Text className="text-orange-400 text-[14px] font-semibold">Sign Out</Text>
              </TouchableOpacity>

              {!IS_WEB && showLogoutConfirm && (
                <ConfirmBanner
                  message="Sign out of SubTrackr?"
                  confirmLabel="Sign Out"
                  onConfirm={doLogout}
                  onCancel={() => setShowLogoutConfirm(false)}
                  loading={loggingOut}
                  danger={false}
                />
              )}

              <TouchableOpacity onPress={handleDelete}
                className="bg-red-500/[0.08] rounded-[14px] px-4 py-3.5 mb-2 flex-row items-center gap-2.5 border border-red-500/20"
                activeOpacity={0.85}>
                <Text className="text-lg">🗑️</Text>
                <Text className="text-red-400 text-[14px] font-semibold">Delete Account</Text>
              </TouchableOpacity>

              {!IS_WEB && showDeleteConfirm && (
                <ConfirmBanner
                  message="⚠️ Permanently delete your account and ALL data? This cannot be undone."
                  confirmLabel="Delete Forever"
                  onConfirm={doDelete}
                  onCancel={() => setShowDeleteConfirm(false)}
                  loading={deleting}
                />
              )}

              <View className="items-center pt-4 pb-2">
                <Text className="text-slate-800 text-[11px]">
                  SubTrackr v1.0.0 · Stop overpaying. Start tracking.
                </Text>
              </View>
            </View>
          </ContentWrap>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function PwField({ label, value, onChange, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <View className="mb-3">
      <Text className="text-slate-500 text-[10px] font-semibold tracking-[0.8px] mb-1.5">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#1e293b"
        secureTextEntry
        multiline={false}
        style={{
          backgroundColor: '#111827', color: '#f1f5f9', fontSize: 14,
          paddingHorizontal: 14, paddingVertical: 12,
          borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
          ...(IS_WEB ? { outlineStyle: 'none', width: '100%' } : {}),
        } as any}
      />
    </View>
  );
}