import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Platform, Animated, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';

const IS_WEB = Platform.OS === 'web';

//  Inject global CSS via useEffect (fixes TS parser crash from <style>{`...`}</style>) 
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; overflow-x: hidden; font-family: 'Plus Jakarta Sans', sans-serif; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #04050d; }
  ::-webkit-scrollbar-thumb { background: #7c3aed; border-radius: 2px; }
  @keyframes drift {
    0%   { transform: translate(0,0) scale(1); }
    40%  { transform: translate(70px,-50px) scale(1.08); }
    70%  { transform: translate(-50px,70px) scale(.93); }
    100% { transform: translate(35px,35px) scale(1.04); }
  }
  @keyframes badgePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.6)} }
  @keyframes heroUp { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
  @keyframes floatUp {
    0%{opacity:0;transform:translateY(100vh) scale(0)}
    8%{opacity:.45}
    88%{opacity:.18}
    100%{opacity:0;transform:translateY(-80px) scale(1)}
  }
`;

function useGlobalCSS() {
  useEffect(() => {
    if (!IS_WEB) return;
    const el = document.createElement('style');
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, []);
}

export default function Index() {
  if (!IS_WEB) return <Redirect href="/(tabs)/" />;
  return <LandingPage />;
}

//  Reveal animation hook 
function useReveal(delay = 0) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;
  const trigger = () => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 600, delay: delay * 1000, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay: delay * 1000, useNativeDriver: true, damping: 20 }),
    ]).start();
  };
  return { opacity, translateY, trigger };
}

//  Section label 
function SectionLabel({ text }: { text: string }) {
  return (
    <View className="flex-row items-center gap-2 mb-4">
      <View className="w-5 h-px bg-indigo-400" />
      <Text className="text-indigo-400 text-xs font-bold tracking-widest uppercase">{text}</Text>
    </View>
  );
}

//  Gradient / Outline Button 
function GradientBtn({ label, onPress, outline = false }: {
  label: string; onPress: () => void; outline?: boolean;
}) {
  const [hov, setHov] = useState(false);

  if (outline) {
    return (
      <TouchableOpacity
        onPress={onPress}
        {...{ onMouseEnter: () => setHov(true), onMouseLeave: () => setHov(false) } as any}
        className="px-9 py-3.5 rounded-full"
        style={{
          borderWidth: 1,
          borderColor: hov ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.12)',
          backgroundColor: hov ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.04)',
          ...(IS_WEB ? { transition: 'all .25s' } : {}),
        } as any}
      >
        <Text className="text-slate-100 text-[15px] font-medium">{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      {...{ onMouseEnter: () => setHov(true), onMouseLeave: () => setHov(false) } as any}
      style={{
        transform: [{ translateY: hov ? -2 : 0 }],
        ...(IS_WEB ? { transition: 'transform .2s' } : {}),
      } as any}
    >
      <LinearGradient
        colors={['#6366f1', '#4f46e5']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        className="px-9 py-3.5 rounded-full"
      >
        <Text className="text-white text-[15px] font-semibold">{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function StepItem({ num, title, desc, delay = 0 }: {
  num: string; title: string; desc: string; delay?: number;
}) {
  const { opacity, translateY, trigger } = useReveal(delay);
  useEffect(() => { trigger(); }, []);

  return (
    <Animated.View
      style={{ opacity, transform: [{ translateY }], flex: 1, alignItems: 'center', paddingHorizontal: 24, minWidth: 200 }}
    >
      <View
        className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 items-center justify-center mb-5"
      >
        <Text className="text-indigo-400 text-xl font-extrabold">{num}</Text>
      </View>
      <Text className="text-slate-100 font-bold text-[17px] mb-2.5 text-center">{title}</Text>
      <Text className="text-slate-400 text-sm leading-[22px] text-center">{desc}</Text>
    </Animated.View>
  );
}
function TestiCard({ quote, name, role, emoji, delay = 0 }: {
  quote: string; name: string; role: string; emoji: string; delay?: number;
}) {
  const { opacity, translateY, trigger } = useReveal(delay);
  const [hov, setHov] = useState(false);
  useEffect(() => { trigger(); }, []);

  return (
    <Animated.View
      style={{ opacity, transform: [{ translateY }], flex: 1, minWidth: 260, maxWidth: 420 }}
    >
      <Pressable
        onHoverIn={() => setHov(true)}
        onHoverOut={() => setHov(false)}
        style={{
          backgroundColor: '#1e293b',
          borderRadius: 20,
          padding: 28,
          flex: 1,
          borderWidth: 1,
          borderColor: hov ? '#475569' : '#334155',
          transform: [{ translateY: hov ? -4 : 0 }],
          ...(IS_WEB ? {
            boxShadow: hov ? '0 12px 32px rgba(0,0,0,.25)' : undefined,
            transition: 'all .25s',
          } : {}),
        } as any}
      >
        <Text className="text-amber-400 text-sm mb-3.5 tracking-[3px]">★★★★★</Text>
        <Text className="text-slate-300 text-sm leading-[22px] italic mb-5">{`"${quote}"`}</Text>
        <View className="flex-row items-center gap-3">
          <View className="w-[38px] h-[38px] rounded-full bg-white/[0.06] items-center justify-center">
            <Text className="text-lg">{emoji}</Text>
          </View>
          <View>
            <Text className="text-slate-100 font-semibold text-sm">{name}</Text>
            <Text className="text-slate-500 text-xs">{role}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
function PricingCard({ name, price, period, desc, features, dimmed = [], featured = false, onPress }: {
  name: string; price: string; period: string; desc: string;
  features: string[]; dimmed?: string[]; featured?: boolean; onPress: () => void;
}) {
  return (
    <View
      className="flex-1 min-w-[280px] rounded-3xl p-9 border relative overflow-hidden bg-slate-800"
      style={{
        borderColor: featured ? '#6366f1' : '#334155',
        ...(IS_WEB && featured ? { boxShadow: '0 0 40px rgba(99,102,241,.12)' } : {}),
      } as any}
    >
      {featured && (
        <LinearGradient
          colors={['#7c3aed', '#ec4899']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          className="absolute top-[18px] right-[18px] px-2.5 py-1 rounded-full"
        >
          <Text className="text-white text-[10px] font-extrabold tracking-[1.5px]">POPULAR</Text>
        </LinearGradient>
      )}

      <Text className="text-slate-500 text-[11px] font-bold tracking-[2px] uppercase mb-3.5">{name}</Text>

      <View className="flex-row items-end gap-1.5 mb-1.5">
        <Text className="text-slate-100 font-extrabold text-5xl tracking-[-2px] leading-[52px]">{price}</Text>
        <Text className="text-slate-500 text-[15px] mb-2">{period}</Text>
      </View>
      <Text className="text-slate-500 text-[13px] mb-7">{desc}</Text>

      <View className="gap-[11px] mb-8">
        {features.map((f, i) => (
          <View key={i} className="flex-row items-center gap-2.5">
            <View className="w-5 h-5 rounded-full bg-emerald-500/20 items-center justify-center">
              <Text className="text-emerald-400 text-[10px] font-extrabold">✓</Text>
            </View>
            <Text className="text-slate-200 text-sm">{f}</Text>
          </View>
        ))}
        {dimmed.map((f, i) => (
          <View key={i} className="flex-row items-center gap-2.5">
            <View className="w-5 h-5 rounded-full bg-slate-500/[0.15] items-center justify-center">
              <Text className="text-slate-500 text-[11px]">{''}</Text>
            </View>
            <Text className="text-slate-500 text-sm">{f}</Text>
          </View>
        ))}
      </View>

      {featured ? (
        <TouchableOpacity onPress={onPress}>
          <LinearGradient
            colors={['#7c3aed', '#ec4899']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            className="rounded-full py-3.5 items-center"
            style={IS_WEB ? { boxShadow: '0 0 28px rgba(124,58,237,.3)' } as any : undefined}
          >
            <Text className="text-white font-bold text-[15px]">{'Start Premium '}</Text>
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onPress}
          className="rounded-full py-3.5 items-center border border-white/10"
        >
          <Text className="text-slate-100 font-medium text-[15px]">Get started free</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
type BlobDef = { s: number; c: string; top?: number | string; left?: number | string; bottom?: number | string; right?: number | string; d: string; dl?: string };
const BLOBS: BlobDef[] = [
  { s: 560, c: '#7c3aed', top: -180, left: -180, d: '26s' },
  { s: 480, c: '#ec4899', bottom: -140, right: -90, d: '21s', dl: '-9s' },
  { s: 380, c: '#06b6d4', top: '38%', left: '48%', d: '32s', dl: '-16s' },
];

const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 21 + 4) % 100}%`,
  width: (i % 3) + 1.5,
  height: (i % 3) + 1.5,
  color: (['rgba(124,58,237,.45)', 'rgba(236,72,153,.45)', 'rgba(6,182,212,.45)'] as string[])[i % 3],
  duration: `${13 + (i % 9)}s`,
  delay: `${(i * 2.9) % 20}s`,
}));

