"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { sdk, type Conversation, type Message } from "@promptbridge/sdk";
import { Trash2, ArrowLeft } from "lucide-react";
import Markdown from "@/components/Markdown";

export default function HistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const conversationId = params?.id as string;

  const [convList, setConvList] = useState<Conversation[] | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const conversation = useMemo(() =>
    (convList || []).find((c) => c.id === conversationId) || null,
  [convList, conversationId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [convs, msgs] = await Promise.all([
        sdk.conversations.list(),
        sdk.conversations.messages.list(conversationId),
      ]);
      setConvList(convs);
      setMessages(msgs);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!conversationId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  async function onDelete() {
    const ok = window.confirm("Delete this conversation? This cannot be undone.");
    if (!ok) return;
    try {
      await sdk.conversations.remove(conversationId);
      router.push("/history");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to delete";
      setError(message);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/history"
            className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium border border-white/15 bg-white/5 hover:bg-white/10"
          >
            <ArrowLeft className="size-3.5" /> Back
          </Link>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium border border-white/15 bg-white/5 hover:bg-white/10"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" /> Delete
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-3 rounded-xl border border-red-400/20 bg-red-500/10 text-red-300 px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="opacity-70">Loading…</p>
      ) : !messages ? (
        <p className="opacity-70">No messages.</p>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h1 className="text-lg font-semibold mb-3">{conversation?.title || "Conversation"}</h1>
          <div className="space-y-2 text-sm">
            {messages.map((m) => (
              <div key={m.id} className="flex justify-start">
                <div className={`max-w-full rounded-lg px-3 py-2 border border-white/10 ${m.role === 'user' ? 'bg-indigo-600/20' : 'bg-white/5'}`}>
                  {m.role === 'assistant' ? (
                    <Markdown text={m.content} />
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                  {m.role === 'assistant' && m.model && (
                    <div className="mt-1 text-[10px] opacity-70">Model: {m.model}</div>
                  )}
                  <div className="mt-1 text-[10px] opacity-60">{new Date(m.createdAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
