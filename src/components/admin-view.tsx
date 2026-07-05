"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CheckBadge, Spinner } from "@/components/icons";
import { ALL_POOL_TYPES, POOL_TYPES, type PoolType } from "@/lib/pool-types";

type Handle = {
  id: string;
  username: string;
  displayName: string | null;
  profileImage: string | null;
  isEtoroVerified: boolean;
  active: boolean;
  pushEnabled: boolean;
  type: string | null;
  userRole: string | null; // role of the linked User, if they've logged in
};

export function AdminView({
  isSuperAdmin,
  currentUsername,
}: {
  isSuperAdmin: boolean;
  currentUsername: string | null;
}) {
  const [handles, setHandles] = useState<Handle[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [type, setType] = useState<PoolType>("ETORIAN");
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
      body: JSON.stringify({ username: input, type }),
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

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/pool/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function toggleActive(h: Handle) {
    patch(h.id, { active: !h.active });
    setHandles((list) =>
      list.map((x) => (x.id === h.id ? { ...x, active: !x.active } : x))
    );
  }

  function togglePush(h: Handle) {
    patch(h.id, { pushEnabled: !h.pushEnabled });
    setHandles((list) =>
      list.map((x) =>
        x.id === h.id ? { ...x, pushEnabled: !x.pushEnabled } : x
      )
    );
  }

  function changeType(h: Handle, newType: PoolType) {
    patch(h.id, { type: newType });
    setHandles((list) =>
      list.map((x) => (x.id === h.id ? { ...x, type: newType } : x))
    );
  }

  async function toggleAdmin(h: Handle) {
    const makeAdmin = h.userRole !== "ADMIN";
    setError(null);
    const res = await fetch("/api/admin/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: h.username, makeAdmin }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to update role.");
      return;
    }
    setHandles((list) =>
      list.map((x) => (x.id === h.id ? { ...x, userRole: data.role } : x))
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Handle pool</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Add and manage the X accounts colleagues connect with.
          {isSuperAdmin && " As super admin, you can also promote admins."}
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
        <select
          value={type}
          onChange={(e) => setType(e.target.value as PoolType)}
          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-3 outline-none focus:border-[var(--brand)]/50"
        >
          {ALL_POOL_TYPES.map((t) => (
            <option key={t} value={t}>
              {POOL_TYPES[t].label}
            </option>
          ))}
        </select>
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
          {handles.map((h) => {
            const isSelf = h.username.toLowerCase() === currentUsername?.toLowerCase();
            const isTargetSuperAdmin = h.userRole === "SUPER_ADMIN";
            const canToggleAdmin =
              isSuperAdmin && h.userRole !== null && !isSelf && !isTargetSuperAdmin;
            return (
              <li key={h.id} className="flex flex-wrap items-center gap-3 p-3.5">
                {h.profileImage ? (
                  <Image
                    src={h.profileImage.replace("_normal", "_bigger")}
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 shrink-0 rounded-full ring-1 ring-[var(--border)]"
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-full bg-[var(--surface-2)]" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-medium">
                      {h.displayName ?? h.username}
                    </span>
                    {h.isEtoroVerified && (
                      <span title="eToro affiliated" className="shrink-0 text-[var(--brand)]">
                        <CheckBadge className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {isTargetSuperAdmin && (
                      <RolePill label="Super Admin" tone="brand" />
                    )}
                    {h.userRole === "ADMIN" && <RolePill label="Admin" tone="sky" />}
                  </div>
                  <div className="truncate text-sm text-[var(--muted)]">
                    @{h.username}
                  </div>
                </div>

                {/* Controls — own full-width row on mobile, inline on wider screens */}
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  {/* Type editor (admin + super admin) */}
                  <select
                    value={h.type ?? ""}
                    onChange={(e) => changeType(h, e.target.value as PoolType)}
                    className="rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs outline-none focus:border-[var(--brand)]/50"
                  >
                    {!h.type && <option value="">Unassigned</option>}
                    {ALL_POOL_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {POOL_TYPES[t].label}
                      </option>
                    ))}
                  </select>

                  {canToggleAdmin && (
                    <button
                      onClick={() => toggleAdmin(h)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        h.userRole === "ADMIN"
                          ? "border-sky-400/40 text-sky-300 hover:border-red-500/40 hover:text-red-400"
                          : "border-[var(--border)] text-[var(--muted)] hover:border-sky-400/40 hover:text-sky-300"
                      }`}
                    >
                      {h.userRole === "ADMIN" ? "Remove admin" : "Make admin"}
                    </button>
                  )}

                  <button
                    onClick={() => togglePush(h)}
                    title={
                      h.pushEnabled
                        ? "New posts trigger push notifications — click to disable"
                        : "Notify everyone when this handle posts"
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      h.pushEnabled
                        ? "border-[var(--brand)]/30 text-[var(--brand)]"
                        : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {h.pushEnabled ? "🔔 Push on" : "🔕 Push off"}
                  </button>

                  <button
                    onClick={() => toggleActive(h)}
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
                    className="ml-auto rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:border-red-500/40 hover:text-red-400 sm:ml-0"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RolePill({ label, tone }: { label: string; tone: "brand" | "sky" }) {
  const styles =
    tone === "brand"
      ? "border-[var(--brand)]/30 bg-[var(--brand)]/10 text-[var(--brand)]"
      : "border-sky-400/30 bg-sky-400/10 text-sky-300";
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles}`}
    >
      {label}
    </span>
  );
}
