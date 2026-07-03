"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CheckBadge, Spinner } from "@/components/icons";

type Handle = {
  id: string;
  username: string;
  displayName: string | null;
  profileImage: string | null;
  isEtoroVerified: boolean;
  active: boolean;
};

export function AdminView() {
  const [handles, setHandles] = useState<Handle[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/pool/list");
    const data = await res.json().catch(() => ({ handles: [] }));
    setHandles(data.handles ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    const res = await fetch("/api/pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: input }),
    });
    const data = await res.json().catch(() => ({}));
    setAdding(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to add handle.");
      return;
    }
    setInput("");
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/pool/${id}`, { method: "DELETE" });
    setHandles((h) => h.filter((x) => x.id !== id));
  }

  async function toggle(h: Handle) {
    await fetch(`/api/pool/${h.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !h.active }),
    });
    setHandles((list) =>
      list.map((x) => (x.id === h.id ? { ...x, active: !x.active } : x))
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Handle pool</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Add the eToro X accounts colleagues should connect with.
        </p>
      </div>

      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 focus-within:border-[var(--brand)]/50">
          <span className="text-[var(--muted)]">@</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="handle (e.g. samuelrudnick)"
            className="w-full bg-transparent px-2 py-3 outline-none placeholder:text-[var(--muted)]/60"
          />
        </div>
        <button
          type="submit"
          disabled={adding || !input.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-6 py-3 font-semibold text-[var(--brand-contrast)] transition hover:bg-[var(--brand-strong)] disabled:opacity-40"
        >
          {adding ? <Spinner className="h-4 w-4" /> : null}
          Add handle
        </button>
      </form>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-[var(--muted)]">
          <Spinner className="h-5 w-5" /> Loading pool…
        </div>
      ) : handles.length === 0 ? (
        <p className="py-10 text-center text-[var(--muted)]">
          No handles yet. Add the first one above.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          {handles.map((h) => (
            <li key={h.id} className="flex items-center gap-3 p-3.5">
              {h.profileImage ? (
                <Image
                  src={h.profileImage.replace("_normal", "_bigger")}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full ring-1 ring-[var(--border)]"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-[var(--surface-2)]" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium">
                    {h.displayName ?? h.username}
                  </span>
                  {h.isEtoroVerified && (
                    <span title="eToro affiliated" className="text-[var(--brand)]">
                      <CheckBadge className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
                <div className="truncate text-sm text-[var(--muted)]">
                  @{h.username}
                </div>
              </div>
              <button
                onClick={() => toggle(h)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  h.active
                    ? "border-[var(--brand)]/30 text-[var(--brand)]"
                    : "border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                {h.active ? "Active" : "Hidden"}
              </button>
              <button
                onClick={() => remove(h.id)}
                className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:border-red-500/40 hover:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
