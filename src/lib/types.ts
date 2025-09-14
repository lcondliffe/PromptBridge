export type Role = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ModelInfo {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
    image?: string;
    web_search?: string;
    internal_reasoning?: string;
  };
  supported_parameters?: string[];
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
  provider?: string;
  description?: string;
}

export interface StreamCallbacks {
  onToken?: (chunk: string) => void;
  onDone?: (full: string, usage?: unknown, metrics?: ResponseMetrics) => void;
  onError?: (err: Error) => void;
  onMetrics?: (metrics: Partial<ResponseMetrics>) => void;
}

export interface ResponseMetrics {
  startTime: number;
  firstTokenTime?: number;
  endTime?: number;
  totalTokens?: number;
  tokensPerSecond?: number;
  totalDuration?: number;
  firstTokenLatency?: number;
  provider?: string;
  modelUsed?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
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
  // Tools and function calling
  tools?: ToolDefinition[];
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
  // Reasoning capabilities
  reasoning?: { enabled?: boolean; effort?: 'low' | 'medium' | 'high' };
  include_reasoning?: boolean;
  // Debugging / logging
  debug?: boolean;
  traceId?: string;
  // Stream reliability
  streamTimeoutMs?: number;
  // Performance tracking
  trackMetrics?: boolean;
}

export interface StreamHandle {
  abortController: AbortController;
  promise: Promise<void>;
}
