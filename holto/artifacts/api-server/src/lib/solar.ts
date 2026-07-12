// Pure, dependency-free solar maths — sunrise, sunset, and the golden/blue-hour
// windows creators care about. Implements the classic "Sunrise/Sunset Algorithm"
// (Almanac for Computers), parameterised by the sun's zenith angle so we can ask
// for the moment the sun reaches a given elevation, not just the horizon. All
// times are returned as minutes from UTC midnight; the caller localises them.

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const sinD = (d: number) => Math.sin(rad(d));
const cosD = (d: number) => Math.cos(rad(d));
const tanD = (d: number) => Math.tan(rad(d));
const asinD = (x: number) => deg(Math.asin(x));
const acosD = (x: number) => deg(Math.acos(x));
const atanD = (x: number) => deg(Math.atan(x));
const mod = (n: number, m: number) => ((n % m) + m) % m;

// Zenith angles (90° = geometric horizon). Larger = sun further below horizon.
export const ZENITH_OFFICIAL = 90.833; // sunrise/sunset (refraction + sun radius)
export const ZENITH_GOLDEN = 84; // sun ~6° above horizon — edge of golden hour
export const ZENITH_BLUE = 96; // sun ~6° below horizon — edge of blue hour

function dayOfYear(year: number, month: number, day: number): number {
  const start = Date.UTC(year, 0, 0);
  const cur = Date.UTC(year, month - 1, day);
  return Math.floor((cur - start) / 86_400_000);
}

/**
 * Minutes-from-UTC-midnight at which the sun reaches `zenith` on the given date
 * at (lat, lng), on the rising or setting side. Returns null when the sun never
 * reaches that angle that day (polar day/night for that threshold).
 */
export function sunEventUtcMin(
  year: number,
  month: number,
  day: number,
  lat: number,
  lng: number,
  zenith: number,
  rising: boolean,
): number | null {
  const N = dayOfYear(year, month, day);
  const lngHour = lng / 15;
  const t = rising ? N + (6 - lngHour) / 24 : N + (18 - lngHour) / 24;

  const M = 0.9856 * t - 3.289;
  let L = M + 1.916 * sinD(M) + 0.02 * sinD(2 * M) + 282.634;
  L = mod(L, 360);

  let RA = atanD(0.91764 * tanD(L));
  RA = mod(RA, 360);
  // Put RA in the same quadrant as L.
  RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90;
  RA /= 15;

  const sinDec = 0.39782 * sinD(L);
  const cosDec = cosD(asinD(sinDec));

  const cosH = (cosD(zenith) - sinDec * sinD(lat)) / (cosDec * cosD(lat));
  if (cosH > 1 || cosH < -1) return null; // sun never reaches this angle today

  const H = (rising ? 360 - acosD(cosH) : acosD(cosH)) / 15;
  const T = H + RA - 0.06571 * t - 6.622;
  const UT = mod(T - lngHour, 24);
  return Math.round(UT * 60);
}

export interface LightWindows {
  sunriseUtcMin: number | null;
  sunsetUtcMin: number | null;
  goldenMorning: { start: number; end: number } | null; // sunrise → sun +6°
  goldenEvening: { start: number; end: number } | null; // sun +6° → sunset
  blueMorning: { start: number; end: number } | null; // sun −6° → sunrise
  blueEvening: { start: number; end: number } | null; // sunset → sun −6°
  polar: boolean; // true when the sun doesn't cross the horizon that day
}

// Compute the full set of shoot-light windows for a place and date.
export function computeLightWindows(year: number, month: number, day: number, lat: number, lng: number): LightWindows {
  const sunrise = sunEventUtcMin(year, month, day, lat, lng, ZENITH_OFFICIAL, true);
  const sunset = sunEventUtcMin(year, month, day, lat, lng, ZENITH_OFFICIAL, false);
  const goldenRise = sunEventUtcMin(year, month, day, lat, lng, ZENITH_GOLDEN, true);
  const goldenSet = sunEventUtcMin(year, month, day, lat, lng, ZENITH_GOLDEN, false);
  const blueRise = sunEventUtcMin(year, month, day, lat, lng, ZENITH_BLUE, true);
  const blueSet = sunEventUtcMin(year, month, day, lat, lng, ZENITH_BLUE, false);

  return {
    sunriseUtcMin: sunrise,
    sunsetUtcMin: sunset,
    goldenMorning: sunrise != null && goldenRise != null ? { start: sunrise, end: goldenRise } : null,
    goldenEvening: sunset != null && goldenSet != null ? { start: goldenSet, end: sunset } : null,
    blueMorning: sunrise != null && blueRise != null ? { start: blueRise, end: sunrise } : null,
    blueEvening: sunset != null && blueSet != null ? { start: sunset, end: blueSet } : null,
    polar: sunrise == null || sunset == null,
  };
}
