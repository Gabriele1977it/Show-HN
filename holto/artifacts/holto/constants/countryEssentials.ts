// Bundled, offline "destination essentials" — the practical things every
// traveller wants on arrival. All static, stable facts (no API, no cost, works
// on a plane). Curated for HOLTO's common destinations. Guidance, not gospel:
// emergency numbers and norms can vary regionally, so we keep it pragmatic.

// When the essentials facts below were last reviewed. Surfaced in the app so
// even the static reference data is transparent about its age.
export const ESSENTIALS_REVIEWED = "July 2026";

export type WaterSafety = "safe" | "bottled" | "caution";
export type DrivingSide = "left" | "right";

export interface CountryEssentials {
  code: string; // ISO-3166 alpha-2
  name: string;
  flag: string;
  currency: string; // ISO-4217
  dialingCode: string; // "+44"
  drivingSide: DrivingSide;
  voltage: string; // "230V · 50Hz"
  plugs: string; // "Type G"
  emergency: string; // dialable string, most useful first
  tapWater: WaterSafety;
  tipping: string;
  tip: string; // one practical, high-value local tip
}

// EU/EEA share 112. Voltage across most of Europe is 230V·50Hz, Type C/F.
export const COUNTRY_ESSENTIALS: Record<string, CountryEssentials> = {
  GB: { code: "GB", name: "United Kingdom", flag: "🇬🇧", currency: "GBP", dialingCode: "+44", drivingSide: "left", voltage: "230V · 50Hz", plugs: "Type G", emergency: "999 or 112", tapWater: "safe", tipping: "Not required; ~10% if no service charge added.", tip: "Contactless (card or phone) works almost everywhere, including buses and the Tube." },
  IE: { code: "IE", name: "Ireland", flag: "🇮🇪", currency: "EUR", dialingCode: "+353", drivingSide: "left", voltage: "230V · 50Hz", plugs: "Type G", emergency: "112 or 999", tapWater: "safe", tipping: "10–15% in restaurants; round up taxis.", tip: "The same Type G plug as the UK — no adapter needed between them." },
  FR: { code: "FR", name: "France", flag: "🇫🇷", currency: "EUR", dialingCode: "+33", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type C/E", emergency: "112", tapWater: "safe", tipping: "Service included; round up or leave small change.", tip: "Many shops close for lunch (12–2pm) and all day Sunday outside big cities." },
  ES: { code: "ES", name: "Spain", flag: "🇪🇸", currency: "EUR", dialingCode: "+34", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type C/F", emergency: "112", tapWater: "safe", tipping: "Small change or ~5%; not expected.", tip: "Dinner runs late (9pm+). Many places take a mid-afternoon siesta break." },
  PT: { code: "PT", name: "Portugal", flag: "🇵🇹", currency: "EUR", dialingCode: "+351", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type C/F", emergency: "112", tapWater: "safe", tipping: "Round up or ~5–10%.", tip: "Multibanco ATMs are everywhere and cheap; carry a little cash for cafés." },
  IT: { code: "IT", name: "Italy", flag: "🇮🇹", currency: "EUR", dialingCode: "+39", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type C/F/L", emergency: "112", tapWater: "safe", tipping: "Often a 'coperto' cover charge; tipping optional.", tip: "A cappuccino after ~11am raises eyebrows; coffee is cheaper standing at the bar." },
  DE: { code: "DE", name: "Germany", flag: "🇩🇪", currency: "EUR", dialingCode: "+49", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type C/F", emergency: "112", tapWater: "safe", tipping: "Round up ~5–10%; tell the server the total.", tip: "Carry cash — many bakeries, bars and even restaurants are card-shy." },
  NL: { code: "NL", name: "Netherlands", flag: "🇳🇱", currency: "EUR", dialingCode: "+31", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type C/F", emergency: "112", tapWater: "safe", tipping: "Round up or ~5–10%.", tip: "Watch for bike lanes (usually red) — cyclists have priority and are fast." },
  BE: { code: "BE", name: "Belgium", flag: "🇧🇪", currency: "EUR", dialingCode: "+32", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type C/E", emergency: "112", tapWater: "safe", tipping: "Included; round up if you like.", tip: "Trains link the whole country cheaply; validate mobile tickets before boarding." },
  CH: { code: "CH", name: "Switzerland", flag: "🇨🇭", currency: "CHF", dialingCode: "+41", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type J", emergency: "112", tapWater: "safe", tipping: "Included; round up for good service.", tip: "Type J plugs are Swiss-specific — a standard Euro adapter may not fit." },
  AT: { code: "AT", name: "Austria", flag: "🇦🇹", currency: "EUR", dialingCode: "+43", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type C/F", emergency: "112", tapWater: "safe", tipping: "~5–10%, tell the server the total.", tip: "A motorway 'vignette' toll sticker is required if you drive — buy it before the border." },
  GR: { code: "GR", name: "Greece", flag: "🇬🇷", currency: "EUR", dialingCode: "+30", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type C/F", emergency: "112", tapWater: "bottled", tipping: "Round up or ~5–10%.", tip: "Tap water is fine on the mainland but bottled is wiser on many islands." },
  TR: { code: "TR", name: "Türkiye", flag: "🇹🇷", currency: "TRY", dialingCode: "+90", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type C/F", emergency: "112", tapWater: "bottled", tipping: "~5–10% in restaurants ('bahşiş').", tip: "Bottled water is the norm. Haggling is expected in bazaars, not in shops." },
  PL: { code: "PL", name: "Poland", flag: "🇵🇱", currency: "PLN", dialingCode: "+48", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type C/E", emergency: "112", tapWater: "safe", tipping: "~10%; hand it over, don't leave on the table.", tip: "Cards are widely accepted, but keep some złoty for kiosks and small bakeries." },
  CZ: { code: "CZ", name: "Czechia", flag: "🇨🇿", currency: "CZK", dialingCode: "+420", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type C/E", emergency: "112", tapWater: "safe", tipping: "~10%, tell the server the total.", tip: "Prices in tourist-area menus may add a cover charge — check before ordering." },
  HU: { code: "HU", name: "Hungary", flag: "🇭🇺", currency: "HUF", dialingCode: "+36", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type C/F", emergency: "112", tapWater: "safe", tipping: "~10%; often added as service — check first.", tip: "Always pay in local forint (HUF); paying by card in EUR costs you on the rate." },
  HR: { code: "HR", name: "Croatia", flag: "🇭🇷", currency: "EUR", dialingCode: "+385", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type C/F", emergency: "112", tapWater: "safe", tipping: "Round up or ~10%.", tip: "Now on the euro. Ferries between islands book out in summer — reserve ahead." },
  SE: { code: "SE", name: "Sweden", flag: "🇸🇪", currency: "SEK", dialingCode: "+46", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type C/F", emergency: "112", tapWater: "safe", tipping: "Not expected; round up for good service.", tip: "Nearly cashless — a card or phone covers everything, even tiny purchases." },
  NO: { code: "NO", name: "Norway", flag: "🇳🇴", currency: "NOK", dialingCode: "+47", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type C/F", emergency: "112", tapWater: "safe", tipping: "Not expected; round up if you wish.", tip: "Very cashless. Alcohol is state-sold (Vinmonopolet) with limited hours." },
  DK: { code: "DK", name: "Denmark", flag: "🇩🇰", currency: "DKK", dialingCode: "+45", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type C/E/F/K", emergency: "112", tapWater: "safe", tipping: "Included; not expected.", tip: "Overwhelmingly cashless — MobilePay and cards rule." },
  FI: { code: "FI", name: "Finland", flag: "🇫🇮", currency: "EUR", dialingCode: "+358", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type C/F", emergency: "112", tapWater: "safe", tipping: "Not expected.", tip: "Tap water is some of the cleanest in the world — skip buying bottled." },
  IS: { code: "IS", name: "Iceland", flag: "🇮🇸", currency: "ISK", dialingCode: "+354", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type C/F", emergency: "112", tapWater: "safe", tipping: "Not expected; included.", tip: "Card-only mindset. The hot tap can smell of sulphur — it's harmless." },
  US: { code: "US", name: "United States", flag: "🇺🇸", currency: "USD", dialingCode: "+1", drivingSide: "right", voltage: "120V · 60Hz", plugs: "Type A/B", emergency: "911", tapWater: "safe", tipping: "Expected: 15–20% dining, $1–2/bag, ~15% taxis.", tip: "Menu/shelf prices exclude sales tax — expect the total to be a bit higher." },
  CA: { code: "CA", name: "Canada", flag: "🇨🇦", currency: "CAD", dialingCode: "+1", drivingSide: "right", voltage: "120V · 60Hz", plugs: "Type A/B", emergency: "911", tapWater: "safe", tipping: "15–20% dining, similar to the US.", tip: "Sales tax is added at the till and varies by province." },
  MX: { code: "MX", name: "Mexico", flag: "🇲🇽", currency: "MXN", dialingCode: "+52", drivingSide: "right", voltage: "127V · 60Hz", plugs: "Type A/B", emergency: "911", tapWater: "caution", tipping: "10–15% in restaurants ('propina').", tip: "Drink bottled water. Pay in pesos, not dollars, for a better rate." },
  BR: { code: "BR", name: "Brazil", flag: "🇧🇷", currency: "BRL", dialingCode: "+55", drivingSide: "right", voltage: "127–220V · 60Hz", plugs: "Type N/C", emergency: "190 police · 192 ambulance", tapWater: "bottled", tipping: "~10% usually added to the bill.", tip: "Voltage varies by city (127 vs 220V) — check before plugging in appliances." },
  AR: { code: "AR", name: "Argentina", flag: "🇦🇷", currency: "ARS", dialingCode: "+54", drivingSide: "right", voltage: "220V · 50Hz", plugs: "Type C/I", emergency: "911", tapWater: "safe", tipping: "~10% in restaurants, cash preferred.", tip: "Carry cash; card/exchange rates can be poor. Bottled water outside big cities." },
  AE: { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", currency: "AED", dialingCode: "+971", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type G", emergency: "999 police · 998 ambulance", tapWater: "bottled", tipping: "10–15% appreciated; often a service charge.", tip: "Dress modestly at malls and mosques. Same Type G plug as the UK." },
  QA: { code: "QA", name: "Qatar", flag: "🇶🇦", currency: "QAR", dialingCode: "+974", drivingSide: "right", voltage: "240V · 50Hz", plugs: "Type G", emergency: "999", tapWater: "safe", tipping: "~10% if no service charge.", tip: "Desalinated tap water is safe but most prefer bottled for taste." },
  EG: { code: "EG", name: "Egypt", flag: "🇪🇬", currency: "EGP", dialingCode: "+20", drivingSide: "right", voltage: "220V · 50Hz", plugs: "Type C/F", emergency: "122 police · 123 ambulance", tapWater: "caution", tipping: "'Baksheesh' is customary — keep small notes handy.", tip: "Drink bottled water only. Agree taxi fares before you set off." },
  MA: { code: "MA", name: "Morocco", flag: "🇲🇦", currency: "MAD", dialingCode: "+212", drivingSide: "right", voltage: "220V · 50Hz", plugs: "Type C/E", emergency: "19 police · 15 ambulance", tapWater: "caution", tipping: "Small tips widely expected; carry coins.", tip: "Haggle in the souks — start around a third of the asking price. Bottled water." },
  ZA: { code: "ZA", name: "South Africa", flag: "🇿🇦", currency: "ZAR", dialingCode: "+27", drivingSide: "left", voltage: "230V · 50Hz", plugs: "Type M/N/D", emergency: "10111 police · 112 (mobile)", tapWater: "safe", tipping: "10–15% dining; tip petrol & parking attendants.", tip: "Big-city tap water is safe; be cautious rural. Uses an unusual large plug — pack a universal adapter." },
  KE: { code: "KE", name: "Kenya", flag: "🇰🇪", currency: "KES", dialingCode: "+254", drivingSide: "left", voltage: "240V · 50Hz", plugs: "Type G", emergency: "999 or 112", tapWater: "caution", tipping: "~10% appreciated.", tip: "M-Pesa mobile money is used everywhere. Drink bottled/filtered water." },
  TH: { code: "TH", name: "Thailand", flag: "🇹🇭", currency: "THB", dialingCode: "+66", drivingSide: "left", voltage: "230V · 50Hz", plugs: "Type A/B/C", emergency: "191 police · 1669 ambulance · 1155 tourist", tapWater: "caution", tipping: "Not expected; round up or leave small change.", tip: "Drink bottled water. Cover shoulders/knees at temples; remove shoes to enter." },
  VN: { code: "VN", name: "Vietnam", flag: "🇻🇳", currency: "VND", dialingCode: "+84", drivingSide: "right", voltage: "220V · 50Hz", plugs: "Type A/C/F", emergency: "113 police · 115 ambulance", tapWater: "caution", tipping: "Not customary but appreciated.", tip: "Bottled water only. To cross busy roads, walk slowly and steadily — traffic flows around you." },
  SG: { code: "SG", name: "Singapore", flag: "🇸🇬", currency: "SGD", dialingCode: "+65", drivingSide: "left", voltage: "230V · 50Hz", plugs: "Type G", emergency: "999 police · 995 ambulance", tapWater: "safe", tipping: "Not expected; often a 10% service charge.", tip: "Fines are real — no eating/drinking on the MRT, no jaywalking, no littering." },
  MY: { code: "MY", name: "Malaysia", flag: "🇲🇾", currency: "MYR", dialingCode: "+60", drivingSide: "left", voltage: "240V · 50Hz", plugs: "Type G", emergency: "999 or 112", tapWater: "bottled", tipping: "Not expected; service charge common.", tip: "Boil or buy bottled water. Grab (ride-hailing) is cheap and reliable." },
  ID: { code: "ID", name: "Indonesia", flag: "🇮🇩", currency: "IDR", dialingCode: "+62", drivingSide: "left", voltage: "230V · 50Hz", plugs: "Type C/F", emergency: "112", tapWater: "caution", tipping: "~10% in tourist areas; often included in Bali.", tip: "Bottled water only. Carry cash — many warungs (small eateries) don't take cards." },
  JP: { code: "JP", name: "Japan", flag: "🇯🇵", currency: "JPY", dialingCode: "+81", drivingSide: "left", voltage: "100V · 50/60Hz", plugs: "Type A/B", emergency: "110 police · 119 fire/ambulance", tapWater: "safe", tipping: "No tipping — it can cause confusion.", tip: "Carry some cash; get a Suica/PASMO IC card for trains and convenience stores." },
  CN: { code: "CN", name: "China", flag: "🇨🇳", currency: "CNY", dialingCode: "+86", drivingSide: "right", voltage: "220V · 50Hz", plugs: "Type A/I/C", emergency: "110 police · 120 ambulance", tapWater: "caution", tipping: "Not customary.", tip: "Set up Alipay/WeChat Pay (they now link foreign cards) — cash is rarely used. Bottled water." },
  IN: { code: "IN", name: "India", flag: "🇮🇳", currency: "INR", dialingCode: "+91", drivingSide: "left", voltage: "230V · 50Hz", plugs: "Type C/D/M", emergency: "112", tapWater: "caution", tipping: "~10% in restaurants; small tips widely given.", tip: "Bottled/filtered water only. UPI apps are ubiquitous, but carry cash too." },
  KR: { code: "KR", name: "South Korea", flag: "🇰🇷", currency: "KRW", dialingCode: "+82", drivingSide: "right", voltage: "220V · 60Hz", plugs: "Type C/F", emergency: "112 police · 119 fire/ambulance", tapWater: "safe", tipping: "Not expected.", tip: "Get a T-money card for transport. Note the Euro-style Type C/F plug, not the US one." },
  AU: { code: "AU", name: "Australia", flag: "🇦🇺", currency: "AUD", dialingCode: "+61", drivingSide: "left", voltage: "230V · 50Hz", plugs: "Type I", emergency: "000 or 112 (mobile)", tapWater: "safe", tipping: "Not expected; round up for great service.", tip: "The sun is fierce — high-SPF sunscreen isn't optional. Contactless is everywhere." },
  NZ: { code: "NZ", name: "New Zealand", flag: "🇳🇿", currency: "NZD", dialingCode: "+64", drivingSide: "left", voltage: "230V · 50Hz", plugs: "Type I", emergency: "111", tapWater: "safe", tipping: "Not expected.", tip: "Same Type I plug as Australia. Weather changes fast — pack layers." },
  IL: { code: "IL", name: "Israel", flag: "🇮🇱", currency: "ILS", dialingCode: "+972", drivingSide: "right", voltage: "230V · 50Hz", plugs: "Type C/H", emergency: "100 police · 101 ambulance", tapWater: "safe", tipping: "~10–12% in restaurants.", tip: "Shabbat (Fri eve–Sat eve) closes many shops and pauses public transport." },
  HK: { code: "HK", name: "Hong Kong", flag: "🇭🇰", currency: "HKD", dialingCode: "+852", drivingSide: "left", voltage: "220V · 50Hz", plugs: "Type G", emergency: "999", tapWater: "safe", tipping: "Often a 10% service charge; round up taxis.", tip: "Get an Octopus card — it pays for transit, shops and more. Type G plug like the UK." },
  GE: { code: "GE", name: "Georgia", flag: "🇬🇪", currency: "GEL", dialingCode: "+995", drivingSide: "right", voltage: "220V · 50Hz", plugs: "Type C/F", emergency: "112", tapWater: "safe", tipping: "~10% in restaurants.", tip: "Tbilisi tap water is safe and famously good; bottled is easy to find elsewhere." },
};

export const ESSENTIALS_LIST: CountryEssentials[] = Object.values(COUNTRY_ESSENTIALS).sort((a, b) =>
  a.name.localeCompare(b.name),
);

// Resolve a country by ISO code or a loose name match (e.g. from a trip's
// free-text destination like "Lisbon, Portugal").
export function findEssentials(query: string): CountryEssentials | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const byCode = COUNTRY_ESSENTIALS[query.trim().toUpperCase()];
  if (byCode) return byCode;
  // Try to match a country name appearing anywhere in the string.
  for (const c of ESSENTIALS_LIST) {
    if (q.includes(c.name.toLowerCase())) return c;
  }
  return null;
}
