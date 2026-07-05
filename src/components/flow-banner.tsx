"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { usePush } from "@/lib/use-push";

// Guided "what's next" banner at the top of the dashboard:
//   1. Follow the network   → done when there's no one left to follow
//   2. Turn on alerts       → done when push is subscribed on this browser
//   3. Boost a post         → done after the first like/repost/quote click
// Disappears entirely once every step is complete.

async function fetchEngaged(): Promise<{ count: number }> {
  const res = await fetch("/api/engage");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function FlowBanner({
  toFollowCount,
  latestPost,
}: {
  toFollowCount: number;
  latestPost: { tweetId: string; username: string } | null;
}) {
  const router = useRouter();
  const push = usePush();
  const { data: engaged } = useQuery({
    queryKey: ["engaged"],
    queryFn: fetchEngaged,
    staleTime: 60 * 1000,
  });

  // Wait until every completion signal is known — no flash of wrong state.
  if (push.state === "loading" || engaged === undefined) return null;

  const steps = [
    {
      key: "follow",
      title: "Follow the network",
      detail:
        toFollowCount > 0
          ? `${toFollowCount} ${toFollowCount === 1 ? "person" : "people"} left`
          : "All connected",
      done: toFollowCount === 0,
      cta: "Follow them",
      onClick: () =>
        document
          .getElementById("to-follow")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    },
    // On browsers without web push (e.g. iOS Safari before installing the
    // PWA) the step is omitted rather than shown as permanently stuck.
    ...(push.state !== "unsupported"
      ? [
          {
            key: "alerts",
            title: "Stay updated",
            detail:
              push.state === "on"
                ? "Alerts are on"
                : push.state === "denied"
                  ? "Blocked in browser settings"
                  : "Know the moment someone posts",
            done: push.state === "on",
            cta: push.state === "denied" ? null : "Turn on alerts",
            onClick: () => push.enable(),
          },
        ]
      : []),
    {
      key: "boost",
      title: "Boost a post",
      detail:
        (engaged.count ?? 0) > 0
          ? "You've boosted the network"
          : "Early likes & reposts multiply reach",
      done: (engaged.count ?? 0) > 0,
      cta: "Boost the latest",
      onClick: () => {
        if (latestPost) {
          router.push(
            `/dashboard?post=${latestPost.tweetId}&u=${latestPost.username}`
          );
        } else {
          document
            .getElementById("latest-posts")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      },
    },
  ];

  if (steps.every((s) => s.done)) return null;
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Get the most out of the network
        </h2>
        <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">
          {doneCount}/{steps.length}
        </span>
      </div>

      <ol className="grid gap-2 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li
            key={s.key}
            className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
              s.done
                ? "border-[var(--brand)]/25 bg-[var(--brand)]/5"
                : "border-[var(--border)] bg-[var(--background)]/40"
            }`}
          >
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                s.done
                  ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                  : "border border-[var(--border)] text-[var(--muted)]"
              }`}
            >
              {s.done ? "✓" : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className={`truncate text-sm font-semibold ${
                  s.done ? "text-[var(--brand)]" : ""
                }`}
              >
                {s.title}
              </div>
              <div className="truncate text-xs text-[var(--muted)]">
                {s.detail}
              </div>
            </div>
            {!s.done && s.cta && (
              <button
                onClick={s.onClick}
                className="shrink-0 rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-contrast)] transition hover:bg-[var(--brand-strong)]"
              >
                {s.cta}
              </button>
            )}
          </li>
        ))}
      </ol>
    </motion.section>
  );
}
