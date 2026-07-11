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
        name="living"
        options={{
          title: "Living",
          tabBarIcon: ({ color }) => (
            <TabSvgIcon name="globe" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: "Plans",
          tabBarIcon: ({ color }) => (
            <TabSvgIcon name="star" color={color} />
          ),
        }}
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
