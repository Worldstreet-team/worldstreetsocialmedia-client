"use client";

import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { fmt } from "@/components/studio/studio-ui";
import { resolveCategoryLabel } from "@/lib/categories";
import { useT } from "@/i18n/client";

export interface DiscoverCommunity {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category: string;
  avatar?: string;
  membersCount: number;
  joined: boolean;
  memberSample?: { username: string; avatar?: string }[];
}

/**
 * A discovery row: big art, name, member count, topic, and a stack of real
 * faces. The faces are the point. A bare "24 members" says nothing about
 * whether a community is worth joining.
 */
export function DiscoverRow({
  row,
  onToggle,
}: {
  row: DiscoverCommunity;
  onToggle: (row: DiscoverCommunity) => void;
}) {
  const t = useT();
  const faces = row.memberSample ?? [];

  return (
    <div className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-surface/50">
      <Link
        href={`/communities/${row.slug}`}
        className="relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-xl bg-raised"
      >
        {row.avatar ? (
          <Image src={row.avatar} alt="" fill sizes="68px" className="object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-display text-2xl font-semibold text-gold">
            {row.name.charAt(0).toUpperCase()}
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          href={`/communities/${row.slug}`}
          className="truncate font-sans text-[15px] font-semibold text-primary hover:underline"
        >
          {row.name}
        </Link>
        <span className="font-sans text-[13px] text-muted">
          <span className="font-semibold tabular-nums text-primary">
            {fmt(row.membersCount)}
          </span>{" "}
          {t("community.members")}
        </span>
        <span className="truncate font-sans text-[12.5px] text-subtle">
          {resolveCategoryLabel(row.category) || row.category}
        </span>

        {faces.length > 0 && (
          <span className="mt-1 flex items-center">
            {faces.slice(0, 4).map((m, i) => (
              <span
                key={m.username}
                className="relative -ml-1.5 h-6 w-6 shrink-0 overflow-hidden rounded-pill bg-raised ring-2 ring-page first:ml-0"
                // Intra-row stacking, far below the z-sticky floor.
                style={{ zIndex: 4 - i }}
              >
                <SafeAvatar src={m.avatar} />
              </span>
            ))}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onToggle(row)}
        className={clsx(
          "h-8 shrink-0 cursor-pointer self-center rounded-pill px-3.5 font-sans text-[12px] font-semibold transition-colors",
          row.joined
            ? "bg-raised text-muted hover:text-danger"
            : "bg-primary text-page hover:bg-muted",
        )}
      >
        {row.joined ? t("community.joined") : t("community.join")}
      </button>
    </div>
  );
}
