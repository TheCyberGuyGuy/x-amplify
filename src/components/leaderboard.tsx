"use client";

import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import type { LeaderboardRow } from "@/app/api/leaderboard/route";

async function fetchLeaderboard(): Promise<{ rows: LeaderboardRow[] }> {
  const res = await fetch("/api/leaderboard");
  if (!res.ok) throw new Error("Failed to load the leaderboard.");
  return res.json();
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function Leaderboard() {
  const { data } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: fetchLeaderboard,
    staleTime: 60 * 1000,
  });

  const rows = data?.rows ?? [];
  if (rows.length === 0) return null;

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Network leaderboard
        </h3>
        <span className="hidden text-xs text-[var(--muted)]/70 sm:inline">
          who follows the most of the pool
        </span>
      </div>

      <ol className="space-y-1.5">
        {rows.map((r, i) => (
          <motion.li
            key={r.userId}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
              r.isMe
                ? "border border-[var(--brand)]/40 bg-[var(--brand)]/10"
                : "border border-transparent hover:bg-[var(--surface-2)]"
            }`}
          >
            <span className="w-6 shrink-0 text-center text-sm font-semibold text-[var(--muted)]">
              {MEDALS[i] ?? i + 1}
            </span>

            {r.image ? (
              <Image
                src={r.image}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 shrink-0 rounded-full ring-1 ring-[var(--border)]"
              />
            ) : (
              <div className="h-9 w-9 shrink-0 rounded-full bg-[var(--surface-2)]" />
            )}

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-semibold">
                  {r.name ?? r.username ?? "Unknown"}
                </span>
                {r.isMe && (
                  <span className="shrink-0 rounded-full bg-[var(--brand)]/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--brand)]">
                    You
                  </span>
                )}
              </div>
              {/* Progress bar */}
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                <motion.div
                  className="h-full rounded-full bg-[var(--brand)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${r.pct}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-sm font-bold tabular-nums">
                {r.count}
                <span className="text-[var(--muted)]">/{r.total}</span>
              </div>
              <div className="text-[11px] text-[var(--muted)]">{r.pct}%</div>
            </div>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
