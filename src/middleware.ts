import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public page path(s)
  const isPublicPage = pathname.startsWith("/login") || pathname.startsWith("/register");

  // Public API endpoints (pre-auth)
  const isPublicApi =
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/status") ||
    pathname.startsWith("/api/register");

  if (isPublicPage || isPublicApi) return NextResponse.next();

  const session = await auth();
  if (!session?.user) {
    const url = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Run middleware on everything except static assets and file requests.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};

