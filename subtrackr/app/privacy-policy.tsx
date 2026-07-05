import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const IS_WEB = Platform.OS === 'web';
const LAST_UPDATED = 'March 2025';
const CONTACT_EMAIL = 'privacy@subtrackr.app';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 28 }}>
      <Text style={{
        color: '#a5b4fc', fontSize: 13, fontWeight: '700',
        letterSpacing: 0.5, marginBottom: 10,
      }}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ color: '#94a3b8', fontSize: 13, lineHeight: 22, marginBottom: 10 }}>
      {children}
    </Text>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8, paddingLeft: 4 }}>
      <Text style={{ color: '#6366F1', fontSize: 13, marginTop: 4 }}>•</Text>
      <Text style={{ color: '#94a3b8', fontSize: 13, lineHeight: 22, flex: 1 }}>{children}</Text>
    </View>
  );
}

function Bold({ children }: { children: string }) {
  return <Text style={{ color: '#cbd5e1', fontWeight: '700' }}>{children}</Text>;
}

export default function PrivacyPolicyScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>

      {/* Header */}
      <View style={{
        backgroundColor: '#020617', borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
        paddingTop: IS_WEB ? 0 : (Platform.OS === 'ios' ? 56 : 52),
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: 'rgba(255,255,255,0.06)',
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
            }}
            activeOpacity={0.7}
          >
            <Text style={{ color: '#94a3b8', fontSize: 15 }}>‹</Text>
            <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '600' }}>Back</Text>
          </TouchableOpacity>
          <Text style={{
            flex: 1, color: '#f1f5f9', fontSize: 17, fontWeight: '800',
            textAlign: 'center', marginRight: 64,
          }}>
            Privacy Policy
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        <LinearGradient colors={['#130826', '#020617']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120 }} />

        <View style={{
          maxWidth: IS_WEB ? 720 : undefined,
          alignSelf: IS_WEB ? 'center' : undefined,
          width: '100%',
          paddingHorizontal: IS_WEB ? 40 : 20,
          paddingTop: 28,
        }}>

          {/* Hero */}
          <View style={{
            backgroundColor: 'rgba(99,102,241,0.08)', borderWidth: 1,
            borderColor: 'rgba(99,102,241,0.2)', borderRadius: 20,
            padding: 20, marginBottom: 32, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🔒</Text>
            <Text style={{ color: '#f1f5f9', fontSize: 20, fontWeight: '800', marginBottom: 4 }}>
              Your privacy matters
            </Text>
            <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
              SubTrackr is built on the principle that your financial data belongs to you.{'\n'}
              Last updated: {LAST_UPDATED}
            </Text>
          </View>

          <Section title="1. Who We Are">
            <P>
              SubTrackr is a subscription and price tracking service operated by
              SubTrackr. Our service is accessible at <Bold>app.subtrackr.io</Bold> and through our
              mobile applications. For privacy-related enquiries, contact us at{' '}
              <Bold>{CONTACT_EMAIL}</Bold>.
            </P>
            <P>
              We are committed to compliance with the EU General Data Protection Regulation (GDPR),
              the UK GDPR, and applicable data protection laws in all jurisdictions where we operate.
            </P>
          </Section>

          <Section title="2. Data We Collect">
            <P><Bold>Account data</Bold> — when you register:</P>
            <Bullet>Full name and email address</Bullet>
            <Bullet>Bcrypt-hashed password (we never store plaintext passwords)</Bullet>
            <Bullet>Account creation timestamp and plan type (Free or Premium)</Bullet>
            <Bullet>Optional: profile avatar (stored as base64 in our database)</Bullet>

            <P><Bold>Subscription data</Bold> — data you enter manually or import:</P>
            <Bullet>Service name, amount, billing cycle, next billing date</Bullet>
            <Bullet>Category, colour preference, and optional description</Bullet>
            <Bullet>Pause/active status</Bullet>

            <P><Bold>Price tracker data</Bold> — when you add a product to track:</P>
            <Bullet>The product URL you submit</Bullet>
            <Bullet>Target price you set</Bullet>
            <Bullet>Price history scraped from the product page over time</Bullet>

            <P><Bold>Technical data</Bold> — collected automatically:</P>
            <Bullet>Firebase Cloud Messaging (FCM) device token for push notifications (optional)</Bullet>
            <Bullet>JWT access and refresh tokens (stored locally on your device only)</Bullet>
            <Bullet>Server-side logs for error monitoring (no personal identifiers beyond email)</Bullet>

            <P><Bold>Payment data</Bold> — if you subscribe to Premium:</P>
            <Bullet>Stripe handles all payment processing. We store only your Stripe Customer ID.</Bullet>
            <Bullet>We never see, store, or process your card number, CVV, or full billing address.</Bullet>
          </Section>

          <Section title="3. Gmail Import (Optional)">
            <P>
              If you choose to use our Gmail import feature, you will be asked to grant SubTrackr
              read-only access to your Gmail inbox via Google OAuth.
            </P>
            <Bullet>We request <Bold>read-only</Bold> scope — we cannot send, delete, or modify emails.</Bullet>
            <Bullet>
              Access tokens are used only during your active import session and are
              <Bold> never stored</Bold> on our servers.
            </Bullet>
            <Bullet>
              We scan up to 30 recent billing/receipt emails to detect subscription names and amounts.
              Full email content is processed in-memory and immediately discarded.
            </Bullet>
            <Bullet>
              You can revoke Gmail access at any time at{' '}
              <Bold>myaccount.google.com/permissions</Bold>.
            </Bullet>
            <P>
              Our use of Google APIs complies with the{' '}
              <Bold>Google API Services User Data Policy</Bold>, including the Limited Use requirements.
            </P>
          </Section>

          <Section title="4. How We Use Your Data">
            <Bullet>To provide, operate, and improve SubTrackr's core features</Bullet>
            <Bullet>To send billing reminders 2 days before each upcoming charge</Bullet>
            <Bullet>To send price-drop alerts when a tracked product hits your target price</Bullet>
            <Bullet>To send a daily digest email (only if you enable email notifications)</Bullet>
            <Bullet>To process Premium subscription payments via Stripe</Bullet>
            <Bullet>
              To generate <Bold>anonymous, aggregate platform statistics</Bold> (average spending,
              popular services) — no individual data is ever exposed in these insights
            </Bullet>
            <Bullet>To send a welcome email upon registration via Brevo (Sendinblue)</Bullet>
            <P>
              We <Bold>never</Bold> sell your personal data to third parties. We do not use your
              data for advertising profiling or behavioural tracking.
            </P>
          </Section>

          <Section title="5. Affiliate Links">
            <P>
              When you click "Buy Now" on a price-tracked product, the link may contain an
              affiliate tracking tag. If you make a purchase through this link, SubTrackr may
              earn a small commission from the retailer at no additional cost to you.
            </P>
            <Bullet>The product price is identical whether you use our link or not.</Bullet>
            <Bullet>Affiliate tags are appended automatically to supported retailer URLs.</Bullet>
            <Bullet>We participate in programmes including Amazon Associates, Skroutz Partner, and Awin.</Bullet>
          </Section>

          <Section title="6. Third-Party Services">
            <P>We use the following sub-processors. Each has been evaluated for GDPR compliance:</P>
            <Bullet><Bold>Stripe</Bold> — payment processing (PCI DSS Level 1 certified). Privacy: stripe.com/privacy</Bullet>
            <Bullet><Bold>Firebase / Google</Bold> — push notifications. Privacy: firebase.google.com/support/privacy</Bullet>
            <Bullet><Bold>Brevo (Sendinblue)</Bold> — transactional email delivery. Privacy: brevo.com/legal/privacypolicy</Bullet>
            <Bullet><Bold>Railway</Bold> — cloud infrastructure hosting. Privacy: railway.app/legal/privacy</Bullet>
            <Bullet><Bold>Groq</Bold> — AI email draft generation (optional feature). Your subscription details are sent to Groq's API only when you use the Email Drafter. Privacy: groq.com/privacy</Bullet>
            <Bullet><Bold>Supabase / PostgreSQL</Bold> — database hosting in the EU region</Bullet>
          </Section>

          <Section title="7. Data Retention">
            <Bullet>Active account data is retained for as long as your account exists.</Bullet>
            <Bullet>Read notifications older than 30 days are automatically deleted.</Bullet>
            <Bullet>Expired refresh tokens are purged weekly by our maintenance job.</Bullet>
            <Bullet>Price history is retained for the lifetime of your tracker.</Bullet>
            <Bullet>
              When you delete your account, all associated data (subscriptions, trackers,
              notifications, spending snapshots) is permanently deleted within 24 hours via
              cascading database deletion.
            </Bullet>
          </Section>

          <Section title="8. Your Rights (GDPR)">
            <P>
              If you are located in the European Economic Area or the United Kingdom, you have the
              following rights under GDPR / UK GDPR:
            </P>
            <Bullet><Bold>Right of access</Bold> — request a copy of all data we hold about you</Bullet>
            <Bullet><Bold>Right to rectification</Bold> — correct inaccurate personal data</Bullet>
            <Bullet><Bold>Right to erasure</Bold> — delete your account and all associated data (available directly in the app under Settings → Account → Delete Account)</Bullet>
            <Bullet><Bold>Right to data portability</Bold> — receive your data in a structured, machine-readable format</Bullet>
            <Bullet><Bold>Right to restrict processing</Bold> — limit how we use your data in certain circumstances</Bullet>
            <Bullet><Bold>Right to object</Bold> — object to processing based on our legitimate interests</Bullet>
            <P>
              To exercise any right, email us at <Bold>{CONTACT_EMAIL}</Bold>. We will respond
              within 30 days. You also have the right to lodge a complaint with your national data
              protection authority (in Greece: <Bold>hellenic-dpa.gr</Bold>).
            </P>
          </Section>

          <Section title="9. Cookies & Local Storage">
            <P>
              SubTrackr does not use advertising or tracking cookies.
            </P>
            <Bullet>Your JWT access and refresh tokens are stored in <Bold>AsyncStorage</Bold> (mobile) or <Bold>localStorage</Bold> (web) on your own device.</Bullet>
            <Bullet>Local preferences (notification settings, display currency) are stored locally and never transmitted to our servers.</Bullet>
            <Bullet>No third-party tracking scripts, analytics SDKs, or advertising pixels are present in SubTrackr.</Bullet>
          </Section>

          <Section title="10. Children's Privacy">
            <P>
              SubTrackr is not directed at children under the age of 16. We do not knowingly
              collect personal data from children. If you believe a child has provided us with
              personal information, please contact us at <Bold>{CONTACT_EMAIL}</Bold> and we will
              delete it promptly.
            </P>
          </Section>

          <Section title="11. Changes to This Policy">
            <P>
              We may update this Privacy Policy from time to time. When we make material changes,
              we will notify you by email (if you have email notifications enabled) and update the
              "Last updated" date at the top of this page. Continued use of SubTrackr after changes
              constitutes acceptance of the updated policy.
            </P>
          </Section>

          <Section title="12. Contact">
            <P>
              For all privacy-related questions, data access requests, or complaints:
            </P>
            <Bullet>Email: <Bold>{CONTACT_EMAIL}</Bold></Bullet>
            <Bullet>Response time: within 30 days for all GDPR-related requests</Bullet>
          </Section>

          <View style={{
            backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.06)', borderRadius: 16,
            padding: 16, marginTop: 8,
          }}>
            <Text style={{ color: '#334155', fontSize: 11, textAlign: 'center', lineHeight: 18 }}>
              SubTrackr Privacy Policy · Last updated {LAST_UPDATED}{'\n'}
              This policy is governed by Greek and EU law.
            </Text>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}