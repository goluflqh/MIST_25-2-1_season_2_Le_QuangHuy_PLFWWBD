/**
 * Rate limiter for API routes.
 * Uses in-memory storage in development and a database bucket in production.
 */

import { isPrismaDatabaseUnavailable, logPrismaAvailabilityWarning, prisma } from "@/lib/prisma";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Auto-cleanup expired entries every 5 minutes.
if (typeof setInterval !== "undefined") {
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  if (typeof cleanupInterval === "object" && typeof cleanupInterval.unref === "function") {
    cleanupInterval.unref();
  }
}

interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
  limit: number;
  count: number;
}

function getRetryAfterSeconds(resetAt: number, now: number) {
  return Math.max(Math.ceil((resetAt - now) / 1000), 0);
}

function buildResult(entry: RateLimitEntry, config: RateLimitConfig, now: number): RateLimitResult {
  const allowed = entry.count < config.limit;

  return {
    allowed,
    remaining: Math.max(config.limit - entry.count, 0),
    resetAt: entry.resetAt,
    retryAfterSec: allowed ? 0 : getRetryAfterSeconds(entry.resetAt, now),
    limit: config.limit,
    count: entry.count,
  };
}

function shouldUsePersistentRateLimit() {
  return process.env.RATE_LIMIT_STORE === "database" || process.env.NODE_ENV === "production";
}

function getWindowResetAt(now: number, config: RateLimitConfig) {
  return now + config.windowSec * 1000;
}

function buildEmptyResult(config: RateLimitConfig, now: number): RateLimitResult {
  return {
    allowed: true,
    remaining: config.limit,
    resetAt: getWindowResetAt(now, config),
    retryAfterSec: 0,
    limit: config.limit,
    count: 0,
  };
}

function logPersistentRateLimitFallback(scope: string, error: unknown) {
  if (isPrismaDatabaseUnavailable(error)) {
    logPrismaAvailabilityWarning(`${scope} rate limit fallback`, error);
    return;
  }

  console.error(`[rate-limit] ${scope} fallback:`, error);
}

export function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || now > entry.resetAt) {
    return buildEmptyResult(config, now);
  }

  return buildResult(entry, config, now);
}

export function consumeRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const current = store.get(identifier);

  const entry =
    !current || now > current.resetAt
      ? { count: 0, resetAt: getWindowResetAt(now, config) }
      : current;

  entry.count += 1;
  store.set(identifier, entry);

  return {
    allowed: entry.count <= config.limit,
    remaining: Math.max(config.limit - entry.count, 0),
    resetAt: entry.resetAt,
    retryAfterSec: entry.count <= config.limit ? 0 : getRetryAfterSeconds(entry.resetAt, now),
    limit: config.limit,
    count: entry.count,
  };
}

export function resetRateLimit(identifier: string) {
  store.delete(identifier);
}

export async function getRateLimitStatusForRequest(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (!shouldUsePersistentRateLimit()) {
    return getRateLimitStatus(identifier, config);
  }

  const now = Date.now();

  try {
    const entry = await prisma.rateLimitBucket.findUnique({ where: { identifier } });

    if (!entry || now > entry.resetAt.getTime()) {
      return buildEmptyResult(config, now);
    }

    return buildResult(
      { count: entry.count, resetAt: entry.resetAt.getTime() },
      config,
      now
    );
  } catch (error) {
    logPersistentRateLimitFallback("status", error);
    return getRateLimitStatus(identifier, config);
  }
}

export async function consumeRateLimitForRequest(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (!shouldUsePersistentRateLimit()) {
    return consumeRateLimit(identifier, config);
  }

  const now = Date.now();
  const resetAt = new Date(getWindowResetAt(now, config));

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const current = await tx.rateLimitBucket.findUnique({ where: { identifier } });

      if (!current || now > current.resetAt.getTime()) {
        return tx.rateLimitBucket.upsert({
          where: { identifier },
          create: { identifier, count: 1, resetAt },
          update: { count: 1, resetAt },
        });
      }

      return tx.rateLimitBucket.update({
        where: { identifier },
        data: { count: { increment: 1 } },
      });
    });

    return {
      allowed: entry.count <= config.limit,
      remaining: Math.max(config.limit - entry.count, 0),
      resetAt: entry.resetAt.getTime(),
      retryAfterSec: entry.count <= config.limit ? 0 : getRetryAfterSeconds(entry.resetAt.getTime(), now),
      limit: config.limit,
      count: entry.count,
    };
  } catch (error) {
    logPersistentRateLimitFallback("consume", error);
    return consumeRateLimit(identifier, config);
  }
}

export async function resetRateLimitForRequest(identifier: string) {
  resetRateLimit(identifier);

  if (!shouldUsePersistentRateLimit()) {
    return;
  }

  try {
    await prisma.rateLimitBucket.deleteMany({ where: { identifier } });
  } catch (error) {
    logPersistentRateLimitFallback("reset", error);
  }
}

// Backward-compatible alias for existing routes that consume the limit immediately.
export const checkRateLimit = consumeRateLimit;
export const checkRateLimitForRequest = consumeRateLimitForRequest;

export function formatDurationVi(totalSeconds: number) {
  const seconds = Math.max(Math.ceil(totalSeconds), 0);

  if (seconds < 60) {
    return `${seconds} giây`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes} phút`;
  }

  return `${minutes} phút ${remainingSeconds} giây`;
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
  login: { limit: 5, windowSec: 5 * 60 } as RateLimitConfig,
  register: { limit: 4, windowSec: 10 * 60 } as RateLimitConfig,
  chat: { limit: 15, windowSec: 60 } as RateLimitConfig,
  contact: { limit: 5, windowSec: 10 * 60 } as RateLimitConfig,
  general: { limit: 30, windowSec: 60 } as RateLimitConfig,
} as const;
