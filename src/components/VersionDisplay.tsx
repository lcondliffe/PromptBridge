"use client";

import { useEffect, useState } from "react";

export function VersionDisplay() {
  const [version, setVersion] = useState<string>("unknown");

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await fetch("/version.txt");
        if (response.ok) {
          const text = await response.text();
          setVersion(text.trim() || "unknown");
        }
      } catch (error) {
        // Fallback to unknown if fetch fails
        console.debug("Failed to fetch version:", error);
      }
    };

    fetchVersion();
  }, []);

  return (
    <div
      className="fixed right-3 bottom-2 text-xs opacity-60 pointer-events-none z-50"
      style={{
        fontSize: "10px",
        color: "rgb(161 161 170)", // zinc-400
      }}
    >
      {version}
    </div>
  );
}