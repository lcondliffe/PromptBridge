"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchModels, streamChat } from "@/lib/openrouter";
import type { ChatMessage, ModelInfo } from "@/lib/types";

function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
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

  const onSend = async (prompt: string) => {
    if (!apiKey) {
      alert("Please set your OpenRouter API key first.");
      return;
    }
    if (selectedModels.length === 0) {
      alert("Select at least one model.");
      return;
    }

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
      { role: "user", content: prompt },
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
    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Multi LLM Researcher</h1>
          <p className="text-sm opacity-80">Prompt multiple models and synthesize a consensus.</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            className="px-3 py-2 rounded border hover:bg-black/5 dark:hover:bg-white/10"
            onClick={() => setShowKey((v) => !v)}
          >
            {apiKey ? "Update API Key" : "Set API Key"}
          </button>
          {showKey && (
            <div className="flex items-center gap-2">
              <input
                type="password"
                placeholder="OpenRouter API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="px-2 py-1 rounded border bg-transparent min-w-[260px]"
              />
              <span className="text-xs opacity-70">Stored locally</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="text-sm opacity-80">Temp</label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
            />
            <span className="text-sm w-10 text-right">{temperature.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm opacity-80">Max tokens</label>
            <input
              type="number"
              className="px-2 py-1 rounded border bg-transparent w-24"
              value={maxTokens ?? 1024}
              onChange={(e) => setMaxTokens(parseInt(e.target.value || "1024", 10))}
            />
          </div>
        </div>
      </header>

      <section className="mb-4 grid gap-3 md:grid-cols-2">
        <div className="rounded border p-3">
          <h2 className="font-medium mb-2">Select models</h2>
          {apiKey ? (
            models.length === 0 ? (
              <p className="text-sm opacity-70">Fetching models…</p>
            ) : (
              <div className="max-h-56 overflow-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
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
        <div className="rounded border p-3">
          <h2 className="font-medium mb-2">Summarizer model</h2>
          <select
            className="px-2 py-1 rounded border bg-transparent w-full"
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
          <div className="mt-3 flex gap-2">
            <button
              className="px-3 py-2 rounded border hover:bg-black/5 dark:hover:bg-white/10"
              onClick={onSummarize}
              disabled={!summarizerModel || Object.values(panes).every((p) => !p.text)}
            >
              Summarize
            </button>
            <button
              className="px-3 py-2 rounded border hover:bg-black/5 dark:hover:bg-white/10"
              onClick={stopAll}
              disabled={Object.values(panes).every((p) => !p.running)}
            >
              Stop
            </button>
          </div>
          {summary.text && (
            <div className="mt-3">
              <h3 className="font-medium mb-1">Summary</h3>
              <div className="rounded border p-3 whitespace-pre-wrap text-sm">
                {summary.text}
                {summary.running && <span className="opacity-60">▌</span>}
              </div>
            </div>
          )}
          {summary.error && (
            <p className="text-sm text-red-600 mt-2">{summary.error}</p>
          )}
        </div>
      </section>

      <section className="mb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) onSend(input.trim());
          }}
          className="flex gap-2"
        >
          <textarea
            className="w-full min-h-[72px] px-3 py-2 rounded border bg-transparent"
            placeholder="Enter your prompt…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            className="px-3 py-2 rounded border hover:bg-black/5 dark:hover:bg-white/10 h-fit"
            type="submit"
          >
            Send
          </button>
        </form>
      </section>

      {Object.keys(panes).length > 0 && (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {selectedModels.map((id) => (
            <div key={id} className="rounded border p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium truncate" title={id}>
                  {modelsById[id]?.name || id}
                </h3>
                {panes[id]?.running && <span className="text-xs opacity-60">Streaming…</span>}
              </div>
              <div className="whitespace-pre-wrap text-sm min-h-[120px]">
                {panes[id]?.text}
                {panes[id]?.running && <span className="opacity-60">▌</span>}
              </div>
              {panes[id]?.error && (
                <p className="text-sm text-red-600 mt-2">{panes[id]?.error}</p>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  className="px-2 py-1 rounded border text-xs hover:bg-black/5 dark:hover:bg-white/10"
                  onClick={() => {
                    const c = controllersRef.current[id];
                    c?.abort();
                    setPanes((p) => ({ ...p, [id]: { ...(p[id] || { text: "" }), running: false } }));
                  }}
                  disabled={!panes[id]?.running}
                >
                  Stop
                </button>
                <button
                  className="px-2 py-1 rounded border text-xs hover:bg-black/5 dark:hover:bg-white/10"
                  onClick={() => {
                    const text = panes[id]?.text || "";
                    navigator.clipboard.writeText(text).catch(() => {});
                  }}
                >
                  Copy
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <footer className="mt-8 text-xs opacity-70">
        Powered by OpenRouter. API key stored locally. No server.
      </footer>
    </div>
  );
}
