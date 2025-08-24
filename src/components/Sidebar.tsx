"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";
import useLocalStorage from "@/lib/useLocalStorage";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

export default function Sidebar({ items, open, setOpen, desktopCollapsed, setDesktopCollapsed }: {
  items: NavItem[];
  open: boolean;
  setOpen: (v: boolean) => void;
  desktopCollapsed: boolean;
  setDesktopCollapsed: (v: boolean) => void;
}) {
  const pathname = usePathname();
  const firstLinkRef = useRef<HTMLAnchorElement | null>(null);
  const [prefersReduced] = useLocalStorage<boolean>("prefers_reduced_motion", false);

  // Focus the first link when mobile drawer opens
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => firstLinkRef.current?.focus(), 0);
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = origOverflow;
    };
  }, [open, setOpen]);

  // Desktop width
  const desktopWidth = desktopCollapsed ? 64 : 232;

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:block fixed top-0 left-0 h-screen border-r border-white/10 bg-black/30 backdrop-blur-md ${prefersReduced ? "" : "transition-[width] duration-200"}`}
        style={{ width: desktopWidth }}
        aria-label="Sidebar"
      >
        <div className="pt-20 px-3">
          <nav className="flex flex-col gap-1">
            {items.map((item, idx) => {
              const active = pathname === item.href;
              const Icon = item.icon as any;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-2 py-2 border border-transparent hover:border-white/10 ${active ? "bg-white/10" : "bg-white/0"}`}
                  ref={idx === 0 ? firstLinkRef : undefined}
                >
                  {Icon && <Icon className="size-4 opacity-90" />}
                  {!desktopCollapsed && <span className="text-sm">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
          <button
            className="mt-4 inline-flex items-center justify-center rounded-md border border-white/15 bg-white/5 hover:bg-white/10 p-2"
            onClick={() => setDesktopCollapsed(!desktopCollapsed)}
            aria-label={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {desktopCollapsed ? (
              <ChevronsRight className="size-4" />
            ) : (
              <ChevronsLeft className="size-4" />
            )}
          </button>
        </div>
      </aside>

      {/* Mobile drawer and backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-50 ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm ${prefersReduced ? "" : "transition-opacity duration-200"} ${open ? "opacity-100" : "opacity-0"}`}
          onClick={() => setOpen(false)}
        />
        {/* Panel */}
        <aside
          id="sidebar"
          role="dialog"
          aria-modal="true"
          className={`absolute top-0 left-0 h-full w-[80%] max-w-[280px] border-r border-white/10 bg-black/85 backdrop-blur-md ${prefersReduced ? "" : "transition-transform duration-200"} ${open ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="pt-20 px-3">
            <nav className="flex flex-col gap-1">
              {items.map((item, idx) => {
                const active = pathname === item.href;
                const Icon = item.icon as any;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`flex items-center gap-2 rounded-lg px-2 py-2 border border-transparent hover:border-white/10 ${active ? "bg-white/10" : "bg-white/0"}`}
                    onClick={() => setOpen(false)}
                    ref={idx === 0 ? firstLinkRef : undefined}
                  >
                    {Icon && <Icon className="size-4 opacity-90" />}
                    <span className="text-sm">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>
      </div>

      {/* Layout spacer for desktop */}
      <div className="hidden md:block" aria-hidden="true" style={{ width: desktopWidth }} />
    </>
  );
}
