// tz-lookup ships no type definitions. It exports a single function that maps a
// latitude/longitude to its IANA timezone name (throwing on out-of-range input).
declare module "tz-lookup" {
  export default function tzlookup(lat: number, lng: number): string;
}
