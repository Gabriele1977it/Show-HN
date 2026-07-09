import { Icon } from "@/components/Icon";
import { Linking } from "react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export function BeyondSection() {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <Text style={[styles.heading, { color: colors.mutedForeground }]}>
        Thinking beyond this trip?
      </Text>

      <Pressable
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
        onPress={() => Linking.openURL("https://www.holtotravel.co.uk/guides")}
      >
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: colors.muted, borderRadius: 8 },
          ]}
        >
          <Icon name="map" size={14} color={colors.teal} />
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: colors.foreground }]}>
            HOLTO Guides
          </Text>
          <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>
            Honest destination guides. No ads, no affiliate tricks.
          </Text>
        </View>
        <Icon name="arrow-right" size={14} color={colors.mutedForeground} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
        onPress={() => Linking.openURL("https://www.holtotravel.co.uk/living")}
      >
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: colors.muted, borderRadius: 8 },
          ]}
        >
          <Icon name="home" size={14} color={colors.teal} />
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: colors.foreground }]}>
            HOLTO Living
          </Text>
          <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>
            For people curious about living abroad. No pressure.
          </Text>
        </View>
        <Icon name="arrow-right" size={14} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 24,
  },
  divider: {
    height: 1,
    marginBottom: 20,
  },
  heading: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    marginBottom: 1,
  },
  rowDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
});
