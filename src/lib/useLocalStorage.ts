"use client";

import { useEffect, useMemo, useState } from "react";

// Reusable typed localStorage hook with immediate client-side hydration.
export default function useLocalStorage<T>(key: string, initial: T) {
  const isBrowser = typeof window !== "undefined";

  // Read once, synchronously on first render (client-only)
  const initialValue = useMemo<T>(() => {
    if (!isBrowser) return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  }, [isBrowser, key, initial]);

  const [value, setValue] = useState<T>(initialValue);

  // Persist on change
  useEffect(() => {
    if (!isBrowser) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [isBrowser, key, value]);

  return [value, setValue] as const;
}
