"use client";

import {
  Check,
  Pause,
  Play,
  SpeakerSimpleHigh,
  SpeakerSimpleSlash,
  X,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import { useToast } from "@/components/ui/Toast/ToastContext";

interface VideoEditorProps {
  file: File;
  title?: string;
  onClose: () => void;
  /** The trimmed/muted file — or the original untouched when no edits. */
  onSave: (file: File) => void;
}

/**
 * Video edit sheet (glass chrome, matching MediaEditor): preview player,
 * dual-handle trim bar, mute toggle.
 *
 * Export is a realtime client-side re-encode — the video plays its trimmed
 * range through captureStream() into MediaRecorder (audio track dropped when
 * muted), because the gateway does zero processing and stores whatever we
 * upload. A 20s clip therefore takes ~20s to export; progress is shown on
 * the Save button. When the browser can't do it (no captureStream /
 * MediaRecorder), trim and mute are disabled and Save passes the original
 * through.
 */
export default function VideoEditor({
  file,
  title = "Edit video",
  onClose,
  onSave,
}: VideoEditorProps) {
  const { toast } = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportPct, setExportPct] = useState(0);
  const [supported, setSupported] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<null | "start" | "end">(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    const probe = document.createElement("video");
    setSupported(
      typeof window.MediaRecorder !== "undefined" &&
        typeof (
          probe as HTMLVideoElement & { captureStream?: () => MediaStream }
        ).captureStream === "function",
    );
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !exporting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, exporting]);

  const clampToRange = useCallback(
    (video: HTMLVideoElement) => {
      // Preview loops inside the trimmed range.
      if (video.currentTime >= range[1] || video.currentTime < range[0] - 0.2) {
        video.currentTime = range[0];
      }
    },
    [range],
  );

  const handleLoaded = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const d = e.currentTarget.duration;
    if (Number.isFinite(d) && d > 0) {
      setDuration(d);
      setRange([0, d]);
    }
  };

  // Trim-bar dragging: pointer position → seconds, per captured handle.
  const posToTime = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || duration === 0) return 0;
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return frac * duration;
  };

  const handleTrackPointerMove = (e: React.PointerEvent) => {
    const handle = dragRef.current;
    if (!handle) return;
    const t = posToTime(e.clientX);
    setRange(([start, end]) =>
      handle === "start"
        ? [Math.min(t, end - 0.2), end]
        : [start, Math.max(t, start + 0.2)],
    );
  };

  const seekPreview = () => {
    const video = videoRef.current;
    if (video) video.currentTime = range[0];
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      clampToRange(video);
      void video.play();
    } else {
      video.pause();
    }
  };

  const isTrimmed =
    duration > 0 && (range[0] > 0.05 || range[1] < duration - 0.05);
  const needsReencode = (isTrimmed || muted) && supported;

  const handleSave = async () => {
    if (exporting) return;
    if (!needsReencode) {
      onSave(file);
      return;
    }
    const source = videoRef.current;
    if (!source) return;
    setExporting(true);
    try {
      const out = await reencode(source, range, muted, setExportPct, file.name);
      onSave(out);
    } catch {
      toast("Couldn't process the video — posting the original", {
        type: "error",
      });
      onSave(file);
    }
  };

  const fmt = (t: number) =>
    `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

  const startPct = duration > 0 ? (range[0] / duration) * 100 : 0;
  const endPct = duration > 0 ? (range[1] / duration) * 100 : 100;
  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <ConfirmModalPortal>
      <div className="fixed inset-0 z-modal flex items-start justify-center overflow-y-auto p-3 sm:p-4 pt-[max(3vh,0.75rem)]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={exporting ? undefined : onClose}
          className="absolute inset-0 glass-scrim"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          className="relative w-full max-w-xl glass-panel overflow-hidden flex flex-col max-h-[90dvh] glass-ink"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b glass-divider">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={onClose}
                disabled={exporting}
                aria-label="Discard edits"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill glass-chip transition-colors cursor-pointer disabled:opacity-40"
              >
                <X size={17} weight="bold" />
              </button>
              <h2 className="font-display text-lg font-semibold tracking-tight truncate">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={exporting || duration === 0}
              className="shrink-0 flex items-center gap-2 glass-cta px-5 sm:px-6 h-10 sm:h-9 rounded-pill font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-sans cursor-pointer tabular-nums"
            >
              {exporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#0c0a09]/25 border-t-[#0c0a09] rounded-full animate-spin" />
                  {exportPct}%
                </>
              ) : (
                <>
                  <Check size={16} weight="bold" />
                  Save
                </>
              )}
            </button>
          </div>

          {/* Player */}
          <div className="relative w-full h-[min(52dvh,420px)] bg-[#000000]">
            {url && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                ref={videoRef}
                src={url}
                playsInline
                muted={muted}
                className="absolute inset-0 h-full w-full object-contain"
                onLoadedMetadata={handleLoaded}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onTimeUpdate={(e) => {
                  setCurrentTime(e.currentTarget.currentTime);
                  // Never clamp while exporting — the recorder owns playback
                  // then, and looping back to range start would keep it from
                  // ever reaching its stop point.
                  if (!e.currentTarget.paused && !exporting)
                    clampToRange(e.currentTarget);
                }}
              />
            )}
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className="absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-pill glass-chip cursor-pointer"
            >
              {playing ? (
                <Pause size={18} weight="fill" />
              ) : (
                <Play size={18} weight="fill" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              disabled={!supported}
              aria-label={muted ? "Unmute" : "Mute"}
              aria-pressed={muted}
              className={clsx(
                "absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-pill cursor-pointer disabled:opacity-40",
                muted ? "glass-chip-active" : "glass-chip",
              )}
            >
              {muted ? (
                <SpeakerSimpleSlash size={18} weight="bold" />
              ) : (
                <SpeakerSimpleHigh size={18} weight="bold" />
              )}
            </button>
          </div>

          {/* Trim bar */}
          <div className="shrink-0 px-4 py-4 space-y-2 border-t glass-divider">
            <div
              ref={trackRef}
              className="relative h-10 rounded-lg bg-[#ffffff]/8 touch-none select-none"
              onPointerMove={handleTrackPointerMove}
              onPointerUp={() => {
                dragRef.current = null;
                seekPreview();
              }}
              onPointerCancel={() => {
                dragRef.current = null;
              }}
            >
              {/* selected range */}
              <div
                className="absolute inset-y-0 rounded-lg border-2 border-[#fafaf9] bg-[#ffffff]/10"
                style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
              />
              {/* playhead */}
              <div
                className="absolute inset-y-1 w-0.5 rounded-pill glass-fill opacity-80"
                style={{ left: `${playheadPct}%` }}
              />
              {/* handles */}
              <button
                type="button"
                aria-label="Trim start"
                disabled={!supported}
                onPointerDown={(e) => {
                  dragRef.current = "start";
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={handleTrackPointerMove}
                onPointerUp={() => {
                  dragRef.current = null;
                  seekPreview();
                }}
                className="absolute inset-y-0 w-5 -ml-2.5 cursor-ew-resize disabled:cursor-default touch-none"
                style={{ left: `${startPct}%` }}
              >
                <span className="absolute inset-y-1 left-1/2 -ml-0.5 w-1 rounded-pill glass-fill" />
              </button>
              <button
                type="button"
                aria-label="Trim end"
                disabled={!supported}
                onPointerDown={(e) => {
                  dragRef.current = "end";
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={handleTrackPointerMove}
                onPointerUp={() => {
                  dragRef.current = null;
                  seekPreview();
                }}
                className="absolute inset-y-0 w-5 -ml-2.5 cursor-ew-resize disabled:cursor-default touch-none"
                style={{ left: `${endPct}%` }}
              >
                <span className="absolute inset-y-1 left-1/2 -ml-0.5 w-1 rounded-pill glass-fill" />
              </button>
            </div>
            <div className="flex items-center justify-between font-sans text-xs glass-ink-dim tabular-nums">
              <span>{fmt(range[0])}</span>
              <span>
                {supported
                  ? `${fmt(Math.max(0, range[1] - range[0]))} selected`
                  : "Trimming isn't supported in this browser"}
              </span>
              <span>{fmt(range[1])}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </ConfirmModalPortal>
  );
}

/** Realtime re-encode of [start, end] via captureStream + MediaRecorder. */
function reencode(
  source: HTMLVideoElement,
  [start, end]: [number, number],
  muted: boolean,
  onProgress: (pct: number) => void,
  originalName: string,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const video = source;
    video.pause();
    const stream = (
      video as HTMLVideoElement & { captureStream: () => MediaStream }
    ).captureStream();
    const tracks = muted
      ? stream.getVideoTracks()
      : [...stream.getVideoTracks(), ...stream.getAudioTracks()];
    const recStream = new MediaStream(tracks);

    const mime =
      ["video/mp4", "video/webm;codecs=vp9", "video/webm"].find((m) =>
        MediaRecorder.isTypeSupported(m),
      ) ?? "";
    const recorder = new MediaRecorder(recStream, {
      mimeType: mime || undefined,
      videoBitsPerSecond: 5_000_000,
    });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = () => reject(new Error("recorder error"));
    recorder.onstop = () => {
      video.pause();
      video.onended = null;
      const type = mime.startsWith("video/mp4") ? "video/mp4" : "video/webm";
      const ext = type === "video/mp4" ? "mp4" : "webm";
      const base = originalName.replace(/\.[^.]+$/, "") || "video";
      const blob = new Blob(chunks, { type });
      if (blob.size === 0) {
        reject(new Error("empty recording"));
        return;
      }
      resolve(new File([blob], `${base}-trimmed.${ext}`, { type }));
    };

    const onTime = () => {
      onProgress(
        Math.min(
          99,
          Math.round(((video.currentTime - start) / (end - start)) * 100),
        ),
      );
      if (video.currentTime >= end) {
        video.removeEventListener("timeupdate", onTime);
        recorder.stop();
      }
    };

    video.currentTime = start;
    video.onseeked = () => {
      video.onseeked = null;
      video.addEventListener("timeupdate", onTime);
      // The recording is the playback — muted preview audio would also
      // silence the captured track, so let the element play audible-muted
      // only when the user chose mute.
      recorder.start(250);
      video.play().catch(() => {
        video.removeEventListener("timeupdate", onTime);
        reject(new Error("playback failed"));
      });
    };
  });
}
