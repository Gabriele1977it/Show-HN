// The gov.uk Foreign Office travel-advice URL for a destination — authoritative
// and current (safety alerts + entry requirements). Countries are always chosen
// from our essentials list, so names are clean; a few slugs differ from the
// display name and are overridden by ISO-2 code.
const SLUG_OVERRIDE: Record<string, string> = {
  TR: "turkey",
  CZ: "czech-republic",
  US: "usa",
  AE: "united-arab-emirates",
  KR: "south-korea",
  VN: "vietnam",
  GE: "georgia",
  RU: "russia",
};

export function govUkAdviceUrl(code: string, name: string): string {
  const slug =
    SLUG_OVERRIDE[code.toUpperCase()] ??
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return `https://www.gov.uk/foreign-travel-advice/${slug}`;
}
