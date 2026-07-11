import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/Icon";

export const ONBOARDED_KEY = "holto_onboarded";

interface Slide {
  icon: IconName;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: "radio",
    title: "Never travel blind",
    body: "Track any flight and get a heads-up the moment something changes — delays, gate changes, cancellations — even when the app is closed.",
  },
  {
    icon: "shield",
    title: "Know what you're owed",
    body: "HOLTO checks your flight against EU261 and UK261 rules, then helps you claim the compensation and care you're actually entitled to.",
  },
  {
    icon: "home",
    title: "Life beyond the flight",
    body: "Compare the real cost of living in cities worldwide and get honest, no-pressure guidance if you're dreaming of a move abroad.",
  },
];

async function finish() {
  try {
    await AsyncStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    // Non-fatal: worst case the user sees onboarding again.
  }
  router.replace("/(tabs)");
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const slideWidth = Math.min(width, 560);
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const topPad = Platform.OS === "web" ? 40 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom + 20;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
    if (next !== page) setPage(next);
  };

  const goNext = () => {
    if (page >= SLIDES.length - 1) {
      void finish();
      return;
    }
    const next = page + 1;
    scrollRef.current?.scrollTo({ x: next * slideWidth, animated: true });
    setPage(next);
  };

  const isLast = page === SLIDES.length - 1;

  return (
    <LinearGradient colors={["#0A2E38", "#0C3844", "#0E4252"]} style={styles.gradient}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.container, { paddingTop: topPad + 8, paddingBottom: bottomPad }]}>
        <View style={styles.skipRow}>
          <Pressable onPress={() => void finish()} hitSlop={12} accessibilityRole="button">
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.pagerWrap}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
            onScroll={onScroll}
            scrollEventThrottle={16}
            style={{ width: slideWidth }}
          >
            {SLIDES.map((s) => (
              <View key={s.title} style={[styles.slide, { width: slideWidth }]}>
                <Animated.View entering={FadeIn.duration(500)} style={styles.iconBadge}>
                  <Icon name={s.icon} size={40} color="#C9A24B" />
                </Animated.View>
                <Text style={styles.title}>{s.title}</Text>
                <Text style={styles.body}>{s.body}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.bottom}>
          <View style={styles.dots}>
            {SLIDES.map((s, i) => (
              <View
                key={s.title}
                style={[
                  styles.dot,
                  {
                    width: i === page ? 22 : 7,
                    backgroundColor: i === page ? "#C9A24B" : "rgba(255,255,255,0.25)",
                  },
                ]}
              />
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.88 : 1 }]}
            onPress={goNext}
            accessibilityRole="button"
            accessibilityLabel={isLast ? "Start using HOLTO" : "Next"}
          >
            <Text style={styles.primaryBtnText}>
              {isLast ? "Start using HOLTO" : "Next"}
            </Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, alignItems: "center", justifyContent: "space-between" },
  skipRow: { width: "100%", maxWidth: 560, paddingHorizontal: 24, alignItems: "flex-end", height: 32 },
  skipText: { fontFamily: "Inter_500Medium", fontSize: 15, color: "rgba(244,247,248,0.6)" },
  pagerWrap: { flex: 1, justifyContent: "center" },
  slide: { paddingHorizontal: 36, alignItems: "center", justifyContent: "center" },
  iconBadge: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: "rgba(201,162,75,0.12)",
    borderWidth: 1,
    borderColor: "rgba(201,162,75,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: "#F4F7F8",
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: 16,
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 25,
    color: "rgba(244,247,248,0.65)",
    textAlign: "center",
    maxWidth: 340,
  },
  bottom: { width: "100%", maxWidth: 560, paddingHorizontal: 28, alignItems: "center", gap: 24 },
  dots: { flexDirection: "row", gap: 7, alignItems: "center" },
  dot: { height: 7, borderRadius: 4 },
  primaryBtn: {
    width: "100%",
    height: 56,
    backgroundColor: "#1C7C8C",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: "#fff",
    letterSpacing: 0.1,
  },
});
