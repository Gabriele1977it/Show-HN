import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";

import { useColors } from "@/hooks/useColors";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {children}
    </View>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text style={[styles.para, { color: colors.mutedForeground }]}>{children}</Text>
  );
}

function Bullet({ children }: { children: string }) {
  const colors = useColors();
  return (
    <View style={styles.bulletRow}>
      <Text style={[styles.bulletDot, { color: colors.primary }]}>•</Text>
      <Text style={[styles.bulletText, { color: colors.mutedForeground }]}>{children}</Text>
    </View>
  );
}

export default function PrivacyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: topPad, paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + "18" }]}>
          <Icon name="shield" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.headline, { color: colors.foreground }]}>Privacy Policy</Text>
        <Text style={[styles.subline, { color: colors.mutedForeground }]}>
          Last updated: June 2025
        </Text>
      </View>

      <Para>
        HOLTO Travel Ltd ("HOLTO", "we", "us", "our") is committed to protecting your personal data. This Privacy Policy explains how we collect, use, and safeguard information when you use the HOLTO mobile application and related services. We comply with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
      </Para>

      <Section title="1. Data Controller">
        <Para>
          HOLTO Travel Ltd is the data controller for personal data processed through the HOLTO app. If you have any questions about how we handle your data, contact us at hello@holtotravel.com.
        </Para>
      </Section>

      <Section title="2. Data We Collect">
        <Para>We collect the following categories of personal data:</Para>
        <Bullet>Account data: your name and email address when you register</Bullet>
        <Bullet>Usage data: flight searches, disruption reports, and features used within the app</Bullet>
        <Bullet>Location data: approximate location (with your permission) to find nearby services via Ask HOLTO</Bullet>
        <Bullet>Payment data: handled entirely by Stripe — we never store card details</Bullet>
        <Bullet>Technical data: device type, app version, IP address, and crash logs for debugging</Bullet>
        <Bullet>Communications: messages you send to our support team</Bullet>
      </Section>

      <Section title="3. How We Use Your Data">
        <Para>We process your personal data for the following purposes:</Para>
        <Bullet>Providing and improving the HOLTO service (contractual necessity)</Bullet>
        <Bullet>Processing payments and managing your subscription (contractual necessity)</Bullet>
        <Bullet>Personalising AI responses to your travel context (legitimate interests)</Bullet>
        <Bullet>Sending important service notifications such as changes to your plan (legitimate interests)</Bullet>
        <Bullet>Complying with legal obligations</Bullet>
        <Bullet>Fraud prevention and security (legitimate interests)</Bullet>
      </Section>

      <Section title="4. Third-Party Services">
        <Para>
          We share limited data with trusted third-party providers:
        </Para>
        <Bullet>Stripe — payment processing; their Privacy Policy applies to payment data</Bullet>
        <Bullet>OpenAI — processes your Ask HOLTO queries to generate AI responses; queries may be sent to OpenAI's API but are not used to train models under our business agreement</Bullet>
        <Bullet>Aviation data providers — receive flight numbers to return live status data</Bullet>
        <Bullet>Hosting infrastructure — our servers are hosted on secure cloud infrastructure in the EU/UK</Bullet>
        <Para>
          We do not sell your personal data to third parties.
        </Para>
      </Section>

      <Section title="5. Location Data">
        <Para>
          When you use the Ask HOLTO feature, we may request your device location to find nearby places relevant to your query. Location access is optional — Ask HOLTO works without it but results may be less localised. Your location is used only for the duration of the query and is not stored.
        </Para>
      </Section>

      <Section title="6. Data Retention">
        <Para>
          We retain your account data for as long as your account is active. If you delete your account, we will erase your personal data within 30 days, except where we are required to retain records for legal, tax, or regulatory purposes (typically up to 7 years for financial records).
        </Para>
      </Section>

      <Section title="7. Your Rights">
        <Para>Under UK GDPR, you have the right to:</Para>
        <Bullet>Access the personal data we hold about you</Bullet>
        <Bullet>Correct inaccurate data</Bullet>
        <Bullet>Request deletion of your data ("right to be forgotten")</Bullet>
        <Bullet>Object to or restrict certain processing</Bullet>
        <Bullet>Data portability — receive your data in a machine-readable format</Bullet>
        <Bullet>Withdraw consent where processing is based on consent</Bullet>
        <Para>
          To exercise any of these rights, email hello@holtotravel.com. We will respond within 30 days. You also have the right to lodge a complaint with the Information Commissioner's Office (ICO) at ico.org.uk.
        </Para>
      </Section>

      <Section title="8. Cookies & Tracking">
        <Para>
          The HOLTO mobile app does not use tracking cookies. We use analytics data solely to improve performance and fix bugs. The web version of HOLTO may use essential cookies to maintain your session.
        </Para>
      </Section>

      <Section title="9. Security">
        <Para>
          We implement appropriate technical and organisational measures to protect your data, including encrypted data in transit (TLS), hashed passwords, and access controls. No system is completely secure, and we encourage you to use a strong, unique password for your account.
        </Para>
      </Section>

      <Section title="10. Children's Privacy">
        <Para>
          HOLTO is not directed at children under 16. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us so we can delete it.
        </Para>
      </Section>

      <Section title="11. Changes to This Policy">
        <Para>
          We may update this Privacy Policy periodically. We will notify you of significant changes via the app or email. The date at the top of this page reflects the most recent revision.
        </Para>
      </Section>

      <Section title="12. Contact">
        <Para>
          For any privacy-related queries or to exercise your rights, contact our team at hello@holtotravel.com. We aim to respond to all requests within 30 days.
        </Para>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 22,
    gap: 4,
  },
  hero: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 20,
    gap: 10,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  headline: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  subline: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  section: {
    marginTop: 18,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  para: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 10,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 15,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
});
