"use client";

import { WhatsAppLogo } from "@/components/icons";

// Mobile-only quick-share: opens WhatsApp with a pre-filled invite to the app.
// Shown only on small screens (the header already has room on desktop, and the
// wa.me handoff is really a phone flow). The URL is read from the current
// origin at click time, so it works in any environment with no config.
export function WhatsAppShare() {
  function share() {
    const url = window.location.origin;
    const text = `Join me on eToro X-Amplify 🚀 — we boost each other's reach on X. Sign in with X and follow the network: ${url}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <button
      onClick={share}
      aria-label="Share on WhatsApp"
      title="Invite a colleague on WhatsApp"
      className="grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] text-[#25D366] transition hover:bg-[#25D366]/10 sm:hidden"
    >
      <WhatsAppLogo className="h-4 w-4" />
    </button>
  );
}
