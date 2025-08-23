"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Key, Send, Square, Copy, Maximize2, X } from "lucide-react";
import { fetchModels, streamChat } from "@/lib/openrouter";
import type { ChatMessage, ModelInfo } from "@/lib/types";

function useLocalStorage<T>(key: string, initial: T) {
  // Start with the provided initial value on both server and first client render
  // to avoid SSR/client hydration mismatches. Read localStorage after mount.
  const [value, setValue] = useState<T>(initial);
  const hydratedRef = useRef(false);

  // Load from localStorage after mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        setValue(JSON.parse(raw) as T);
      }
    } catch {}
    hydratedRef.current = true;
  }, [key]);

  // Persist to localStorage only after we've attempted to read existing value
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue] as const;
}

// Lightweight tooltip component to provide hover/focus explanations
function Tip({ text, children }: { text: string; children: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <div
        role="tooltip"
        className={`pointer-events-none absolute z-30 -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-pre-wrap rounded-md border border-white/10 bg-black/80 px-2 py-1 text-[11px] shadow transition duration-150 ${open ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
      >
        {text}
      </div>
    </div>
  );
}

export default function Home() {
  // API key handling
  const [apiKey, setApiKey] = useLocalStorage<string>("openrouter_api_key", "");
  const [showKey, setShowKey] = useState(false);

  // Models
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModels, setSelectedModels] = useLocalStorage<string[]>(
    "selected_models",
    []
  );
  const [temperature, setTemperature] = useLocalStorage<number>(
    "temperature",
    0.7
  );
  const [maxTokens, setMaxTokens] = useLocalStorage<number | undefined>(
    "max_tokens",
    1024
  );

  // Advanced sampling UI state
  const [showAdvanced, setShowAdvanced] = useLocalStorage<boolean>("show_advanced", false);
  const [topP, setTopP] = useLocalStorage<number | undefined>("top_p", undefined);
  const [topK, setTopK] = useLocalStorage<number | undefined>("top_k", undefined);
  const [freqPenalty, setFreqPenalty] = useLocalStorage<number | undefined>("frequency_penalty", undefined);
  const [presencePenalty, setPresencePenalty] = useLocalStorage<number | undefined>("presence_penalty", undefined);
  const [repetitionPenalty, setRepetitionPenalty] = useLocalStorage<number | undefined>("repetition_penalty", undefined);
  const [minP, setMinP] = useLocalStorage<number | undefined>("min_p", undefined);
  const [topA, setTopA] = useLocalStorage<number | undefined>("top_a", undefined);
  const [seed, setSeed] = useLocalStorage<number | undefined>("seed", undefined);
  const [stopStr, setStopStr] = useLocalStorage<string>("stop_str", "");

  // Prompt options
  const [limitWordsEnabled, setLimitWordsEnabled] = useLocalStorage<boolean>(
    "limit_words_enabled",
    false
  );
  const [limitWords, setLimitWords] = useLocalStorage<number>(
    "limit_words",
    200
  );

  // Responses state
  type Pane = {
    text: string;
    error?: string;
    running: boolean;
  };
  const [panes, setPanes] = useState<Record<string, Pane>>({});
  const controllersRef = useRef<Record<string, AbortController>>({});


  // Expanded (maximized) result pane
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Manage body scroll lock and Escape to close when expanded
  useEffect(() => {
    if (!expandedId) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
    };
  }, [expandedId]);

  const popularDefaults = [
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-sonnet",
    "deepseek/deepseek-r1",
    "meta-llama/llama-3.1-70b-instruct",
    "qwen/qwen2.5-72b-instruct",
    "mistralai/mistral-large-2",
  ];

  // Cache & fetch models (once per apiKey), with localStorage TTL
  const MODELS_CACHE_KEY = "openrouter_models_cache_v1";
  const MODELS_TTL_MS = 15 * 60 * 1000; // 15 minutes
  const lastModelsApiKeyRef = useRef<string | null>(null);

  function maybeInitSelections(list: ModelInfo[]) {
    try {
      const storedSel = window.localStorage.getItem("selected_models");
      const ids = list.map((m) => m.id);
      if (!storedSel) {
        const picks = popularDefaults.filter((id) => ids.includes(id)).slice(0, 4);
        if (picks.length > 0) setSelectedModels(picks);
      }
    } catch {}
  }

  useEffect(() => {
    if (!apiKey) return;
    // Avoid duplicate fetches for the same apiKey (StrictMode etc.)
    if (lastModelsApiKeyRef.current === apiKey && models.length > 0) return;

    let mounted = true;

    // Try cache first
    try {
      const raw = window.localStorage.getItem(MODELS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { ts?: number; data?: ModelInfo[] };
        if (parsed?.data && Array.isArray(parsed.data) && typeof parsed.ts === "number") {
          if (Date.now() - parsed.ts < MODELS_TTL_MS) {
            setModels(parsed.data);
            maybeInitSelections(parsed.data);
            lastModelsApiKeyRef.current = apiKey;
            return; // fresh cache; skip network
          }
        }
      }
    } catch {}

    (async () => {
      try {
        const list = await fetchModels(apiKey);
        if (!mounted) return;
        setModels(list);
        try {
          window.localStorage.setItem(
            MODELS_CACHE_KEY,
            JSON.stringify({ ts: Date.now(), data: list })
          );
        } catch {}
        maybeInitSelections(list);
        lastModelsApiKeyRef.current = apiKey;
      } catch (err) {
        console.error(err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [apiKey]);

  const [uiError, setUiError] = useState<string>("");

  const onSend = async (inputPrompt: string) => {
    if (!apiKey) {
      setUiError("Please set your OpenRouter API key first.");
      return;
    }
    if (selectedModels.length === 0) {
      setUiError("No models selected. Use ‘Browse models’ or search to pick at least one, then Send.");
      return;
    }
    setUiError("");

    // Apply prompt options
    const options: string[] = [];
    if (limitWordsEnabled && Number.isFinite(limitWords) && (limitWords as number) > 0) {
      options.push(`Please limit your answer to at most ${limitWords} words.`);
    }
    const finalPrompt = options.length
      ? `${inputPrompt}\n\nConstraints:\n- ${options.join("\n- ")}`
      : inputPrompt;

    // Reset panes
    const initial: Record<string, Pane> = {};
    for (const m of selectedModels) initial[m] = { text: "", running: true };
    setPanes(initial);

    // Start streaming for each model
    const baseMessages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are a helpful assistant. Answer clearly and concisely with reasoning when appropriate.",
      },
      { role: "user", content: finalPrompt },
    ];

    // Parse stop strings into array
    const stop = stopStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const traceId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    for (const model of selectedModels) {
      const handle = streamChat(
        {
          apiKey,
          model,
          messages: baseMessages,
          temperature,
          maxTokens,
          top_p: topP,
          top_k: topK,
          frequency_penalty: freqPenalty,
          presence_penalty: presencePenalty,
          repetition_penalty: repetitionPenalty,
          min_p: minP,
          top_a: topA,
          seed,
          stop,
          debug: true,
          traceId,
        },
        {
          onToken: (chunk) =>
            setPanes((p) => ({ ...p, [model]: { ...(p[model] || { text: "" }), text: (p[model]?.text || "") + chunk, running: true } })),
          onDone: () =>
            setPanes((p) => ({ ...p, [model]: { ...(p[model] || { text: "" }), running: false } })),
          onError: (err) =>
            setPanes((p) => ({ ...p, [model]: { ...(p[model] || { text: "" }), running: false, error: err.message } })),
        }
      );
      controllersRef.current[model] = handle.abortController;
      // Fire and forget promise
      handle.promise.catch(() => {});
    }
  };

  const stopAll = () => {
    Object.values(controllersRef.current).forEach((c) => c?.abort());
    controllersRef.current = {} as Record<string, AbortController>;
    setPanes((p) =>
      Object.fromEntries(
        Object.entries(p).map(([k, v]) => [k, { ...v, running: false }])
      ) as Record<string, Pane>
    );
  };


  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize the compose textarea as content grows/shrinks
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  const modelsById = useMemo(() => {
    const map: Record<string, ModelInfo> = {};
    for (const m of models) map[m.id] = m;
    return map;
  }, [models]);

  // Phase 1: Model selection helpers
  const [modelQuery, setModelQuery] = useLocalStorage<string>("model_query", "");
  const [modelSort, setModelSort] = useLocalStorage<"alpha" | "none">("model_sort", "alpha");
  const [selectedFirst, setSelectedFirst] = useLocalStorage<boolean>("model_selected_first", true);

  const filteredSortedModels = useMemo(() => {
    let list = models;
    // Filter
    const q = modelQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((m) => (m.name || m.id).toLowerCase().includes(q));
    }
    // Sort
    if (modelSort === "alpha") {
      list = [...list].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
    } else {
      list = [...list];
    }
    // Selected first
    if (selectedFirst && selectedModels.length > 0) {
      const selectedSet = new Set(selectedModels);
      list.sort((a, b) => Number(selectedSet.has(b.id)) - Number(selectedSet.has(a.id)));
    }
    return list;
  }, [models, modelQuery, modelSort, selectedFirst, selectedModels]);

  const filteredCount = useMemo(() => filteredSortedModels.length, [filteredSortedModels]);
  // Collapse/expand model list
  const [modelListOpen, setModelListOpen] = useState(false);
  const isSearching = modelQuery.trim().length > 0;
  const showModelList = modelListOpen || isSearching;

  // Helpers to safely parse numeric inputs
  function safeNum(v: string, min?: number, max?: number): number | undefined {
    if (v === "") return undefined;
    const n = Number(v);
    if (Number.isNaN(n)) return undefined;
    if (typeof min === "number" && n < min) return min;
    if (typeof max === "number" && n > max) return max;
    return n;
  }
  function safeInt(v: string, min?: number, max?: number): number | undefined {
    if (v === "") return undefined;
    const n = Math.floor(Number(v));
    if (Number.isNaN(n)) return undefined;
    if (typeof min === "number" && n < min) return min;
    if (typeof max === "number" && n > max) return max;
    return n;
  }

  return (
    <div className="relative min-h-screen text-zinc-100">
      {/* Background gradient and subtle grid overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-zinc-950 via-neutral-900 to-zinc-900" />
      <div className="pointer-events-none absolute inset-0 opacity-10 [background:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:12px_12px]" />

      <div className="relative z-10 px-4 sm:px-6 md:px-8">
        {/* Top-level UI error banner */}
        {uiError && (
          <div role="alert" className="mb-3 rounded-xl border border-red-400/20 bg-red-500/10 text-red-300 px-3 py-2 flex items-start justify-between gap-3">
            <span className="text-sm">{uiError}</span>
            <button className="px-2 py-1 text-xs rounded-md border border-white/10 hover:bg-white/10" onClick={() => setUiError("")}>Dismiss</button>
          </div>
        )}
        {/* Sticky header */}
        <header className="sticky top-0 z-50 -mx-4 sm:-mx-6 md:-mx-8 bg-gradient-to-b from-zinc-950/70 to-zinc-900/40 backdrop-blur-md border-b border-white/10">
          <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="shrink-0 rounded-xl overflow-hidden border border-white/10 bg-white/10">
                <Image src="/logo.webp" width={48} height={48} alt="PromptBridge logo" priority />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">PromptBridge</h1>
                <p className="text-sm opacity-80">Prompt multiple models side-by-side.</p>
              </div>
            </div>
            <div className="w-full sm:w-auto">
              <button
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium leading-5 whitespace-nowrap bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 transition-[colors,transform] duration-200 active:scale-[0.98]"
                onClick={() => setShowKey((v) => !v)}
                aria-haspopup="dialog"
                aria-expanded={showKey}
                aria-controls="api-key-panel"
              >
                <Key className="size-4" /> {apiKey ? "Update API Key" : "Set API Key"}
              </button>
              {showKey && (
                <div id="api-key-panel" className="mt-3 w-full sm:w-[360px] rounded-xl border border-white/10 bg-white/5 backdrop-blur-md shadow-lg p-3">
                  <label className="block text-xs opacity-80 mb-1">OpenRouter API Key</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      placeholder="sk-or-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded-md border border-white/10 bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
                    />
                    <span className="text-[10px] opacity-70">Stored locally</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Controls row */}
        <section className="mb-6">
          <div className="inline-block w-fit max-w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_12px_40px_-12px_rgba(0,0,0,0.6)] p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-medium">Select models</h2>
            </div>

            {apiKey ? (
              models.length === 0 ? (
                <p className="text-sm opacity-70">Fetching models…</p>
              ) : (
                <>
                  {/* Selected chips row */}
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs opacity-80 mb-1">
                        <span>Selected ({selectedModels.length})</span>
                        {selectedModels.length === 0 && (
                          <span className="opacity-60">None</span>
                        )}
                      </div>
                      {selectedModels.length > 0 && (
                        <div className="inline-flex flex-wrap gap-2 w-fit max-w-full">
                          {selectedModels.map((id) => (
                            <span key={id} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs">
                              <span className="truncate max-w-[180px]" title={id}>
                                {modelsById[id]?.name || id}
                              </span>
                              <button
                                className="p-1 rounded-md hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40"
                                aria-label={`Remove ${modelsById[id]?.name || id}`}
                                onClick={() => setSelectedModels((prev) => prev.filter((x) => x !== id))}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        className="rounded-md px-2.5 py-1.5 text-xs border border-white/15 bg-white/5 hover:bg-white/10"
                        onClick={() => setSelectedModels([])}
                        disabled={selectedModels.length === 0}
                      >
                        Clear all
                      </button>
                      <button
                        className="rounded-md px-2.5 py-1.5 text-xs border border-white/15 bg-white/5 hover:bg-white/10"
                        onClick={() => {
                          const ids = new Set(models.map((m) => m.id));
                          const picks = popularDefaults.filter((id) => ids.has(id)).slice(0, 4);
                          setSelectedModels(picks);
                        }}
                      >
                        Select defaults
                      </button>
                    </div>
                  </div>

                  {/* Search and sort */}
                  <div className="mb-3 flex flex-col sm:flex-row gap-2 sm:items-center">
                    <input
                      type="search"
                      placeholder="Search models…"
                      value={modelQuery}
                      onChange={(e) => setModelQuery(e.target.value)}
                      onFocus={() => setModelListOpen(true)}
                      className="px-2 py-1.5 rounded-md border border-white/10 bg-black/20 w-full sm:w-72 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        className="rounded-md px-2.5 py-1.5 text-xs border border-white/15 bg-white/5 hover:bg-white/10"
                        onClick={() => setModelListOpen((v) => !v)}
                      >
                        {showModelList ? "Hide list" : "Browse models"}
                      </button>
                      {showModelList && (
                        <>
                          <label className="inline-flex items-center gap-2 text-xs opacity-90">
                            <input
                              type="checkbox"
                              checked={selectedFirst}
                              onChange={(e) => setSelectedFirst(e.target.checked)}
                            />
                            Selected first
                          </label>
                          <label className="text-xs opacity-90 flex items-center gap-2">
                            <span>Sort</span>
                            <select
                              className="px-2 py-1 rounded-md border border-white/10 bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
                              value={modelSort}
                              onChange={(e) => setModelSort(e.target.value as "alpha" | "none")}
                            >
                              <option value="alpha">Alphabetical</option>
                              <option value="none">None</option>
                            </select>
                          </label>
                          <span className="text-xs opacity-70">{filteredCount} of {models.length}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Filtered list */}
                  {showModelList && (
                    <div className="max-h-56 overflow-auto grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1">
                      {filteredSortedModels.map((m) => {
                        const checked = selectedModels.includes(m.id);
                        return (
                          <label key={m.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setSelectedModels((prev) =>
                                  e.target.checked
                                    ? Array.from(new Set([...prev, m.id]))
                                    : prev.filter((id) => id !== m.id)
                                )
                              }
                            />
                            <span className="truncate" title={m.id}>
                              {m.name || m.id}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </>
              )
            ) : (
              <p className="text-sm opacity-70">Set your API key to load models.</p>
            )}
          </div>

        </section>

        {/* Compose */}
        <section className="mb-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_12px_40px_-12px_rgba(0,0,0,0.6)] p-6">
            <h2 className="font-medium mb-3">Compose prompt</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) onSend(input.trim());
              }}
              className="flex gap-2"
            >
              <textarea
                ref={inputRef}
                className="w-full min-h-[92px] px-3 py-2 rounded-lg border border-white/10 bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 overflow-hidden resize-none"
                placeholder="Enter your prompt…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }}
              />
              <button
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 transition-[colors,transform] duration-200 active:scale-[0.98] h-fit"
                type="submit"
              >
                <Send className="size-4" /> Send
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium border border-white/15 bg-white/5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40 transition-colors disabled:opacity-50 h-fit"
                type="button"
                onClick={stopAll}
                disabled={Object.values(panes).every((p) => !p.running)}
              >
                <Square className="size-4" /> Stop all
              </button>
            </form>
            {/* Prompt options */}
            <div className="mt-3 inline-flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-3 w-fit max-w-full self-start">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={limitWordsEnabled}
                  onChange={(e) => setLimitWordsEnabled(e.target.checked)}
                />
                Limit words
              </label>
              <div className="flex items-center gap-2">
                <label className="text-sm opacity-80" htmlFor="limit-words-input">Max</label>
                <input
                  id="limit-words-input"
                  type="number"
                  min={10}
                  step={10}
                  className="px-2 py-1 rounded-md border border-white/10 bg-black/20 w-28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
                  value={limitWords}
                  onChange={(e) => setLimitWords(parseInt(e.target.value || "0", 10))}
                  disabled={!limitWordsEnabled}
                />
                <span className="text-sm opacity-80">words</span>
              </div>
            </div>

            {/* Advanced prompt toggle & options (moved here) */}
            <div className="mt-3">
              <button
                className="rounded-md px-2.5 py-1.5 text-xs border border-white/15 bg-white/5 hover:bg-white/10"
                onClick={() => setShowAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
              >
                {showAdvanced ? "Hide advanced" : "Advanced prompt"}
              </button>
              {showAdvanced && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {/* Temperature slider (full width) */}
                  <div className="sm:col-span-2">
                    <Tip text="Controls randomness/creativity. Lower = deterministic, higher = diverse.">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-28 opacity-80">Temp</span>
                        <input
                          type="range"
                          min={0}
                          max={2}
                          step={0.1}
                          value={temperature}
                          onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        />
                        <span className="tabular-nums w-10 text-right">{temperature.toFixed(1)}</span>
                      </div>
                    </Tip>
                  </div>
                  <Tip text="Upper bound on tokens generated per model (provider caps may still apply).">
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-28 opacity-80">Max tokens</span>
                      <input type="number" min={1} step={1} value={maxTokens ?? ''} onChange={(e)=> setMaxTokens(safeInt(e.target.value, 1))} className="flex-1 px-2 py-1 rounded-md border border-white/10 bg-black/20" />
                    </label>
                  </Tip>

                  <Tip text="Nucleus sampling. Consider only top tokens whose cumulative probability ≤ P.">
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-28 opacity-80">Top P</span>
                      <input type="number" min={0} max={1} step={0.01} value={topP ?? ''} onChange={(e)=> setTopP(safeNum(e.target.value, 0, 1))} className="flex-1 px-2 py-1 rounded-md border border-white/10 bg-black/20" />
                    </label>
                  </Tip>
                  <Tip text="Top-K sampling. Limit choices to the K most likely tokens (0 disables).">
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-28 opacity-80">Top K</span>
                      <input type="number" min={0} step={1} value={topK ?? ''} onChange={(e)=> setTopK(safeInt(e.target.value, 0))} className="flex-1 px-2 py-1 rounded-md border border-white/10 bg-black/20" />
                    </label>
                  </Tip>
                  <Tip text="Discourage frequent tokens based on occurrence count. Negative encourages reuse.">
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-28 opacity-80">Freq Penalty</span>
                      <input type="number" min={-2} max={2} step={0.1} value={freqPenalty ?? ''} onChange={(e)=> setFreqPenalty(safeNum(e.target.value, -2, 2))} className="flex-1 px-2 py-1 rounded-md border border-white/10 bg-black/20" />
                    </label>
                  </Tip>
                  <Tip text="Discourage repetition regardless of count. Negative encourages reuse.">
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-28 opacity-80">Presence Penalty</span>
                      <input type="number" min={-2} max={2} step={0.1} value={presencePenalty ?? ''} onChange={(e)=> setPresencePenalty(safeNum(e.target.value, -2, 2))} className="flex-1 px-2 py-1 rounded-md border border-white/10 bg-black/20" />
                    </label>
                  </Tip>
                  <Tip text="Reduce repetition by penalizing more probable repeated tokens.">
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-28 opacity-80">Repetition Pen.</span>
                      <input type="number" min={0} max={2} step={0.1} value={repetitionPenalty ?? ''} onChange={(e)=> setRepetitionPenalty(safeNum(e.target.value, 0, 2))} className="flex-1 px-2 py-1 rounded-md border border-white/10 bg-black/20" />
                    </label>
                  </Tip>
                  <Tip text="Minimum probability relative to most likely token.">
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-28 opacity-80">Min P</span>
                      <input type="number" min={0} max={1} step={0.01} value={minP ?? ''} onChange={(e)=> setMinP(safeNum(e.target.value, 0, 1))} className="flex-1 px-2 py-1 rounded-md border border-white/10 bg-black/20" />
                    </label>
                  </Tip>
                  <Tip text="Consider tokens with sufficiently high probabilities relative to the best.">
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-28 opacity-80">Top A</span>
                      <input type="number" min={0} max={1} step={0.01} value={topA ?? ''} onChange={(e)=> setTopA(safeNum(e.target.value, 0, 1))} className="flex-1 px-2 py-1 rounded-md border border-white/10 bg-black/20" />
                    </label>
                  </Tip>
                  <Tip text="Use the same seed to make outputs repeatable (determinism not guaranteed).">
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-28 opacity-80">Seed</span>
                      <input type="number" step={1} value={seed ?? ''} onChange={(e)=> setSeed(safeInt(e.target.value))} className="flex-1 px-2 py-1 rounded-md border border-white/10 bg-black/20" />
                    </label>
                  </Tip>
                  <Tip text="Stop when any of these strings are generated.">
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-28 opacity-80">Stop</span>
                      <input type="text" placeholder="e.g. ###,END" value={stopStr} onChange={(e)=> setStopStr(e.target.value)} className="flex-1 px-2 py-1 rounded-md border border-white/10 bg-black/20" />
                    </label>
                  </Tip>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Results */}
        {Object.keys(panes).length > 0 && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {selectedModels.map((id) => (
              <div key={id} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_12px_40px_-12px_rgba(0,0,0,0.6)] p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium truncate" title={id}>
                    {modelsById[id]?.name || id}
                  </h3>
                  <div className="flex items-center gap-1">
                    {panes[id]?.running && <span className="text-xs opacity-60">Streaming…</span>}
                    <button
                      className="ml-2 p-2 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40"
                      aria-label="Maximize result"
                      onClick={() => setExpandedId(id)}
                    >
                      <Maximize2 className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="whitespace-pre-wrap text-sm min-h-[140px]">
                  {panes[id]?.text}
                  {panes[id]?.running && <span className="opacity-60">▌</span>}
                </div>
                {panes[id]?.error && (
                  <p className="text-sm text-red-400 mt-2">{panes[id]?.error}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium border border-white/15 bg-white/5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40"
                    onClick={() => {
                      const c = controllersRef.current[id];
                      c?.abort();
                      setPanes((p) => ({ ...p, [id]: { ...(p[id] || { text: "" }), running: false } }));
                    }}
                    disabled={!panes[id]?.running}
                  >
                    <Square className="size-3.5" /> Stop
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium border border-white/15 bg-white/5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40"
                    onClick={() => {
                      const text = panes[id]?.text || "";
                      navigator.clipboard.writeText(text).catch(() => {});
                    }}
                  >
                    <Copy className="size-3.5" /> Copy
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Expanded overlay */}
        {expandedId && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="relative w-full max-w-4xl max-h-[85vh] rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium truncate" title={expandedId}>
                  {modelsById[expandedId]?.name || expandedId}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium border border-white/15 bg-white/5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40"
                    onClick={() => {
                      const c = controllersRef.current[expandedId];
                      c?.abort();
                      setPanes((p) => ({ ...p, [expandedId]: { ...(p[expandedId] || { text: "" }), running: false } }));
                    }}
                    disabled={!panes[expandedId]?.running}
                  >
                    <Square className="size-3.5" /> Stop
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium border border-white/15 bg-white/5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40"
                    onClick={() => {
                      const text = panes[expandedId]?.text || "";
                      navigator.clipboard.writeText(text).catch(() => {});
                    }}
                  >
                    <Copy className="size-3.5" /> Copy
                  </button>
                  <button
                    className="ml-2 p-2 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40"
                    aria-label="Close"
                    onClick={() => setExpandedId(null)}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
              <div className="overflow-auto max-h-[60vh] whitespace-pre-wrap text-sm pr-1">
                {panes[expandedId]?.text}
                {panes[expandedId]?.running && <span className="opacity-60">▌</span>}
              </div>
              {panes[expandedId]?.error && (
                <p className="text-sm text-red-400 mt-2">{panes[expandedId]?.error}</p>
              )}
            </div>
          </div>
        )}

        <footer className="mt-10 mb-6 text-xs opacity-70 text-center">
          Powered by OpenRouter. API key stored locally. No server.
        </footer>
      </div>
    </div>
  );
}
