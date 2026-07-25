import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Animated, StatusBar, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { authApi } from '../../lib/api';
import { storage } from '../../lib/storage';

const IS_WEB    = Platform.OS === 'web';
const { width } = Dimensions.get('window');
const CARD_W    = IS_WEB ? 480 : Math.min(width - 40, 480);

const goBack = () => router.replace('/(auth)/login');

export default function RegisterScreen() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    emailNotifications: false,
  });
  const [loading, setLoading]   = useState(false);
  const [focused, setFocused]   = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 150, delay: 60 }),
    ]).start();
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.fullName.trim())
      e.fullName = 'Please enter your full name';
    else if (form.fullName.trim().length < 2)
      e.fullName = 'Full name must be at least 2 characters';
    if (!form.email.trim())
      e.email = 'Please enter your email address';
    else if (!/\S+@\S+\.\S+/.test(form.email))
      e.email = 'Please enter a valid email (e.g. name@example.com)';
    if (!form.password)
      e.password = 'Please enter a password';
    else if (form.password.length < 6)
      e.password = 'Password must be at least 6 characters';
    if (!form.confirmPassword)
      e.confirmPassword = 'Please confirm your password';
    else if (form.confirmPassword !== form.password)
      e.confirmPassword = 'Passwords do not match — please re-enter';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    setApiError('');
    try {
      const res = await authApi.register({
        fullName:           form.fullName.trim(),
        email:              form.email.trim(),
        password:           form.password,
        emailNotifications: form.emailNotifications,
      });
      await storage.setToken(res.data.accessToken);
      if (res.data.refreshToken) await storage.setRefreshToken(res.data.refreshToken);
      await storage.setUser(res.data);
      router.replace('/(tabs)/');
    } catch (err: any) {
      const serverMsg = err.response?.data?.error || err.response?.data?.message;
      const status    = err.response?.status;
      let msg = 'Registration failed. Please try again.';
      if (status === 409 || (serverMsg && serverMsg.toLowerCase().includes('email'))) {
        msg = 'An account with this email already exists. Try signing in instead.';
      } else if (status === 400) {
        msg = serverMsg || 'Please check your details and try again.';
      } else if (serverMsg) {
        msg = serverMsg;
      } else if (!err.response) {
        msg = 'Unable to connect. Please check your internet connection.';
      }
      if (IS_WEB) {
        setApiError(msg);
      } else {
        Alert.alert('Registration failed', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const upd = (k: keyof typeof form) => (v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: '' }));
    if (apiError) setApiError('');
  };

  return (
    <View className="flex-1 bg-[#060812]">
      <StatusBar barStyle="light-content" />

      <View style={{
        position: 'absolute', width: 500, height: 500, borderRadius: 250,
        backgroundColor: 'rgba(6,182,212,0.05)', top: -240, alignSelf: 'center',
        ...(IS_WEB ? { filter: 'blur(100px)' } : {}),
      } as any} />

      {/* Back button */}
      <TouchableOpacity
        onPress={goBack}
        className="absolute top-14 left-6 z-10 flex-row items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/5 border border-white/[0.08]"
      >
        <Text className="text-violet-400 text-sm">←</Text>
        <Text className="text-violet-400 text-[13px] font-semibold">Back</Text>
      </TouchableOpacity>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={{
            flexGrow: 1, alignItems: 'center', justifyContent: 'center',
            paddingVertical: 88, paddingHorizontal: 20,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ width: CARD_W, transform: [{ translateY: slideAnim }] }}>

            <View className="mb-6">
              <LinearGradient
                colors={['#7c3aed', '#ec4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{
                  width: 52, height: 52, borderRadius: 15,
                  alignItems: 'center', justifyContent: 'center', marginBottom: 18,
                  ...(IS_WEB ? { boxShadow: '0 0 24px rgba(124,58,237,.32)' } : {}),
                } as any}
              >
                <Text style={{ fontSize: 24 }}>💰</Text>
              </LinearGradient>
              <Text className="text-white text-2xl font-extrabold tracking-tight mb-1">Create account</Text>
              <Text className="text-slate-500 text-sm">Join thousands saving money with SubTrackr</Text>
            </View>

            <View className="flex-row items-center gap-1.5 self-start mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3.5 py-1.5">
              <Text className="text-xs">✓</Text>
              <Text className="text-emerald-400 text-xs font-semibold">Free — no credit card needed</Text>
            </View>

            <View
              className="w-full rounded-3xl p-7 border border-white/[0.07] bg-[#0d1526] mb-5"
              style={IS_WEB ? { boxShadow: '0 20px 60px rgba(0,0,0,.48)' } as any : undefined}
            >
              {/* API Error Banner */}
              {apiError ? (
                <View
                  className="rounded-xl border px-4 py-3 mb-5 flex-row items-start gap-2.5"
                  style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' }}
                >
                  <Text style={{ fontSize: 15, marginTop: 1 }}>⚠️</Text>
                  <Text className="text-red-400 text-[13px] flex-1 leading-5">{apiError}</Text>
                </View>
              ) : null}

              <FL>Full Name</FL>
              <IW focused={focused === 'fn'} error={!!errors.fullName}>
                <TextInput
                  placeholder="Nikos Papadopoulos"
                  placeholderTextColor="#2d3f5a"
                  value={form.fullName}
                  onChangeText={upd('fullName')}
                  autoCapitalize="words"
                  multiline={false}
                  onFocus={() => setFocused('fn')} onBlur={() => setFocused(null)}
                  style={{
                    flex: 1, color: '#f1f5f9', fontSize: 15,
                    paddingHorizontal: 16, paddingVertical: 14,
                    ...(IS_WEB ? { outlineStyle: 'none' } : {}),
                  } as any}
                />
              </IW>
              {errors.fullName ? <ET>{errors.fullName}</ET> : null}

              <FL>Email</FL>
              <IW focused={focused === 'em'} error={!!errors.email}>
                <TextInput
                  placeholder="your@email.com"
                  placeholderTextColor="#2d3f5a"
                  value={form.email}
                  onChangeText={upd('email')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  multiline={false}
                  onFocus={() => setFocused('em')} onBlur={() => setFocused(null)}
                  style={{
                    flex: 1, color: '#f1f5f9', fontSize: 15,
                    paddingHorizontal: 16, paddingVertical: 14,
                    ...(IS_WEB ? { outlineStyle: 'none' } : {}),
                  } as any}
                />
              </IW>
              {errors.email ? <ET>{errors.email}</ET> : null}

              <FL>Password</FL>
              <IW focused={focused === 'pw'} error={!!errors.password}>
                <TextInput
                  placeholder="Min. 6 characters"
                  placeholderTextColor="#2d3f5a"
                  value={form.password}
                  onChangeText={upd('password')}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  multiline={false}
                  onFocus={() => setFocused('pw')} onBlur={() => setFocused(null)}
                  style={{
                    flex: 1, color: '#f1f5f9', fontSize: 15,
                    paddingHorizontal: 16, paddingVertical: 14,
                    ...(IS_WEB ? { outlineStyle: 'none' } : {}),
                  } as any}
                />
                <TouchableOpacity onPress={() => setShowPass(v => !v)} className="pr-4 justify-center">
                  <Text className="text-slate-500 text-xs font-semibold">{showPass ? 'HIDE' : 'SHOW'}</Text>
                </TouchableOpacity>
              </IW>
              {errors.password ? <ET>{errors.password}</ET> : null}

              <FL>Confirm Password</FL>
              <IW focused={focused === 'cp'} error={!!errors.confirmPassword}>
                <TextInput
                  placeholder="Re-enter your password"
                  placeholderTextColor="#2d3f5a"
                  value={form.confirmPassword}
                  onChangeText={upd('confirmPassword')}
                  secureTextEntry={!showConf}
                  autoCapitalize="none"
                  multiline={false}
                  onFocus={() => setFocused('cp')} onBlur={() => setFocused(null)}
                  style={{
                    flex: 1, color: '#f1f5f9', fontSize: 15,
                    paddingHorizontal: 16, paddingVertical: 14,
                    ...(IS_WEB ? { outlineStyle: 'none' } : {}),
                  } as any}
                />
                <TouchableOpacity onPress={() => setShowConf(v => !v)} className="pr-4 justify-center">
                  <Text className="text-slate-500 text-xs font-semibold">{showConf ? 'HIDE' : 'SHOW'}</Text>
                </TouchableOpacity>
              </IW>
              {errors.confirmPassword ? <ET>{errors.confirmPassword}</ET> : null}

              {form.confirmPassword.length > 0 && (
                <View className="flex-row items-center gap-1.5 mb-4 mt-1">
                  <View className={`w-2 h-2 rounded-full ${form.confirmPassword === form.password ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <Text className={`text-xs font-medium ${form.confirmPassword === form.password ? 'text-emerald-400' : 'text-red-400'}`}>
                    {form.confirmPassword === form.password ? 'Passwords match ✓' : 'Passwords do not match'}
                  </Text>
                </View>
              )}

              {form.password.length > 0 && <StrengthBar password={form.password} />}

              {/* Email notifications opt-in */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setForm(f => ({ ...f, emailNotifications: !f.emailNotifications }))}
                className="flex-row items-center gap-3 mb-5 mt-2"
              >
                <View style={{
                  width: 20, height: 20, borderRadius: 6,
                  borderWidth: 1.5,
                  borderColor: form.emailNotifications ? '#7c3aed' : 'rgba(255,255,255,0.2)',
                  backgroundColor: form.emailNotifications ? '#7c3aed' : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {form.emailNotifications && <Text className="text-white text-[11px] font-bold">✓</Text>}
                </View>
                <Text className="text-slate-400 text-xs flex-1">
                  Send me billing reminders and price drop alerts via email. (You can change this later.)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleRegister} disabled={loading} activeOpacity={0.85} className="mt-2">
                <LinearGradient
                  colors={loading ? ['#3b1f6e', '#3b1f6e'] : ['#7c3aed', '#ec4899']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 14, paddingVertical: 15, alignItems: 'center',
                    ...(IS_WEB ? { boxShadow: '0 0 24px rgba(124,58,237,.3)' } : {}),
                  } as any}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text className="text-white font-bold text-[15px]">Create Account</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Sign-in link */}
            <TouchableOpacity className="items-center mb-4" onPress={goBack}>
              <Text className="text-slate-500 text-[13px]">
                Already have an account?{' '}
                <Text className="text-violet-400 font-semibold">Sign in</Text>
              </Text>
            </TouchableOpacity>

            <View className="flex-row items-center justify-center gap-4">
              <TouchableOpacity onPress={() => router.push('/privacy-policy')}>
                <Text className="text-slate-600 text-[11px] font-medium" style={IS_WEB ? { transition: 'color .2s' } as any : undefined}>Privacy Policy</Text>
              </TouchableOpacity>
              <Text className="text-slate-700 text-[10px]">·</Text>
              <TouchableOpacity onPress={() => router.push('/terms')}>
                <Text className="text-slate-600 text-[11px] font-medium" style={IS_WEB ? { transition: 'color .2s' } as any : undefined}>Terms of Service</Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StrengthBar({ password }: { password: string }) {
  const score  = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', '#ef4444', '#f59e0b', '#06b6d4', '#10b981'];
  return (
    <View className="mb-5">
      <View className="flex-row gap-1.5 mb-1.5">
        {[1,2,3,4].map(i => (
          <View key={i} className="flex-1 h-1 rounded-full"
            style={{ backgroundColor: i <= score ? colors[score] : 'rgba(255,255,255,0.08)' }} />
        ))}
      </View>
      {score > 0 && <Text className="text-xs" style={{ color: colors[score] }}>{labels[score]} password</Text>}
    </View>
  );
}

function FL({ children }: { children: string }) {
  return <Text className="text-slate-500 text-[10px] font-bold tracking-[1px] uppercase mb-2">{children}</Text>;
}

function IW({ focused, error, children }: { focused: boolean; error?: boolean; children: any }) {
  return (
    <View
      className="rounded-xl overflow-hidden mb-4 flex-row items-center"
      style={{
        borderWidth: 1.5,
        borderColor: error ? '#ef4444' : focused ? '#7c3aed' : 'rgba(255,255,255,0.07)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        ...(IS_WEB ? {
          transition: 'border-color .2s',
          boxShadow: error ? '0 0 0 3px rgba(239,68,68,.12)' : focused ? '0 0 0 3px rgba(124,58,237,.14)' : 'none',
        } : {}),
      } as any}
    >
      {children}
    </View>
  );
}

function ET({ children }: { children: string }) {
  return <Text className="text-red-400 text-xs -mt-2.5 mb-3 ml-1">{children}</Text>;
}