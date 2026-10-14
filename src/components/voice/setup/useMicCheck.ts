"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MicState = "idle" | "asking" | "listening" | "heard" | "blocked";

/** Speech above this level counts toward "heard" (about -42 dBFS). */
const SPEAKING = 0.3;
/** This much speech, in total, and the check is passed. */
const HEARD_MS = 900;

/**
 * The mic check's real input level, for the Signal's voice scene.
 *
 * While `active`, asks for the microphone, then reads an analyser every
 * frame: RMS of the waveform, in dB, mapped so room noise sits near 0 and
 * ordinary speech near 0.7. A fast attack and a slower release keep the
 * line from flickering between syllables. `level()` returns the newest
 * value and is cheap to call every frame (the driver does).
 *
 * The stream closes the moment `active` goes false: leaving the step,
 * going live (the room opens its own connection, muted), or the sheet
 * closing. A refused or missing mic is `blocked`, which the step says
 * plainly while still letting the host go live.
 */
export function useMicCheck(active: boolean) {
  const [state, setState] = useState<MicState>("idle");
  const [device, setDevice] = useState("");
  const level = useRef(0);
  const spoken = useRef(0);
  const passed = useRef(false);

  useEffect(() => {
    if (!active) {
      setState("idle");
      level.current = 0;
      return;
    }
    let alive = true;
    let raf = 0;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    spoken.current = 0;
    passed.current = false;
    setState("asking");
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no mic");
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (!alive) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        setDevice(stream.getAudioTracks()[0]?.label ?? "");
        ctx = new AudioContext();
        void ctx.resume().catch(() => {});
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        setState("listening");
        let last = performance.now();
        const loop = (now: number) => {
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);
          const db = 20 * Math.log10(rms + 1e-8);
          const raw = Math.min(1, Math.max(0, (db + 54) / 40));
          const prev = level.current;
          level.current = prev + (raw - prev) * (raw > prev ? 0.55 : 0.1);
          const dt = Math.min(100, now - last);
          last = now;
          if (!passed.current && raw > SPEAKING) {
            spoken.current += dt;
            if (spoken.current >= HEARD_MS) {
              passed.current = true;
              setState("heard");
            }
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch {
        if (alive) setState("blocked");
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      for (const t of stream?.getTracks() ?? []) t.stop();
      void ctx?.close().catch(() => {});
      level.current = 0;
    };
  }, [active]);

  /** Back to listening on the open stream: no second permission prompt. */
  const again = useCallback(() => {
    spoken.current = 0;
    passed.current = false;
    setState((s) => (s === "heard" ? "listening" : s));
  }, []);

  const read = useCallback(() => level.current, []);

  return { state, device, level: read, again };
}
