import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const IS_WEB = Platform.OS === 'web';
const LAST_UPDATED  = 'March 2025';
const CONTACT_EMAIL = 'legal@subtrackr.app';
const APP_NAME      = 'SubTrackr';

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

export default function TermsScreen() {
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
            Terms of Service
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
            <Text style={{ fontSize: 36, marginBottom: 8 }}>📋</Text>
            <Text style={{ color: '#f1f5f9', fontSize: 20, fontWeight: '800', marginBottom: 4 }}>
              Terms of Service
            </Text>
            <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
              Please read these terms carefully before using {APP_NAME}.{'\n'}
              Last updated: {LAST_UPDATED}
            </Text>
          </View>

          <Section title="1. Acceptance of Terms">
            <P>
              By accessing or using {APP_NAME} ("the Service", "the App"), you agree to be bound
              by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use
              the Service.
            </P>
            <P>
              These Terms constitute a legally binding agreement between you and SubTrackr.
               We reserve the right to modify these Terms at any time. Continued
              use of the Service after changes constitutes acceptance of the updated Terms.
            </P>
          </Section>

          <Section title="2. Eligibility">
            <Bullet>You must be at least 16 years of age to use {APP_NAME}.</Bullet>
            <Bullet>You must provide accurate, current, and complete information during registration.</Bullet>
            <Bullet>You are responsible for maintaining the confidentiality of your account credentials.</Bullet>
            <Bullet>You may not create multiple accounts for the purpose of circumventing usage limits.</Bullet>
            <Bullet>You are responsible for all activity that occurs under your account.</Bullet>
          </Section>

          <Section title="3. The Service">
            <P>
              {APP_NAME} provides the following features:
            </P>
            <Bullet>Manual subscription tracking and billing reminders</Bullet>
            <Bullet>Automated price monitoring of product URLs via web scraping</Bullet>
            <Bullet>Gmail inbox scanning for automatic subscription detection (read-only, optional)</Bullet>
            <Bullet>AI-assisted email drafting for subscription management</Bullet>
            <Bullet>Anonymous aggregate platform statistics</Bullet>
            <P>
              The Service is provided on an "as is" and "as available" basis. We make no warranty
              that the Service will be uninterrupted, error-free, or that all product URLs submitted
              for price tracking will be successfully scraped at all times.
            </P>
          </Section>

          <Section title="4. Free Plan & Premium Subscription">
            <P><Bold>Free Plan</Bold></P>
            <Bullet>Up to 3 subscriptions (lifetime creation limit)</Bullet>
            <Bullet>Up to 2 price trackers (lifetime creation limit)</Bullet>
            <Bullet>Price checks twice daily (08:00 and 20:00)</Bullet>
            <Bullet>All notification types included</Bullet>

            <P><Bold>Premium Plan</Bold></P>
            <Bullet>Unlimited subscriptions and price trackers</Bullet>
            <Bullet>Hourly price checks</Bullet>
            <Bullet>All Free features plus priority processing</Bullet>

            <P><Bold>Billing</Bold></P>
            <Bullet>
              Premium is billed as a recurring subscription. The current price is displayed
              at checkout. Prices are shown in EUR; USD and GBP users are charged at the
              equivalent rate via Stripe currency conversion.
            </Bullet>
            <Bullet>
              You may cancel your Premium subscription at any time via Stripe's customer portal.
              Cancellation takes effect at the end of the current billing period — you retain
              Premium access until that date.
            </Bullet>
            <Bullet>
              We do not offer refunds for partial billing periods, except where required by
              applicable law (including the EU Consumer Rights Directive 14-day cooling-off period
              for digital services where applicable).
            </Bullet>
          </Section>

          <Section title="5. Acceptable Use">
            <P>You agree not to:</P>
            <Bullet>Use the Service for any unlawful purpose or in violation of any applicable law</Bullet>
            <Bullet>
              Attempt to circumvent the freemium limits by creating multiple accounts, deleting
              and recreating trackers/subscriptions, or any similar method
            </Bullet>
            <Bullet>Submit URLs that are illegal, violate third-party rights, or contain malicious content</Bullet>
            <Bullet>Attempt to reverse-engineer, decompile, or extract source code from the Service</Bullet>
            <Bullet>Use the Service to conduct automated bulk scraping beyond normal personal use</Bullet>
            <Bullet>Interfere with or disrupt the infrastructure, servers, or networks connected to the Service</Bullet>
            <Bullet>Impersonate any person or entity or misrepresent your affiliation with any person or entity</Bullet>
          </Section>

          <Section title="6. Price Tracking & Web Scraping">
            <P>
              SubTrackr's price tracking feature works by periodically fetching publicly accessible
              product pages to extract price information.
            </P>
            <Bullet>
              We make reasonable efforts to keep price data accurate but cannot guarantee
              accuracy at all times. Prices displayed are informational only.
            </Bullet>
            <Bullet>
              You are responsible for verifying the current price before making any purchase
              decision. SubTrackr is not liable for any purchase made based on price data
              displayed in the app.
            </Bullet>
            <Bullet>
              Some websites may block or limit automated access. We cannot guarantee that all
              submitted URLs will be tracked successfully.
            </Bullet>
            <Bullet>
              Affiliate links may be appended to product URLs. See our Privacy Policy for details.
              These do not affect the price you pay.
            </Bullet>
          </Section>

          <Section title="7. Gmail Integration">
            <P>
              The Gmail import feature is entirely optional. By connecting your Gmail account:
            </P>
            <Bullet>You authorise SubTrackr to access your Gmail inbox with read-only permission solely for the purpose of detecting subscription-related emails.</Bullet>
            <Bullet>You may revoke this access at any time via your Google Account settings.</Bullet>
            <Bullet>SubTrackr's use of Gmail data is strictly limited to the Gmail import feature and does not serve any other purpose.</Bullet>
          </Section>

          <Section title="8. AI-Generated Content">
            <P>
              The Email Drafter feature uses the Groq API (powered by Llama) to generate email
              draft suggestions. By using this feature:
            </P>
            <Bullet>You acknowledge that AI-generated text may not always be accurate, appropriate, or suitable for your specific situation.</Bullet>
            <Bullet>You are solely responsible for reviewing and editing any AI-generated email before sending it.</Bullet>
            <Bullet>SubTrackr is not responsible for outcomes resulting from emails sent based on our AI-generated drafts.</Bullet>
            <Bullet>Basic subscription details (name, amount, billing cycle) are sent to Groq's API. Do not include sensitive personal data in the context field.</Bullet>
          </Section>

          <Section title="9. Intellectual Property">
            <P>
              All content, design, code, trademarks, and intellectual property within SubTrackr
              are owned by SubTrackr or its licensors. You are granted a limited, non-exclusive,
              non-transferable licence to use the Service for personal, non-commercial purposes.
            </P>
            <P>
              You retain ownership of any data you input into SubTrackr (subscription names,
              amounts, notes). By using the Service, you grant us a limited licence to process
              that data solely for the purpose of providing the Service.
            </P>
          </Section>

          <Section title="10. Disclaimer of Warranties">
            <P>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE IS PROVIDED
              "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
              LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
              AND NON-INFRINGEMENT.
            </P>
            <P>
              We do not warrant that: (a) the Service will meet your requirements; (b) the
              Service will be uninterrupted, timely, or error-free; (c) price data will be
              accurate or current; or (d) any defects in the Service will be corrected.
            </P>
          </Section>

          <Section title="11. Limitation of Liability">
            <P>
              TO THE FULLEST EXTENT PERMITTED BY LAW, SUBTRACKR SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS
              OF PROFITS OR REVENUE, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.
            </P>
            <P>
              Our total liability to you for any claim arising out of or relating to these Terms
              or the Service shall not exceed the amount you paid to SubTrackr in the 12 months
              preceding the claim, or €10, whichever is greater.
            </P>
            <P>
              Nothing in these Terms excludes or limits our liability for death or personal injury
              caused by negligence, fraud, or any other liability that cannot be excluded by law.
            </P>
          </Section>

          <Section title="12. Account Termination">
            <P>
              You may delete your account at any time from within the app (Settings → Account →
              Delete Account). This permanently removes all your data.
            </P>
            <P>
              We reserve the right to suspend or terminate your account, without prior notice,
              if you: (a) breach these Terms; (b) engage in fraudulent or abusive behaviour;
              (c) attempt to circumvent usage limits or payment obligations.
            </P>
            <P>
              If we terminate your account for reasons other than breach of Terms, we will
              provide reasonable notice and refund any unused prepaid Premium fees on a
              pro-rata basis.
            </P>
          </Section>

          <Section title="13. Governing Law & Disputes">
            <P>
              These Terms are governed by the laws of Greece and the European Union. Any dispute
              arising out of or relating to these Terms shall first be subject to good-faith
              negotiation. If unresolved, disputes shall be submitted to the competent courts
              of Athens, Greece.
            </P>
            <P>
              EU consumers have the right to use the European Commission's Online Dispute
              Resolution platform at <Bold>ec.europa.eu/odr</Bold>.
            </P>
          </Section>

          <Section title="14. Changes to These Terms">
            <P>
              We may update these Terms at any time. When we make material changes, we will
              notify you by email (if enabled) and display a notice in the app. The updated
              Terms will be effective 14 days after notification. If you do not agree to the
              changes, you may delete your account before the effective date.
            </P>
          </Section>

          <Section title="15. Contact">
            <P>
              For questions about these Terms:
            </P>
            <Bullet>Email: <Bold>{CONTACT_EMAIL}</Bold></Bullet>
            <Bullet>Response time: within 5 business days</Bullet>
          </Section>

          <View style={{
            backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.06)', borderRadius: 16,
            padding: 16, marginTop: 8,
          }}>
            <Text style={{ color: '#334155', fontSize: 11, textAlign: 'center', lineHeight: 18 }}>
              SubTrackr Terms of Service · Last updated {LAST_UPDATED}{'\n'}
              Governed by Greek law and EU Consumer Protection regulations.
            </Text>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}