import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

async function getValidSessionByToken(token: string | undefined) {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session;
}

export async function getSessionUser(request: NextRequest) {
  const token = request.cookies.get("session_token")?.value;
  const session = await getValidSessionByToken(token);
  if (!session) return null;
  return session.user;
}

export async function getCurrentSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  const session = await getValidSessionByToken(token);
  if (!session) return null;
  return session.user;
}

export function requireAuth(handler: (req: NextRequest, user: { id: string; name: string; role: string }) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Vui lòng đăng nhập." },
        { status: 401 }
      );
    }
    return handler(request, user);
  };
}
