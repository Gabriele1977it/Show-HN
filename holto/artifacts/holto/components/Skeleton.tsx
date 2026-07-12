import React, { useEffect } from "react";
import { type DimensionValue, StyleSheet, View, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";

// A gently-pulsing placeholder block. Modern loading states use skeletons that
// mirror the final layout rather than a spinner — content feels faster to
// arrive and the screen doesn't jump when it does.
export function Skeleton({
  height = 16,
  width = "100%",
  radius = 8,
  style,
}: {
  height?: number;
  width?: DimensionValue;
  radius?: number;
  style?: ViewStyle;
}) {
  const colors = useColors();
  const pulse = useSharedValue(0.5);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);
  const anim = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[{ height, width, borderRadius: radius, backgroundColor: colors.muted }, anim, style]} />;
}

// A card-shaped skeleton that mirrors a typical list row (icon + two lines).
export function SkeletonCard() {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <Skeleton height={40} width={40} radius={10} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton height={13} width="55%" />
        <Skeleton height={11} width="80%" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, padding: 16, marginBottom: 10 },
});
