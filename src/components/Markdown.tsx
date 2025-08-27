"use client";

import React, { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypePrismPlus from "rehype-prism-plus";
import type { Components } from "react-markdown";
import { Copy } from "lucide-react";
import { refractor } from "refractor/lib/core";
import python from "refractor/lang/python.js";

// Register needed languages for rehype-prism-plus (via refractor)
// Registering twice throws; catch and ignore (e.g., HMR)
try {
  refractor.register(python);
} catch {
  // already registered
}

export default function Markdown({ text }: { text: string }) {
  const mdComponents: Components = {
    pre: PreBlock,
    code: InlineCode as unknown as Components["code"],
  };
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypePrismPlus, { ignoreMissing: true }]]}
      // ReactMarkdown escapes raw HTML by default (we're not adding rehype-raw)
      components={mdComponents}
    >
      {text}
    </ReactMarkdown>
  );
}

type CodeProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
  inline?: boolean;
  node?: unknown;
};

function InlineCode({ inline, className, children, ...props }: CodeProps) {
  // For inline code, apply a subtle style. For blocks, let PreBlock handle container/UI.
  if (inline) {
    return (
      <code
        className={`px-1 py-[1px] rounded bg-white/10 border border-white/10 ${className || ""}`}
        {...props}
      >
        {children}
      </code>
    );
  }
  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}

function PreBlock({ className, children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      const codeEl = containerRef.current?.querySelector("code");
      const toCopy = codeEl?.textContent ?? "";
      if (toCopy) {
        await navigator.clipboard.writeText(toCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }
    } catch {
      // no-op
    }
  };

  return (
    <div ref={containerRef} className="relative my-2 rounded-lg border border-white/10 bg-white/5">
      <button
        type="button"
        aria-label="Copy code"
        title={copied ? "Copied" : "Copy"}
        onClick={onCopy}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] border border-white/15 bg-black/30 hover:bg-black/40"
      >
        <Copy className="size-3.5" />
        <span className="sr-only">Copy</span>
      </button>
      <pre className={`m-0 overflow-x-auto rounded-lg ${className || ""}`} {...props}>
        {children}
      </pre>
    </div>
  );
}
