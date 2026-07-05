"use client";

import Link from "next/link";
import { TweetEmbed } from "@/components/tweet-embed";

// Focused "boost this post" card shown when the dashboard is opened from a
// push notification (/dashboard?post=<tweetId>&u=<username>). The buttons are
// zero-cost X intent links; /api/engage just records the click (like
// /api/follow does for follows).
export function BoostCard({
  tweetId,
  username,
}: {
  tweetId: string;
  username: string;
}) {
  const postUrl = `https://x.com/${username || "i"}/status/${tweetId}`;

  function track(action: "LIKE" | "REPOST" | "QUOTE") {
    fetch("/api/engage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tweetId, action }),
    }).catch(() => {});
  }

  return (
    <section className="rounded-3xl border border-[var(--brand)]/30 bg-[var(--brand)]/5 p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">
            🚀 Fresh post{username ? ` from @${username}` : ""} — give it a boost
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Early engagement is what makes X show it to more people.
          </p>
        </div>
        <Link
          href="/dashboard"
          aria-label="Dismiss"
          className="shrink-0 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          ✕
        </Link>
      </div>

      <div className="mx-auto max-w-xl">
        <TweetEmbed tweetId={tweetId} username={username || "x"} />
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <BoostButton
          href={`https://x.com/intent/like?tweet_id=${tweetId}`}
          onClick={() => track("LIKE")}
          label="❤️ Like"
        />
        <BoostButton
          href={`https://x.com/intent/retweet?tweet_id=${tweetId}`}
          onClick={() => track("REPOST")}
          label="🔁 Repost"
        />
        <BoostButton
          href={`https://x.com/intent/post?text=${encodeURIComponent(postUrl)}`}
          onClick={() => track("QUOTE")}
          label="💬 Quote"
        />
      </div>
    </section>
  );
}

function BoostButton({
  href,
  onClick,
  label,
}: {
  href: string;
  onClick: () => void;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-[var(--brand-contrast)] transition hover:bg-[var(--brand-strong)]"
    >
      {label}
    </a>
  );
}
