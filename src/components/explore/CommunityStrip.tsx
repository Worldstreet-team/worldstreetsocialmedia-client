"use client";

import { formatCompact } from "@/lib/utils";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useT } from "@/i18n/client";
import { ExploreSection, SectionLink } from "./ExploreSection";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import {
  press,
  snappySpring,
  staggerItem,
  staggerParent,
} from "@/lib/motion-presets";

export interface CommunityRow {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category: string;
  avatar?: string;
  membersCount: number;
  joined: boolean;
}

/**
 * Up to four communities the viewer has not joined.
 *
 * There is no "suggested" endpoint yet, so this filters the full list client
 * side. Fine at current scale; past a few hundred rows it wants ?suggested=1.
 */
export function CommunityStrip({
  communities,
  loading,
  onJoin,
  delay,
}: {
  communities: CommunityRow[];
  loading: boolean;
  onJoin: (row: CommunityRow) => void;
  delay: number;
}) {
  const t = useT();
  const open = communities.filter((c) => !c.joined).slice(0, 4);

  // Rows only re-measure when the set of cards changes. Without this, a
  // strip loading above would send these gliding down the page after it.
  const layoutKey = open.map((c) => c.id).join();

  if (!loading && open.length === 0) return null;

  return (
    <ExploreSection
      label={t("explore.section.communities")}
      delay={delay}
      trailing={<SectionLink href="/communities">{t("rail.seeAll")}</SectionLink>}
    >
      <div className="relative grid gap-3 sm:grid-cols-2">
        {loading
          ? [0, 1].map((i) => <div key={i} className="card-depth skeleton h-28" />)
          : (
            // Cascade once when the list lands. A joined card fades out and
            // the rest glide up; the one that takes its place rises alone.
            <motion.div
              className="contents"
              variants={staggerParent}
              initial="hidden"
              animate="show"
            >
            {/* popLayout, not the default: the rows only measure on the
                render where the id set changes, so the leaving card has to
                be out of the flow on that same render or the rest snap. */}
            <AnimatePresence mode="popLayout">
            {open.map((row) => (
              <motion.div
                key={row.id}
                layout
                layoutDependency={layoutKey}
                variants={staggerItem}
                // The exit is passed as an object on purpose: a variant LABEL
                // here would make the row its own variant root and cut it
                // out of the parent's cascade.
                exit={staggerItem.exit}
                transition={{ layout: snappySpring }}
                className="card-depth flex gap-3 p-4"
              >
                <Link
                  href={`/communities/${row.slug}`}
                  className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-raised"
                >
                  {row.avatar ? (
                    <SafeAvatar src={row.avatar} className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-display text-[calc(17px*var(--ws-fs))] font-semibold text-gold">
                      {row.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link
                    href={`/communities/${row.slug}`}
                    className="truncate font-sans text-[calc(15px*var(--ws-fs))] font-semibold text-primary hover:underline"
                  >
                    {row.name}
                  </Link>
                  <span className="font-sans text-[calc(11px*var(--ws-fs))] font-semibold uppercase tracking-wider text-subtle">
                    <span className="tabular-nums">{formatCompact(row.membersCount)}</span>{" "}
                    {t("community.members")}
                  </span>
                  {row.description && (
                    <p className="line-clamp-2 font-sans text-[calc(13px*var(--ws-fs))] leading-snug text-muted">
                      {row.description}
                    </p>
                  )}
                  <motion.button
                    type="button"
                    onClick={() => onJoin(row)}
                    {...press}
                    className="mt-1 h-8 cursor-pointer self-start rounded-pill bg-primary px-3.5 font-sans text-[calc(12px*var(--ws-fs))] font-semibold text-page transition-colors hover:bg-muted"
                  >
                    {t("community.join")}
                  </motion.button>
                </div>
              </motion.div>
            ))}
            </AnimatePresence>
            </motion.div>
          )}
      </div>
    </ExploreSection>
  );
}
