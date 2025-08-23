export type Role = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ModelInfo {
  id: string;
  name?: string;
  context_length?: number;
}

export interface StreamCallbacks {
  onToken?: (chunk: string) => void;
  onDone?: (full: string, usage?: unknown) => void;
  onError?: (err: Error) => void;
}

export interface ChatParams {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  // Advanced sampling parameters (all optional)
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  repetition_penalty?: number;
  min_p?: number;
  top_a?: number;
  seed?: number;
  stop?: string[];
  logprobs?: boolean;
  top_logprobs?: number;
  response_format?: { type: string; [k: string]: unknown };
  structured_outputs?: boolean;
  // Debugging / logging
  debug?: boolean;
  traceId?: string;
}

export interface StreamHandle {
  abortController: AbortController;
  promise: Promise<void>;
}
