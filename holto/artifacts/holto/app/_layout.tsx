import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { WizardProvider } from "@/context/WizardContext";
import { usePushRegistration } from "@/hooks/usePushRegistration";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function RootLayoutNav() {
  // Register for push + handle notification taps once the user is signed in.
  usePushRegistration();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="legal/terms" options={{ headerShown: true, headerTitle: "Terms of Service", headerBackTitle: "Back", headerStyle: { backgroundColor: "#F4F7F8" }, headerTintColor: "#0A2E38", headerTitleStyle: { fontFamily: "Inter_600SemiBold", fontSize: 17, color: "#0A2E38" } }} />
      <Stack.Screen name="legal/privacy" options={{ headerShown: true, headerTitle: "Privacy Policy", headerBackTitle: "Back", headerStyle: { backgroundColor: "#F4F7F8" }, headerTintColor: "#0A2E38", headerTitleStyle: { fontFamily: "Inter_600SemiBold", fontSize: 17, color: "#0A2E38" } }} />
      <Stack.Screen
        name="disruption/wizard"
        options={{
          headerShown: true,
          headerTitle: "Report a Problem",
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: "#F4F7F8" },
          headerTintColor: "#0A2E38",
          headerTitleStyle: {
            fontFamily: "Inter_600SemiBold",
            fontSize: 17,
            color: "#0A2E38",
          },
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="disruption/[id]"
        options={{
          headerShown: true,
          headerTitle: "Your Rights",
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: "#F4F7F8" },
          headerTintColor: "#0A2E38",
          headerTitleStyle: {
            fontFamily: "Inter_600SemiBold",
            fontSize: 17,
            color: "#0A2E38",
          },
        }}
      />
      <Stack.Screen
        name="claim/[id]"
        options={{
          headerShown: true,
          headerTitle: "Your Claim",
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: "#F4F7F8" },
          headerTintColor: "#0A2E38",
          headerTitleStyle: {
            fontFamily: "Inter_600SemiBold",
            fontSize: 17,
            color: "#0A2E38",
          },
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    // Feather icons are pre-bundled in Expo Go; for production builds
    // the expo-font plugin in app.json loads the TTF automatically.
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthProvider>
              <WizardProvider>
                <RootLayoutNav />
              </WizardProvider>
            </AuthProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
