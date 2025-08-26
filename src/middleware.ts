export { auth as middleware } from "@/auth";

// Protect everything by default except explicit public paths
export const config = {
  matcher: [
    "/((?!api/auth|api/health|login|register|_next/static|_next/image|favicon.ico|public|.*\\..*).*)",
  ],
};

