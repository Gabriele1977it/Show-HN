// The full ISO-3166 country list, used anywhere a picker must cover the whole
// world (residency, Travel alerts, Visa & entry). Flags are derived from the
// two-letter code, so there's nothing to keep in sync. Names use common English.
export interface Country {
  code: string; // ISO-3166 alpha-2
  name: string;
  flag: string;
}

// Turn "GB" into 🇬🇧 using Unicode regional-indicator letters.
export function flagEmoji(code: string): string {
  const cc = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "🏳️";
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

// [code, name] pairs — sovereign states plus the territories travellers commonly
// visit. The exported COUNTRIES adds derived flags and sorts by name.
const RAW: [string, string][] = [
  ["AF", "Afghanistan"], ["AL", "Albania"], ["DZ", "Algeria"], ["AD", "Andorra"], ["AO", "Angola"],
  ["AG", "Antigua and Barbuda"], ["AR", "Argentina"], ["AM", "Armenia"], ["AW", "Aruba"], ["AU", "Australia"],
  ["AT", "Austria"], ["AZ", "Azerbaijan"], ["BS", "Bahamas"], ["BH", "Bahrain"], ["BD", "Bangladesh"],
  ["BB", "Barbados"], ["BY", "Belarus"], ["BE", "Belgium"], ["BZ", "Belize"], ["BJ", "Benin"],
  ["BM", "Bermuda"], ["BT", "Bhutan"], ["BO", "Bolivia"], ["BA", "Bosnia and Herzegovina"], ["BW", "Botswana"],
  ["BR", "Brazil"], ["BN", "Brunei"], ["BG", "Bulgaria"], ["BF", "Burkina Faso"], ["BI", "Burundi"],
  ["KH", "Cambodia"], ["CM", "Cameroon"], ["CA", "Canada"], ["CV", "Cape Verde"], ["KY", "Cayman Islands"],
  ["CF", "Central African Republic"], ["TD", "Chad"], ["CL", "Chile"], ["CN", "China"], ["CO", "Colombia"],
  ["KM", "Comoros"], ["CG", "Congo"], ["CD", "Congo (DRC)"], ["CR", "Costa Rica"], ["CI", "Côte d'Ivoire"],
  ["HR", "Croatia"], ["CU", "Cuba"], ["CW", "Curaçao"], ["CY", "Cyprus"], ["CZ", "Czechia"],
  ["DK", "Denmark"], ["DJ", "Djibouti"], ["DM", "Dominica"], ["DO", "Dominican Republic"], ["EC", "Ecuador"],
  ["EG", "Egypt"], ["SV", "El Salvador"], ["GQ", "Equatorial Guinea"], ["ER", "Eritrea"], ["EE", "Estonia"],
  ["SZ", "Eswatini"], ["ET", "Ethiopia"], ["FJ", "Fiji"], ["FI", "Finland"], ["FR", "France"],
  ["PF", "French Polynesia"], ["GA", "Gabon"], ["GM", "Gambia"], ["GE", "Georgia"], ["DE", "Germany"],
  ["GH", "Ghana"], ["GI", "Gibraltar"], ["GR", "Greece"], ["GL", "Greenland"], ["GD", "Grenada"],
  ["GP", "Guadeloupe"], ["GU", "Guam"], ["GT", "Guatemala"], ["GG", "Guernsey"], ["GN", "Guinea"],
  ["GW", "Guinea-Bissau"], ["GY", "Guyana"], ["HT", "Haiti"], ["HN", "Honduras"], ["HK", "Hong Kong"],
  ["HU", "Hungary"], ["IS", "Iceland"], ["IN", "India"], ["ID", "Indonesia"], ["IR", "Iran"],
  ["IQ", "Iraq"], ["IE", "Ireland"], ["IM", "Isle of Man"], ["IL", "Israel"], ["IT", "Italy"],
  ["JM", "Jamaica"], ["JP", "Japan"], ["JE", "Jersey"], ["JO", "Jordan"], ["KZ", "Kazakhstan"],
  ["KE", "Kenya"], ["KI", "Kiribati"], ["KW", "Kuwait"], ["KG", "Kyrgyzstan"], ["LA", "Laos"],
  ["LV", "Latvia"], ["LB", "Lebanon"], ["LS", "Lesotho"], ["LR", "Liberia"], ["LY", "Libya"],
  ["LI", "Liechtenstein"], ["LT", "Lithuania"], ["LU", "Luxembourg"], ["MO", "Macau"], ["MG", "Madagascar"],
  ["MW", "Malawi"], ["MY", "Malaysia"], ["MV", "Maldives"], ["ML", "Mali"], ["MT", "Malta"],
  ["MH", "Marshall Islands"], ["MQ", "Martinique"], ["MR", "Mauritania"], ["MU", "Mauritius"], ["MX", "Mexico"],
  ["FM", "Micronesia"], ["MD", "Moldova"], ["MC", "Monaco"], ["MN", "Mongolia"], ["ME", "Montenegro"],
  ["MA", "Morocco"], ["MZ", "Mozambique"], ["MM", "Myanmar"], ["NA", "Namibia"], ["NR", "Nauru"],
  ["NP", "Nepal"], ["NL", "Netherlands"], ["NC", "New Caledonia"], ["NZ", "New Zealand"], ["NI", "Nicaragua"],
  ["NE", "Niger"], ["NG", "Nigeria"], ["MK", "North Macedonia"], ["NO", "Norway"], ["OM", "Oman"],
  ["PK", "Pakistan"], ["PW", "Palau"], ["PS", "Palestinian Territories"], ["PA", "Panama"], ["PG", "Papua New Guinea"],
  ["PY", "Paraguay"], ["PE", "Peru"], ["PH", "Philippines"], ["PL", "Poland"], ["PT", "Portugal"],
  ["PR", "Puerto Rico"], ["QA", "Qatar"], ["RE", "Réunion"], ["RO", "Romania"], ["RU", "Russia"],
  ["RW", "Rwanda"], ["KN", "Saint Kitts and Nevis"], ["LC", "Saint Lucia"], ["VC", "Saint Vincent and the Grenadines"], ["WS", "Samoa"],
  ["SM", "San Marino"], ["ST", "São Tomé and Príncipe"], ["SA", "Saudi Arabia"], ["SN", "Senegal"], ["RS", "Serbia"],
  ["SC", "Seychelles"], ["SL", "Sierra Leone"], ["SG", "Singapore"], ["SX", "Sint Maarten"], ["SK", "Slovakia"],
  ["SI", "Slovenia"], ["SB", "Solomon Islands"], ["SO", "Somalia"], ["ZA", "South Africa"], ["KR", "South Korea"],
  ["SS", "South Sudan"], ["ES", "Spain"], ["LK", "Sri Lanka"], ["SD", "Sudan"], ["SR", "Suriname"],
  ["SE", "Sweden"], ["CH", "Switzerland"], ["SY", "Syria"], ["TW", "Taiwan"], ["TJ", "Tajikistan"],
  ["TZ", "Tanzania"], ["TH", "Thailand"], ["TL", "Timor-Leste"], ["TG", "Togo"], ["TO", "Tonga"],
  ["TT", "Trinidad and Tobago"], ["TN", "Tunisia"], ["TR", "Türkiye"], ["TM", "Turkmenistan"], ["TC", "Turks and Caicos"],
  ["TV", "Tuvalu"], ["UG", "Uganda"], ["UA", "Ukraine"], ["AE", "United Arab Emirates"], ["GB", "United Kingdom"],
  ["US", "United States"], ["UY", "Uruguay"], ["UZ", "Uzbekistan"], ["VU", "Vanuatu"], ["VA", "Vatican City"],
  ["VE", "Venezuela"], ["VN", "Vietnam"], ["VG", "British Virgin Islands"], ["VI", "US Virgin Islands"], ["YE", "Yemen"],
  ["ZM", "Zambia"], ["ZW", "Zimbabwe"],
];

export const COUNTRIES: Country[] = RAW.map(([code, name]) => ({ code, name, flag: flagEmoji(code) })).sort((a, b) =>
  a.name.localeCompare(b.name),
);

export const COUNTRY_BY_CODE: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c]),
);

export function findCountry(code: string): Country | undefined {
  return COUNTRY_BY_CODE[code.trim().toUpperCase()];
}
