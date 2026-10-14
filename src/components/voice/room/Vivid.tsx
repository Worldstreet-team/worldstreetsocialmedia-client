"use client";

import { CaretRight, FileText, Sparkle } from "@phosphor-icons/react";
import { formatElapsed, useNow } from "@/components/voice/useNow";
import { useT } from "@/i18n/client";

/*
 * Vivid: the room's notes, kept by AI while people talk.
 *
 * There is no notes backend yet. Which rooms get live notes is an open
 * owner decision, and transcription costs money per minute, so nothing
 * here may pretend: the panel's parts take their data as props and the
 * room renders `VividPanel` with `notes={null}`, which is one honest state.
 * The notes phase feeds the same components and the panel fills in.
 */

/** One key moment: when in the room it happened, who, and a line on it. */
export interface VividMoment {
  /** Stable id from the notes service, for the list key. */
  id?: string;
  /** Seconds since the room went live. */
  at: number;
  /** Display name of whoever said it. */
  speaker: string;
  line: string;
}

/** Everything the panel shows once notes exist for a room. */
export interface VividNotes {
  /** The running summary, a few short points, newest understanding. */
  summary: string[];
  /** When the summary was last rewritten: ISO string or epoch ms. */
  updatedAt: string | number;
  moments: VividMoment[];
}

function useTf() {
  const t = useT();
  // Newer copy than the dictionaries: t() echoes the key when missing.
  return (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };
}

/** "30s", "4m", "2h": how long ago, on the shared one-second clock. */
function agoLabel(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

/** A leaf, so the clock re-renders these characters and not the panel. */
function UpdatedAgo({ at }: { at: string | number }) {
  const tf = useTf();
  const now = useNow();
  const when = typeof at === "number" ? at : new Date(at).getTime();
  if (!now || !Number.isFinite(when)) return null;
  return (
    <span className="font-sans text-[calc(12px*var(--ws-fs))] text-subtle tabular-nums">
      {tf("voice.vividUpdated", "updated")} {agoLabel(now - when)}{" "}
      {tf("voice.vividAgo", "ago")}
    </span>
  );
}

/** The heading every part of the panel uses: words, not signage. */
function PartLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
      {children}
    </h3>
  );
}

/** The running summary, as short points. */
export function LiveSummary({
  points,
  updatedAt,
}: {
  points: string[];
  updatedAt: string | number;
}) {
  const tf = useTf();
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <PartLabel>{tf("voice.liveSummary", "Live summary")}</PartLabel>
        <UpdatedAgo at={updatedAt} />
      </div>
      <ul className="mt-3 flex flex-col gap-3">
        {points.map((p, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: the summary is rewritten whole; position is its identity
            key={i}
            className="flex gap-3 font-sans text-[calc(14px*var(--ws-fs))] leading-relaxed text-primary"
          >
            <span
              aria-hidden
              className="mt-[0.6em] size-1.5 shrink-0 rounded-pill bg-muted"
            />
            <span className="min-w-0">{p}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The moments worth going back to: time into the room, who, one line. */
export function KeyMoments({ items }: { items: VividMoment[] }) {
  const tf = useTf();
  return (
    <section>
      <PartLabel>{tf("voice.keyMoments", "Key moments")}</PartLabel>
      <ol className="mt-3 flex flex-col gap-2.5">
        {items.map((m) => (
          <li
            key={m.id ?? `${m.at}-${m.speaker}`}
            className="flex min-w-0 items-baseline gap-3 font-sans text-[calc(13.5px*var(--ws-fs))]"
          >
            <span className="shrink-0 font-mono text-[calc(12.5px*var(--ws-fs))] text-muted tabular-nums">
              {formatElapsed(m.at * 1000)}
            </span>
            <span className="shrink-0 font-semibold text-primary">
              {m.speaker}
            </span>
            <span className="min-w-0 truncate text-muted">{m.line}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The door to the full transcript. Only rendered with somewhere to go. */
export function TranscriptRow({ onOpen }: { onOpen: () => void }) {
  const tf = useTf();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-12 w-full cursor-pointer items-center gap-3 rounded-xl bg-primary/[0.05] px-4 text-left transition-colors hover:bg-primary/[0.09]"
    >
      <FileText size={18} className="shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary">
        {tf("voice.liveTranscript", "Live transcript")}
      </span>
      <span className="flex items-center gap-1 font-sans text-[calc(13px*var(--ws-fs))] text-muted">
        {tf("voice.open", "Open")}
        <CaretRight size={12} weight="bold" />
      </span>
    </button>
  );
}

/** Ask a question about what was said. Only rendered when asking works. */
export function AskVivid({
  cost,
  onAsk,
}: {
  /** Credits one question costs. */
  cost: number;
  onAsk: () => void;
}) {
  const tf = useTf();
  return (
    <button
      type="button"
      onClick={onAsk}
      className="flex h-12 w-full cursor-pointer items-center gap-3 rounded-xl bg-primary/[0.05] px-4 text-left transition-colors hover:bg-primary/[0.09]"
    >
      <Sparkle size={18} className="shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate font-sans text-[calc(14px*var(--ws-fs))] text-primary">
        {tf("voice.askVivid", "Ask Vivid about this room")}
      </span>
      <span className="shrink-0 font-sans text-[calc(12.5px*var(--ws-fs))] text-subtle tabular-nums">
        {cost}{" "}
        {cost === 1
          ? tf("voice.credit", "credit")
          : tf("voice.credits", "credits")}
      </span>
    </button>
  );
}

/** The one state the panel has today: no notes are being taken here. */
export function VividNotTaking() {
  const tf = useTf();
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-10 text-center">
      <Sparkle size={28} className="text-muted" />
      <p className="mt-4 max-w-[28ch] font-sans text-[calc(15px*var(--ws-fs))] font-semibold leading-snug text-primary">
        {tf("voice.vividOffTitle", "Vivid isn't taking notes in this room yet")}
      </p>
      <p className="mt-2 max-w-[34ch] font-sans text-[calc(13px*var(--ws-fs))] leading-relaxed text-muted">
        {tf(
          "voice.vividOffBody",
          "When it is, a live summary, the key moments and the transcript will build here as people talk, and you'll be able to ask it about the room.",
        )}
      </p>
    </div>
  );
}

/**
 * The Vivid tab. `notes` null means no notes are being taken in this room,
 * which today is every room. The transcript row and Ask only appear with a
 * handler, so neither is ever a button that does nothing.
 */
export function VividPanel({
  notes,
  onOpenTranscript,
  ask,
}: {
  notes: VividNotes | null;
  onOpenTranscript?: () => void;
  ask?: { cost: number; onAsk: () => void };
}) {
  if (!notes) return <VividNotTaking />;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-5 py-4">
        <div className="flex flex-col gap-7">
          {notes.summary.length > 0 && (
            <LiveSummary points={notes.summary} updatedAt={notes.updatedAt} />
          )}
          {notes.moments.length > 0 && <KeyMoments items={notes.moments} />}
        </div>
      </div>
      {(onOpenTranscript || ask) && (
        <div className="flex shrink-0 flex-col gap-2.5 px-4 pb-4 pt-2">
          {onOpenTranscript && <TranscriptRow onOpen={onOpenTranscript} />}
          {ask && <AskVivid cost={ask.cost} onAsk={ask.onAsk} />}
        </div>
      )}
    </div>
  );
}
