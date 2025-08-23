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
}

export interface StreamHandle {
  abortController: AbortController;
  promise: Promise<void>;
}
