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
 *
 * The <input> is attached to the DOM before clicking: a detached input can be
 * garbage-collected before its change event fires, which is a common cause of
 * "nothing happens" — especially on mobile Safari/Chrome.
 */
export async function pickBookingFile(): Promise<PickedFile | null> {
  if (Platform.OS !== "web" || typeof document === "undefined") return null;

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    // Broad + mobile-friendly: PDFs plus any image (lets phones offer camera/photos).
    input.accept = "application/pdf,image/*";
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "0";

    let settled = false;
    const finish = (value: PickedFile | null) => {
      if (settled) return;
      settled = true;
      try {
        if (input.parentNode) input.parentNode.removeChild(input);
      } catch {
        /* already detached */
      }
      resolve(value);
    };

    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) {
        finish(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const comma = result.indexOf(",");
        finish({
          data: comma !== -1 ? result.slice(comma + 1) : result,
          mimeType: file.type || "application/pdf",
          filename: file.name,
        });
      };
      reader.onerror = () => finish(null);
      reader.readAsDataURL(file);
    };

    document.body.appendChild(input);
    input.click();
  });
}

export const bookingUploadSupported = Platform.OS === "web";
