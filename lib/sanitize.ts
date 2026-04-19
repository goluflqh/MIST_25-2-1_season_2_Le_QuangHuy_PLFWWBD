/**
 * Input sanitization utilities.
 * Prevents XSS and ensures data consistency.
 */

/** Strip HTML tags and trim whitespace */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

/** Normalize Vietnamese phone number to 0xxx format */
export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\.\(\)]/g, "");
  if (cleaned.startsWith("+84")) cleaned = "0" + cleaned.slice(3);
  if (cleaned.startsWith("84") && cleaned.length === 11) cleaned = "0" + cleaned.slice(2);
  return cleaned;
}

/** Validate Vietnamese phone format */
export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^0\d{9}$/.test(normalized);
}

/** Validate password strength */
export function isStrongPassword(password: string): boolean {
  return password.length >= 6;
}
