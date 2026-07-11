// Pure, dependency-free parsers for pulling structured flight facts out of a
// free-text trip-item title (e.g. "BA503 LHR → LIS"). Kept db-free so they can
// be unit-tested without a database connection.

// Pull a flight number like "BA503", "EZY8743" or "U28743" out of a title.
// The leading 2–3 alphanumerics cover IATA/ICAO airline codes (BA, U2, EZY);
// the whole token is captured regardless of where the letters/digits split.
export function extractFlightNumber(title: string): string | null {
  const m = title.toUpperCase().match(/\b([A-Z0-9]{2,3}\d{1,4})\b/);
  return m ? m[1]! : null;
}

// Pull a "LHR → LIS" style route (IATA airport codes) out of a title.
export function extractRoute(title: string): { dep: string | null; arr: string | null } {
  const m = title.toUpperCase().match(/\b([A-Z]{3})\b\s*(?:→|->|—|-|>|TO)\s*\b([A-Z]{3})\b/);
  return m ? { dep: m[1]!, arr: m[2]! } : { dep: null, arr: null };
}
