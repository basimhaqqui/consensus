"use client";

import { useState } from "react";
import { track } from "@vercel/analytics";

export default function MatchShareButton({
  title,
  text,
  compact = false,
  url,
  label = "Share match ↗",
  copyText = false,
  analytics,
}: {
  title: string;
  text: string;
  compact?: boolean;
  url?: string;
  label?: string;
  copyText?: boolean;
  analytics?: Record<string, string | number | boolean>;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const shareUrl = url
      ? new URL(url, window.location.origin).toString()
      : window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
        recordShare();
        return;
      }
      await navigator.clipboard.writeText(
        copyText ? `${text}\n\n${shareUrl}` : shareUrl
      );
      recordShare();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(
          copyText ? `${text}\n\n${shareUrl}` : shareUrl
        );
        recordShare();
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch {
        // The browser can still share the current URL from its native menu.
      }
    }
  }

  function recordShare() {
    if (!analytics) return;
    try {
      track("Signal Shared", analytics);
    } catch {
      // Sharing still succeeds when custom analytics is unavailable.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-live="polite"
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-[7px] border border-accent/30 bg-accent/[0.08] font-medium uppercase tracking-[0.14em] text-accent transition-colors hover:border-accent/55 hover:bg-accent/[0.13] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        compact ? "h-10 w-full px-4 text-[10px]" : "px-3 py-2 text-[10px]"
      }`}
    >
      {copied ? (copyText ? "Caption copied ✓" : "Link copied ✓") : label}
    </button>
  );
}
