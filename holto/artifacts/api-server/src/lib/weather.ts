import { logger } from "./logger";

// Free, key-less weather from Open-Meteo. Cached per rounded coordinate for 1h,
// so a whole city's travellers share one upstream call. Deterministic WMO-code
// → emoji/label mapping (no LLM). Returns null on any failure so callers just
// hide the chip.

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { data: Weather | null; ts: number }>();

export interface Weather {
  tempC: number | null;
  highC: number | null;
  lowC: number | null;
  code: number;
  emoji: string;
  label: string;
}

// WMO weather-interpretation codes → a friendly emoji + label.
function describe(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: "☀️", label: "Clear" };
  if (code <= 2) return { emoji: "🌤️", label: "Mostly sunny" };
  if (code === 3) return { emoji: "☁️", label: "Cloudy" };
  if (code === 45 || code === 48) return { emoji: "🌫️", label: "Fog" };
  if (code >= 51 && code <= 57) return { emoji: "🌦️", label: "Drizzle" };
  if (code >= 61 && code <= 67) return { emoji: "🌧️", label: "Rain" };
  if (code >= 71 && code <= 77) return { emoji: "❄️", label: "Snow" };
  if (code >= 80 && code <= 82) return { emoji: "🌧️", label: "Showers" };
  if (code >= 85 && code <= 86) return { emoji: "🌨️", label: "Snow showers" };
  if (code >= 95) return { emoji: "⛈️", label: "Thunderstorm" };
  return { emoji: "🌡️", label: "—" };
}

export async function getWeather(lat: number, lon: number): Promise<Weather | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`weather HTTP ${res.status}`);
    const json = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
      daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[]; weather_code?: number[] };
    };
    const code = json.current?.weather_code ?? json.daily?.weather_code?.[0] ?? 0;
    const d = describe(code);
    const weather: Weather = {
      tempC: json.current?.temperature_2m ?? null,
      highC: json.daily?.temperature_2m_max?.[0] ?? null,
      lowC: json.daily?.temperature_2m_min?.[0] ?? null,
      code,
      emoji: d.emoji,
      label: d.label,
    };
    cache.set(key, { data: weather, ts: Date.now() });
    return weather;
  } catch (err) {
    logger.warn({ err, lat, lon }, "Weather fetch failed");
    cache.set(key, { data: null, ts: Date.now() });
    return null;
  }
}
