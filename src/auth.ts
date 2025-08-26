import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { getUserByEmail, verifyPassword } from "@promptbridge/api";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  // Restrict what’s accessible before login via middleware's authorized callback
  authorized({ request, auth }) {
    const { pathname } = request.nextUrl;
    // Public pages
    if (pathname === "/login") return true;
    // Public API endpoints for auth and health/status/initial registration only
    if (
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/api/health") ||
      pathname.startsWith("/api/status") ||
      pathname.startsWith("/api/register")
    ) {
      return true;
    }
    // Everything else requires an authenticated user
    return !!auth?.user;
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (rawCreds) => {
        const parsed = credentialsSchema.safeParse(rawCreds);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const user = await getUserByEmail(email);
        if (!user) return null;
        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user && typeof (user as Record<string, unknown>).id === "string") {
        token.sub = (user as Record<string, string>).id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
});

