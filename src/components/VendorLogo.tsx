"use client";

import { useMemo } from "react";
import {
  siOpenai,
  siMeta,
  siGoogle,
  siNvidia,
  siX,
  siAnthropic,
  siAlibabacloud,
} from "simple-icons";

/**
 * VendorLogo renders a small vendor logo for a given model id (e.g. "openai/gpt-4o-mini").
 * It derives the vendor from the id's prefix before '/' and uses Simple Icons for representation.
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

  // Map vendors to Simple Icons with custom colours for better dark mode visibility
  const iconData = useMemo(() => {
    const iconMap: Record<string, { path: string; hex: string; title: string }> = {
      openai: { ...siOpenai, hex: "10A37F" }, // OpenAI green instead of purple
      anthropic: { ...siAnthropic, hex: "D4820C" }, // Anthropic orange instead of black
      "meta-llama": siMeta,
      meta: siMeta,
      mistralai: siGoogle, // Using Google as fallback for Mistral
      qwen: siAlibabacloud, // Qwen is by Alibaba Cloud
      google: siGoogle,
      nvidia: siNvidia,
      // xAI variants - using a light gray instead of black for visibility
      xai: { ...siX, hex: "E5E7EB" },
      x: { ...siX, hex: "E5E7EB" },
      "x-ai": { ...siX, hex: "E5E7EB" },
      // Microsoft variants will fall back to generic icon
      deepseek: siGoogle, // Using Google as fallback
      cohere: siGoogle, // Using Google as fallback
      perplexity: siGoogle, // Using Google as fallback
      fireworks: siGoogle, // Using Google as fallback
      groq: siNvidia, // Using NVIDIA as fallback for Groq
    };
    return iconMap[vendor];
  }, [vendor]);

  const radius = rounded ? "rounded-sm" : "";
  const t = title || vendor || "Vendor";

  // If we have a Simple Icon, render it as SVG
  if (iconData) {
    return (
      <div
        className={`inline-flex items-center justify-center ${radius} ${className}`.trim()}
        style={{ width: size, height: size }}
        title={t}
      >
        <svg
          role="img"
          viewBox="0 0 24 24"
          className="w-full h-full"
          style={{ fill: `#${iconData.hex}` }}
        >
          <path d={iconData.path} />
        </svg>
      </div>
    );
  }

  // Fallback to a generic icon for unknown vendors
  return (
    <div
      className={`inline-flex items-center justify-center bg-gray-100 ${radius} ${className}`.trim()}
      style={{ width: size, height: size }}
      title={t}
    >
      <svg
        viewBox="0 0 24 24"
        className="w-3/4 h-3/4 text-gray-400"
        fill="currentColor"
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
    </div>
  );
}
