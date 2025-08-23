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
  const [summarizerModel, setSummarizerModel] = useLocalStorage<string>(
    "summarizer_model",
    ""
  );
  const [temperature, setTemperature] = useLocalStorage<number>(
    "temperature",
    0.7
  );
  const [maxTokens, setMaxTokens] = useLocalStorage<number | undefined>(
    "max_tokens",
    1024
  );

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

  // Summary pane
  const [summary, setSummary] = useState<Pane>({ text: "", running: false });

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

  // Fetch models on key available
  useEffect(() => {
    if (!apiKey) return;
    let mounted = true;
    (async () => {
      try {
        const list = await fetchModels(apiKey);
        if (!mounted) return;
        setModels(list);
        // initialize defaults if empty
        if (selectedModels.length === 0) {
          const ids = list.map((m) => m.id);
          const picks = popularDefaults.filter((id) => ids.includes(id)).slice(0, 4);
          if (picks.length > 0) setSelectedModels(picks);
        }
        if (!summarizerModel) {
          const preferred = [
            "anthropic/claude-3.5-sonnet",
            "openai/gpt-4o-mini",
          ];
          const ids = list.map((m) => m.id);
          const pick = preferred.find((p) => ids.includes(p)) || ids[0] || "";
          if (pick) setSummarizerModel(pick);
        }
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [apiKey, selectedModels.length, setSelectedModels, summarizerModel, setSummarizerModel, popularDefaults]);

  const onSend = async (inputPrompt: string) => {
    if (!apiKey) {
      alert("Please set your OpenRouter API key first.");
      return;
    }
    if (selectedModels.length === 0) {
      alert("Select at least one model.");
      return;
    }

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

    for (const model of selectedModels) {
      const handle = streamChat(
        {
          apiKey,
          model,
          messages: baseMessages,
          temperature,
          maxTokens,
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

  const onSummarize = () => {
    if (!apiKey) return alert("Set API key first.");
    if (!summarizerModel) return alert("Choose a summarizer model.");

    const entries = Object.entries(panes);
    if (entries.length === 0) return;

    const content = entries
      .map(([model, pane]) => `### ${model}\n${pane.text.trim()}`)
      .join("\n\n");

    const sys = `You are a neutral synthesis engine. Given multiple model answers to the same question, produce a structured summary with:
- Consensus: where the models agree
- Contradictions: where they disagree (cite models by ID)
- Caveats/assumptions: note uncertainties or missing info
- Recommendations / next steps
Be concise but comprehensive.`;

    setSummary({ text: "", running: true });

    const handle = streamChat(
      {
        apiKey,
        model: summarizerModel,
        temperature: Math.min(temperature, 0.7),
        maxTokens: Math.max(1024, maxTokens || 1024),
        messages: [
          { role: "system", content: sys },
          { role: "user", content },
        ],
      },
      {
        onToken: (chunk) =>
          setSummary((s) => ({ ...s, text: s.text + chunk })),
        onDone: () => setSummary((s) => ({ ...s, running: false })),
        onError: (err) =>
          setSummary((s) => ({ ...s, running: false, error: err.message })),
      }
    );
    controllersRef.current["__summary__"] = handle.abortController;
    handle.promise.catch(() => {});
  };

  const [input, setInput] = useState("");

  const modelsById = useMemo(() => {
    const map: Record<string, ModelInfo> = {};
    for (const m of models) map[m.id] = m;
    return map;
  }, [models]);

  return (
    <div className="relative min-h-screen text-zinc-100">
      {/* Background gradient and subtle grid overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-zinc-950 via-neutral-900 to-zinc-900" />
      <div className="pointer-events-none absolute inset-0 opacity-10 [background:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:12px_12px]" />

      <div className="relative z-10 px-4 sm:px-6 md:px-8">
        {/* Hero header */}
        <section className="py-6 sm:py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_60px_-24px_rgba(0,0,0,0.6)] p-4 sm:p-6">
            <div className="flex items-center gap-4">
              <div className="shrink-0 rounded-xl overflow-hidden border border-white/10 bg-white/10">
                <Image src="/logo.webp" width={48} height={48} alt="PromptBridge logo" priority />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">PromptBridge</h1>
                <p className="text-sm opacity-80">Prompt multiple models and synthesize a consensus.</p>
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
        </section>

        {/* Controls row */}
        <section className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_12px_40px_-12px_rgba(0,0,0,0.6)] p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium">Select models</h2>
              <div className="flex items-center gap-2 text-xs opacity-80">
                <label>Temp</label>
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
            </div>
            {apiKey ? (
              models.length === 0 ? (
                <p className="text-sm opacity-70">Fetching models…</p>
              ) : (
                <div className="max-h-56 overflow-auto grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1">
                  {models.map((m) => {
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
              )
            ) : (
              <p className="text-sm opacity-70">Set your API key to load models.</p>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_12px_40px_-12px_rgba(0,0,0,0.6)] p-6">
            <h2 className="font-medium mb-3">Summarizer model</h2>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <select
                className="px-2 py-2 rounded-md border border-white/10 bg-black/20 w-full sm:flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
                value={summarizerModel}
                onChange={(e) => setSummarizerModel(e.target.value)}
              >
                <option value="">Select…</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <label className="text-sm opacity-80">Max tokens</label>
                <input
                  type="number"
                  className="px-2 py-2 rounded-md border border-white/10 bg-black/20 w-28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
                  value={maxTokens ?? 1024}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value || "1024", 10))}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 transition-[colors,transform] duration-200 active:scale-[0.98] disabled:opacity-50"
                onClick={onSummarize}
                disabled={!summarizerModel || Object.values(panes).every((p) => !p.text)}
              >
                Summarize
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium border border-white/15 bg-white/5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40 transition-colors disabled:opacity-50"
                onClick={stopAll}
                disabled={Object.values(panes).every((p) => !p.running)}
              >
                <Square className="size-4" /> Stop
              </button>
            </div>
            {summary.text && (
              <div className="mt-4">
                <h3 className="font-medium mb-2">Summary</h3>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 whitespace-pre-wrap text-sm">
                  {summary.text}
                  {summary.running && <span className="opacity-60">▌</span>}
                </div>
              </div>
            )}
            {summary.error && (
              <p className="text-sm text-red-400 mt-2">{summary.error}</p>
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
                className="w-full min-h-[92px] px-3 py-2 rounded-lg border border-white/10 bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
                placeholder="Enter your prompt…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 transition-[colors,transform] duration-200 active:scale-[0.98] h-fit"
                type="submit"
              >
                <Send className="size-4" /> Send
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
