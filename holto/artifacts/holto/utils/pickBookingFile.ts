import { Platform } from "react-native";

export interface PickedFile {
  data: string; // base64, without the data: prefix
  mimeType: string;
  filename: string;
}

/**
 * Opens the browser's file picker and returns the chosen booking document as
 * base64. Web-only by design — this covers the PWA on both desktop and mobile
 * browsers without pulling in a native document-picker dependency. Returns null
 * if cancelled or unsupported (e.g. a native build).
 */
export async function pickBookingFile(): Promise<PickedFile | null> {
  if (Platform.OS !== "web" || typeof document === "undefined") return null;

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,image/png,image/jpeg,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const comma = result.indexOf(",");
        resolve({
          data: comma !== -1 ? result.slice(comma + 1) : result,
          mimeType: file.type || "application/pdf",
          filename: file.name,
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

export const bookingUploadSupported = Platform.OS === "web";
