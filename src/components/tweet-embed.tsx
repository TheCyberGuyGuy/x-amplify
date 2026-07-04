"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/icons";

// Minimal shape of the global injected by X's widgets.js.
type Twttr = {
  widgets: {
    createTweet: (
      id: string,
      el: HTMLElement,
      opts?: Record<string, unknown>
    ) => Promise<HTMLElement | undefined>;
  };
};
declare global {
  interface Window {
    twttr?: Twttr;
  }
}

const SCRIPT_SRC = "https://platform.twitter.com/widgets.js";
let scriptPromise: Promise<Twttr | null> | null = null;

// Load widgets.js exactly once for the whole app.
function loadWidgets(): Promise<Twttr | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.twttr?.widgets) return Promise.resolve(window.twttr);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`
    );
    const done = () => resolve(window.twttr ?? null);
    if (existing) {
      existing.addEventListener("load", done);
      existing.addEventListener("error", () => resolve(null));
      if (window.twttr?.widgets) done();
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = done;
    s.onerror = () => resolve(null);
    document.body.appendChild(s);
  });
  return scriptPromise;
}

export function TweetEmbed({
  tweetId,
  username,
}: {
  tweetId: string;
  username: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    setState("loading");

    // Safety net: never hang on "Loading…" — fall back to a link after a while.
    const timeout = setTimeout(() => {
      if (!cancelled) setState((s) => (s === "loading" ? "error" : s));
    }, 12000);

    loadWidgets().then((twttr) => {
      if (cancelled || !el) return;
      if (!twttr) {
        setState("error");
        return;
      }
      const isDark =
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark");
      // The target must be attached and visible for the iframe to lay out.
      twttr.widgets
        .createTweet(tweetId, el, {
          theme: isDark ? "dark" : "light",
          conversation: "none",
          dnt: true,
        })
        .then((node) => {
          if (cancelled) return;
          setState(node ? "ready" : "error");
        })
        .catch(() => !cancelled && setState("error"));
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [tweetId]);

  return (
    <div className="min-h-[120px]">
      {state === "loading" && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
          <Spinner className="h-4 w-4" /> Loading post…
        </div>
      )}
      {state === "error" && (
        <a
          href={`https://x.com/${username}/status/${tweetId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)] hover:border-[var(--brand)]/40 hover:text-[var(--foreground)]"
        >
          View latest post by @{username} on X ↗
        </a>
      )}
      {/* Always mounted & visible so createTweet can measure and render. */}
      <div ref={ref} />
    </div>
  );
}
