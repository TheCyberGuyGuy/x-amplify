"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/icons";
import { SELF_SELECTABLE_TYPES, POOL_TYPES, type PoolType } from "@/lib/pool-types";

const DESCRIPTIONS: Record<string, string> = {
  ETORIAN: "I work at eToro.",
  POPULAR_INVESTOR: "I'm a Popular Investor in the eToro community.",
};

export function OnboardingModal() {
  const router = useRouter();
  const [saving, setSaving] = useState<PoolType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(type: PoolType) {
    setError(null);
    setSaving(type);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    if (!res.ok) {
      setSaving(null);
      setError("Something went wrong. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7 text-center"
      >
        <h2 className="text-xl font-bold tracking-tight">Welcome to X-Amplify 👋</h2>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          One quick thing — how should we list you in the network?
        </p>

        <div className="mt-6 grid gap-3">
          {SELF_SELECTABLE_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => choose(t)}
              disabled={saving !== null}
              className="group flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--background)] px-5 py-4 text-left transition hover:border-[var(--brand)]/50 hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              <div>
                <div className="font-semibold">{POOL_TYPES[t].label}</div>
                <div className="text-sm text-[var(--muted)]">{DESCRIPTIONS[t]}</div>
              </div>
              {saving === t ? (
                <Spinner className="h-5 w-5 text-[var(--brand)]" />
              ) : (
                <span className="text-[var(--muted)] transition group-hover:text-[var(--brand)]">
                  →
                </span>
              )}
            </button>
          ))}
        </div>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </motion.div>
    </div>
  );
}
