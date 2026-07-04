"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FollowCard } from "@/components/follow-card";
import { Leaderboard } from "@/components/leaderboard";
import { TweetEmbed } from "@/components/tweet-embed";
import { Spinner } from "@/components/icons";
import type { PoolMember } from "@/app/api/pool/route";
import type { TimelineEntry } from "@/app/api/timeline/route";
import { ALL_POOL_TYPES, POOL_TYPES, type PoolType } from "@/lib/pool-types";

type PoolResponse = {
  following: PoolMember[];
  toFollow: PoolMember[];
  total: number;
};

async function fetchPool(): Promise<PoolResponse> {
  const res = await fetch("/api/pool");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to load your network.");
  }
  return res.json();
}

type TimelineResponse = { entries: TimelineEntry[]; isAdmin: boolean };

async function fetchTimeline(): Promise<TimelineResponse> {
  const res = await fetch("/api/timeline");
  if (!res.ok) throw new Error("Failed to load the timeline.");
  return res.json();
}

function ProgressRing({ value, total }: { value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-24 w-24 place-items-center">
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
        <motion.circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * pct) / 100 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute text-lg font-bold">{pct}%</span>
    </div>
  );
}

export function DashboardView() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["pool"],
    queryFn: fetchPool,
  });
  const { data: timeline } = useQuery({
    queryKey: ["timeline"],
    queryFn: fetchTimeline,
    staleTime: 5 * 60 * 1000, // cached server-side anyway; don't refetch eagerly
  });

  const [filter, setFilter] = useState<PoolType | "ALL">("ALL");
  const [refreshing, setRefreshing] = useState(false);

  // Once the pool load has snapshotted this viewer's follow state, refresh the
  // leaderboard so their own row reflects the latest counts.
  useEffect(() => {
    if (data) qc.invalidateQueries({ queryKey: ["leaderboard"] });
  }, [data, qc]);

  async function refreshTimeline() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch("/api/timeline", { method: "POST" });
      if (res.ok) {
        const fresh = (await res.json()) as TimelineResponse;
        qc.setQueryData(["timeline"], fresh);
      }
    } catch {
      // Non-fatal — leave the current posts in place.
    } finally {
      setRefreshing(false);
    }
  }

  function recordFollow(m: PoolMember) {
    fetch("/api/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poolHandleId: m.id }),
    }).catch(() => {});
    // Optimistically move the card into "following".
    qc.setQueryData<PoolResponse>(["pool"], (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        toFollow: prev.toFollow.filter((x) => x.id !== m.id),
        following: [{ ...m, following: true }, ...prev.following],
      };
    });
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-[var(--muted)]">
        <Spinner className="h-6 w-6" />
        Checking who you already follow…
      </div>
    );
  }

  if (error) {
    const msg = (error as Error).message;
    const sessionExpired = /sign in|session/i.test(msg);
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
        <p className="font-medium text-red-300">{msg}</p>
        {sessionExpired ? (
          <button
            onClick={() => signIn("twitter", { callbackUrl: "/dashboard" })}
            className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-white/90"
          >
            Sign in with X again
          </button>
        ) : (
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["pool"] })}
            className="mt-4 rounded-full border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-2)]"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  const { following: allFollowing = [], toFollow: allToFollow = [], total = 0 } =
    data ?? {};

  // Which types actually appear in the pool (for showing only relevant tabs).
  const presentTypes = ALL_POOL_TYPES.filter((t) =>
    [...allFollowing, ...allToFollow].some((m) => m.type === t)
  );
  const byFilter = (m: PoolMember) => filter === "ALL" || m.type === filter;
  const following = allFollowing.filter(byFilter);
  const toFollow = allToFollow.filter(byFilter);

  if (total === 0) {
    return (
      <div className="py-24 text-center text-[var(--muted)]">
        <p className="text-lg font-medium text-[var(--foreground)]">
          No colleagues in the pool yet
        </p>
        <p className="mt-1 text-sm">An admin needs to add some X handles first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Progress hero — overall, across all types */}
      <div className="flex items-center gap-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <ProgressRing value={allFollowing.length} total={total} />
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            You follow {allFollowing.length} of {total} in the network
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {allToFollow.length > 0
              ? `${allToFollow.length} more to go — one click each to boost each other's reach.`
              : "You're connected with everyone in the pool. 🎉"}
          </p>
        </div>
      </div>

      <Leaderboard />

      {/* Type filter tabs */}
      {presentTypes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <FilterTab active={filter === "ALL"} onClick={() => setFilter("ALL")}>
            All
          </FilterTab>
          {presentTypes.map((t) => (
            <FilterTab key={t} active={filter === t} onClick={() => setFilter(t)}>
              {POOL_TYPES[t].label}
            </FilterTab>
          ))}
        </div>
      )}

      {toFollow.length > 0 && (
        <section>
          <SectionHeading title="People to follow" count={toFollow.length} />
          <div className="grid gap-3 sm:grid-cols-2">
            {toFollow.map((m) => (
              <FollowCard key={m.id} member={m} onFollow={recordFollow} />
            ))}
          </div>
        </section>
      )}

      {following.length > 0 && (
        <section>
          <SectionHeading title="Already following" count={following.length} />
          <div className="grid gap-3 sm:grid-cols-2">
            {following.map((m) => (
              <FollowCard key={m.id} member={m} />
            ))}
          </div>
        </section>
      )}

      {(() => {
        const posts = (timeline?.entries ?? []).filter(
          (e) => filter === "ALL" || e.type === filter
        );
        if (posts.length === 0) return null;
        return (
          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <SectionHeading
                title="Latest posts — like & reply"
                count={posts.length}
              />
              {timeline?.isAdmin && (
                <button
                  onClick={refreshTimeline}
                  disabled={refreshing}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--foreground)] disabled:opacity-60"
                >
                  {refreshing && <Spinner className="h-3.5 w-3.5" />}
                  {refreshing ? "Refreshing…" : "Refresh posts"}
                </button>
              )}
            </div>
            <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
              {posts.map((e) => (
                <TweetEmbed
                  key={e.id}
                  tweetId={e.latestTweetId!}
                  username={e.username}
                />
              ))}
            </div>
          </section>
        );
      })()}
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
        active
          ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
          : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        {title}
      </h3>
      <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">
        {count}
      </span>
    </div>
  );
}
