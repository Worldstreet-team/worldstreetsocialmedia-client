"use client";

import Link from "next/link";
import Image from "next/image";
import { Plus } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";

export interface RailCommunity {
  id: string;
  name: string;
  slug: string;
  avatar?: string;
}

/**
 * The communities you are in, as art tiles.
 *
 * Art first, name under it: at a glance you recognise a community by its
 * icon, not by reading four names in a column.
 */
export function MyCommunitiesRail({
  communities,
  onCreate,
}: {
  communities: RailCommunity[];
  onCreate: () => void;
}) {
  const t = useT();

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {communities.map((c) => (
        <Link
          key={c.id}
          href={`/communities/${c.slug}`}
          className="group flex w-[112px] shrink-0 flex-col gap-1.5"
        >
          <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-raised transition-opacity group-hover:opacity-90">
            {c.avatar ? (
              <Image src={c.avatar} alt="" fill sizes="112px" className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-display text-2xl font-semibold text-gold">
                {c.name.charAt(0).toUpperCase()}
              </span>
            )}
          </span>
          <span className="truncate font-sans text-[12.5px] font-semibold text-primary">
            {c.name}
          </span>
        </Link>
      ))}

      <button
        type="button"
        onClick={onCreate}
        className="flex w-[112px] shrink-0 cursor-pointer flex-col gap-1.5"
      >
        <span className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-dashed border-hairline bg-surface text-muted transition-colors hover:border-gold hover:text-gold">
          <Plus size={20} weight="bold" />
        </span>
        <span className="truncate text-left font-sans text-[12.5px] font-medium text-muted">
          {t("community.create")}
        </span>
      </button>
    </div>
  );
}
