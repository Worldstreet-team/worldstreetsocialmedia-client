"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import { type StoryRailEntry, viewStoryAction } from "@/lib/story.actions";
import { formatTimeAgo } from "@/lib/utils";

const IMAGE_DURATION_MS = 5000;
/** Press shorter than this is a tap (navigate); longer is a hold (pause). */
const TAP_MS = 200;

interface StoryViewerProps {
  entries: StoryRailEntry[];
  /** Author (rail entry) to open on. */
  initialIndex: number;
  onClose: () => void;
  /** Lets the rail mark a story seen without refetching. */
  onStoryViewed: (storyId: string) => void;
}

/**
 * Full-screen story playback: per-author progress hairlines, 5s image
 * auto-advance (videos advance on end), tap right/left to move, hold to
 * pause — the Instagram model, on tokens. Fires the gateway's idempotent
 * view endpoint per story shown.
 */
export default function StoryViewer({
  entries,
  initialIndex,
  onClose,
  onStoryViewed,
}: StoryViewerProps) {
  const [authorIdx, setAuthorIdx] = useState(() =>
    Math.min(initialIndex, entries.length - 1),
  );
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  // The 5s countdown must not run against a blank frame — it starts only
  // once the media has actually loaded.
  const [mediaReady, setMediaReady] = useState(false);

  const progressRef = useRef(0);
  const pressStartRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const entry = entries[authorIdx];
  const story = entry?.stories[storyIdx];

  const goNext = useCallback(() => {
    setProgress(0);
    progressRef.current = 0;
    if (!entry) return;
    if (storyIdx < entry.stories.length - 1) {
      setStoryIdx((i) => i + 1);
    } else if (authorIdx < entries.length - 1) {
      setAuthorIdx((i) => i + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  }, [authorIdx, storyIdx, entry, entries.length, onClose]);

  const goPrev = useCallback(() => {
    setProgress(0);
    progressRef.current = 0;
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
    } else if (authorIdx > 0) {
      const prevEntry = entries[authorIdx - 1];
      setAuthorIdx((i) => i - 1);
      setStoryIdx(Math.max(0, prevEntry.stories.length - 1));
    }
    // At the very first story a prev-tap just restarts it.
  }, [authorIdx, storyIdx, entries]);

  // Reset progress whenever the active story changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the indexes aren't read in the body — they ARE the trigger.
  useEffect(() => {
    setProgress(0);
    progressRef.current = 0;
    setMediaReady(false);
  }, [authorIdx, storyIdx]);

  // Record the view — idempotent server-side; the rail updates its rings.
  // biome-ignore lint/correctness/useExhaustiveDependencies: fire once per story shown; entries/callback identity churn must not re-fire it.
  useEffect(() => {
    const current = entries[authorIdx]?.stories[storyIdx];
    if (!current) return;
    onStoryViewed(current.id);
    viewStoryAction(current.id).catch(() => {});
  }, [authorIdx, storyIdx]);

  // Image auto-advance timer (videos drive progress via timeupdate/ended).
  useEffect(() => {
    if (!story || story.media.type !== "image" || paused || !mediaReady) return;
    let raf = 0;
    const started = performance.now() - progressRef.current * IMAGE_DURATION_MS;
    const tick = (now: number) => {
      const p = (now - started) / IMAGE_DURATION_MS;
      if (p >= 1) {
        goNext();
        return;
      }
      progressRef.current = p;
      setProgress(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [story, paused, mediaReady, goNext]);

  // Hold-to-pause also pauses video playback.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) video.pause();
    else video.play().catch(() => {});
  }, [paused]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!entry || !story) return null;

  const authorName = entry.author.username
    ? `@${entry.author.username}`
    : [entry.author.firstName, entry.author.lastName].filter(Boolean).join(" ");

  const handlePointerDown = () => {
    pressStartRef.current = performance.now();
    setPaused(true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setPaused(false);
    const held = performance.now() - pressStartRef.current;
    if (held >= TAP_MS) return; // it was a hold, not a tap
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) goPrev();
    else goNext();
  };

  return (
    <ConfirmModalPortal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed inset-0 z-modal bg-page text-primary flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-label={`Story by ${authorName}`}
      >
        {/* Desktop prev/next, outside the frame */}
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous story"
          className="hidden sm:flex absolute left-4 h-11 w-11 items-center justify-center rounded-pill bg-raised hover:bg-track text-muted hover:text-primary transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label="Next story"
          className="hidden sm:flex absolute right-4 h-11 w-11 items-center justify-center rounded-pill bg-raised hover:bg-track text-muted hover:text-primary transition-colors cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* The 9:16 frame */}
        <div className="relative h-full sm:h-[min(92dvh,860px)] w-full sm:w-auto sm:aspect-[9/16] sm:rounded-xl overflow-hidden bg-sunken select-none">
          {story.media.type === "video" ? (
            <video
              ref={videoRef}
              key={story.id}
              src={story.media.url}
              autoPlay
              playsInline
              muted={muted}
              className="absolute inset-0 h-full w-full object-cover"
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration > 0) {
                  progressRef.current = v.currentTime / v.duration;
                  setProgress(progressRef.current);
                }
              }}
              onEnded={goNext}
              // A 404/undecodable video fires neither timeupdate nor ended —
              // without this the viewer freezes at 0% forever.
              onError={goNext}
            />
          ) : (
            // biome-ignore lint/performance/noImgElement: R2 story media renders full-bleed; next/image adds nothing here.
            <img
              key={story.id}
              src={story.media.url}
              alt={story.caption || `Story by ${authorName}`}
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
              onLoad={() => setMediaReady(true)}
              onError={goNext}
            />
          )}

          {/* Tap/hold layer — under the chrome, over the media. */}
          <div
            className="absolute inset-0"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => setPaused(false)}
          />

          {/* Progress hairlines */}
          <div className="absolute top-0 inset-x-0 flex gap-1 p-2 pt-safe">
            {entry.stories.map((s, i) => (
              <div
                key={s.id}
                className="h-0.5 flex-1 rounded-pill bg-primary/25 overflow-hidden"
              >
                <div
                  className="h-full rounded-pill bg-primary"
                  style={{
                    width:
                      i < storyIdx
                        ? "100%"
                        : i === storyIdx
                          ? `${progress * 100}%`
                          : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-4 inset-x-0 flex items-center justify-between gap-2 px-3">
            <div className="flex items-center gap-2 min-w-0 bg-scrim rounded-pill py-1 pl-1 pr-3">
              <div
                className="h-8 w-8 shrink-0 rounded-pill bg-raised bg-cover bg-center border border-hairline"
                style={
                  entry.author.avatar
                    ? { backgroundImage: `url('${entry.author.avatar}')` }
                    : undefined
                }
              />
              <span className="flex items-center gap-1 min-w-0 font-sans text-[13px] font-semibold text-primary">
                <span className="truncate">{authorName}</span>
                {entry.author.isVerified && (
                  <VerifiedIcon size={{ width: "14", height: "14" }} />
                )}
              </span>
              <span className="shrink-0 font-sans text-xs text-muted tabular-nums">
                {formatTimeAgo(story.createdAt)}
              </span>
              {story.origin === "live" && (
                <span className="shrink-0 font-sans text-[10px] font-bold uppercase tracking-[1px] text-danger">
                  Live
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {story.media.type === "video" && (
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  aria-label={muted ? "Unmute" : "Mute"}
                  className="flex h-10 w-10 items-center justify-center rounded-pill bg-scrim text-primary hover:bg-raised transition-colors cursor-pointer"
                >
                  {muted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close stories"
                className="flex h-10 w-10 items-center justify-center rounded-pill bg-scrim text-primary hover:bg-raised transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Caption */}
          {story.caption && (
            <div className="absolute bottom-4 inset-x-3 flex justify-center pb-safe pointer-events-none">
              <span
                className={clsx(
                  "max-w-full bg-scrim rounded-lg px-3 py-1.5",
                  "font-sans text-sm text-primary text-center",
                )}
              >
                {story.caption}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    </ConfirmModalPortal>
  );
}
