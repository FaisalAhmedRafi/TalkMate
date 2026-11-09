import { parsePhoneNumberFromString, validatePhoneNumberLength, type CountryCode } from "libphonenumber-js";
import { countryByCode, UNAVAILABLE } from "./countries";

export type PhoneCheck =
  | { ok: true; e164: string; national: string; country?: CountryCode }
  | { ok: false; message: string };

/**
 * Checks a phone number the way the server does (same library): the digits must make a real number for the chosen
 * country code. `dial` is the country whose calling code is selected; a number typed with a leading "+" brings its own.
 * On success `e164` is what is sent to the API (e.g. "+8801712345678").
 */
export function checkPhone(raw: string, dial: CountryCode | null): PhoneCheck {
  const text = raw.trim();
  if (!text) return { ok: false, message: "Please enter your phone number." };
  const international = text.startsWith("+");
  if (!dial && !international) return { ok: false, message: "Choose your country code first." };
  const where = international ? "that country" : `${countryByCode(dial)?.name ?? "that country"} (+${countryByCode(dial)?.dial})`;
  const bad = validatePhoneNumberLength(text, dial ?? undefined);
  if (bad === "TOO_SHORT") return { ok: false, message: `That phone number is too short for ${where}.` };
  if (bad === "TOO_LONG") return { ok: false, message: `That phone number is too long for ${where}.` };
  const p = parsePhoneNumberFromString(text, dial ?? undefined);
  if (p?.country && UNAVAILABLE.has(p.country)) return { ok: false, message: "Please use a phone number from one of the listed countries." };
  if (!p || !p.isValid()) return { ok: false, message: `Enter a valid phone number for ${where}.` };
  return { ok: true, e164: p.number, national: p.formatNational(), country: p.country };
}
