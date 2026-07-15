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
      <Stack.Screen name="today" options={{ headerShown: true, headerTitle: "Your Travel Day", ...headerOptions }} />
      <Stack.Screen name="loyalty" options={{ headerShown: true, headerTitle: "Loyalty & Points", ...headerOptions }} />
      <Stack.Screen name="import" options={{ headerShown: true, headerTitle: "Add from a Booking", ...headerOptions }} />
      <Stack.Screen name="t/[slug]" options={{ headerShown: false }} />
      <Stack.Screen name="expenses" options={{ headerShown: true, headerTitle: "Expenses", ...headerOptions }} />
      <Stack.Screen name="airport-timing" options={{ headerShown: true, headerTitle: "Airport Timing", ...headerOptions }} />
      <Stack.Screen name="shoot-times" options={{ headerShown: true, headerTitle: "Best Light", ...headerOptions }} />
      <Stack.Screen name="cost-of-living" options={{ headerShown: true, headerTitle: "Cost of Living", ...headerOptions }} />
      <Stack.Screen name="currency" options={{ headerShown: true, headerTitle: "Currency Converter", ...headerOptions }} />
      <Stack.Screen name="destination" options={{ headerShown: true, headerTitle: "Destination Guide", ...headerOptions }} />
      <Stack.Screen name="watchlist" options={{ headerShown: true, headerTitle: "Watchlist", ...headerOptions }} />
      <Stack.Screen name="esim/index" options={{ headerShown: true, headerTitle: "eSIM data plans", ...headerOptions }} />
      <Stack.Screen name="esims" options={{ headerShown: true, headerTitle: "My eSIMs", ...headerOptions }} />
      <Stack.Screen name="esim/complete" options={{ headerShown: true, headerTitle: "Your eSIM", ...headerOptions }} />
      <Stack.Screen name="esim/[id]" options={{ headerShown: true, headerTitle: "Your eSIM", ...headerOptions }} />
      <Stack.Screen name="admin" options={{ headerShown: true, headerTitle: "Admin", ...headerOptions }} />
      <Stack.Screen name="invite" options={{ headerShown: true, headerTitle: "Invite Friends", ...headerOptions }} />
      <Stack.Screen name="whats-new" options={{ headerShown: false }} />
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
