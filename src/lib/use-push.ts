"use client";

import { useCallback, useEffect, useState } from "react";

// Shared push-subscription state + actions, used by the header bell and the
// flow banner. States:
//  unsupported — hide push UI (e.g. iOS Safari outside an installed PWA)
//  off        — supported, not subscribed; enable() subscribes
//  on         — subscribed on this browser; disable() unsubscribes
//  denied     — user blocked notifications at the browser level (irreversible
//               from JS; surface a hint instead of a button)
export type PushState = "unsupported" | "loading" | "off" | "on" | "denied";

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

export function usePush() {
  const [state, setState] = useState<PushState>("loading");

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

  const enable = useCallback(async () => {
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
  }, []);

  const disable = useCallback(async () => {
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
  }, []);

  return { state, enable, disable };
}
