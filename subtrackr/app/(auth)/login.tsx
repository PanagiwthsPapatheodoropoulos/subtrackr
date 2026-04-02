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
import { registerForPushNotifications } from '../../lib/notifications';

const IS_WEB = Platform.OS === 'web';
const { width } = Dimensions.get('window');
const CARD_WIDTH = IS_WEB ? 420 : Math.min(width - 40, 420);

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [focused, setFocused]   = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 160 }),
    ]).start();
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim())                    e.email    = 'Please enter your email address';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email    = 'Please enter a valid email (e.g. name@example.com)';
    if (!password)                         e.password = 'Please enter your password';
    else if (password.length < 6)          e.password = 'Password must be at least 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    setApiError('');
    try {
      const fcmToken = await registerForPushNotifications();
      const res = await authApi.login({
        email: email.trim(), password,
        fcmToken: fcmToken ?? undefined,
      });
      await storage.setToken(res.data.accessToken);
      if (res.data.refreshToken) await storage.setRefreshToken(res.data.refreshToken);
      await storage.setUser(res.data);
      router.replace('/(tabs)/');
    } catch (err: any) {
      const serverMsg = err.response?.data?.error || err.response?.data?.message;
      const status    = err.response?.status;
      let msg = 'Something went wrong. Please try again.';
      if (status === 401 || status === 403) {
        msg = 'Incorrect email or password. Please double-check and try again.';
      } else if (status === 404) {
        msg = 'No account found with that email address.';
      } else if (serverMsg) {
        msg = serverMsg;
      } else if (!err.response) {
        msg = 'Unable to connect. Please check your internet connection.';
      }
      if (IS_WEB) {
        setApiError(msg);
      } else {
        Alert.alert('Sign in failed', msg);
      }
    } finally { setLoading(false); }
  };

  const handleEmailChange = (v: string) => {
    setEmail(v);
    setErrors(e => ({ ...e, email: '' }));
    if (apiError) setApiError('');
  };

  const handlePasswordChange = (v: string) => {
    setPassword(v);
    setErrors(e => ({ ...e, password: '' }));
    if (apiError) setApiError('');
  };

  return (
    <View className="flex-1 bg-[#060812]">
      <StatusBar barStyle="light-content" />

      {/* Ambient glow */}
      <View style={{
        position: 'absolute', width: 480, height: 480, borderRadius: 240,
        backgroundColor: 'rgba(124,58,237,0.07)', top: -220, alignSelf: 'center',
        ...(IS_WEB ? { filter: 'blur(90px)' } : {}),
      } as any} />

      {/* Back button */}
      <TouchableOpacity
        onPress={() => router.replace('/')}
        className="absolute top-14 left-6 z-10 flex-row items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/5 border border-white/[0.08]"
      >
        <Text className="text-violet-400 text-sm">←</Text>
        <Text className="text-violet-400 text-[13px] font-semibold">Back</Text>
      </TouchableOpacity>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={{
            flexGrow: 1, alignItems: 'center', justifyContent: 'center',
            paddingVertical: 80, paddingHorizontal: 20,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ width: CARD_WIDTH, alignItems: 'center', transform: [{ translateY: slideAnim }] }}>

            {/* Logo */}
            <View className="items-center mb-9">
              <LinearGradient
                colors={['#7c3aed', '#ec4899']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{
                  width: 64, height: 64, borderRadius: 18,
                  alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                  ...(IS_WEB ? { boxShadow: '0 0 30px rgba(124,58,237,.38)' } : {}),
                } as any}
              >
                <Text style={{ fontSize: 28 }}>💰</Text>
              </LinearGradient>
              <Text className="text-white text-2xl font-black tracking-tight mb-1">SubTrackr</Text>
              <Text className="text-slate-500 text-[13px]">Stop overpaying. Start tracking.</Text>
            </View>

            {/* Card */}
            <View
              className="w-full bg-[#0d1526] rounded-3xl p-7 border border-white/[0.07]"
              style={IS_WEB ? { boxShadow: '0 20px 56px rgba(0,0,0,.45)' } as any : undefined}
            >
              <Text className="text-white text-xl font-bold tracking-tight mb-1">Welcome back</Text>
              <Text className="text-slate-500 text-[13px] mb-6">Sign in to your account</Text>

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

              {/* Email */}
              <FieldLabel>Email</FieldLabel>
              <InputWrap focused={focused === 'email'} error={!!errors.email}>
                <TextInput
                  style={[inputStyle, IS_WEB ? { outlineStyle: 'none', flex: 1 } as any : { flex: 1 }]}
                  placeholder="your@email.com"
                  placeholderTextColor="#2d3f5a"
                  value={email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  multiline={false}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                />
              </InputWrap>
              {errors.email ? <ErrorText>{errors.email}</ErrorText> : null}

              {/* Password */}
              <FieldLabel>Password</FieldLabel>
              <InputWrap focused={focused === 'password'} error={!!errors.password} style={{ marginBottom: 8 }}>
                <TextInput
                  style={[inputStyle, IS_WEB ? { outlineStyle: 'none', flex: 1 } as any : { flex: 1 }]}
                  placeholder="••••••••"
                  placeholderTextColor="#2d3f5a"
                  value={password}
                  onChangeText={handlePasswordChange}
                  secureTextEntry={!showPass}
                  multiline={false}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                />
                <TouchableOpacity onPress={() => setShowPass(v => !v)} className="px-4 justify-center">
                  <Text className="text-slate-500 text-xs font-semibold">{showPass ? 'HIDE' : 'SHOW'}</Text>
                </TouchableOpacity>
              </InputWrap>
              {errors.password
                ? <ErrorText>{errors.password}</ErrorText>
                : <View className="mb-4" />
              }

              {/* Submit */}
              <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
                <LinearGradient
                  colors={loading ? ['#3b1f6e', '#3b1f6e'] : ['#7c3aed', '#ec4899']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 14, paddingVertical: 15,
                    alignItems: 'center', justifyContent: 'center',
                    ...(IS_WEB ? { boxShadow: '0 0 22px rgba(124,58,237,.28)' } : {}),
                  } as any}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text className="text-white font-bold text-[15px]">Sign In</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Register link */}
            <TouchableOpacity className="mt-6 items-center" onPress={() => router.push('/(auth)/register')}>
              <Text className="text-slate-500 text-[13px]">
                Don't have an account?{' '}
                <Text className="text-violet-400 font-semibold">Create one ✨</Text>
              </Text>
            </TouchableOpacity>

          </Animated.View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text className="text-slate-500 text-[10px] font-bold tracking-[1px] uppercase mb-2">{children}</Text>
  );
}

function InputWrap({ focused, error, children, style }: {
  focused: boolean; error?: boolean; children: any; style?: any;
}) {
  return (
    <View
      className="rounded-xl overflow-hidden mb-4 flex-row items-center"
      style={[{
        borderWidth: 1.5,
        borderColor: error ? '#ef4444' : focused ? '#7c3aed' : 'rgba(255,255,255,0.07)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        ...(IS_WEB ? {
          transition: 'border-color .2s',
          boxShadow: error
            ? '0 0 0 3px rgba(239,68,68,.12)'
            : focused ? '0 0 0 3px rgba(124,58,237,.14)' : 'none',
        } : {}),
      } as any, style]}
    >
      {children}
    </View>
  );
}

function ErrorText({ children }: { children: string }) {
  return <Text className="text-red-400 text-xs -mt-2.5 mb-3 ml-1">{children}</Text>;
}

const inputStyle = {
  color: '#f1f5f9',
  fontSize: 15,
  paddingHorizontal: 16,
  paddingVertical: 14,
  backgroundColor: 'transparent',
} as const;