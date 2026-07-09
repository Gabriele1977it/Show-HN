import { LinearGradient } from "expo-linear-gradient";
import { Redirect, router } from "expo-router";
import React from "react";
import {
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const LOGO = require("@/assets/images/holto-logo.png");

export default function WelcomeScreen() {
  const { user, isLoading } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom;

  if (isLoading) return null;
  if (user) return <Redirect href="/(tabs)" />;

  return (
    <LinearGradient
      colors={["#0A2E38", "#0C3844", "#0E4252"]}
      style={styles.gradient}
    >
      <StatusBar barStyle="light-content" />

      <View
        style={[
          styles.container,
          { paddingTop: topPad + 32, paddingBottom: bottomPad + 24 },
        ]}
      >
        <Animated.View entering={FadeIn.duration(700)} style={styles.top}>
          <View style={styles.logoPill}>
            <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
          </View>

          <View style={[styles.tagline, { borderLeftColor: colors.gold }]}>
            <Text style={styles.taglineText}>Travel. Relocate. Live Better Abroad.</Text>
          </View>

          <Animated.Text
            entering={FadeInDown.delay(200).duration(700)}
            style={styles.headline}
          >
            {"Your companion\nfrom take-off to\nliving abroad."}
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(400).duration(700)}
            style={styles.subhead}
          >
            Real-time flight tracking, disruption support, and honest guidance for every step of your journey — from the airport to a new life abroad.
          </Animated.Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(600).duration(600)}
          style={styles.bottom}
        >
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: colors.teal,
                borderRadius: colors.radius,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
            onPress={() => router.push("/(auth)/register")}
            accessibilityRole="button"
            accessibilityLabel="Get started"
          >
            <Text style={styles.primaryBtnText}>Get started — it's free</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              { opacity: pressed ? 0.65 : 1 },
            ]}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.secondaryBtnText}>
              Already have an account →
            </Text>
          </Pressable>

          <View style={styles.pillRow}>
            <Pill label="Live flight status" />
            <Pill label="Disruption support" />
            <Pill label="Relocation guides" />
          </View>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logoPill: {
    alignSelf: "flex-start",
    backgroundColor: "#F5F0EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  logoImage: {
    width: 190,
    height: 63,
  },
  gradient: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  top: { flex: 1, justifyContent: "center" },
  tagline: {
    borderLeftWidth: 2,
    paddingLeft: 12,
    marginTop: 24,
    marginBottom: 22,
  },
  taglineText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(244,247,248,0.45)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  headline: {
    fontFamily: "Inter_700Bold",
    fontSize: 36,
    color: "#F4F7F8",
    lineHeight: 45,
    marginBottom: 18,
    letterSpacing: -0.4,
  },
  subhead: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(244,247,248,0.6)",
    lineHeight: 24,
    maxWidth: 310,
  },
  bottom: { gap: 0 },
  primaryBtn: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  primaryBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: "#fff",
    letterSpacing: 0.1,
  },
  secondaryBtn: {
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  secondaryBtnText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(244,247,248,0.55)",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  pill: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
  },
});
