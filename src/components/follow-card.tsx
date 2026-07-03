"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { CheckBadge } from "@/components/icons";
import type { PoolMember } from "@/app/api/pool/route";

export function FollowCard({
  member,
  onFollow,
}: {
  member: PoolMember;
  onFollow?: (m: PoolMember) => void;
}) {
  const intentUrl = `https://x.com/intent/follow?screen_name=${member.username}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 transition hover:border-[var(--brand)]/40 hover:bg-[var(--surface-2)]"
    >
      {member.profileImage ? (
        <Image
          src={member.profileImage.replace("_normal", "_bigger")}
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-full ring-1 ring-[var(--border)]"
        />
      ) : (
        <div className="h-12 w-12 shrink-0 rounded-full bg-[var(--surface-2)]" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold">
            {member.displayName ?? member.username}
          </span>
          {member.isEtoroVerified && (
            <span title="eToro affiliated" className="text-[var(--brand)]">
              <CheckBadge className="h-4 w-4" />
            </span>
          )}
        </div>
        <div className="truncate text-sm text-[var(--muted)]">
          @{member.username}
        </div>
        {member.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-[var(--muted)]/80">
            {member.description}
          </p>
        )}
      </div>

      {member.following ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--brand)]/30 bg-[var(--brand)]/10 px-3.5 py-2 text-sm font-medium text-[var(--brand)]">
          <CheckBadge className="h-4 w-4" /> Following
        </span>
      ) : (
        <a
          href={intentUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onFollow?.(member)}
          className="shrink-0 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-white/90 active:scale-95"
        >
          Follow
        </a>
      )}
    </motion.div>
  );
}
