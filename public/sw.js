// X-Amplify push service worker.
// Kept intentionally tiny: show pushes, open the app on click. No caching.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "eToro X-Amplify", {
      body: data.body || "",
      // tag replaces an earlier notification with the same tag instead of stacking
      tag: data.tag || "x-amplify",
      data: { url: data.url || "/dashboard" },
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    (async () => {
      // Record the click (best-effort; cookies ride along on same-origin).
      fetch("/api/push/clicked", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url }),
      }).catch(() => {});

      // Focus an existing app tab if one is open, else open a new one.
      const tabs = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = tabs.find((t) => t.url.includes(self.location.origin));
      if (existing) {
        await existing.focus();
        await existing.navigate(url);
      } else {
        await self.clients.openWindow(url);
      }
    })()
  );
});
