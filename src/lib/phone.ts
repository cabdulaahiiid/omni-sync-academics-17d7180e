/**
 * Ethiopian telephone validation + normalization.
 * Accepts: 09XXXXXXXX, 07XXXXXXXX, 9XXXXXXXX, 7XXXXXXXX, +2519XXXXXXXX,
 * 2517XXXXXXXX (spaces, dashes and parentheses ignored).
 * Stores as E.164: +251XXXXXXXXX
 */
export const PHONE_ERROR = "Please enter a valid parent/guardian telephone number.";

export function normalizeEtPhone(input: string | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).replace(/[\s\-().]/g, "");
  if (!raw) return null;
  let digits = raw.startsWith("+") ? raw.slice(1) : raw;
  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith("251")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  if (!/^[79]\d{8}$/.test(digits)) return null;
  return `+251${digits}`;
}

export function isValidEtPhone(input: string | null | undefined): boolean {
  if (input === null || input === undefined || String(input).trim() === "") return true;
  return normalizeEtPhone(input) !== null;
}
