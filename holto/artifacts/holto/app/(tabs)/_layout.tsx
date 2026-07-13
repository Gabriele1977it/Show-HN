import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, useColorScheme, View } from "react-native";

import { TabSvgIcon } from "@/components/TabSvgIcon";
import { useColors } from "@/hooks/useColors";

export default function TabLayout() {
  const colors = useColors();
  const scheme = useColorScheme();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={scheme === "dark" ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <TabSvgIcon name="home" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="monitor"
        options={{
          title: "Flight",
          tabBarIcon: ({ color }) => (
            <TabSvgIcon name="airplane" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: "Tools",
          tabBarIcon: ({ color }) => (
            <TabSvgIcon name="tools" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rights"
        options={{
          title: "Rights",
          tabBarIcon: ({ color }) => (
            <TabSvgIcon name="shield" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: "News",
          tabBarIcon: ({ color }) => (
            <TabSvgIcon name="news" color={color} />
          ),
        }}
      />
      {/* "Living" is reached from the Home ecosystem card, not the tab bar —
          keep the route but hide it so the action bar stays uncluttered. */}
      <Tabs.Screen
        name="living"
        options={{ href: null }}
      />
      {/* "Plans" is reached from Account and every upgrade prompt — keep it out
          of the tab bar so the action bar stays at six and News has room. */}
      <Tabs.Screen
        name="plans"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color }) => (
            <TabSvgIcon name="person" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{ href: null }}
      />
    </Tabs>
  );
}
