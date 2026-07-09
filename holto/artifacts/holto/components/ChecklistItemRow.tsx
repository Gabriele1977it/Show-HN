import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  category?: string;
}

interface Props {
  item: ChecklistItem;
  onToggle: (id: string) => void;
}

export function ChecklistItemRow({ item, onToggle }: Props) {
  const colors = useColors();

  const circleStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(
      item.done ? colors.primary : "transparent",
      { duration: 200 },
    ),
    borderColor: withTiming(
      item.done ? colors.primary : colors.border,
      { duration: 200 },
    ),
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: withTiming(item.done ? 0.5 : 1, { duration: 200 }),
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(item.id);
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      onPress={handlePress}
    >
      <Animated.View
        style={[
          styles.circle,
          circleStyle,
          { borderRadius: 10 },
        ]}
      >
        {item.done && (
          <View style={styles.check} />
        )}
      </Animated.View>
      <Animated.Text
        style={[
          styles.text,
          textStyle,
          {
            color: colors.foreground,
            textDecorationLine: item.done ? "line-through" : "none",
          },
        ]}
      >
        {item.text}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  circle: {
    width: 22,
    height: 22,
    borderWidth: 2,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    width: 8,
    height: 5,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#fff",
    marginTop: -2,
    transform: [{ rotate: "-45deg" }],
  },
  text: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
});
