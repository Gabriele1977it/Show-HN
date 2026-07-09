import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

import { useAuth } from "@/context/AuthContext";

// Show alerts even when the app is foregrounded — a flight change is worth
// interrupting for. Set once at module load.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

function resolveProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
}

async function registerForPush(authToken: string): Promise<void> {
  // Remote push needs a physical device; simulators/web can't receive it.
  if (Platform.OS === "web" || !Device.isDevice) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Flight alerts",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const projectId = resolveProjectId();
  const { data: expoToken } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  if (!expoToken) return;

  await fetch(`${API_BASE}/api/push/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ token: expoToken, platform: Platform.OS }),
  });
}

/**
 * Registers the device's Expo push token with the API once the user is signed
 * in, and deep-links a tapped flight alert into the My Flight screen. Best
 * effort — any failure (permission denied, no projectId, offline) is swallowed
 * so it never blocks the app.
 */
export function usePushRegistration(): void {
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;
    registerForPush(token).catch(() => {
      /* best effort — push is a nice-to-have, never a hard dependency */
    });
  }, [token]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { type?: string } | undefined;
      if (data?.type === "flight_alert") {
        router.push("/(tabs)/monitor");
      }
    });
    return () => sub.remove();
  }, []);
}
