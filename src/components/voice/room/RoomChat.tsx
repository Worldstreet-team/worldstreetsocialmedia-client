"use client";

import { PaperPlaneRight } from "@phosphor-icons/react";
import clsx from "clsx";
import { type RefObject, useEffect, useRef, useState } from "react";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import type { RoomChatMessage } from "@/hooks/useSpaceRoom";

/**
 * The room's text lane, for everyone who would rather type than talk.
 *
 * One pane, two mounts: the Chat tab of the side panel on a wide screen,
 * and the bottom sheet on a phone. Messages are ephemeral: they ride the
 * room's Ably channel and live exactly as long as your stay, and every
 * name and face comes from the server-resolved roster, never from the
 * payload.
 */
export function RoomChat({
  messages,
  meId,
  nameOf,
  avatarOf,
  onSend,
  inputRef,
  labels,
}: {
  messages: RoomChatMessage[];
  meId: string;
  nameOf: (id: string) => string;
  avatarOf: (id: string) => string | undefined;
  onSend: (text: string) => boolean;
  /** So the bottom bar's Chat button can put the cursor here. */
  inputRef?: RefObject<HTMLInputElement | null>;
  labels: { placeholder: string; empty: string; send: string };
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  // Follow the stream only while the reader is at the bottom; never yank
  // someone away from a message they scrolled back to.
  const stickRef = useRef(true);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new message is the trigger; the effect reads the DOM, not the list
  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={listRef}
        role="log"
        aria-label={labels.placeholder}
        onScroll={() => {
          const el = listRef.current;
          if (!el) return;
          stickRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-4 py-3"
      >
        {messages.length === 0 ? (
          <p className="pt-8 text-center font-sans text-[calc(13px*var(--ws-fs))] text-muted">
            {labels.empty}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <div key={m.id} className="flex items-start gap-2.5">
                <span className="relative mt-0.5 size-6 shrink-0 overflow-hidden rounded-pill bg-[#1c2533]">
                  <SafeAvatar src={avatarOf(m.from)} eager sizes="24px" />
                </span>
                <p className="min-w-0 font-sans text-[calc(13.5px*var(--ws-fs))] leading-snug text-primary [overflow-wrap:anywhere]">
                  <span
                    className={clsx(
                      "mr-1.5 font-semibold",
                      m.from === meId ? "text-primary" : "text-muted",
                    )}
                  >
                    {nameOf(m.from)}
                  </span>
                  {m.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      <form
        className="flex shrink-0 items-center gap-2 px-3 pb-3 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (onSend(text)) setText("");
        }}
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder={labels.placeholder}
          aria-label={labels.placeholder}
          className="h-10 w-full min-w-0 flex-1 rounded-pill bg-primary/[0.07] px-4 font-sans text-[calc(13.5px*var(--ws-fs))] text-primary outline-none transition-colors placeholder:text-subtle focus:bg-primary/[0.1]"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label={labels.send}
          className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-[#eef2f6] text-[#05070a] transition-opacity disabled:cursor-default disabled:opacity-30"
        >
          <PaperPlaneRight size={15} weight="fill" />
        </button>
      </form>
    </div>
  );
}
