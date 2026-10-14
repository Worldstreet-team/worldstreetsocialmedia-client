"use client";

import type { Room } from "livekit-client";
import { useEffect, useRef } from "react";

const BARS = 13;
/** How often a new reading enters the trace, in ms: fast enough to follow
 *  syllables, slow enough that the trace reads as a line, not a flicker. */
const STEP_MS = 70;
/** A bar at rest, as a share of full height, so a silent mic still draws. */
const REST = 0.16;

/**
 * Your own mic, as a short scrolling trace beside "You're on air".
 *
 * It listens to the published microphone track itself through a Web Audio
 * analyser (LiveKit's `createAudioAnalyser`), not to LiveKit's speaker
 * levels: those come back from the server a few times a second, which is
 * fine for a ring and too coarse to show a voice. Readings are written
 * straight onto the bars, so React never renders per frame, and the whole
 * thing is torn down the moment the mic goes quiet or the room closes.
 *
 * A level meter is information, like a spinner, so it keeps moving under
 * reduced motion; there is no easing on it to remove.
 */
export function MicLevel({
  room,
  live,
  className,
}: {
  room: Room | null;
  /** Mic open and connected. Off draws a flat trace. */
  live: boolean;
  className?: string;
}) {
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const paint = (levels: number[]) => {
      levels.forEach((v, i) => {
        const el = barsRef.current[i];
        if (el) el.style.transform = `scaleY(${v.toFixed(3)})`;
      });
    };
    const rest = () => paint(new Array(BARS).fill(REST));
    rest();
    if (!room || !live) return;

    let cancelled = false;
    let raf = 0;
    let stop: (() => Promise<void>) | null = null;
    const trace: number[] = new Array(BARS).fill(REST);

    void (async () => {
      const lk = await import("livekit-client");
      if (cancelled) return;
      const track = room.localParticipant.getTrackPublication(
        lk.Track.Source.Microphone,
      )?.audioTrack;
      if (!track) return;
      let analyser: AnalyserNode;
      try {
        const made = lk.createAudioAnalyser(track, {
          // A wide window, so quiet speech moves the bars and a shout
          // still has headroom.
          minDecibels: -90,
          maxDecibels: -25,
          smoothingTimeConstant: 0.5,
          fftSize: 512,
        });
        analyser = made.analyser;
        stop = made.cleanup;
        // Safari can create the context suspended when no gesture is on
        // the stack; the mic toggle was one, but it has passed by now.
        void (analyser.context as AudioContext).resume?.();
      } catch {
        return;
      }
      if (cancelled) {
        void stop?.();
        return;
      }
      const bins = new Uint8Array(analyser.frequencyBinCount);
      // The voice band only (about 90 Hz to 3.5 kHz at 48 kHz): the bins
      // above it are near silent for speech and would drag the mean down.
      const lo = 1;
      const hi = Math.min(bins.length, 38);
      let last = 0;
      const tick = (t: number) => {
        if (t - last >= STEP_MS) {
          last = t;
          analyser.getByteFrequencyData(bins);
          let sum = 0;
          for (let i = lo; i < hi; i++) sum += bins[i];
          const level = sum / ((hi - lo) * 255);
          trace.shift();
          trace.push(REST + Math.min(1, level * 1.6) * (1 - REST));
          paint(trace);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      void stop?.();
      rest();
    };
  }, [room, live]);

  return (
    <span
      aria-hidden
      className={`flex h-7 items-center gap-[3px] ${className ?? ""}`}
    >
      {Array.from({ length: BARS }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed positional bars
          key={i}
          ref={(el) => {
            barsRef.current[i] = el;
          }}
          className={`block h-full w-[3px] rounded-pill ${live ? "bg-[#eef2f6]" : "bg-[#eef2f6]/35"}`}
          style={{ transform: `scaleY(${REST})` }}
        />
      ))}
    </span>
  );
}
