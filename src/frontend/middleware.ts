import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public paths and customer paths that do not require port worker authentication
const PUBLIC_PATHS = ["/login", "/port/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignore static assets, next internals, and favicon
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 1. Root page is the landing page / portal selector (or authenticated landing)
  if (pathname === "/") {
    return NextResponse.next();
  }

  // 2. Customer module paths manage their own authentication
  if (pathname.startsWith("/customer")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("naviops_token")?.value;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  // 3. If unauthenticated and accessing a protected port worker page, redirect to /port/login
  if (!token && !isPublicPath) {
    const loginUrl = new URL("/port/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. If already authenticated with port token and accessing login, redirect to overview
  if (token && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
