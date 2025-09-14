"use client";

import { useEffect, useMemo, useState, useRef } from "react";

// Reusable typed localStorage hook with immediate client-side hydration.
export default function useLocalStorage<T>(key: string, initial: T) {
  const isBrowser = typeof window !== "undefined";
  const previousKeyRef = useRef<string>(key);

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

  // Handle key changes: re-read from new key and optionally cleanup old key
  useEffect(() => {
    if (!isBrowser) return;
    
    const previousKey = previousKeyRef.current;
    
    // If key changed, read from the new key
    if (previousKey !== key) {
      try {
        const raw = window.localStorage.getItem(key);
        const newValue = raw !== null ? (JSON.parse(raw) as T) : initial;
        setValue(newValue);
        
        // Optional cleanup: remove the old key's value
        // Uncomment the next line if you want to clean up old keys
        // window.localStorage.removeItem(previousKey);
      } catch {
        setValue(initial);
      }
      
      previousKeyRef.current = key;
    }
  }, [isBrowser, key, initial]);

  // Persist on change
  useEffect(() => {
    if (!isBrowser) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [isBrowser, key, value]);

  return [value, setValue] as const;
}
