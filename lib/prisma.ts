import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

const seenPrismaAvailabilityWarnings = new Set<string>();

export function isPrismaDatabaseUnavailable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    cause?: { message?: string } | string;
    name?: string;
    message?: string;
  };
  const name = candidate.name || "";
  const causeMessage =
    typeof candidate.cause === "string"
      ? candidate.cause
      : typeof candidate.cause === "object" && candidate.cause
        ? candidate.cause.message || ""
        : "";
  const message = [candidate.message || "", causeMessage].filter(Boolean).join("\n");

  if (name === "PrismaClientInitializationError") {
    return true;
  }

  return (
    message.includes("Can't reach database server") ||
    message.includes("Server has closed the connection") ||
    message.includes("Connection terminated unexpectedly") ||
    message.includes("the database system is not yet accepting connections") ||
    message.includes("the database system is starting up") ||
    message.includes("Consistent recovery state has not been yet reached") ||
    message.includes("Error querying the database")
  );
}

export function logPrismaAvailabilityWarning(scope: string, error: unknown) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown Prisma error";
  const key = `${scope}:${message}`;

  if (seenPrismaAvailabilityWarnings.has(key)) {
    return;
  }

  seenPrismaAvailabilityWarnings.add(key);
  console.warn(`[prisma] ${scope}: ${message}`);
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
