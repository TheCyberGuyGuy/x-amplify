"use client";

import { signIn } from "next-auth/react";
import { XLogo } from "@/components/icons";

export function SignInButton({ className = "" }: { className?: string }) {
  return (
    <button
      onClick={() => signIn("twitter", { callbackUrl: "/dashboard" })}
      className={`group inline-flex items-center justify-center gap-2.5 rounded-full bg-white px-6 py-3 font-semibold text-black shadow-lg shadow-black/30 transition hover:scale-[1.02] hover:bg-white/90 active:scale-95 ${className}`}
    >
      <XLogo className="h-4 w-4" />
      Sign in with X
    </button>
  );
}
