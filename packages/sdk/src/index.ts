export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string | null;
  createdAt: string;
};

function getApiBase(): string {
  // Client: use NEXT_PUBLIC_API_BASE_URL or default to /api
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
  }
  // Server-side: allow API_BASE_URL override (useful in SSR/split deployments)
  return (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:3000/api"
  );
}

class ApiError extends Error {
  status: number;
  body?: string;
  constructor(status: number, body?: string) {
    super(body || `Request failed: ${status}`);
    this.status = status;
    this.body = body;
    this.name = "ApiError";
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });
  if (!res.ok) {
    let body: string | undefined;
    try {
      body = await res.text();
    } catch {}
    throw new ApiError(res.status, body);
  }
  return res.json();
}

export const sdk = {
  health: () => api<{ ok: true; now: string }>("/health"),
  conversations: {
    list: () => api<Conversation[]>("/conversations"),
    create: (title: string) =>
      api<Conversation>("/conversations", {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    remove: (id: string) =>
      api<{ ok: true }>(`/conversations/${id}`, { method: "DELETE" }),
    messages: {
      list: (conversationId: string) =>
        api<Message[]>(`/conversations/${conversationId}/messages`),
      create: (
        conversationId: string,
        input: { role: "user" | "assistant" | "system"; content: string; model?: string | null }
      ) =>
        api<Message>(`/conversations/${conversationId}/messages`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
    },
  },
};

