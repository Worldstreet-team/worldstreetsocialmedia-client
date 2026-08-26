"use client";

import {
  ArrowCounterClockwise,
  Microphone,
  Pause,
  Play,
  Stop,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadBackdropImage,
  type StoryCanvas,
} from "@/lib/editor/storyBackgrounds";
import {
  analyseTake,
  drawVoiceFrame,
  formatClock,
  pickAudioMime,
  VOICE_BARS,
  VOICE_H,
  VOICE_MAX_SECONDS,
  VOICE_W,
  type VoiceTake,
} from "@/lib/editor/voiceRender";

interface VoiceRecorderProps {
  background: StoryCanvas;
  /** The reviewed take, or null while there isn't one. */
  take: VoiceTake | null;
  onTake: (take: VoiceTake | null) => void;
}

/**
 * Record, then actually listen back before you post.
 *
 * Only audio is captured, so the canvas behind the waveform stays live — you
 * can swap backdrops after recording and the preview follows. The picture is
 * composed at share time by `renderVoiceVideo`, which reuses this component's
 * painter so what you hear and see here is what posts.
 */
export default function VoiceRecorder({
  background,
  take,
  onTake,
}: VoiceRecorderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const liveRef = useRef<number[]>(new Array(VOICE_BARS).fill(0));
  const photoRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);
  const backgroundRef = useRef(background);
  backgroundRef.current = background;
  const takeRef = useRef(take);
  takeRef.current = take;

  const [micState, setMicState] = useState<"asking" | "ready" | "denied">(
    "asking",
  );
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);
  const [seconds, setSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const [position, setPosition] = useState(0);
  const positionRef = useRef(0);
  const [analysing, setAnalysing] = useState(false);

  /* ── Painting ─────────────────────────────────────────────────────────── */

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const design = backgroundRef.current;
    const photo =
      design.kind === "photo" && photoRef.current?.url === design.url
        ? photoRef.current.img
        : null;
    const current = takeRef.current;

    if (current) {
      const fraction =
        current.duration > 0 ? positionRef.current / current.duration : 0;
      drawVoiceFrame(
        ctx,
        VOICE_W,
        VOICE_H,
        design,
        photo,
        current.envelope,
        fraction,
        `${formatClock(positionRef.current)} / ${formatClock(current.duration)}`,
      );
      return;
    }

    const analyser = analyserRef.current;
    const heights = liveRef.current;
    if (analyser) {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const usable = Math.floor(data.length * 0.66);
      for (let i = 0; i < VOICE_BARS; i++) {
        const v = data[Math.floor((i / VOICE_BARS) * usable)] / 255;
        heights[i] = heights[i] * 0.72 + v * 0.28;
      }
    }
    drawVoiceFrame(
      ctx,
      VOICE_W,
      VOICE_H,
      design,
      photo,
      heights,
      // While recording the whole bar row is "live", so nothing greys out.
      1,
      recordingRef.current
        ? `${formatClock(seconds)} / ${formatClock(VOICE_MAX_SECONDS)}`
        : "READY",
    );
  }, [seconds]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      paint();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // rAF halts in hidden tabs, which would starve a capture of frames.
    const ticker = setInterval(() => {
      if (document.hidden) paint();
    }, 400);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(ticker);
    };
  }, [paint]);

  /* ── Mic ──────────────────────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        micStreamRef.current = stream;
        const AudioCtor: typeof AudioContext =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new AudioCtor();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        ctx.createMediaStreamSource(stream).connect(analyser);
        analyserRef.current = analyser;
        setMicState("ready");
      })
      .catch(() => {
        if (!cancelled) setMicState("denied");
      });
    return () => {
      cancelled = true;
      for (const track of micStreamRef.current?.getTracks() ?? []) track.stop();
      void audioCtxRef.current?.close().catch(() => {});
      audioRef.current?.pause();
    };
  }, []);

  // Photographic canvases preload so the frame loop never waits on the network.
  useEffect(() => {
    if (background.kind !== "photo") return;
    let cancelled = false;
    loadBackdropImage(background.url)
      .then((img) => {
        if (!cancelled) photoRef.current = { url: background.url, img };
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [background]);

  /* ── Recording ────────────────────────────────────────────────────────── */

  const stopRecording = useCallback(() => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    recorderRef.current?.stop();
    setRecording(false);
  }, []);

  useEffect(() => {
    if (!recording) return;
    const started = performance.now();
    const tick = setInterval(() => {
      const elapsed = Math.floor((performance.now() - started) / 1000);
      setSeconds(elapsed);
      if (elapsed >= VOICE_MAX_SECONDS) stopRecording();
    }, 200);
    return () => clearInterval(tick);
  }, [recording, stopRecording]);

  const startRecording = () => {
    const mic = micStreamRef.current;
    if (!mic || recordingRef.current) return;
    void audioCtxRef.current?.resume().catch(() => {});
    const mime = pickAudioMime();
    const recorder = new MediaRecorder(mic, {
      mimeType: mime || undefined,
    });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      const type = mime || "audio/webm";
      const blob = new Blob(chunks, { type });
      if (blob.size === 0) return;
      setAnalysing(true);
      try {
        const { duration, envelope } = await analyseTake(blob);
        const url = URL.createObjectURL(blob);
        positionRef.current = 0;
        setPosition(0);
        onTake({ blob, url, duration, envelope });
      } catch {
        // Undecodable take — drop it rather than post something unplayable.
        onTake(null);
      } finally {
        setAnalysing(false);
      }
    };
    recorderRef.current = recorder;
    recorder.start();
    recordingRef.current = true;
    setSeconds(0);
    setRecording(true);
  };

  /* ── Playback ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!take) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlaying(false);
      playingRef.current = false;
      return;
    }
    const audio = new Audio(take.url);
    audioRef.current = audio;
    const onTime = () => {
      positionRef.current = audio.currentTime;
      setPosition(audio.currentTime);
    };
    const onEnd = () => {
      playingRef.current = false;
      setPlaying(false);
      positionRef.current = 0;
      setPosition(0);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audio.pause();
    };
  }, [take]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingRef.current) {
      audio.pause();
      playingRef.current = false;
      setPlaying(false);
    } else {
      void audio.play().catch(() => {});
      playingRef.current = true;
      setPlaying(true);
    }
  };

  const scrub = (fraction: number) => {
    const audio = audioRef.current;
    if (!audio || !take) return;
    const next = Math.max(0, Math.min(take.duration, fraction * take.duration));
    audio.currentTime = next;
    positionRef.current = next;
    setPosition(next);
  };

  const discard = () => {
    audioRef.current?.pause();
    if (take) URL.revokeObjectURL(take.url);
    positionRef.current = 0;
    setPosition(0);
    onTake(null);
  };

  return (
    <div className="absolute inset-0">
      <canvas
        ref={canvasRef}
        width={VOICE_W}
        height={VOICE_H}
        className="absolute inset-0 h-full w-full"
      />

      {micState === "ready" && !take && (
        <div className="absolute top-4 inset-x-0 flex justify-center">
          <span className="rounded-pill glass-chip-canvas backdrop-blur-md px-3 py-1 font-sans text-xs font-semibold tabular-nums">
            {recording && (
              <span className="mr-2 inline-block h-2 w-2 rounded-pill bg-danger align-middle animate-pulse" />
            )}
            {formatClock(seconds)} / {formatClock(VOICE_MAX_SECONDS)}
          </span>
        </div>
      )}

      {/* Record control */}
      {micState === "ready" && !take && !analysing && (
        <div className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-2.5">
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            aria-label={recording ? "Stop recording" : "Start recording"}
            className="flex h-16 w-16 items-center justify-center rounded-pill glass-cta transition-colors cursor-pointer active:brightness-95"
          >
            {recording ? (
              <Stop size={24} weight="fill" className="text-danger" />
            ) : (
              <Microphone size={26} weight="bold" />
            )}
          </button>
          <span className="font-sans text-xs glass-ink-dim">
            {recording ? "Tap to finish" : "Tap to record"}
          </span>
        </div>
      )}

      {analysing && (
        <div className="absolute bottom-6 inset-x-0 flex justify-center">
          <span className="font-sans text-xs glass-ink-dim">
            Preparing your take…
          </span>
        </div>
      )}

      {/* Review: play it back, scrub it, or start over. */}
      {take && (
        <div className="absolute bottom-5 inset-x-0 px-5 space-y-3">
          <button
            type="button"
            aria-label="Scrub"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              scrub((e.clientX - rect.left) / rect.width);
            }}
            className="block h-6 w-full cursor-pointer"
          >
            <span className="relative block h-1 w-full rounded-pill bg-[#fafaf9]/25 top-2.5">
              <span
                className="absolute inset-y-0 left-0 rounded-pill bg-[#fafaf9]"
                style={{
                  width: `${take.duration > 0 ? Math.min(100, (position / take.duration) * 100) : 0}%`,
                }}
              />
            </span>
          </button>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={discard}
              aria-label="Record again"
              className="flex h-10 w-10 items-center justify-center rounded-pill glass-chip-canvas backdrop-blur-md transition-colors cursor-pointer"
            >
              <ArrowCounterClockwise size={16} weight="bold" />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className="flex h-14 w-14 items-center justify-center rounded-pill glass-cta transition-colors cursor-pointer active:brightness-95"
            >
              {playing ? (
                <Pause size={20} weight="fill" />
              ) : (
                <Play size={20} weight="fill" />
              )}
            </button>
            <span className="flex h-10 min-w-10 items-center justify-center rounded-pill glass-chip-canvas backdrop-blur-md px-3 font-sans text-[11px] font-semibold tabular-nums">
              {formatClock(take.duration)}
            </span>
          </div>
        </div>
      )}

      {micState === "denied" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-pill glass-chip backdrop-blur-md backdrop-saturate-150">
            <Microphone size={24} />
          </span>
          <p className="font-sans text-sm font-medium glass-ink">
            Microphone access is blocked
          </p>
          <p className="font-sans text-xs glass-ink-dim">
            Allow the mic in your browser&apos;s site settings, then try again.
          </p>
        </div>
      )}
    </div>
  );
}
