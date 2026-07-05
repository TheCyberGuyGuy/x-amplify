"use client";

import { useEffect, useState } from "react";

// Bell toggle for browser push notifications. States:
//  unsupported — hidden entirely (e.g. iOS Safari outside an installed PWA)
//  off        — supported, not subscribed; click subscribes
//  on         — subscribed on this browser; click unsubscribes
//  denied     — user blocked notifications at the browser level (irreversible
//               from JS; we show a disabled bell with a hint)
type State = "unsupported" | "loading" | "off" | "on" | "denied";

function supported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// applicationServerKey must be a Uint8Array, not the base64url string.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function NotificationToggle() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (!supported()) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  async function enable() {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      // Only ever request permission from a click handler.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("push not configured");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key).buffer as ArrayBuffer,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setState("on");
    } catch {
      setState("off");
    }
  }

  async function disable() {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
    } finally {
      setState("off");
    }
  }

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