const NAV_LINKS: [string, string][] = [
  ['lp-features', 'Features'],
  ['lp-how', 'How it works'],
  ['lp-pricing', 'Pricing'],
];
const STATS: [string, string][] = [
  ['14,200+', 'Users tracking'],
  ['2.4M',   'Monthly spend tracked'],
  ['340K',   'Saved by users'],
  ['4.9 ',   'App rating'],
];
const FEATURES = [
  { title: 'Subscription Manager', desc: "Add all your recurring payments in seconds. See what's charging when, with billing cycle breakdowns and category groupings." },
  { title: 'Price Drop Tracker', desc: "Paste any e-shop URL and we'll monitor the price 24/7. Instant alerts the moment it hits your target  Amazon, Skroutz and more." },
  { title: 'Smart Billing Alerts', desc: 'Never be surprised by a charge again. Push notifications arrive 2 days before every billing date, straight to your phone.' },
  { title: 'Spending Analytics', desc: 'Beautiful charts break down your spending by category and track your monthly trend across 6 months.' },
  { title: 'Duplicate Detector', desc: 'Running Netflix and Disney+ simultaneously? SubTrackr flags overlapping services and estimates your potential savings.' },
  { title: 'Savings Report', desc: 'See your total savings from price drops. A shareable "This year I saved X" report ready for social media.' },
];
type SubRow = { emoji: string; name: string; cycle: string; price: string };
const SUB_ROWS: SubRow[] = [
  { emoji: '🎬', name: 'Netflix', cycle: 'Monthly  2 days', price: '15.99' },
  { emoji: '🎵', name: 'Spotify', cycle: 'Monthly  8 days', price: '9.99' },
];
function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [winWidth, setWinWidth] = useState(
    IS_WEB && typeof window !== 'undefined' ? window.innerWidth : 1200
  );
  const scrollRef = useRef<ScrollView | null>(null);
  useGlobalCSS();

  useEffect(() => {
    if (!IS_WEB) return;
    const onResize = () => setWinWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
 
  const isMobile = winWidth < 768;
  const isTablet = winWidth < 1024;
 

  const goLogin  = () => router.push('/(auth)/login');
  const scrollTo = (id: string) =>
    (document.getElementById(id) as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth' });
  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    if (IS_WEB) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <View className="flex-1 bg-[#0f172a]">

      {/* Ambient blobs */}
      <View style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' } as any}>
        {BLOBS.map((b, i) => (
          <View key={i} style={{
            position: 'absolute',
            width: b.s, height: b.s, borderRadius: 9999,
            backgroundColor: b.c,
            filter: 'blur(110px)', opacity: 0.11,
            top: b.top, left: b.left, bottom: b.bottom, right: b.right,
            animation: `drift ${b.d} ease-in-out infinite alternate`,
            animationDelay: b.dl ?? '0s',
          } as any} />
        ))}
        {PARTICLES.map((p, i) => (
          <View key={i} style={{
            position: 'fixed', borderRadius: 9999, pointerEvents: 'none', zIndex: 0,
            left: p.left,
            width: p.width, height: p.height,
            backgroundColor: p.color,
            animation: `floatUp ${p.duration} linear infinite`,
            animationDelay: p.delay,
          } as any} />
        ))}
      </View>

      <View style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        paddingVertical: scrolled ? 10 : 16,
        paddingHorizontal: isMobile ? 16 : isTablet ? 28 : 48,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backdropFilter: 'blur(20px)',
        backgroundColor: scrolled ? '#0f172a' : '#0f172a',
        borderBottomWidth: 1, borderBottomColor: '#1e293b',
        transition: 'all .3s',
      } as any}>
        {/* Logo — click scrolls to top */}
        <TouchableOpacity
          onPress={scrollToTop}
          activeOpacity={0.8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <LinearGradient
            colors={['#6366f1', '#4f46e5']}
            style={{
              width: 36, height: 36, borderRadius: 10,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 17, textAlign: 'center', lineHeight: Platform.OS === 'web' ? 22 : undefined, marginTop: Platform.OS === 'web' ? -1 : 0 }}>💳</Text>
          </LinearGradient>
          <Text style={{ color: '#f8fafc', fontWeight: '800', fontSize: 17, letterSpacing: -0.3 }}>
            SubTrackr
          </Text>
        </TouchableOpacity>
 
        {/* Nav links — hidden on mobile */}
        {!isMobile && (
          <View className="flex-row gap-8 items-center">
            {NAV_LINKS.map(([id, lbl]) => (
              <Text
                key={id}
                onPress={() => scrollTo(id)}
                className="text-slate-400 text-sm font-medium"
                {...{ onMouseEnter: (e: any) => (e.target.style.color = '#f8fafc'), onMouseLeave: (e: any) => (e.target.style.color = '#94a3b8') } as any}
                style={IS_WEB ? { transition: 'color .2s', cursor: 'pointer' } as any : undefined}
              >
                {lbl}
              </Text>
            ))}
          </View>
        )}
 
        {/* CTA — more visible */}
        <TouchableOpacity onPress={goLogin} activeOpacity={0.85}>
          <LinearGradient
            colors={['#6366f1', '#4f46e5']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{
              paddingHorizontal: isMobile ? 14 : 20,
              paddingVertical: 10,
              borderRadius: 999,
            } as any}
          >
            <Text style={{ color: '#fff', fontSize: isMobile ? 13 : 14, fontWeight: '700', letterSpacing: 0.3 }}>
              {isMobile ? 'Sign In' : 'Get Started →'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        onScroll={e => setScrolled(e.nativeEvent.contentOffset.y > 60)}
        scrollEventThrottle={16}
      >
        <View
          className="items-center justify-center"
          style={{
            minHeight: '100vh' as any,
            paddingTop: isMobile ? 100 : 130,
            paddingBottom: 80,
            paddingHorizontal: isMobile ? 20 : 24,
          }}
        >
          {/* Badge */}
          <View
            className="flex-row items-center gap-2 px-4 py-2 bg-violet-500/[0.13] border border-violet-500/30 rounded-full mb-8 self-center"
            style={IS_WEB ? { animation: 'heroUp .7s ease both' } as any : undefined}
          >
            <View
              className="w-1.5 h-1.5 rounded-full bg-violet-400"
              style={IS_WEB ? { animation: 'badgePulse 2s infinite' } as any : undefined}
            />
            <Text className="text-violet-400 text-xs font-semibold tracking-[0.5px]">
              Now tracking 2.4M in subscriptions
            </Text>
          </View>

          {/* Title */}
          <View
            className="items-center mb-6"
            style={IS_WEB ? { animation: 'heroUp .7s ease .1s both' } as any : undefined}
          >
            <Text style={{
              color: '#f1f5f9',
              fontWeight: '800',
              fontSize: isMobile ? 40 : isTablet ? 52 : 64,
              letterSpacing: isMobile ? -1 : -2,
              lineHeight: isMobile ? 46 : isTablet ? 58 : 68,
              textAlign: 'center',
            }}>
              Stop bleeding
            </Text>
            <Text style={{
              fontWeight: '800',
              fontSize: isMobile ? 40 : isTablet ? 52 : 64,
              letterSpacing: isMobile ? -1 : -2,
              lineHeight: isMobile ? 46 : isTablet ? 58 : 68,
              textAlign: 'center',
              ...(IS_WEB ? {
                background: 'linear-gradient(135deg,#a78bfa 0%,#ec4899 55%,#06b6d4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              } : { color: '#a78bfa' }),
            } as any}>
              money monthly.
            </Text>
          </View>

          <Text
            className="text-slate-500 text-lg text-center max-w-[520px] leading-[28px] font-normal mb-11"
            style={IS_WEB ? { animation: 'heroUp .7s ease .2s both' } as any : undefined}
          >
            SubTrackr watches your subscriptions and tracks prices  alerting you before every charge and when deals hit.
          </Text>

          <View
            className="flex-row gap-3.5 flex-wrap justify-center mb-[72px]"
            style={IS_WEB ? { animation: 'heroUp .7s ease .3s both' } as any : undefined}
          >
            <GradientBtn label="Start saving for free " onPress={goLogin} />
            <GradientBtn label="See how it works" onPress={() => scrollTo('lp-features')} outline />
          </View>
        </View>

        <View
          className="flex-row flex-wrap border-t border-b border-slate-800 bg-slate-900"
        >
          {STATS.map(([num, lbl], i) => (
            <View key={i} className="flex-1 items-center py-[30px] border-r border-slate-800 min-w-[160px]">
              <Text className="text-indigo-400 font-extrabold text-3xl tracking-tight leading-9">
                {num}
              </Text>
              <Text className="text-slate-400 text-[13px] mt-1 font-medium">{lbl}</Text>
            </View>
          ))}
        </View>

        <View id="lp-features" className="px-10 py-20">
          <View className="max-w-[960px] w-full self-center items-center">
            <SectionLabel text="Features" />
            <Text className="text-slate-100 font-extrabold text-[44px] tracking-[-1.5px] leading-[50px] mb-4 text-center">
              {'Everything in one place.\nNothing slips through.'}
            </Text>
            <Text className="text-slate-400 text-base leading-[26px] max-w-[540px] mb-12 text-center">
              From Netflix to gym memberships  SubTrackr keeps every charge visible and under control.
            </Text>
            <View className="w-full gap-4">
              {FEATURES.map((f, i) => (
                <View
                  key={i}
                  className="flex-row items-center justify-between p-6 rounded-2xl bg-slate-800 border border-slate-700/80"
                >
                  <View className="flex-1 pr-6">
                    <Text className="text-slate-100 font-bold text-lg mb-1">{f.title}</Text>
                    <Text className="text-slate-400 text-sm leading-[22px]">{f.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View id="lp-how" className="px-10 py-24 bg-slate-900">
          <View className="max-w-[920px] self-center w-full items-center">
            <SectionLabel text="How it works" />
            <Text className="text-slate-100 font-extrabold text-[44px] tracking-[-1.5px] leading-[50px] text-center mb-3">
              Set it up in 2 minutes.
            </Text>
            <Text className="text-slate-400 text-base text-center mb-[72px]">
              Three steps and your subscription life is under control.
            </Text>

            <View className="w-full relative">
              <View style={{
                position: 'absolute', top: 28, left: '18%', right: '18%', height: 2,
                backgroundColor: '#334155',
              } as any} />
              <View className="flex-row gap-0 justify-between">
                <StepItem num="1" title="Add your subscriptions" desc="Enter each service with price and billing date. Takes 30 seconds per subscription." delay={0} />
                <StepItem num="2" title="Paste product links" desc="Copy any URL from Amazon or Skroutz. Set your target price and we handle the rest." delay={0.12} />
                <StepItem num="3" title="Relax and save" desc="We alert you before every charge and the moment prices drop. Sit back and save money." delay={0.24} />
              </View>
            </View>
          </View>
        </View>

        <View id="lp-pricing" className="px-10 py-24">
          <View className="max-w-[860px] self-center w-full items-center">
            <SectionLabel text="Pricing" />
            <Text className="text-slate-100 font-extrabold text-[44px] tracking-[-1.5px] leading-[50px] text-center mb-14">
              {'Start free.\nUpgrade when you\'re ready.'}
            </Text>
            <View className="flex-row flex-wrap gap-5 w-full">
              <PricingCard
                name="Free" price="€0" period="/ forever"
                desc="For people just getting started."
                features={['Up to 3 subscriptions', 'Up to 2 price trackers', 'In-app notifications', 'Basic spending chart']}
                dimmed={['Push notifications', 'Real-time price checks', 'Unlimited trackers']}
                onPress={goLogin}
              />
              <PricingCard
                name="Premium" price="€2.99" period="/ month"
                desc="For people serious about their finances."
                features={['Unlimited subscriptions', 'Unlimited price trackers', 'Real-time push notifications', 'Full analytics & charts', 'Hourly price checks', 'Savings report & export']}
                featured onPress={goLogin}
              />
            </View>
          </View>
        </View>

        <View className="px-10 py-24 bg-slate-900">
          <View className="max-w-[1080px] self-center w-full items-center">
            <SectionLabel text="Reviews" />
            <Text className="text-slate-100 font-extrabold text-[44px] tracking-[-1.5px] leading-[50px] text-center mb-14">
              People are saving real money.
            </Text>
            <View className="flex-row flex-wrap gap-5 justify-center w-full">
              <TestiCard quote="I had no idea I was paying for 4 streaming services. SubTrackr showed me in 2 minutes and I cancelled 2. Saving 25/month now." name="Nikos P." role="Software Engineer, Athens" emoji="👨‍💻" delay={0} />
              <TestiCard quote="The price tracker is insane. Watching a laptop for 3 months on Skroutz. Got the alert, bought it 180 cheaper." name="Maria K." role="Student, Thessaloniki" emoji="🎓" delay={0.1} />
              <TestiCard quote="Clean design, works perfectly. Billing reminders alone are worth it  no more surprise charges on my card." name="Dimitris V." role="Teacher, Patras" emoji="👨‍🏫" delay={0.2} />
            </View>
          </View>
        </View>

        <View className="px-10 py-24">
          <View
            className="max-w-[680px] self-center w-full items-center rounded-3xl p-14 border border-slate-700 bg-slate-800"
          >
            <Text className="text-slate-100 font-extrabold text-[40px] tracking-[-1.5px] leading-[46px] text-center mb-3.5">
              Ready to stop overpaying?
            </Text>
            <Text className="text-slate-400 text-base text-center mb-9">
              Join thousands of people who finally know where their money goes.
            </Text>
            <View className="flex-row gap-3.5 flex-wrap justify-center">
              <GradientBtn label="Create free account " onPress={goLogin} />
              <GradientBtn label="Sign in" onPress={goLogin} outline />
            </View>
          </View>
        </View>

        <View
          className="flex-row items-center justify-between flex-wrap gap-[18px] px-12 py-9 border-t border-slate-800 bg-slate-900"
        >
          <View className="flex-row items-center gap-2.5">
            <LinearGradient
              colors={['#6366f1', '#4f46e5']}
              className="w-[30px] h-[30px] rounded-lg items-center justify-center"
            >
              <Text className="text-sm">💳</Text>
            </LinearGradient>
            <Text className="text-slate-100 font-bold text-[15px]">SubTrackr</Text>
          </View>
          <View className="flex-row gap-7">
            <TouchableOpacity onPress={() => router.push('/privacy-policy')}>
              <Text className="text-slate-500 text-[13px] hover:text-slate-300" style={IS_WEB ? { transition: 'color .2s', cursor: 'pointer' } as any : undefined}>Privacy</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => router.push('/terms')}>
              <Text className="text-slate-500 text-[13px] hover:text-slate-300" style={IS_WEB ? { transition: 'color .2s', cursor: 'pointer' } as any : undefined}>Terms</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => window.open('mailto:legal@subtrackr.app')}>
              <Text className="text-slate-500 text-[13px] hover:text-slate-300" style={IS_WEB ? { transition: 'color .2s', cursor: 'pointer' } as any : undefined}>Contact</Text>
            </TouchableOpacity>
          </View>
          <Text className="text-slate-600 text-xs">© 2026 SubTrackr. All rights reserved.</Text>
        </View>

      </ScrollView>
    </View>
  );
}