"use client";

import { Hand, Microphone, SlidersHorizontal } from "@phosphor-icons/react";
import clsx from "clsx";
import { motion } from "framer-motion";
import {
  ElapsedTimer,
  type SpaceRow,
  SpaceThumb,
  spaceArt,
  spaceListenerCount,
} from "@/components/voice/SpaceCard";
import { useT } from "@/i18n/client";
import { press } from "@/lib/motion-presets";
import { formatCompact } from "@/lib/utils";

/**
 * The room you are in, pinned above the Now column.
 *
 * The room itself lives in `voiceSessionAtom` (VoiceRoomHost renders it and
 * keeps its audio alive across the app), so this bar is only a way back in:
 * the art, the title, how long it has been on air, who is listening and,
 * for the host, how many hands are up. A host whose room is live but who is
 * not connected in this tab (a reload, another device) gets the bar too,
 * from the listing's `isHost`, because a room dying without its host is the
 * one thing worth putting at the top of the page.
 */
export function YourRoomBar({
  row,
  connected,
  onOpen,
}: {
  row: SpaceRow;
  /** True when this tab holds the room (docked or open). */
  connected: boolean;
  onOpen: () => void;
}) {
  const t = useT();
  const manages = row.isHost || Boolean(row.isCohost);
  const hands = row.isHost ? (row.speakRequestCount ?? 0) : 0;
  const primary = connected ? "Open" : t("voice.rejoin");

  return (
    <section
      aria-label={manages ? t("voice.host") : "The room you're in"}
      className="@container rounded-xl bg-surface p-3"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-[240px] items-center gap-3">
          <SpaceThumb
            row={row}
            glyph={spaceArt(row) !== "photo"}
            glyphSize={18}
            className="h-12 w-12 rounded-[10px]"
          />
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 font-sans text-[calc(12px*var(--ws-fs))] text-muted">
              <span className="font-semibold text-gold">
                {manages ? t("voice.host") : "Listening in"}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-pill bg-danger" />
                <span>{t("voice.onAir")}</span>
                <ElapsedTimer
                  since={row.startedAt}
                  className="font-semibold text-primary"
                />
              </span>
              <span aria-hidden className="text-subtle">
                ·
              </span>
              <span className="tabular-nums">
                {formatCompact(spaceListenerCount(row))} {t("voice.listeners")}
              </span>
              {hands > 0 && (
                <>
                  <span aria-hidden className="text-subtle">
                    ·
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-warning tabular-nums">
                    <Hand size={12} weight="fill" />
                    {formatCompact(hands)} {hands === 1 ? "hand" : "hands"} up
                  </span>
                </>
              )}
            </p>
            <h3 className="mt-0.5 line-clamp-2 font-sans text-[calc(14.5px*var(--ws-fs))] font-semibold leading-snug text-primary">
              {row.title}
            </h3>
          </div>
        </div>

        {/* On a narrow column the two buttons take their own line, split
            evenly, rather than crushing the title. */}
        <div className="flex w-full items-center gap-2 @md:w-auto">
          {row.isHost && (
            <motion.button
              {...press}
              type="button"
              onClick={onOpen}
              className="flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-pill bg-primary/10 px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary transition-colors hover:bg-primary/15 @md:flex-none"
            >
              <SlidersHorizontal size={15} />
              {t("voice.manage")}
            </motion.button>
          )}
          <motion.button
            {...press}
            type="button"
            onClick={onOpen}
            className={clsx(
              "flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-pill bg-brand px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-brand-on transition-colors hover:bg-brand-active @md:flex-none",
            )}
          >
            <Microphone size={15} weight="fill" />
            {primary}
          </motion.button>
        </div>
      </div>
    </section>
  );
}
