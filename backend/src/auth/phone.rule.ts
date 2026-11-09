import { getCountries, parsePhoneNumberFromString } from 'libphonenumber-js';

// Sign-up asks for a country and a phone number. The phone number is validated (right digits for its country) and stored in
// international E.164 form, e.g. "+8801712345678". The browser runs the same library, so both sides agree.
// Israel is not offered at sign-up (same list as the frontend's `lib/countries.ts`)
const UNAVAILABLE = new Set<string>(['IL']);
const COUNTRIES = new Set<string>(getCountries().filter((c) => !UNAVAILABLE.has(c)));

export const COUNTRY_MESSAGE = 'Please select your country.';
export const PHONE_MESSAGE = 'Please enter a valid phone number with its country code.';

/** "bd" or "BD" -> "BD"; null when it is not a country we know. */
export function normalizeCountry(code: string | undefined): string | null {
  const c = (code ?? '').trim().toUpperCase();
  return COUNTRIES.has(c) ? c : null;
}

/** "+880 1712-345678" -> "+8801712345678"; null when it is not a real, complete phone number. */
export function normalizePhone(raw: string | undefined): string | null {
  const p = parsePhoneNumberFromString((raw ?? '').trim()); // no default country: the number must start with +<country code>
  if (!p?.isValid() || (p.country && UNAVAILABLE.has(p.country))) return null;
  return p.number;
}
