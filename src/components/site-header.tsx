"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { NotificationToggle } from "@/components/notification-toggle";
import { WhatsAppShare } from "@/components/whatsapp-share";

export function SiteHeader({
  name,
  username,
  image,
  role,
}: {
  name?: string | null;
  username?: string | null;
  image?: string | null;
  role?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--brand)] font-black text-[var(--brand-contrast)]">
            e
          </span>
          <span className="truncate text-sm font-semibold tracking-tight">
            eToro <span className="text-[var(--brand)]">X-Amplify</span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <WhatsAppShare />
          <NotificationToggle />
          {(role === "ADMIN" || role === "SUPER_ADMIN") && (
            <Link
              href="/admin"
              className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              Admin
            </Link>
          )}
          <div className="flex items-center gap-2.5">
            {image && (
              <Image
                src={image}
                alt=""
                width={30}
                height={30}
                className="rounded-full ring-1 ring-[var(--border)]"
              />
            )}
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-medium">{name}</div>
              {username && (
                <div className="text-xs text-[var(--muted)]">@{username}</div>
              )}
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:border-[var(--foreground)]/40 hover:text-[var(--foreground)]"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
