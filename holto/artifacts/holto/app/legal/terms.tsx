import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
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

export default function TermsScreen() {
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
          <Icon name="file-text" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.headline, { color: colors.foreground }]}>Terms of Service</Text>
        <Text style={[styles.subline, { color: colors.mutedForeground }]}>
          Last updated: June 2025
        </Text>
      </View>

      <Para>
        Welcome to HOLTO. By downloading, accessing, or using the HOLTO mobile application or any associated services provided by HOLTO Travel Ltd ("HOLTO", "we", "us", or "our"), you agree to be bound by these Terms of Service. Please read them carefully before use.
      </Para>

      <Section title="1. About HOLTO">
        <Para>
          HOLTO is a travel companion application that provides real-time flight tracking, disruption assistance, EU261 rights guidance, and relocation information for travellers and expats. HOLTO Travel Ltd is a company registered in England & Wales. Our website is holtotravel.co.uk.
        </Para>
      </Section>

      <Section title="2. Eligibility">
        <Para>
          You must be at least 16 years old to use HOLTO. By using the app, you represent and warrant that you have the legal capacity to enter into these Terms.
        </Para>
      </Section>

      <Section title="3. User Accounts">
        <Para>
          To access certain features, you must create an account. You are responsible for:
        </Para>
        <Bullet>Keeping your login credentials secure and confidential</Bullet>
        <Bullet>All activity that occurs under your account</Bullet>
        <Bullet>Notifying us immediately of any unauthorised use at hello@holtotravel.com</Bullet>
        <Para>
          We reserve the right to suspend or terminate accounts that violate these Terms.
        </Para>
      </Section>

      <Section title="4. Subscription Plans & Payments">
        <Para>
          HOLTO offers paid plans processed securely via Stripe:
        </Para>
        <Bullet>Free — no charge, basic features</Bullet>
        <Bullet>Trip Pass — one-time payment for 7 days of full access</Bullet>
        <Bullet>Holto Pro Monthly — recurring monthly subscription</Bullet>
        <Bullet>Holto Pro Annual — recurring annual subscription</Bullet>
        <Para>
          All prices are shown in GBP inclusive of applicable taxes. Subscriptions auto-renew unless cancelled before the renewal date. You may cancel at any time through the Stripe billing portal accessible from the Account tab. Refunds are handled in accordance with applicable UK consumer law.
        </Para>
      </Section>

      <Section title="5. Acceptable Use">
        <Para>
          You agree not to:
        </Para>
        <Bullet>Use HOLTO for any unlawful purpose or in violation of any regulations</Bullet>
        <Bullet>Attempt to reverse-engineer, decompile, or tamper with the app</Bullet>
        <Bullet>Use automated tools to scrape, crawl, or extract data from the service</Bullet>
        <Bullet>Impersonate other users or third parties</Bullet>
        <Bullet>Share your account credentials with others</Bullet>
      </Section>

      <Section title="6. Accuracy of Information">
        <Para>
          HOLTO provides flight status and travel information sourced from third-party data providers. While we strive for accuracy, we cannot guarantee that all information is complete, current, or error-free. Flight status, compensation eligibility, and legal guidance should be independently verified before taking action. Nothing in the app constitutes legal advice.
        </Para>
      </Section>

      <Section title="7. Intellectual Property">
        <Para>
          All content, trademarks, logos, designs, and software within the HOLTO app are owned by or licensed to HOLTO Travel Ltd. You may not reproduce, distribute, or create derivative works without our express written permission.
        </Para>
      </Section>

      <Section title="8. Third-Party Services">
        <Para>
          HOLTO integrates with third-party services including Stripe (payments), OpenAI (AI responses), and aviation data providers. Your use of these services is also subject to their respective terms and policies. We are not responsible for the availability or accuracy of third-party services.
        </Para>
      </Section>

      <Section title="9. Limitation of Liability">
        <Para>
          To the fullest extent permitted by applicable law, HOLTO Travel Ltd shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of, or inability to use, the app or its content. Our aggregate liability shall not exceed the amount you paid for the service in the 12 months preceding the claim.
        </Para>
      </Section>

      <Section title="10. Changes to These Terms">
        <Para>
          We may update these Terms from time to time. We will notify you of material changes by updating the date at the top of this page and, where appropriate, by in-app notification. Continued use of HOLTO after changes constitutes your acceptance of the updated Terms.
        </Para>
      </Section>

      <Section title="11. Governing Law">
        <Para>
          These Terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.
        </Para>
      </Section>

      <Section title="12. Contact Us">
        <Para>
          If you have any questions about these Terms, please contact us at hello@holtotravel.com or write to us at HOLTO Travel Ltd, United Kingdom.
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
