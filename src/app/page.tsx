"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Square, Copy, Maximize2, X, LayoutGrid, Rows } from "lucide-react";
import { sdk } from "@promptbridge/sdk";
import { fetchModels, streamChatWithRetry } from "@/lib/openrouter";
import type { ChatMessage, ModelInfo, ResponseMetrics } from "@/lib/types";
import { CompactPerformanceMetrics } from "@/components/PerformanceMetrics";
import { CompactBalanceDisplay } from "@/components/BalanceDisplay";
import { usePostHog } from 'posthog-js/react';

import useLocalStorage from "@/lib/useLocalStorage";
import { captureEvent } from "@/lib/posthog";
import { useApiKey } from "@/lib/apiKey";
import Markdown from "@/components/Markdown";
import VendorLogo from "@/components/VendorLogo";
import { VersionDisplay } from "@/components/VersionDisplay";

// Lightweight tooltip component
function Tip({ text, children }: { text: string; children: ReactNode }) {
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

// Cache keys and TTLs at module scope to avoid effect deps noise
const MODELS_CACHE_KEY = "openrouter_models_cache_v1";
const MODELS_TTL_MS = 15 * 60 * 1000; // 15 minutes

function HomeInner() {
// API key handling (shared across app)
  const { apiKey } = useApiKey();
  const posthog = usePostHog();

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
    4096  // Increased from 1024 to support longer code generation
  );
  
  // One-time migration: Update users who have the old 1024 limit
  useEffect(() => {
    if (maxTokens === 1024) {
      console.log('🔄 Migrating maxTokens from 1024 to 4096 for better code generation');
      setMaxTokens(4096);
    }
  }, [maxTokens, setMaxTokens]);

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
  // Layout for results: 'tiled' grid vs 'stacked' full-width list
  const [resultsLayout, setResultsLayout] = useLocalStorage<'tiled' | 'stacked'>(
    'results_layout',
    'tiled'
  );

  // Advanced features state
  const [reasoningEnabled, setReasoningEnabled] = useLocalStorage<boolean>('reasoning_enabled', false);
  const [reasoningEffort, setReasoningEffort] = useLocalStorage<'low' | 'medium' | 'high'>('reasoning_effort', 'medium');
  const [webSearchEnabled, setWebSearchEnabled] = useLocalStorage<boolean>('web_search_enabled', false);

  // When Web Search is enabled, route requests through OpenRouter's web plugin by
  // appending ":online" to the model slug (per OpenRouter docs). Avoid duplicating
  // for models that already include an online variant.
  const effectiveModelId = useCallback((id: string): string => {
    if (!webSearchEnabled) return id;
    // If already explicitly using the web plugin suffix
    if (id.includes(':online')) return id;
    // If the provider's model id already denotes an online variant (e.g. "-online")
    if (id.endsWith('-online')) return id;
    return `${id}:online`;
  }, [webSearchEnabled]);

  // Prompt options
  const [limitWordsEnabled, setLimitWordsEnabled] = useLocalStorage<boolean>(
    "limit_words_enabled",
    false
  );
  const [limitWords, setLimitWords] = useLocalStorage<number>(
    "limit_words",
    200
  );

// Conversations and streaming state
  const [conversations, setConversations] = useLocalStorage<Record<string, ChatMessage[]>>(
    "conversations_v1",
    {}
  );
  // Active persisted conversation id
  const [activeConversationId, setActiveConversationId] = useLocalStorage<string | null>(
    "active_conversation_id",
    null
  );
  type Pane = {
    draft: string;
    error?: string;
    running: boolean;
    metrics?: Partial<ResponseMetrics>;
  };
  const [panes, setPanes] = useState<Record<string, Pane>>({});
  const controllersRef = useRef<Record<string, AbortController>>({});
  // Refs to the start of the streaming draft per model tile
  const draftStartRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [scrollToStartIds, setScrollToStartIds] = useState<string[]>([]);


  // Expanded (maximized) result pane
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Per-visit session state
  const [showResults, setShowResults] = useState(false); // hide tiles until first send
  const sessionStartIndexRef = useRef<Record<string, number>>({}); // per-model offset to hide previous messages
  const [sessionConvId, setSessionConvId] = useState<string | null>(null); // server-side conversation for this session

  // Rehydrate session conversation from last active conversation (survives reloads)
  useEffect(() => {
    if (!sessionConvId && activeConversationId) setSessionConvId(activeConversationId);
  }, [activeConversationId, sessionConvId]);

  const anyRunning = useMemo(() => Object.values(panes).some((p) => p.running), [panes]);

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

  const SYSTEM_PROMPT = "You are a helpful assistant. Answer clearly and concisely with reasoning when appropriate.";

  const popularDefaults = useMemo(
    () => [
      "openai/gpt-5-chat",
      "anthropic/claude-sonnet-4",
      "google/gemini-2.5-flash",
    ],
    []
  );

  // Cache & fetch models (once per apiKey), with localStorage TTL
  const lastModelsApiKeyRef = useRef<string | null>(null);

  const maybeInitSelections = useCallback(
    (list: ModelInfo[]) => {
      try {
        const storedSel = window.localStorage.getItem("selected_models");
        const ids = list.map((m) => m.id);
        if (!storedSel) {
          const picks = popularDefaults.filter((id) => ids.includes(id)).slice(0, 4);
          if (picks.length > 0) setSelectedModels(picks);
        }
      } catch {}
    },
    [setSelectedModels, popularDefaults]
  );

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
      } catch (err: unknown) {
        const msg = 'Failed to load models. Please try again.';
        const errorMessage = err instanceof Error ? err.message : String(err);
        setUiError(errorMessage ? `${msg} (${errorMessage.slice(0, 120)})` : msg);
        console.debug('fetchModels error', err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [apiKey, maybeInitSelections, models.length]);

  const [uiError, setUiError] = useState<string>("");

  // Resume conversation from history via query param (?conv=ID)
  const searchParams = useSearchParams();
  useEffect(() => {
    try {
      const conv = searchParams.get('conv');
      if (!conv) return;
      if (sessionConvId === conv) { setShowResults(true); return; }
      (async () => {
        try {
          const msgs = await sdk.conversations.messages.list(conv);
          // Build per-model transcripts. User messages apply to all models; assistant only to its model.
          const perModel: Record<string, ChatMessage[]> = {};
          const userBuffer: ChatMessage[] = [];
          const modelSet = new Set<string>();
          for (const m of msgs) {
            if (m.role === 'user') {
              const u = { role: 'user', content: m.content } as ChatMessage;
              userBuffer.push(u);
              for (const model of Object.keys(perModel)) perModel[model].push(u);
            } else if (m.role === 'assistant' && m.model) {
              modelSet.add(m.model);
              if (!perModel[m.model]) {
                perModel[m.model] = [...userBuffer];
              }
              perModel[m.model].push({ role: 'assistant', content: m.content });
            }
          }
          const modelsArr = Array.from(modelSet);
          setSelectedModels(modelsArr);
          setConversations((prev) => {
            const next = { ...prev } as Record<string, ChatMessage[]>;
            for (const model of modelsArr) next[model] = perModel[model] || [];
            return next;
          });
          // Ensure transcripts are visible
          sessionStartIndexRef.current = {} as Record<string, number>;
          for (const model of modelsArr) sessionStartIndexRef.current[model] = 0;
          setSessionConvId(conv);
          setActiveConversationId(conv);
          setShowResults(true);
        } catch (e: unknown) {
          setUiError('Failed to load conversation. Please refresh or try again later.');
          console.debug('resume-conversation error', e);
        }
      })();
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const onSend = async (inputPrompt: string) => {
    if (anyRunning) return; // Disabled while any model is running
    
    // Debug API key
    console.log('🔑 API Key Debug:', {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      apiKeyPrefix: apiKey ? `${apiKey.slice(0, 8)}...` : 'none'
    });
    
    if (!apiKey || apiKey.trim().length === 0) {
      setUiError("Please set your OpenRouter API key first.");
      return;
    }
    if (selectedModels.length === 0) {
      setUiError("No models selected. Use ‘Browse models’ or search to pick at least one, then Send.");
      return;
    }
    setUiError("");

    // Track prompt sending event
    captureEvent(posthog, 'prompt_sent', {
      prompt_length: inputPrompt.length,
      models_count: selectedModels.length,
      models: selectedModels,
      temperature,
      max_tokens: maxTokens,
      limit_words_enabled: limitWordsEnabled,
      limit_words: limitWords
    });

    // Apply prompt options
    const options: string[] = [];
    if (limitWordsEnabled && Number.isFinite(limitWords) && (limitWords as number) > 0) {
      options.push(`Please limit your answer to at most ${limitWords} words.`);
    }
    const finalPrompt = options.length
      ? `${inputPrompt}\n\nConstraints:\n- ${options.join("\n- ")}`
      : inputPrompt;

    // Initialize panes for selected models
    const initial: Record<string, Pane> = {};
    for (const m of selectedModels) initial[m] = { draft: "", running: true };
    setPanes(initial);
    // After tiles render their new draft bubbles, scroll each to the start anchor
    setScrollToStartIds(selectedModels);

    // Mark session start only for models that don't have one yet; this preserves context across sends
    for (const m of selectedModels) {
      if (sessionStartIndexRef.current[m] === undefined) {
        sessionStartIndexRef.current[m] = (conversations[m] || []).length;
      }
    }
    setShowResults(true);

    // Ensure a server-side conversation exists for this session and persist the user message
    let convIdLocal = sessionConvId;
    try {
      if (!convIdLocal) {
        const title = inputPrompt.trim().split("\n")[0].slice(0, 80) || "Untitled";
        const conv = await sdk.conversations.create(title);
        convIdLocal = conv.id;
        setSessionConvId(convIdLocal);
        setActiveConversationId(convIdLocal);
      }
      // Persist the user message for this turn
      await sdk.conversations.messages.create(convIdLocal!, { role: "user", content: finalPrompt });
    } catch {
      // Non-fatal; continue streaming UI regardless (e.g., API unavailable or unauthenticated)
      // Intentionally suppress console noise here to avoid alarming users during local/offline use.
    }

    // Parse stop strings into array
    const stop = stopStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Prepare messages per model from current conversations snapshot (session-only)
    const msgsByModel: Record<string, ChatMessage[]> = {};
    for (const model of selectedModels) {
      const base = conversations[model] || [];
      const startIdx = sessionStartIndexRef.current[model] ?? base.length;
      const sessionOnly = base.slice(startIdx);
      const msgs: ChatMessage[] = [];
      if (sessionOnly.length === 0) msgs.push({ role: 'system', content: SYSTEM_PROMPT });
      msgs.push(...sessionOnly, { role: 'user', content: finalPrompt });
      msgsByModel[model] = msgs;
    }

    // Append the user message to all conversations (persist)
    setConversations((prev) => {
      const next = { ...prev } as Record<string, ChatMessage[]>;
      for (const model of selectedModels) {
        const arr = next[model] ? [...next[model]] : [];
        arr.push({ role: 'user', content: finalPrompt });
        next[model] = arr;
      }
      return next;
    });

    const traceId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    
    // Debug log for web search
    console.log('🔍 Web Search Debug:', {
      webSearchEnabled,
      webSearchParam: webSearchEnabled ? true : undefined,
      selectedModels,
      modelsWithWebSearch: selectedModels.map(id => ({
        id,
        supportsWebSearch: modelsById[id] ? Boolean(modelsById[id].pricing?.web_search && modelsById[id].pricing?.web_search !== '0') : false
      }))
    });
    
    // Debug log for reasoning
    console.log('🧠 Reasoning Debug:', {
      reasoningEnabled,
      reasoningEffort,
      selectedModels,
      modelsWithReasoning: selectedModels.map(id => ({
        id,
        supportsReasoning: modelsById[id] ? Boolean(modelsById[id].pricing?.internal_reasoning && modelsById[id].pricing?.internal_reasoning !== '0') : false,
        reasoningParam: reasoningEnabled ? { enabled: true, effort: reasoningEffort } : undefined
      }))
    });
    
    for (const model of selectedModels) {
      const handle = streamChatWithRetry(
        {
          apiKey,
          model: effectiveModelId(model),
          messages: msgsByModel[model],
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
          // Enhanced features
          trackMetrics: true,
          reasoning: reasoningEnabled ? { enabled: true, effort: reasoningEffort } : undefined,
          web_search: webSearchEnabled ? true : undefined,
          plugins: webSearchEnabled ? [{ id: 'web' }] : undefined,
        },
        {
          onToken: (chunk) =>
            setPanes((p) => ({
              ...p,
              [model]: { ...(p[model] || { draft: '' }), draft: (p[model]?.draft || '') + chunk, running: true },
            })),
          onMetrics: (metrics) => {
            setPanes((p) => ({
              ...p,
              [model]: { ...(p[model] || { draft: '', running: true }), metrics },
            }));
          },
          onDone: (full, usage, metrics) => {
            setPanes((p) => ({
              ...p,
              [model]: { ...(p[model] || { draft: '' }), running: false, metrics },
            }));
            setConversations((prev) => {
              const next = { ...prev } as Record<string, ChatMessage[]>;
              const arr = next[model] ? [...next[model]] : [];
              arr.push({ role: 'assistant', content: full || '' });
              next[model] = arr;
              return next;
            });
            // Persist assistant message with model tag
            try {
              const idForPersist = convIdLocal || sessionConvId;
              if (idForPersist) {
                void sdk.conversations.messages.create(idForPersist, { role: "assistant", content: full || "", model });
              }
            } catch {}
            setPanes((p) => ({ ...p, [model]: { ...(p[model] || { draft: '' }), running: false, draft: '' } }));
          },
          onError: (err) => {
            // Enhanced error handling for timeout issues
            let errorMessage = err.message;
            if (err.message.includes('Stream timeout')) {
              errorMessage = 'Response took too long to generate. This can happen with complex requests like code generation. Try again or consider breaking down your request into smaller parts.';
            }
            
            setPanes((p) => ({
              ...p,
              [model]: { ...(p[model] || { draft: '' }), running: false, draft: '', error: errorMessage },
            }));
          },
          onRetry: (attempt, error) => {
            console.log(`Retrying ${model} (attempt ${attempt}): ${error.message}`);
            // Could update UI to show retry status if desired
          }
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
        Object.entries(p).map(([k, v]) => [k, { ...v, running: false, draft: "" }])
      ) as Record<string, Pane>
    );
  };

  const resetAll = () => {
    const ok = window.confirm("Reset all chats? This will stop any running responses and clear all conversations.");
    if (!ok) return;
    stopAll();
    controllersRef.current = {} as Record<string, AbortController>;
    setConversations({});
    setPanes({});
    sessionStartIndexRef.current = {} as Record<string, number>;
    setSessionConvId(null);
    setActiveConversationId(null);
  };


  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const replyRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

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

  // When requested, scroll model tiles to the start of their new streaming replies
  useEffect(() => {
    if (scrollToStartIds.length === 0) return;
    for (const id of scrollToStartIds) {
      const el = draftStartRefs.current[id];
      try {
        el?.scrollIntoView({ block: 'start' });
      } catch {}
    }
    setScrollToStartIds([]);
  }, [scrollToStartIds]);

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
  const [manuallyClosed, setManuallyClosed] = useState(false);
  const isSearching = modelQuery.trim().length > 0;
  const showModelList = modelListOpen || (isSearching && !manuallyClosed);

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

  // Build a copyable transcript string per model (includes partial draft if present)
  const toCopyString = (modelId: string): string => {
    const hist = conversations[modelId] || [];
    const parts: string[] = [];
    let skippedFirstUser = false;
    for (const m of hist) {
      if (m.role === 'user' && !skippedFirstUser) { skippedFirstUser = true; continue; }
      parts.push(`${m.role.toUpperCase()}: ${m.content}`);
    }
    const d = panes[modelId]?.draft || '';
    if (panes[modelId]?.running && d) parts.push(`ASSISTANT (partial): ${d}`);
    return parts.join("\n\n");
  };

  // Render transcript as chat bubbles, with a live draft bubble when streaming
  const renderTranscript = (modelId: string) => {
    const all = conversations[modelId] || [];
    const startIdx = sessionStartIndexRef.current[modelId] ?? all.length;
    const hist = all.slice(startIdx);
    let skippedFirstUser = false;
    const visible = hist.filter((m) => {
      if (m.role === 'user' && !skippedFirstUser) { skippedFirstUser = true; return false; }
      return true;
    });
    return (
      <div className="space-y-2 text-sm min-h-[140px]">
        {visible.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-start'}`}>
            <div className={`max-w-full rounded-lg px-3 py-2 border border-white/10 ${m.role === 'user' ? 'bg-indigo-600/20' : 'bg-white/5'}`}>
              {m.role === 'assistant' ? (
                <Markdown text={m.content} />
              ) : (
                <div className="whitespace-pre-wrap">{m.content}</div>
              )}
            </div>
          </div>
        ))}
        {panes[modelId]?.running && (
          <>
            <div ref={(el) => { draftStartRefs.current[modelId] = el; }} className="h-0" />
            <div className="flex justify-start">
              <div className="max-w-full rounded-lg px-3 py-2 border border-white/10 bg-white/5">
                <div className="whitespace-pre-wrap">{panes[modelId]?.draft || ''}<span className="opacity-60">▌</span></div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // Send a reply for a given model (used by button click and Enter key)
  const sendReply = async (id: string) => {
    const text = (replyInputs[id] || '').trim();
    if (!text || anyRunning) return;
    
    // Track reply event
    captureEvent(posthog, 'reply_sent', {
      model: id,
      reply_length: text.length,
      temperature,
      max_tokens: maxTokens
    });
    
    const stop = stopStr.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    const history = conversations[id] || [];
    const msgs = [] as ChatMessage[];
    if (history.length === 0) msgs.push({ role: 'system', content: SYSTEM_PROMPT });
    const options: string[] = [];
    if (limitWordsEnabled && Number.isFinite(limitWords) && (limitWords as number) > 0) {
      options.push(`Please limit your answer to at most ${limitWords} words.`);
    }
    const finalText = options.length ? `${text}\n\nConstraints:\n- ${options.join('\n- ')}` : text;
    msgs.push(...history, { role: 'user', content: finalText });
    setPanes((p) => ({ ...p, [id]: { ...(p[id] || { draft: '' }), draft: '', running: true, error: undefined } }));
    setConversations((prev) => {
      const next = { ...prev } as Record<string, ChatMessage[]>;
      const arr = next[id] ? [...next[id]] : [];
      arr.push({ role: 'user', content: finalText });
      next[id] = arr;
      return next;
    });
    try {
      const convId = sessionConvId;
      if (convId) {
        await sdk.conversations.messages.create(convId, { role: 'user', content: finalText });
      }
    } catch {}
    const traceId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const handle = streamChatWithRetry(
      {
        apiKey,
        model: effectiveModelId(id),
        messages: msgs,
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
        // Enhanced features
        trackMetrics: true,
        reasoning: reasoningEnabled ? { enabled: true, effort: reasoningEffort } : undefined,
        web_search: webSearchEnabled ? true : undefined,
        plugins: webSearchEnabled ? [{ id: 'web' }] : undefined,
      },
      {
        onToken: (chunk) =>
          setPanes((p) => ({ ...p, [id]: { ...(p[id] || { draft: '' }), draft: (p[id]?.draft || '') + chunk, running: true } })),
        onMetrics: (metrics) =>
          setPanes((p) => ({ ...p, [id]: { ...(p[id] || { draft: '', running: true }), metrics } })),
        onDone: (full, usage, metrics) => {
          setPanes((p) => ({ ...p, [id]: { ...(p[id] || { draft: '' }), running: false, draft: '', metrics } }));
          setConversations((prev) => {
            const next = { ...prev } as Record<string, ChatMessage[]>;
            const arr = next[id] ? [...next[id]] : [];
            arr.push({ role: 'assistant', content: full || '' });
            next[id] = arr;
            return next;
          });
          try {
            const convId2 = sessionConvId;
            if (convId2) {
              void sdk.conversations.messages.create(convId2, { role: 'assistant', content: full || '', model: id });
            }
          } catch {}
        },
        onError: (err) => {
          // Enhanced error handling for timeout issues
          let errorMessage = err.message;
          if (err.message.includes('Stream timeout')) {
            errorMessage = 'Response took too long to generate. This can happen with complex requests like code generation. Try again or consider breaking down your request into smaller parts.';
          }
          
          setPanes((p) => ({ ...p, [id]: { ...(p[id] || { draft: '' }), running: false, draft: '', error: errorMessage } }));
        },
      }
    );
    controllersRef.current[id] = handle.abortController;
    handle.promise.catch(() => {});
    setReplyInputs((r) => ({ ...r, [id]: '' }));
    try {
      const el = replyRefs.current[id];
      if (el) {
        el.style.height = "auto";
      }
    } catch {}
  };

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

        {/* OpenRouter Key Credit */}
        {apiKey && (
          <section className="mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>OpenRouter Key Credit:</span>
              <CompactBalanceDisplay apiKey={apiKey} />
            </div>
          </section>
        )}

        {/* Controls row */}
        <section className="mb-6">
          <div className="inline-block w-fit max-w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_12px_40px_-12px_rgba(0,0,0,0.6)] p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-medium">Select models</h2>
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

            {apiKey ? (
              models.length === 0 ? (
                <p className="text-sm opacity-70">Fetching models…</p>
              ) : (
                <>
                  {/* Selected chips row */}
                  <div className="mb-3 flex items-center gap-3">
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
                            <span key={id} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs">
<VendorLogo modelId={id} size={16} className="shrink-0" />
                              <span className="truncate max-w-[180px]" title={id}>
                                {modelDisplayName(id, modelsById[id])}
                              </span>
                              <button
                                className="p-1 rounded-md hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40"
                                aria-label={`Remove ${modelsById[id]?.name || id}`}
                              onClick={() => {
                                setSelectedModels((prev) => prev.filter((x) => x !== id))
                                captureEvent(posthog, 'model_removed', { model: id })
                              }}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Search and sort */}
                  <div className="mb-3 flex flex-col sm:flex-row gap-2 sm:items-center">
                    <input
                      type="search"
                      placeholder="Search models…"
                      value={modelQuery}
                      onChange={(e) => {
                        const val = e.target.value;
                        setModelQuery(val);
                        if (val.trim().length === 0) setManuallyClosed(false);
                      }}
                      onFocus={() => { setModelListOpen(true); setManuallyClosed(false); }}
                      className="px-2 py-1.5 rounded-md border border-white/10 bg-black/20 w-full sm:w-72 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        className="rounded-md px-2.5 py-1.5 text-xs border border-white/15 bg-white/5 hover:bg-white/10"
                        onClick={() => {
                          if (showModelList) {
                            setModelListOpen(false);
                            setManuallyClosed(true);
                          } else {
                            setModelListOpen(true);
                            setManuallyClosed(false);
                          }
                        }}
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
                              onChange={(e) => {
                                const isAdding = e.target.checked
                                setSelectedModels((prev) =>
                                  isAdding
                                    ? Array.from(new Set([...prev, m.id]))
                                    : prev.filter((id) => id !== m.id)
                                )
                                captureEvent(posthog, isAdding ? 'model_selected' : 'model_deselected', { model: m.id })
                              }}
                            />
<VendorLogo modelId={m.id} size={18} className="shrink-0" />
                            <span className="truncate" title={m.id}>
                              {modelDisplayName(m.id, m)}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (e.shiftKey) return; // newline
                    e.preventDefault();
                    if (input.trim()) onSend(input.trim());
                  }
                }}
              />
            </form>
            {/* Prompt options */}
            <div className="mt-3 space-y-3 rounded-lg border border-white/10 bg-black/20 p-3 w-fit max-w-full self-start">
              {/* Word limit section */}
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={limitWordsEnabled}
                    onChange={(e) => setLimitWordsEnabled(e.target.checked)}
                  />
                  <span>Limit words</span>
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
              
              {/* AI Features section */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm opacity-90">AI Features:</span>
                <Tip text="Enable advanced reasoning mode for supported models.">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={reasoningEnabled}
                      onChange={(e) => setReasoningEnabled(e.target.checked)}
                    />
                    <span className="opacity-80">Reasoning</span>
                  </label>
                </Tip>
                
                {reasoningEnabled && (
                  <Tip text="Reasoning effort level - higher effort may produce more thorough analysis.">
                    <div className="flex items-center gap-2">
                      <label className="text-sm opacity-80" htmlFor="reasoning-effort-select">Effort</label>
                      <select
                        id="reasoning-effort-select"
                        value={reasoningEffort}
                        onChange={(e) => setReasoningEffort(e.target.value as 'low' | 'medium' | 'high')}
                        className="px-2 py-1 rounded-md border border-white/10 bg-black/20 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </Tip>
                )}
                
                
                <Tip text="Allow models to search the web for current information.">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={webSearchEnabled}
                      onChange={(e) => setWebSearchEnabled(e.target.checked)}
                    />
                    <span className="opacity-80">Web Search</span>
                  </label>
                </Tip>
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
                  <Tip text="Upper bound on tokens generated per model (provider caps may still apply). Recommended: 4096+ for code generation.">
                    <label className="flex flex-col gap-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-28 opacity-80">Max tokens</span>
                        <input type="number" min={1} step={1} value={maxTokens ?? ''} onChange={(e)=> setMaxTokens(safeInt(e.target.value, 1))} className="flex-1 px-2 py-1 rounded-md border border-white/10 bg-black/20" />
                      </div>
                      {maxTokens && maxTokens < 2048 && (
                        <span className="text-[10px] text-yellow-400 opacity-90">
                          ⚠️ Low token limit may truncate long responses (code, scripts, etc.)
                        </span>
                      )}
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
            {/* Actions toolbar */}
            <div className="mt-3 flex items-center">
              <div role="toolbar" aria-label="Compose actions" className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  aria-label="Send"
                  onClick={() => { const v = input.trim(); if (v) onSend(v); }}
                  disabled={anyRunning || !input.trim()}
                  className="p-2 rounded-md border border-transparent hover:bg-white/10 disabled:opacity-50"
                  title="Send"
                >
                  <Send className="size-5 opacity-90" />
                </button>
                <button
                  type="button"
                  aria-label="Stop all"
                  onClick={stopAll}
                  disabled={Object.values(panes).every((p) => !p.running)}
                  className="p-2 rounded-md border border-transparent hover:bg-white/10 disabled:opacity-50"
                  title="Stop all"
                >
                  <Square className="size-5 opacity-90" />
                </button>
                <button
                  type="button"
                  aria-label="Reset all"
                  onClick={resetAll}
                  className="p-2 rounded-md border border-transparent hover:bg-white/10"
                  title="Reset all"
                >
                  <X className="size-5 opacity-90" />
                </button>
              </div>
            </div>
          </div>
          </div>
        </section>

        {/* Results */}
        {showResults && selectedModels.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-end">
              <div role="toolbar" aria-label="Layout" className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  aria-pressed={resultsLayout === 'tiled'}
                  aria-label="Tiled view"
                  onClick={() => {
                    setResultsLayout('tiled')
                    captureEvent(posthog, 'layout_changed', { layout: 'tiled' })
                  }}
                  className={`px-2 py-1 text-xs rounded-md border ${resultsLayout === 'tiled' ? 'border-white/20 bg-white/10' : 'border-transparent hover:bg-white/10'}`}
                  title="Tiled view"
                >
                  <LayoutGrid className="size-5 opacity-90" />
                </button>
                <button
                  type="button"
                  aria-pressed={resultsLayout === 'stacked'}
                  aria-label="Stacked view"
                  onClick={() => {
                    setResultsLayout('stacked')
                    captureEvent(posthog, 'layout_changed', { layout: 'stacked' })
                  }}
                  className={`px-2 py-1 text-xs rounded-md border ${resultsLayout === 'stacked' ? 'border-white/20 bg-white/10' : 'border-transparent hover:bg-white/10'}`}
                  title="Stacked view"
                >
                  <Rows className="size-5 opacity-90" />
                </button>
              </div>
            </div>
            <div className={resultsLayout === 'tiled' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-4'}>
              {selectedModels.map((id) => (
                <div key={id} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_12px_40px_-12px_rgba(0,0,0,0.6)] p-4">
                  <div className="flex items-center justify-between mb-2">
<h3 className="font-medium truncate flex items-center gap-2" title={id}>
<VendorLogo modelId={id} size={18} className="shrink-0" />
                      <span className="truncate">{modelDisplayName(id, modelsById[id])}</span>
                    </h3>
                    <div className="flex items-center gap-2">
                      {/* Performance Metrics or Streaming indicator */}
                      {panes[id]?.running ? (
                        <span className="text-xs opacity-60">Streaming…</span>
                      ) : panes[id]?.metrics ? (
                        <CompactPerformanceMetrics 
                          metrics={panes[id]?.metrics || null}
                          isStreaming={false}
                          className="text-xs"
                        />
                      ) : null}
                      <button
                        className="p-2 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40"
                        aria-label="Maximize result"
                        onClick={() => setExpandedId(id)}
                      >
                        <Maximize2 className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div className={resultsLayout === 'stacked' ? 'pr-1' : 'max-h-[320px] overflow-auto pr-1'}>
                    {renderTranscript(id)}
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
                        setPanes((p) => ({ ...p, [id]: { ...(p[id] || { draft: '' }), running: false, draft: '' } }));
                      }}
                      disabled={!panes[id]?.running}
                    >
                      <Square className="size-3.5" /> Stop
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium border border-white/15 bg-white/5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40"
                      onClick={() => {
                        const text = toCopyString(id);
                        navigator.clipboard.writeText(text).catch(() => {});
                        captureEvent(posthog, 'transcript_copied', { model: id });
                      }}
                    >
                      <Copy className="size-3.5" /> Copy
                    </button>
                  </div>
                  <div className="mt-3 flex items-start gap-2">
                    <textarea
                      ref={(el) => { replyRefs.current[id] = el; }}
                      className="flex-1 min-h-[44px] px-2 py-1.5 rounded-md border border-white/10 bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40 overflow-hidden resize-none text-sm"
                      placeholder="Reply to this model…"
                      value={replyInputs[id] || ''}
                      onChange={(e) => setReplyInputs((r) => ({ ...r, [id]: e.target.value }))}
                      onInput={(e) => autoResize(e.currentTarget)}
                      disabled={anyRunning}
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (e.shiftKey) return; // newline
                          e.preventDefault();
                          void sendReply(id);
                        }
                      }}
                    />
                    <button
                      className="p-2 rounded-md border border-transparent hover:bg-white/10 disabled:opacity-50"
                      aria-label="Send reply"
                      type="button"
                      onClick={() => { void sendReply(id); }}
                      disabled={anyRunning || !(replyInputs[id] || '').trim()}
                    >
                      <Send className="size-5 opacity-90" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Expanded overlay */}
        {expandedId && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="relative w-full max-w-4xl max-h-[85vh] rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl p-5">
              <div className="flex items-center justify-between mb-3">
<h3 className="font-medium truncate flex items-center gap-2" title={expandedId}>
<VendorLogo modelId={expandedId} size={20} className="shrink-0" />
                  <span className="truncate">{modelDisplayName(expandedId, modelsById[expandedId])}</span>
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium border border-white/15 bg-white/5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40"
                    onClick={() => {
                      const id = expandedId as string;
                      const c = controllersRef.current[id];
                      c?.abort();
                      setPanes((p) => ({ ...p, [id]: { ...(p[id] || { draft: '' }), running: false, draft: '' } }));
                    }}
                    disabled={!panes[expandedId]?.running}
                  >
                    <Square className="size-3.5" /> Stop
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium border border-white/15 bg-white/5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40"
                    onClick={() => {
                      const id = expandedId as string;
                      const text = toCopyString(id);
                      navigator.clipboard.writeText(text).catch(() => {});
                      captureEvent(posthog, 'transcript_copied', { model: id, context: 'expanded' });
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
              <div className="overflow-auto max-h-[60vh] pr-1">
                {renderTranscript(expandedId)}
              </div>
              {panes[expandedId]?.error && (
                <p className="text-sm text-red-400 mt-2">{panes[expandedId]?.error}</p>
              )}
              <div className="mt-3 flex items-start gap-2">
                <textarea
                  ref={(el) => { if (expandedId) replyRefs.current[expandedId] = el; }}
                  className="flex-1 min-h-[44px] px-2 py-1.5 rounded-md border border-white/10 bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40 overflow-hidden resize-none text-sm"
                  placeholder="Reply to this model…"
                  value={replyInputs[expandedId] || ''}
                  onChange={(e) => setReplyInputs((r) => ({ ...r, [expandedId]: e.target.value }))}
                  onInput={(e) => autoResize(e.currentTarget)}
                  disabled={anyRunning}
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (e.shiftKey) return; // newline
                      e.preventDefault();
                      const id = expandedId as string;
                      void sendReply(id);
                    }
                  }}
                />
                <button
                  className="p-2 rounded-md border border-transparent hover:bg-white/10 disabled:opacity-50"
                  aria-label="Send reply"
                  type="button"
                  onClick={() => { const id = expandedId as string; void sendReply(id); }}
                  disabled={anyRunning || !(replyInputs[expandedId] || '').trim()}
                >
                  <Send className="size-5 opacity-90" />
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="mt-10 mb-6 text-xs opacity-70 text-center">
          Powered by OpenRouter. API key stored locally. No server.
        </footer>
        
        {/* Version display in bottom-right corner */}
        <VersionDisplay />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  );
}
