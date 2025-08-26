"use client";

import { useEffect, useState, FormEvent } from "react";
import { sdk, Conversation } from "@promptbridge/sdk";

export default function SessionsPage() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await sdk.conversations.list();
      setItems(data);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load";
      setError(message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const conv = await sdk.conversations.create(title || "Untitled");
      setTitle("");
      setItems((prev) => [conv, ...prev]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to create";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Sessions</h1>
      <form onSubmit={create} className="flex gap-2">
        <input
          className="border rounded px-3 py-2 flex-1"
          placeholder="New session title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button className="bg-black text-white rounded px-3 py-2" disabled={loading}>
          {loading ? "Creating..." : "Create"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.id} className="border rounded p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{c.title}</div>
              <div className="text-xs text-neutral-500">{new Date(c.updatedAt).toLocaleString()}</div>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await sdk.conversations.remove(c.id);
                setItems((prev) => prev.filter((x) => x.id !== c.id));
              }}
            >
              <button className="text-red-600 hover:underline">Delete</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

