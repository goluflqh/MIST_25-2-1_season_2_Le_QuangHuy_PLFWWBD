/**
 * In-memory rate limiter for API routes.
 * Tracks request counts per IP within sliding windows.
 * For production with multiple instances, switch to Redis/Upstash.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Auto-cleanup expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
  windowSec: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = identifier;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowSec * 1000 });
    return { allowed: true, remaining: config.limit - 1, resetAt: now + config.windowSec * 1000 };
  }

  entry.count++;
  store.set(key, entry);

  if (entry.count > config.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: config.limit - entry.count, resetAt: entry.resetAt };
}

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/** Preset configs for common endpoints */
export const RATE_LIMITS = {
  login: { limit: 5, windowSec: 15 * 60 } as RateLimitConfig,       // 5 req / 15 min
  register: { limit: 3, windowSec: 60 * 60 } as RateLimitConfig,     // 3 req / hour
  chat: { limit: 15, windowSec: 60 } as RateLimitConfig,             // 15 req / min
  contact: { limit: 5, windowSec: 10 * 60 } as RateLimitConfig,      // 5 req / 10 min
  general: { limit: 30, windowSec: 60 } as RateLimitConfig,          // 30 req / min
} as const;
