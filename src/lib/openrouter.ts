import type { ChatParams, ModelInfo, StreamCallbacks, StreamHandle } from './types';
import { log } from './logger';

const BASE_URL = 'https://openrouter.ai/api/v1';

function defaultHeaders(apiKey: string): HeadersInit {
  const trimmed = (apiKey ?? '').trim();
  return {
    'Authorization': `Bearer ${trimmed}`,
    'X-API-Key': trimmed,
    'Content-Type': 'application/json',
    // OpenRouter recommends setting these to identify your app
    'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
    'X-Title': 'PromptBridge',
  } as HeadersInit;
}

export async function fetchModels(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch(`${BASE_URL}/models`, {
    method: 'GET',
    headers: defaultHeaders(apiKey),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to fetch models: ${res.status} ${res.statusText} ${text}`);
  }
  const data = await res.json();
  // OpenRouter returns { data: [ { id, name, ... } ] }
  const listRaw: unknown[] = Array.isArray(data?.data) ? data.data : [];
  const parsed: ModelInfo[] = [];
  for (const raw of listRaw) {
    if (typeof raw !== 'object' || raw === null) continue;
    const o = raw as { id?: unknown; name?: unknown; context_length?: unknown };
    const id = typeof o.id === 'string' ? o.id : o.id != null ? String(o.id) : '';
    if (!id) continue;
    const mi: ModelInfo = { id };
    if (typeof o.name === 'string') mi.name = o.name;
    if (typeof o.context_length === 'number') mi.context_length = o.context_length;
    parsed.push(mi);
  }
  return parsed;
}

export function streamChat(
  {
    apiKey,
    model,
    messages,
    temperature = 0.7,
    maxTokens,
    top_p,
    top_k,
    frequency_penalty,
    presence_penalty,
    repetition_penalty,
    min_p,
    top_a,
    seed,
    stop,
    logprobs,
    top_logprobs,
    response_format,
    structured_outputs,
    debug,
    traceId,
  }: ChatParams,
  { onToken, onDone, onError }: StreamCallbacks = {}
): StreamHandle {
  const abortController = new AbortController();

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    stream: true,
  };
  if (typeof maxTokens === 'number') body.max_tokens = maxTokens;
  if (typeof top_p === 'number') body.top_p = top_p;
  if (typeof top_k === 'number') body.top_k = top_k;
  if (typeof frequency_penalty === 'number') body.frequency_penalty = frequency_penalty;
  if (typeof presence_penalty === 'number') body.presence_penalty = presence_penalty;
  if (typeof repetition_penalty === 'number') body.repetition_penalty = repetition_penalty;
  if (typeof min_p === 'number') body.min_p = min_p;
  if (typeof top_a === 'number') body.top_a = top_a;
  if (typeof seed === 'number') body.seed = seed;
  if (Array.isArray(stop) && stop.length > 0) body.stop = stop;
  if (typeof logprobs === 'boolean') body.logprobs = logprobs;
  if (typeof top_logprobs === 'number') body.top_logprobs = top_logprobs;
  if (response_format) body.response_format = response_format;
  if (typeof structured_outputs === 'boolean') body.structured_outputs = structured_outputs;

  const promise = (async () => {
    try {
      if (debug) {
        const preview = Array.isArray(messages)
          ? messages.map((m) => ({ role: m.role, len: (m.content || '').length })).slice(-3)
          : [];
        const { messages: _omit, ...rest } = body as Record<string, unknown>;
        const sanitized = { ...rest, messages_preview: preview };
        const hasAuth = Boolean((apiKey ?? '').trim());
        log('info', 'chat', 'request', { traceId, model, body: sanitized, url: `${BASE_URL}/chat/completions`, hasAuth });
      }

      const headersObj = defaultHeaders(apiKey) as HeadersInit;
      const headers = new Headers(headersObj);
      headers.set('Accept', 'text/event-stream');

      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: abortController.signal,
        mode: 'cors',
      });
      if (debug) {
        const headerKeys = ['x-request-id','openrouter-request-id','openrouter-model','openrouter-provider','content-type'];
        const respHeaders: Record<string, string> = {};
        headerKeys.forEach((k) => {
          const v = (res.headers.get(k) || '') as string;
          if (v) respHeaders[k] = v;
        });
        log('info','chat','response',{ traceId, status: res.status, statusText: res.statusText, headers: respHeaders });
      }
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        throw new Error(`Chat error: ${res.status} ${res.statusText} ${text}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let full = '';
      const startedAt = Date.now();
      let firstTokenLogged = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE messages are separated by double newlines; process line by line
        const lines = buffer.split(/\r?\n/);
        // Keep the last partial line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice('data:'.length).trim();
            if (dataStr === '[DONE]') {
              onDone?.(full);
              return;
            }
            try {
              const payload = JSON.parse(dataStr);
              // Try OpenAI-style delta
              const delta = payload?.choices?.[0]?.delta ?? payload?.choices?.[0]?.message ?? payload?.message ?? null;
              const contentChunk = delta?.content ?? payload?.choices?.[0]?.text ?? '';
              if (contentChunk) {
                full += contentChunk;
                onToken?.(contentChunk);
                if (debug && !firstTokenLogged) {
                  firstTokenLogged = true;
                  log('info','chat','first_token',{ traceId, ms: Date.now()-startedAt });
                }
              }
            } catch {
              // Ignore malformed lines
            }
          }
        }
      }
      // End of stream without [DONE]
      onDone?.(full);
      if (debug) {
        log('info','chat','done',{ traceId, durationMs: Date.now()-startedAt, chars: full.length });
      }
    } catch (err) {
      if (abortController.signal.aborted) {
        if (debug) log('warn','chat','aborted',{ traceId });
        return;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      if (debug) log('error','chat','error',{ traceId, message: error.message });
      onError?.(error);
    }
  })();

  return { abortController, promise };
}
