"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { useApiKey } from "@/lib/apiKey";
import { UserButton } from "@clerk/nextjs";

export default function Header({
  onBurger,
  burgerExpanded,
}: {
  onBurger: () => void;
  burgerExpanded: boolean;
}) {
  const { apiKey } = useApiKey();
  return (
    <header className="sticky top-0 z-40 -mx-4 sm:-mx-6 md:-mx-8 bg-gradient-to-b from-zinc-950/70 to-zinc-900/40 backdrop-blur-md border-b border-white/10">
      <div className="px-4 sm:px-6 md:px-8 py-4 grid grid-cols-3 items-center gap-4">
        {/* Left: burger (mobile) */}
        <div className="flex items-center">
          <button
            className="md:hidden inline-flex items-center justify-center rounded-md border border-white/15 bg-white/5 hover:bg-white/10 p-2"
            aria-label="Open sidebar"
            aria-controls="sidebar"
            aria-expanded={burgerExpanded}
            onClick={onBurger}
          >
            <Menu className="size-4" />
          </button>
        </div>
        {/* Center: Logo + Title (always centered) */}
        <div className="flex items-center justify-center">
          <Link href="/" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 rounded-md">
            <div className="shrink-0 rounded-xl overflow-hidden border border-white/10 bg-white/10">
              <Image src="/logo.webp" width={40} height={40} alt="PromptBridge logo" />
            </div>
            <div className="text-center">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">PromptBridge</h1>
              <p className="hidden sm:block text-xs opacity-80">Prompt multiple models side-by-side.</p>
            </div>
          </Link>
        </div>
        {/* Right: actions */}
        <div className="flex items-center justify-end gap-3">
          {!apiKey && (
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium leading-5 whitespace-nowrap bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
            >
              Set API Key
            </Link>
          )}
          <UserButton 
            afterSignOutUrl="/login"
            appearance={{
              elements: {
                avatarBox: "w-8 h-8",
                userButtonTrigger: "focus:shadow-none"
              }
            }}
          />
        </div>
      </div>
    </header>
  );
}
