import { NextRequest, NextResponse } from "next/server";

// Routes that require authentication
const PROTECTED_ROUTES = ["/dashboard", "/tai-khoan"];
// Routes only for guests (redirect to account if already logged in)
const GUEST_ONLY_ROUTES = ["/dang-nhap", "/dang-ky"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get("session_token")?.value;

  // Check protected routes
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  if (isProtected && !sessionToken) {
    const loginUrl = new URL("/dang-nhap", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check guest-only routes (already logged in → redirect)
  const isGuestOnly = GUEST_ONLY_ROUTES.some((route) => pathname.startsWith(route));
  if (isGuestOnly && sessionToken) {
    return NextResponse.redirect(new URL("/tai-khoan", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/tai-khoan/:path*", "/dang-nhap", "/dang-ky"],
};
