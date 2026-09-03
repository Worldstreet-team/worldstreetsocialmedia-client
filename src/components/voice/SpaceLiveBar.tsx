"use client";

import { Waveform } from "@phosphor-icons/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useT } from "@/i18n/client";
import { formatCompact } from "@/lib/utils";
import {
  EqBars,
  hostName,
  spaceBackground,
  spaceListenerCount,
} from "@/components/voice/SpaceCard";
import { spacesLiveAtom } from "@/store/spaces.atom";
import { voiceSessionAtom } from "@/store/voice.atom";

/**
 * Live rooms at the top of the timeline — the Spacebar, in house colours.
 *
 * The feed is where everyone actually is; a live room that only advertises
 * itself on /voice and the desktop rail is talking to an empty hallway.
 * One quiet row, the biggest room leading (the directory sorts by heads),
 * and the whole row drops you straight into the stage. Absent entirely
 * when nothing is live: an empty section is worse than no section.
 */
export function SpaceLiveBar() {
  const t = useT();
  const live = useAtomValue(spacesLiveAtom);
  const setSession = useSetAtom(voiceSessionAtom);

  const tf = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  if (live.length === 0) return null;
  const row = live[0];
  const others = live.length - 1;

  return (
    <button
      type="button"
      onClick={() => setSession({ row, minimized: false })}
      className="flex w-full items-center gap-3 border-b border-hairline px-4 py-2.5 text-left transition-colors hover:bg-raised cursor-pointer"
    >
      <span
        className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg"
        style={{ background: spaceBackground(row) }}
      >
        <span className="absolute inset-0 bg-[#0c0a09]/35" />
        <Waveform size={14} weight="fill" className="relative text-[#fafaf9]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          <EqBars className="h-3 shrink-0 text-danger" />
          <span className="min-w-0 truncate font-sans text-[13.5px] font-semibold text-primary">
            {row.title}
          </span>
        </span>
        <span className="truncate font-sans text-[11.5px] text-muted tabular-nums">
          {hostName(row.host)} · {formatCompact(spaceListenerCount(row))}{" "}
          {t("voice.listeners")}
          {others > 0 &&
            ` · +${others} ${tf("voice.moreRooms", "more live")}`}
        </span>
      </span>
      <span className="shrink-0 rounded-pill bg-primary px-3.5 py-1.5 font-sans text-[12px] font-semibold text-page">
        {t("voice.join")}
      </span>
    </button>
  );
}
