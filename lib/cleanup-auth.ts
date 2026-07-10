import { timingSafeEqual } from "node:crypto";

export type CleanupAuthStatus = "authorized" | "misconfigured" | "unauthorized";

export function getCleanupAuthStatus(
  authorizationHeader: string | null,
  configuredSecret: string | undefined
): CleanupAuthStatus {
  const secret = configuredSecret?.trim();
  if (!secret) return "misconfigured";
  if (!authorizationHeader) return "unauthorized";

  const actual = Buffer.from(authorizationHeader);
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length) return "unauthorized";

  return timingSafeEqual(actual, expected) ? "authorized" : "unauthorized";
}
