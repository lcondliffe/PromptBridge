"use client";

import { createContext, useContext } from "react";
import useLocalStorage from "@/lib/useLocalStorage";

type ApiKeyContextValue = {
  apiKey: string;
  setApiKey: (v: string) => void;
};

const ApiKeyCtx = createContext<ApiKeyContextValue | null>(null);

export function ApiKeyProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = useLocalStorage<string>("openrouter_api_key", "");
  return (
    <ApiKeyCtx.Provider value={{ apiKey, setApiKey }}>{children}</ApiKeyCtx.Provider>
  );
}

export function useApiKey() {
  const ctx = useContext(ApiKeyCtx);
  if (!ctx) throw new Error("useApiKey must be used within ApiKeyProvider");
  return ctx;
}
