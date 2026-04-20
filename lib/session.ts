import type { Session, User } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  isPrismaDatabaseUnavailable,
  logPrismaAvailabilityWarning,
  prisma,
} from "@/lib/prisma";

type SessionWithUser = Session & { user: User };

async function getValidSessionByToken(token: string | undefined): Promise<SessionWithUser | null> {
  if (!token) return null;

  let session: SessionWithUser | null = null;

  try {
    session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
  } catch (error) {
    if (isPrismaDatabaseUnavailable(error)) {
      logPrismaAvailabilityWarning("Session lookup skipped", error);
      return null;
    }

    throw error;
  }

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session;
}

export async function getCurrentSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get("session_token")?.value;
}

export async function getCurrentSession() {
  const token = await getCurrentSessionToken();
  return getValidSessionByToken(token);
}

export async function getSessionUser(request: NextRequest) {
  const token = request.cookies.get("session_token")?.value;
  const session = await getValidSessionByToken(token);
  if (!session) return null;
  return session.user;
}

export async function getCurrentSessionUser() {
  const session = await getCurrentSession();
  if (!session) return null;
  return session.user;
}

export async function getCurrentAdminUser() {
  const user = await getCurrentSessionUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export function unauthorizedResponse(message?: string) {
  return NextResponse.json(message ? { success: false, message } : { success: false }, { status: 401 });
}

export function forbiddenResponse(message?: string) {
  return NextResponse.json(message ? { success: false, message } : { success: false }, { status: 403 });
}

export function buildPublicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    loyaltyPoints: user.loyaltyPoints,
    createdAt: user.createdAt,
  };
}
