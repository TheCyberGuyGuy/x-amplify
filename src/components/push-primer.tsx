"use client";

import { AnimatePresence, motion } from "framer-motion";

// Soft pre-prompt for push permission. This is NOT the browser dialog — it's
// our own card, shown at a high-intent moment (right after the user's first
// follow). Only when they tap "Enable" do we fire the real, one-shot browser
// prompt (via usePush.enable), so "Maybe later" never burns the permission.
// Dismissal is remembered so we don't nag on every visit.

const DISMISS_KEY = "xa_push_primer_dismissed_at";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // re-ask at most weekly

export function pushPrimerSnoozed(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const at = Number(raw);
  return Number.isFinite(at) && Date.now() - at < SNOOZE_MS;
}

export function PushPrimer({
  open,
  onEnable,
  onDismiss,
}: {
  open: boolean;
  onEnable: () => void;
  onDismiss: () => void;
}) {
  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // private mode / storage disabled — just close for this session
    }
    onDismiss();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismiss}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          {/* Bottom sheet on mobile, centered card on larger screens */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Turn on alerts"
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md rounded-t-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
          >
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--brand)]/10 text-3xl">
              🔔
            </div>
            <h2 className="text-lg font-bold tracking-tight">
              Never miss a moment
            </h2>
            <p className="mx-auto mt-1.5 max-w-xs text-sm text-[var(--muted)]">
              You just followed a teammate. Get a ping the instant they post — so
              you can boost while it counts most.
            </p>
            <div className="mt-6 grid gap-2">
              <button
                onClick={onEnable}
                className="rounded-full bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-[var(--brand-contrast)] transition hover:bg-[var(--brand-strong)]"
              >
                Enable alerts
              </button>
              <button
                onClick={dismiss}
                className="rounded-full px-5 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
              >
                Maybe later
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
