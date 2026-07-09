import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";

interface Props {
  step: number;
  total: number;
}

export function StepBar({ step, total }: Props) {
  const colors = useColors();
  const progress = total > 0 ? (step + 1) / total : 0;

  const animStyle = useAnimatedStyle(() => ({
    width: withTiming(`${progress * 100}%` as `${number}%`, { duration: 300 }),
  }));

  return (
    <View style={[styles.track, { backgroundColor: colors.muted }]}>
      <Animated.View
        style={[styles.fill, animStyle, { backgroundColor: colors.primary }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 2,
  },
});
