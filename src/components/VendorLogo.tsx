"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

/**
 * VendorLogo renders a small vendor logo for a given model id (e.g. "openai/gpt-4o-mini").
 * It derives the vendor from the id's prefix before '/'.
 * Resolution order for the logo source:
 *   1) Local curated SVG at /vendors/{vendor}.svg (if you add one)
 *   2) Clearbit logo for one of the known domains (tries multiple per vendor)
 *   3) Fallback to /globe.svg
 */
export default function VendorLogo({
  modelId,
  size = 16,
  className = "",
  rounded = true,
  title,
}: {
  modelId: string;
  size?: number;
  className?: string;
  rounded?: boolean;
  title?: string;
}) {
  const vendor = useMemo(() => ((modelId || "").split("/", 1)[0] || "").toLowerCase(), [modelId]);

  // Known vendor (First item has highest priority)
  const domains = useMemo(() => {
    const map: Record<string, string[]> = {
      openai: ["openai.com"],
      anthropic: ["anthropic.com"],
      "meta-llama": ["meta.com"],
      mistralai: ["mistral.ai"],
      // Qwen is by Alibaba Cloud; try qwenlm and Alibaba Cloud domains
      qwen: ["qwenlm.ai", "alibabacloud.com", "aliyun.com"],
      deepseek: ["deepseek.com"],
      google: ["google.com"],
      cohere: ["cohere.com"],
      nvidia: ["nvidia.com"],
      perplexity: ["perplexity.ai"],
      fireworks: ["fireworks.ai"],
      groq: ["groq.com"],
      // xAI sometimes appears as x-ai
      xai: ["x.ai"],
      x: ["x.ai"],
      "x-ai": ["x.ai"],
      microsoft: ["microsoft.com", "azure.microsoft.com"],
    };
    return map[vendor] || [];
  }, [vendor]);

  // Build candidate sources in priority order
  const sources = useMemo(() => {
    const list: string[] = [];
    // 1) Local curated SVG (add a file at public/vendors/{vendor}.svg to override)
    if (vendor) list.push(`/vendors/${vendor}.svg`);
    // 2) Clearbit candidates
    for (const d of domains) list.push(`https://logo.clearbit.com/${d}`);
    // 3) Final fallback
    list.push("/globe.svg");
    return list;
  }, [vendor, domains]);

  const [idx, setIdx] = useState(0);
  const src = sources[Math.min(idx, sources.length - 1)] || "/globe.svg";

  const radius = rounded ? "rounded-sm" : "";
  const alt = `${vendor || "vendor"} logo`;
  const t = title || vendor || "Vendor";

  return (
    <Image
      src={src}
      width={size}
      height={size}
      alt={alt}
      title={t}
      onError={() => setIdx((i) => Math.min(i + 1, sources.length - 1))}
      className={`inline-block object-contain bg-white/5 ${radius} ${className}`.trim()}
      style={{ width: size, height: size }}
      unoptimized
    />
  );
}
