"use client";

import { createContext, useContext } from "react";
import useLocalStorage from "@/lib/useLocalStorage";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { navItems } from "@/lib/nav";
import { ApiKeyProvider } from "@/lib/apiKey";

const SidebarCtx = createContext<{ open: boolean; setOpen: (v: boolean) => void; desktopCollapsed: boolean; setDesktopCollapsed: (v: boolean) => void } | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarCtx);
  if (!ctx) throw new Error("useSidebar must be used within ClientShell");
  return ctx;
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useLocalStorage<boolean>("sidebar_open", false);
  const [desktopCollapsed, setDesktopCollapsed] = useLocalStorage<boolean>("sidebar_collapsed", false);

  return (
    <SidebarCtx.Provider value={{ open, setOpen, desktopCollapsed, setDesktopCollapsed }}>
      <div className="relative min-h-screen text-zinc-100">
        {/* Backgrounds copied from existing page for consistency */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-zinc-950 via-neutral-900 to-zinc-900" />
        <div className="pointer-events-none absolute inset-0 opacity-10 [background:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:12px_12px]" />

        <div className="relative z-10 px-4 sm:px-6 md:px-8">
          <ApiKeyProvider>
            <Header onBurger={() => setOpen(!open)} burgerExpanded={open} />
            <div className="flex">
              <Sidebar
                items={navItems}
                open={open}
                setOpen={setOpen}
                desktopCollapsed={desktopCollapsed}
                setDesktopCollapsed={setDesktopCollapsed}
              />
              <main className="flex-1 pt-6 md:pt-8" style={{ marginLeft: 0 }}>
                {children}
              </main>
            </div>
          </ApiKeyProvider>
        </div>
      </div>
    </SidebarCtx.Provider>
  );
}
