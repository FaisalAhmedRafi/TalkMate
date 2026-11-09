import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";
import metadata from "libphonenumber-js/metadata.min.json";

export type Country = { code: CountryCode; name: string; dial: string; search: string };

// Not offered in the country list or the calling-code list: Ascension Island and Tristan da Cunha (no flag picture) and Israel (removed on request)
const SKIP = new Set<string>(["AC", "TA", "IL"]);
/** Countries whose phone numbers are refused (the server refuses them too). */
export const UNAVAILABLE = new Set<string>(["IL"]);
const plain = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

let cache: Country[] | null = null;
let byCode: Map<string, Country> | null = null;

/** Every country (ISO code, English name, calling code), A to Z. Names come from the browser's own region names. */
export function countries(): Country[] {
  if (cache) return cache;
  let names: Intl.DisplayNames | null = null;
  try { names = new Intl.DisplayNames(["en"], { type: "region" }); } catch { /* very old browser: fall back to the codes */ }
  cache = getCountries()
    .filter((c) => !SKIP.has(c))
    .map((code) => {
      const name = names?.of(code) ?? code;
      const dial = getCountryCallingCode(code);
      return { code, name, dial, search: `${plain(name)} ${code.toLowerCase()} ${dial}` };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  byCode = new Map(cache.map((c) => [c.code, c]));
  return cache;
}

export function countryByCode(code: string | null | undefined): Country | null {
  if (!code) return null;
  countries();
  return byCode!.get(code.toUpperCase()) ?? null;
}

/** Countries matching what the person typed: part of the name, the 2-letter code, or the calling code ("880" or "+880"). */
export function searchCountries(list: Country[], query: string): Country[] {
  const q = plain(query.trim()).replace(/^\+/, "");
  if (!q) return list;
  const starts: Country[] = [];
  const rest: Country[] = [];
  for (const c of list) {
    if (!c.search.includes(q)) continue;
    (plain(c.name).startsWith(q) || c.code.toLowerCase() === q || c.dial === q ? starts : rest).push(c);
  }
  return [...starts, ...rest];
}

/** The main country of a calling code (+44 is the United Kingdom, not Guernsey; +1 is the United States). */
export function mainCountry(callingCode: string): CountryCode | null {
  const list = (metadata as unknown as { country_calling_codes: Record<string, string[]> }).country_calling_codes[callingCode];
  const first = list?.[0] as CountryCode | undefined;
  return first && !SKIP.has(first) ? first : null;
}
