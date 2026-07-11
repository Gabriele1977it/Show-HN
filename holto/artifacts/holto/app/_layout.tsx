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
import { useColors } from "@/hooks/useColors";

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
  const colors = useColors();

  // Theme-aware header styling shared by every stack screen with a header.
  const headerOptions = {
    headerBackTitle: "Back",
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.foreground,
    headerTitleStyle: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 17,
      color: colors.foreground,
    },
  } as const;

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="residency" options={{ headerShown: true, headerTitle: "Residency & Tax Days", ...headerOptions }} />
      <Stack.Screen name="trips" options={{ headerShown: true, headerTitle: "Your Trips", ...headerOptions }} />
      <Stack.Screen name="legal/terms" options={{ headerShown: true, headerTitle: "Terms of Service", ...headerOptions }} />
      <Stack.Screen name="legal/privacy" options={{ headerShown: true, headerTitle: "Privacy Policy", ...headerOptions }} />
      <Stack.Screen
        name="disruption/wizard"
        options={{ headerShown: true, headerTitle: "Report a Problem", presentation: "modal", ...headerOptions }}
      />
      <Stack.Screen
        name="disruption/[id]"
        options={{ headerShown: true, headerTitle: "Your Rights", ...headerOptions }}
      />
      <Stack.Screen
        name="claim/[id]"
        options={{ headerShown: true, headerTitle: "Your Claim", ...headerOptions }}
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
