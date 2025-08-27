"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { sdk, type Conversation } from "@promptbridge/sdk";
import { Trash2 } from "lucide-react";

export default function HistoryPage() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await sdk.conversations.list();
      setItems(data);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onDelete(id: string) {
    const ok = window.confirm("Delete this conversation? This cannot be undone.");
    if (!ok) return;
    try {
      await sdk.conversations.remove(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to delete";
      setError(message);
    }
  }

  return (
    <div className="w-full">
      <h1 className="text-xl font-semibold mb-4">Chat history</h1>
      {error && (
        <div role="alert" className="mb-3 rounded-xl border border-red-400/20 bg-red-500/10 text-red-300 px-3 py-2">
          {error}
        </div>
      )}
      {loading ? (
        <p className="opacity-70">Loading…</p>
      ) : items.length === 0 ? (
        <p className="opacity-70">No conversations yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between"
            >
              <div className="min-w-0">
                <Link
                  href={`/history/${c.id}`}
                  className="font-medium hover:underline block truncate"
                >
                  {c.title || "Untitled"}
                </Link>
                <div className="text-xs opacity-70">
                  {new Date(c.updatedAt).toLocaleString()}
                </div>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium border border-white/15 bg-white/5 hover:bg-white/10"
                onClick={() => onDelete(c.id)}
                aria-label="Delete conversation"
              >
                <Trash2 className="size-3.5" /> Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
