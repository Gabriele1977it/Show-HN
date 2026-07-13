// Renders a shareable "trip recap" story card (Wrapped-style) entirely in the
// browser with the Canvas 2D API — no dependency, no server, no cost. Web only
// (native has no <canvas>); callers should hide the button off-web. Downloads a
// PNG, and uses the Web Share API with the file when available so it can go
// straight to Instagram/WhatsApp on mobile web.

export interface RecapCardData {
  title: string;
  destination?: string | null;
  days?: number | null;
  countries?: number;
  places?: number;
  flights?: number;
  spendGBP?: number | null;
  cities?: string[];
  creatorName?: string | null;
}

export function recapCardSupported(): boolean {
  return typeof document !== "undefined" && !!document.createElement("canvas").getContext;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function downloadRecapCard(data: RecapCardData): Promise<void> {
  if (!recapCardSupported()) return;

  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Background gradient (HOLTO midnight → teal).
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0A2E38");
  bg.addColorStop(1, "#0E3F50");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const pad = 90;
  const gold = "#F2C94C";
  const white = "#FFFFFF";
  const muted = "rgba(255,255,255,0.62)";

  // Wordmark + eyebrow.
  ctx.fillStyle = gold;
  ctx.font = "700 44px Inter, Arial, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("HOLTO", pad, pad + 20);
  ctx.fillStyle = muted;
  ctx.font = "600 26px Inter, Arial, sans-serif";
  ctx.fillText("TRIP RECAP", pad, pad + 62);

  // Title (wrap to 2 lines).
  ctx.fillStyle = white;
  ctx.font = "800 76px Inter, Arial, sans-serif";
  const words = data.title.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > W - pad * 2 && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
    if (lines.length >= 2) break;
  }
  if (line && lines.length < 2) lines.push(line);
  let ty = pad + 190;
  for (const l of lines.slice(0, 2)) {
    ctx.fillText(l, pad, ty);
    ty += 86;
  }

  if (data.destination) {
    ctx.fillStyle = gold;
    ctx.font = "600 38px Inter, Arial, sans-serif";
    ctx.fillText(data.destination, pad, ty + 6);
    ty += 30;
  }

  // Stat tiles (2×2).
  const stats: { value: string; label: string }[] = [];
  if (data.days != null) stats.push({ value: String(data.days), label: data.days === 1 ? "DAY" : "DAYS" });
  const placeN = data.countries && data.countries > 0 ? data.countries : data.places ?? 0;
  if (placeN > 0) stats.push({ value: String(placeN), label: data.countries ? (data.countries === 1 ? "COUNTRY" : "COUNTRIES") : "PLACES" });
  if (data.flights && data.flights > 0) stats.push({ value: String(data.flights), label: data.flights === 1 ? "FLIGHT" : "FLIGHTS" });
  if (data.spendGBP != null) stats.push({ value: `£${data.spendGBP.toLocaleString("en-GB")}`, label: "SPENT" });

  const gridTop = ty + 80;
  const gap = 28;
  const tileW = (W - pad * 2 - gap) / 2;
  const tileH = 210;
  stats.slice(0, 4).forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = pad + col * (tileW + gap);
    const y = gridTop + row * (tileH + gap);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    roundRect(ctx, x, y, tileW, tileH, 28);
    ctx.fill();
    ctx.fillStyle = white;
    ctx.font = "800 88px Inter, Arial, sans-serif";
    ctx.fillText(s.value, x + 36, y + 118);
    ctx.fillStyle = muted;
    ctx.font = "700 28px Inter, Arial, sans-serif";
    ctx.fillText(s.label, x + 38, y + 162);
  });

  // Cities line.
  const cities = (data.cities ?? []).slice(0, 4);
  if (cities.length) {
    ctx.fillStyle = muted;
    ctx.font = "500 32px Inter, Arial, sans-serif";
    ctx.fillText(cities.join("  •  "), pad, H - 190);
  }

  // Footer.
  ctx.fillStyle = white;
  ctx.font = "700 34px Inter, Arial, sans-serif";
  ctx.fillText(data.creatorName ? `${data.creatorName} · planned with HOLTO` : "Planned with HOLTO", pad, H - 110);
  ctx.fillStyle = gold;
  ctx.font = "600 30px Inter, Arial, sans-serif";
  ctx.fillText("holtotravel.com", pad, H - 66);

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  if (!blob) return;
  const file = new File([blob], "holto-trip-recap.png", { type: "image/png" });

  // Prefer the native share sheet with the image (mobile web → Instagram etc.).
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean; share?: (d: object) => Promise<void> };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: data.title });
      return;
    } catch {
      /* fell through to download */
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "holto-trip-recap.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
