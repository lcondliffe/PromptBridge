"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => !cancelled && setHasUsers(!!d?.hasUsers))
      .catch(() => !cancelled && setHasUsers(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (hasUsers === false) {
      // First-run: create initial admin via register API then sign in
      try {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || "Failed to create admin");
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to create admin user";
        setError(message);
        setLoading(false);
        return;
      }
    }
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/");
    }
  }

  const heading = hasUsers === false ? "Create initial admin" : "Sign in";
  const buttonText = loading ? (hasUsers === false ? "Creating..." : "Signing in...") : heading;

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <form onSubmit={onSubmit} className="space-y-4">
          <h1 className="text-2xl font-semibold">{heading}</h1>
          <div className="space-y-1">
            <label className="block text-sm">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
              minLength={6}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full bg-black text-white rounded px-3 py-2 disabled:opacity-60"
            disabled={loading || hasUsers === null}
          >
            {buttonText}
          </button>
        </form>
        <p className="text-sm text-center">
          Don't have an account?
          <a
            className="underline ml-1"
            href="/register"
            onClick={() => {
              // Also trigger client-side navigation for snappy UX
              router.push("/register");
            }}
          >
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}

