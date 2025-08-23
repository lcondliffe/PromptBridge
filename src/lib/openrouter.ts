import type { ChatMessage, ChatParams, ModelInfo, StreamCallbacks, StreamHandle } from './types';

const BASE_URL = 'https://openrouter.ai/api/v1';

function defaultHeaders(apiKey: string): HeadersInit {
  return {
    'Authorization': `Bearer ${apiKey}`,
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
  { apiKey, model, messages, temperature = 0.7, maxTokens }: ChatParams,
  { onToken, onDone, onError }: StreamCallbacks = {}
): StreamHandle {
  const abortController = new AbortController();

  const body: { model: string; messages: ChatMessage[]; temperature: number; stream: boolean; max_tokens?: number } = {
    model,
    messages,
    temperature,
    stream: true,
  };
  if (typeof maxTokens === 'number') body.max_tokens = maxTokens;

  const promise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: defaultHeaders(apiKey),
        body: JSON.stringify(body),
        signal: abortController.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        throw new Error(`Chat error: ${res.status} ${res.statusText} ${text}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let full = '';

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
              }
            } catch {
              // Ignore malformed lines
            }
          }
        }
      }
      // End of stream without [DONE]
      onDone?.(full);
    } catch (err) {
      if (abortController.signal.aborted) return;
      const error = err instanceof Error ? err : new Error(String(err));
      onError?.(error);
    }
  })();

  return { abortController, promise };
}
