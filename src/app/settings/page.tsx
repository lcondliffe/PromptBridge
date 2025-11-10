"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useApiKey } from "@/lib/apiKey";
import { useUser, useClerk } from "@clerk/nextjs";
import useLocalStorage from "@/lib/useLocalStorage";
import { fetchModels } from "@/lib/openrouter";
import type { ModelInfo } from "@/lib/types";
import VendorLogo from "@/components/VendorLogo";

// System default models (fallback when user hasn't configured their own)
const SYSTEM_DEFAULT_MODELS = [
  "openai/gpt-5-chat",
  "anthropic/claude-sonnet-4",
  "google/gemini-2.5-flash",
];

export default function SettingsPage() {
  const { apiKey, setApiKey } = useApiKey();
  const [show, setShow] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();

  // Default models configuration
  const [defaultModels, setDefaultModels] = useLocalStorage<string[]>("default_models", []);
  const [search, setSearch] = useState("");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModelList, setShowModelList] = useState(false);

  // Fetch models when API key is available
  useEffect(() => {
    if (!apiKey) {
      setModels([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    
    fetchModels(apiKey)
      .then((list) => {
        setModels(list);
        setError(null);
      })
      .catch(() => {
        setError("Failed to load models");
        setModels([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [apiKey]);

  // Helper to display model name without vendor prefix
  const modelDisplayName = useCallback((id: string, model?: ModelInfo) => {
    const nm = model?.name;
    if (typeof nm === "string" && nm.length > 0) {
      const idx = nm.indexOf(":");
      if (idx >= 0) return nm.slice(idx + 1).trim();
      return nm;
    }
    const slug = id.includes("/") ? id.split("/")[1] : id;
    return slug.replace(/-/g, " ");
  }, []);

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    if (!search.trim()) return models;
    const q = search.toLowerCase();
    return models.filter((m) => {
      const displayName = modelDisplayName(m.id, m).toLowerCase();
      return m.id.toLowerCase().includes(q) || displayName.includes(q);
    });
  }, [models, search, modelDisplayName]);

  // Toggle model selection
  const toggleModel = (id: string) => {
    setDefaultModels((prev) => 
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Reset to system defaults
  const resetDefaults = () => {
    setDefaultModels(SYSTEM_DEFAULT_MODELS);
  };

  // Clear all defaults
  const clearAllDefaults = () => {
    setDefaultModels([]);
  };

  // Build models by ID map for chip rendering
  const modelsById = useMemo(() => {
    const map: Record<string, ModelInfo> = {};
    for (const m of models) map[m.id] = m;
    return map;
  }, [models]);

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-4">Settings</h2>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
        <label className="block text-xs opacity-80 mb-1">OpenRouter API Key</label>
        <div className="flex items-center gap-2">
          <input
            type={show ? "text" : "password"}
            placeholder="sk-or-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="flex-1 px-2 py-1.5 rounded-md border border-white/10 bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
          />
          <button
            className="rounded-md px-2 py-1 text-xs border border-white/15 bg-white/5 hover:bg-white/10"
            type="button"
            onClick={() => setShow((v) => !v)}
          >
            {show ? "Hide" : "Show"}
          </button>
          <button
            className="rounded-md px-2 py-1 text-xs border border-white/15 bg-white/5 hover:bg-white/10"
            type="button"
            onClick={() => {
              try { localStorage.removeItem("openrouter_api_key"); } catch {}
              setApiKey("");
            }}
          >
            Clear
          </button>
        </div>
        <p className="text-[11px] opacity-70 mt-1">Stored locally in your browser. Not sent to any server.</p>
      </div>

      {/* Default Models section */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
        <h3 className="font-medium mb-2">Default Models</h3>
        <p className="text-xs opacity-70 mb-3">
          These models will be loaded when you click &quot;Load my defaults&quot; on the home page and will be auto-selected for first-time users.
        </p>

        {/* Selected defaults as chips */}
        {defaultModels.length > 0 && (
          <div className="mb-3">
            <label className="block text-xs opacity-80 mb-2">Selected ({defaultModels.length})</label>
            <div className="flex flex-wrap gap-2">
              {defaultModels.map((id) => {
                const model = modelsById[id];
                const isAvailable = !!model;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs"
                  >
                    <VendorLogo modelId={id} size={16} className="shrink-0" />
                    <span className="truncate max-w-[200px]" title={id}>
                      {isAvailable ? modelDisplayName(id, model) : id}
                    </span>
                    {!isAvailable && (
                      <span className="text-yellow-400 text-[10px]">(unavailable)</span>
                    )}
                    <button
                      className="p-0.5 rounded hover:bg-white/10"
                      onClick={() => toggleModel(id)}
                      aria-label={`Remove ${id}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            className="rounded-md px-2.5 py-1.5 text-xs border border-white/15 bg-white/5 hover:bg-white/10"
            onClick={() => setShowModelList((v) => !v)}
          >
            {showModelList ? "Hide model list" : "Browse models"}
          </button>
          <button
            className="rounded-md px-2.5 py-1.5 text-xs border border-white/15 bg-white/5 hover:bg-white/10"
            onClick={resetDefaults}
          >
            Reset to system defaults
          </button>
          <button
            className="rounded-md px-2.5 py-1.5 text-xs border border-white/15 bg-white/5 hover:bg-white/10"
            onClick={clearAllDefaults}
            disabled={defaultModels.length === 0}
          >
            Clear all
          </button>
        </div>

        {/* Model browser */}
        {showModelList && (
          <div className="space-y-3">
            {!apiKey ? (
              <p className="text-sm text-yellow-400/80">
                Please set your OpenRouter API key above to load available models.
              </p>
            ) : loading ? (
              <p className="text-sm opacity-70">Loading models...</p>
            ) : error ? (
              <div className="space-y-2">
                <p className="text-sm text-red-400">{error}</p>
                <button
                  className="rounded-md px-2.5 py-1.5 text-xs border border-white/15 bg-white/5 hover:bg-white/10"
                  onClick={() => {
                    if (apiKey) {
                      setLoading(true);
                      setError(null);
                      fetchModels(apiKey)
                        .then(setModels)
                        .catch(() => setError("Failed to load models"))
                        .finally(() => setLoading(false));
                    }
                  }}
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                {/* Search input */}
                <input
                  type="search"
                  placeholder="Search models..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-md border border-white/10 bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
                />

                {/* Model list */}
                <div className="max-h-64 overflow-auto grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1">
                  {filteredModels.length === 0 ? (
                    <p className="text-sm opacity-70 col-span-full">No models found.</p>
                  ) : (
                    filteredModels.map((m) => {
                      const checked = defaultModels.includes(m.id);
                      return (
                        <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleModel(m.id)}
                          />
                          <VendorLogo modelId={m.id} size={18} className="shrink-0" />
                          <span className="truncate" title={m.id}>
                            {modelDisplayName(m.id, m)}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>

                {filteredModels.length > 0 && (
                  <p className="text-[11px] opacity-70">
                    Showing {filteredModels.length} of {models.length} models
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Account section */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
        <h3 className="font-medium mb-2">Account</h3>
        <p className="text-sm opacity-80 mb-3">
          {user?.emailAddresses[0]?.emailAddress ? `Signed in as ${user.emailAddresses[0].emailAddress}` : "Signed in"}
        </p>
        <button
          type="button"
          className="rounded-md px-3 py-2 text-sm border border-white/15 bg-white/5 hover:bg-white/10"
          onClick={() => signOut({ redirectUrl: "/login" })}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
