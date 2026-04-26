import { NextResponse } from "next/server";
import type { RateLimitResult } from "@/lib/rate-limit";

type JsonBody = Record<string, unknown>;

interface ErrorResponseOptions {
  extra?: JsonBody;
  headers?: HeadersInit;
  message: string;
  status: number;
}

export async function readJsonBody(request: Request): Promise<JsonBody | null> {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }

    return body as JsonBody;
  } catch {
    return null;
  }
}

export function createErrorResponse({
  extra,
  headers,
  message,
  status,
}: ErrorResponseOptions) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...extra,
    },
    { status, headers }
  );
}

export function createInvalidJsonResponse(
  message = "Du lieu gui len chua dung dinh dang. Anh/chi thu lai giup em nhe."
) {
  return createErrorResponse({ status: 400, message });
}

export function createRateLimitResponse(
  message: string,
  result: RateLimitResult,
  extra: JsonBody = {}
) {
  const retryAfterSec = Math.max(result.retryAfterSec, 1);

  return createErrorResponse({
    status: 429,
    message,
    extra: {
      retryAfterSec,
      ...extra,
    },
    headers: {
      "Retry-After": retryAfterSec.toString(),
      "X-RateLimit-Limit": result.limit.toString(),
      "X-RateLimit-Remaining": Math.max(result.remaining, 0).toString(),
      "X-RateLimit-Reset": Math.ceil(result.resetAt / 1000).toString(),
    },
  });
}

export function logApiError(
  scope: string,
  error: unknown,
  context?: Record<string, unknown>
) {
  if (context) {
    console.error(`[${scope}]`, {
      ...context,
      error,
    });
    return;
  }

  console.error(`[${scope}]`, error);
}
