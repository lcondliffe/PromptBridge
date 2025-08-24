"use client";

import { useEffect, useRef, useState } from "react";

// Reusable typed localStorage hook that avoids SSR/client hydration mismatches
export default function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const hydratedRef = useRef(false);

  // Load after mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {}
    hydratedRef.current = true;
  }, [key]);

  // Persist after hydration
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue] as const;
}
