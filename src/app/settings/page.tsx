"use client";

import { useState } from "react";
import { useApiKey } from "@/lib/apiKey";

export default function SettingsPage() {
  const { apiKey, setApiKey } = useApiKey();
  const [show, setShow] = useState(false);

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-4">Settings</h2>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
        <label className="block text-xs opacity-80 mb-1">OpenRouter API Key</label>
        <div className="flex items-center gap-2">
          <input
            type={show ? "text" : "password"}
            placeholder="sk-or-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="flex-1 px-2 py-1.5 rounded-md border border-white/10 bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
          />
          <button
            className="rounded-md px-2 py-1 text-xs border border-white/15 bg-white/5 hover:bg-white/10"
            type="button"
            onClick={() => setShow((v) => !v)}
          >
            {show ? "Hide" : "Show"}
          </button>
          <button
            className="rounded-md px-2 py-1 text-xs border border-white/15 bg-white/5 hover:bg-white/10"
            type="button"
            onClick={() => {
              try { localStorage.removeItem("openrouter_api_key"); } catch {}
              setApiKey("");
            }}
          >
            Clear
          </button>
        </div>
        <p className="text-[11px] opacity-70 mt-1">Stored locally in your browser. Not sent to any server.</p>
      </div>
    </div>
  );
}
