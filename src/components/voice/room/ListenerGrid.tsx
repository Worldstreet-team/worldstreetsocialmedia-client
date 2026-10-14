"use client";

import { HandPalm } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { type RefObject, useEffect, useRef, useState } from "react";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import type { RoomMember } from "@/hooks/useSpaceRoom";
import { pop } from "@/lib/motion-presets";
import { formatCompact } from "@/lib/utils";
import { firstName } from "./roster";

/** Faces per page. Ten across on a wide screen, so a page is four rows. */
const PAGE = 40;

/**
 * Everyone in the audience as a face and a first name, a page at a time.
 *
 * A big room can hold thousands, and a thousand avatars at once is a
 * thousand image requests and a long layout. The grid draws a page, and a
 * sentinel at its foot ("+N more, scroll to see everyone") loads the next
 * page as it scrolls into view. The sentinel is observed against the
 * room's own scroller, which is passed in, not the window.
 *
 * Seats do not animate in or out: in a busy room people come and go all
 * the time, and a grid that pops on every arrival never sits still. Only
 * a hand going up lands, because that one is asking for attention.
 */
export function ListenerGrid({
  members,
  myId,
  scrollRoot,
  onPick,
  labels,
}: {
  /** Already ordered: hands first, then arrival order. */
  members: RoomMember[];
  myId: string;
  scrollRoot: RefObject<HTMLElement | null>;
  onPick: (m: RoomMember) => void;
  labels: {
    you: string;
    handUp: string;
    listener: string;
    more: (n: string) => string;
  };
}) {
  const [shown, setShown] = useState(PAGE);
  const sentinelRef = useRef<HTMLParagraphElement>(null);
  const remaining = Math.max(0, members.length - shown);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || remaining === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown((n) => n + PAGE);
      },
      { root: scrollRoot.current, rootMargin: "0px 0px 320px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [remaining, scrollRoot]);

  const page = members.slice(0, shown);
  const cell =
    "flex w-full min-w-0 flex-col items-center gap-2 rounded-lg py-1";
  const face = (m: RoomMember, name: string) => (
    <>
      <span className="relative block size-12 sm:size-14 lg:size-[68px]">
        <span
          className={clsx(
            "absolute inset-0 overflow-hidden rounded-pill bg-[#1c2533]",
            m.hand && "ring-2 ring-[#eef2f6]/70",
          )}
        >
          <SafeAvatar src={m.avatar} eager sizes="68px" />
        </span>
        <AnimatePresence initial={false}>
          {m.hand && (
            <motion.span
              key="hand"
              {...pop}
              className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-pill bg-[#eef2f6] text-[#05070a] ring-2 ring-[#05070a]"
            >
              <HandPalm size={13} weight="fill" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span
        className={clsx(
          "max-w-full truncate px-0.5 font-sans text-[calc(12px*var(--ws-fs))] lg:text-[calc(13.5px*var(--ws-fs))]",
          m.id === myId ? "font-semibold text-primary" : "text-muted",
        )}
      >
        {name}
      </span>
    </>
  );

  return (
    <>
      <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-x-1 gap-y-4 sm:grid-cols-[repeat(auto-fill,minmax(80px,1fr))] lg:mt-6 lg:gap-y-6">
        {page.map((m) => {
          const me = m.id === myId;
          const name = me ? labels.you : firstName(m);
          return (
            <li key={m.id} className="flex min-w-0 justify-center">
              {/* Your own seat is not a control: there is nothing to do
                  to yourself from here. */}
              {me ? (
                <div className={cell}>{face(m, name)}</div>
              ) : (
                <button
                  type="button"
                  onClick={() => onPick(m)}
                  aria-label={`${m.name || m.username}: ${
                    m.hand ? labels.handUp : labels.listener
                  }`}
                  className={clsx(cell, "cursor-pointer")}
                >
                  {face(m, name)}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {remaining > 0 && (
        <p
          ref={sentinelRef}
          className="mt-5 font-sans text-[calc(13px*var(--ws-fs))] text-subtle tabular-nums"
        >
          {labels.more(formatCompact(remaining))}
        </p>
      )}
    </>
  );
}
