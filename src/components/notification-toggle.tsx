"use client";

import { usePush } from "@/lib/use-push";

// Bell toggle for browser push notifications (see usePush for the states).
export function NotificationToggle() {
  const { state, enable, disable } = usePush();

  if (state === "unsupported") return null;

  const on = state === "on";
  const denied = state === "denied";
  return (
    <button
      onClick={on ? disable : enable}
      disabled={state === "loading" || denied}
      title={
        denied
          ? "Notifications are blocked in your browser settings"
          : on
            ? "Push notifications on — click to turn off"
            : "Get notified when the network posts"
      }
      aria-label="Toggle push notifications"
      className={`grid h-8 w-8 place-items-center rounded-full border transition disabled:opacity-40 ${
        on
          ? "border-[var(--brand)]/40 bg-[var(--brand)]/10 text-[var(--brand)]"
          : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        {denied && <line x1="3" y1="3" x2="21" y2="21" />}
      </svg>
    </button>
  );
}
