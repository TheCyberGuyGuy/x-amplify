"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { XLogo, Spinner } from "@/components/icons";

function GateForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Incorrect password. Ask your admin for access.");
      return;
    }
    const from = params.get("from") || "/";
    router.replace(from);
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center"
    >
      <div className="mx-auto mb-6 flex items-center justify-center gap-2.5">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--brand)] text-xl font-black text-[var(--brand-contrast)]">
          e
        </span>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-black">
          <XLogo className="h-5 w-5" />
        </span>
      </div>
      <h1 className="text-xl font-bold tracking-tight">eToro X-Amplify</h1>
      <p className="mt-1.5 text-sm text-[var(--muted)]">
        Enter the access password to continue.
      </p>

      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Access password"
        className="mt-6 w-full rounded-full border border-[var(--border)] bg-[var(--background)] px-5 py-3 text-center outline-none focus:border-[var(--brand)]/50"
      />
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading || !password}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-6 py-3 font-semibold text-[var(--brand-contrast)] transition hover:bg-[var(--brand-strong)] disabled:opacity-40"
      >
        {loading ? <Spinner className="h-4 w-4" /> : null}
        Enter
      </button>
    </form>
  );
}

export default function GatePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <Suspense fallback={null}>
        <GateForm />
      </Suspense>
    </main>
  );
}
