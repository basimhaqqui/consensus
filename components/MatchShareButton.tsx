"use client";

import { useState } from "react";

export default function MatchShareButton({
  title,
  text,
  compact = false,
}: {
  title: string;
  text: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch {
        // The browser can still share the current URL from its native menu.
      }
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-live="polite"
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-[7px] border border-accent/30 bg-accent/[0.08] font-medium uppercase tracking-[0.14em] text-accent transition-colors hover:border-accent/55 hover:bg-accent/[0.13] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        compact ? "h-10 w-full px-4 text-[10px]" : "px-3 py-2 text-[9px]"
      }`}
    >
      {copied ? "Link copied ✓" : "Share match ↗"}
    </button>
  );
}
