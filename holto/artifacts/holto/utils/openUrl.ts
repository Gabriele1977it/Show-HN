import { Linking, Platform } from "react-native";

// Open an external URL reliably on every platform. On web (especially an
// installed PWA) React Native's Linking.openURL is flaky, so use window.open
// with a real new-tab target.
export function openUrl(url: string): void {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    return;
  }
  void Linking.openURL(url);
}
