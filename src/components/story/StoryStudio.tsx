"use client";

import {
  Images,
  PaperPlaneTilt,
  Scissors,
  Scribble,
  Sticker,
  TextAa,
  X,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import GrainOverlay from "@/components/editor/GrainOverlay";
import PresetCarousel from "@/components/editor/PresetCarousel";
import VideoEditor from "@/components/editor/VideoEditor";
import DrawLayer from "@/components/story/overlays/DrawLayer";
import OverlayLayer from "@/components/story/overlays/OverlayLayer";
import StickerTray from "@/components/story/overlays/StickerTray";
import TextTool from "@/components/story/overlays/TextTool";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { POST_CHAR_BUDGET } from "@/const";
import type { PresetId } from "@/lib/editor/document";
import { createAdjustments } from "@/lib/editor/document";
import {
  exportCroppedFile,
  loadOrientedBitmap,
  makeSquareThumb,
  orientCanvas,
} from "@/lib/editor/export";
import {
  MONO_STACK,
  newOverlayId,
  type Overlay,
  type OverlayFonts,
  resolveOverlayFonts,
  type Stroke,
  type TextOverlay,
} from "@/lib/editor/overlays";
import { colorOpsFor, cssFilterFor, getPreset } from "@/lib/editor/presets";
import { createStoryAction } from "@/lib/stories.actions";

type ToolMode = "none" | "text" | "sticker" | "draw";

const STORY_W = 1080;
const STORY_H = 1920;
const CAPTION_MAX = POST_CHAR_BUDGET;

interface StoryStudioProps {
  onClose: () => void;
  /** Called after a successful post so the rail can refetch. */
  onPosted: () => void;
}

/**
 * The Story Studio — full-screen 9:16 story creator (Phase 3 of the Studio
 * blueprint). No crop chooser: the photo is pinch-positioned inside the
 * fixed story frame (react-easy-crop with a locked 9:16, auto-cover), with
 * the Phase 2 filter presets underneath. Exports exactly 1080×1920 and
 * posts to the gateway's already-live POST /api/stories.
 *
 * Portalled to <body> (template.tsx's transient transform traps fixed UI).
 *
 * Phase 4 layers the decoration tools on top: text (Display/Clean/Ticker
 * styles), cashtag + emoji stickers, and a draw layer — all stored in
 * normalized stage coordinates and composited into the export by
 * lib/editor/overlays.ts, so the posted file matches the preview.
 */
export default function StoryStudio({ onClose, onPosted }: StoryStudioProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  // Chained slides: extra picks wait here; each posts as its own story doc,
  // so the viewer plays the chain in sequence automatically.
  const [queue, setQueue] = useState<File[]>([]);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [preset, setPreset] = useState<PresetId | null>(null);
  const [croppedPx, setCroppedPx] = useState<Area | null>(null);
  const [caption, setCaption] = useState("");
  const [posting, setPosting] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [trimOpen, setTrimOpen] = useState(false);
  const isVideo = !!file && file.type.startsWith("video/");

  // Phase 4 decoration state.
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [mode, setMode] = useState<ToolMode>("none");
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [stageW, setStageW] = useState(0);
  const [fonts] = useState<OverlayFonts>(() =>
    typeof document === "undefined"
      ? {
          display: '"Poppins", system-ui, sans-serif',
          ui: '"Public Sans", system-ui, sans-serif',
          mono: MONO_STACK,
        }
      : resolveOverlayFonts(),
  );

  const orientedRef = useRef<HTMLCanvasElement | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<ToolMode>("none");
  modeRef.current = mode;

  // Live stage width — the DOM preview's scale reference for overlays.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `file` isn't read — it re-attaches the observer when the stage subtree mounts.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const sync = () => setStageW(el.getBoundingClientRect().width);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
    // Re-attach when the stage mounts (file: null → File swaps the subtree).
  }, [file]);

  const neutral = createAdjustments();
  const previewFilter = cssFilterFor(neutral, preset);
  const grainActive = !!getPreset(preset)?.grain;

  // Decode the picked file into an oriented working canvas (EXIF-corrected,
  // downscaled) and hand the cropper a blob URL of it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: decode once per file; toast/onClose identity changes must not re-decode.
  // Video stories: no canvas pipeline — just an object URL for the preview.
  useEffect(() => {
    if (!file || !file.type.startsWith("video/")) {
      setVideoUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setCroppedPx(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!file || file.type.startsWith("video/")) return;
    let cancelled = false;
    let bitmap: ImageBitmap | null = null;
    // The old photo's crop rect is meaningless for the new one — Share must
    // stay disabled until the cropper re-reports in the new pixel space.
    setCroppedPx(null);
    loadOrientedBitmap(file)
      .then(async (bmp) => {
        bitmap = bmp;
        if (cancelled) return;
        const canvas = orientCanvas(bmp, 0, false);
        orientedRef.current = canvas;
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (!blob || cancelled) return;
        if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
        const url = URL.createObjectURL(blob);
        sourceUrlRef.current = url;
        setSourceUrl(url);
        setThumbUrl(makeSquareThumb(canvas));
        setPosition({ x: 0, y: 0 });
        setZoom(1);
      })
      .catch(() => {
        toast("Couldn't open this image", { type: "error" });
        setFile(null);
      })
      .finally(() => {
        bitmap?.close();
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(
    () => () => {
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    },
    [],
  );

  // Scroll lock, restoring the previous value (matches MediaEditor).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Escape while typing the caption drops focus instead of closing the
      // studio and eating the draft.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        target.blur();
        return;
      }
      // Escape closes the active tool before it closes the studio.
      if (modeRef.current !== "none") {
        setEditingTextId(null);
        setMode("none");
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length > 0) {
      if (!file) {
        setFile(picked[0]);
        if (picked.length > 1) setQueue((prev) => [...prev, ...picked.slice(1)]);
      } else {
        // Editing already — every new pick chains onto the queue.
        setQueue((prev) => [...prev, ...picked]);
      }
    }
    e.target.value = "";
  };

  const patchOverlay = (id: string, patch: Partial<Overlay>) => {
    setOverlays((prev) =>
      prev.map((o) => (o.id === id ? ({ ...o, ...patch } as Overlay) : o)),
    );
  };

  const addOverlay = (overlay: Overlay) =>
    setOverlays((prev) => [...prev, overlay]);

  const editingText =
    (overlays.find((o) => o.id === editingTextId && o.kind === "text") as
      | TextOverlay
      | undefined) ?? null;

  const handleTextDone = (
    values: Pick<TextOverlay, "text" | "style" | "pill" | "color">,
  ) => {
    if (!values.text) {
      // Emptied text deletes the overlay (or cancels a new one).
      if (editingTextId) {
        setOverlays((prev) => prev.filter((o) => o.id !== editingTextId));
      }
    } else if (editingTextId) {
      patchOverlay(editingTextId, values);
    } else {
      addOverlay({
        kind: "text",
        id: newOverlayId(),
        x: 0.5,
        y: 0.4,
        scale: 1,
        rotation: 0,
        ...values,
      });
    }
    setEditingTextId(null);
    setMode("none");
  };

  // One slide posted: pull the next queued file into a fresh editor, or
  // close when the chain is done.
  const advanceAfterPost = () => {
    onPosted();
    const [next, ...rest] = queue;
    if (!next) {
      toast("Story posted!", { type: "success" });
      onClose();
      return;
    }
    toast(
      rest.length > 0
        ? `Slide posted — ${rest.length + 1} to go`
        : "Slide posted — last one",
      { type: "success" },
    );
    setQueue(rest);
    setPosition({ x: 0, y: 0 });
    setZoom(1);
    setPreset(null);
    setCroppedPx(null);
    setCaption("");
    setOverlays([]);
    setStrokes([]);
    setMode("none");
    setEditingTextId(null);
    setFile(next);
    setPosting(false);
  };

  const handleShare = async () => {
    if (posting || !file) return;
    if (isVideo) {
      // Video posts as-is (or as trimmed by the VideoEditor) — the canvas
      // pipeline is image-only.
      setPosting(true);
      const formData = new FormData();
      formData.append("media", file);
      if (caption.trim()) formData.append("caption", caption.trim());
      const result = await createStoryAction(formData);
      if (result.success) {
        advanceAfterPost();
      } else {
        toast(result.message || "Failed to post story", { type: "error" });
        setPosting(false);
      }
      return;
    }
    if (!orientedRef.current || !croppedPx) return;
    setPosting(true);
    try {
      // Canvas text uses the same hashed next/font faces the preview shows —
      // make sure they're loaded before measuring/drawing.
      await document.fonts.ready;
      const outFile = await exportCroppedFile(
        orientedRef.current,
        croppedPx,
        file.name,
        {
          ops: colorOpsFor(neutral, preset),
          grain: grainActive,
          target: { w: STORY_W, h: STORY_H },
          decorations:
            overlays.length > 0 || strokes.length > 0
              ? { overlays, strokes, fonts }
              : undefined,
        },
      );
      const formData = new FormData();
      formData.append("media", outFile);
      if (caption.trim()) formData.append("caption", caption.trim());
      const result = await createStoryAction(formData);
      if (result.success) {
        advanceAfterPost();
      } else {
        toast(result.message || "Failed to post story", { type: "error" });
        setPosting(false);
      }
    } catch {
      toast("Something went wrong", { type: "error" });
      setPosting(false);
    }
  };

  return (
    <ConfirmModalPortal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed inset-0 z-modal bg-[#0c0a09] glass-ink flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="New story"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b glass-divider">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close story studio"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill glass-chip transition-colors cursor-pointer"
            >
              <X size={17} weight="bold" />
            </button>
            <h2 className="font-display text-lg font-semibold tracking-tight truncate">
              New story
            </h2>
          </div>
          <button
            type="button"
            onClick={handleShare}
            disabled={posting || (isVideo ? !file : !croppedPx)}
            className="shrink-0 flex items-center gap-2 glass-cta px-5 sm:px-6 h-10 sm:h-9 rounded-pill font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-sans cursor-pointer"
          >
            {posting ? (
              <div className="w-4 h-4 border-2 border-[#0c0a09]/25 border-t-[#0c0a09] rounded-full animate-spin" />
            ) : (
              <PaperPlaneTilt size={15} weight="bold" />
            )}
            {queue.length > 0 ? `Share · ${queue.length + 1} slides` : "Share"}
          </button>
        </div>

        {/* Stage */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          {file ? (
            <div
              ref={stageRef}
              className="relative h-full max-h-full aspect-[9/16] rounded-2xl overflow-hidden bg-[#141110] border border-[#fafaf9]/10 ws-cropper"
            >
              {isVideo && videoUrl ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  key={videoUrl}
                  src={videoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : sourceUrl ? (
                <Cropper
                  image={sourceUrl}
                  crop={position}
                  zoom={zoom}
                  minZoom={1}
                  maxZoom={3}
                  aspect={9 / 16}
                  objectFit="cover"
                  showGrid={false}
                  style={{
                    // The frame IS the container — hide the inner crop chrome.
                    cropAreaStyle: { border: "none", boxShadow: "none" },
                    ...(previewFilter
                      ? { mediaStyle: { filter: previewFilter } }
                      : {}),
                  }}
                  onCropChange={setPosition}
                  onZoomChange={setZoom}
                  onCropComplete={(_area, areaPixels) =>
                    setCroppedPx(areaPixels)
                  }
                />
              ) : (
                <div className="absolute inset-0 skeleton" />
              )}
              {grainActive && <GrainOverlay />}

              {/* Decoration layers: strokes under stickers (IG order). */}
              <DrawLayer
                strokes={strokes}
                active={mode === "draw"}
                onCommitStroke={(stroke) =>
                  setStrokes((prev) => [...prev, stroke])
                }
                onUndo={() => setStrokes((prev) => prev.slice(0, -1))}
                onDone={() => setMode("none")}
              />
              <OverlayLayer
                overlays={overlays}
                stageW={stageW}
                fonts={fonts}
                interactive={mode === "none"}
                onChange={patchOverlay}
                onDelete={(id) =>
                  setOverlays((prev) => prev.filter((o) => o.id !== id))
                }
                onEditText={(id) => {
                  setEditingTextId(id);
                  setMode("text");
                }}
              />

              {/* Tool rail */}
              {mode === "none" && !isVideo && (
                <div className="absolute top-2 left-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTextId(null);
                      setMode("text");
                    }}
                    aria-label="Add text"
                    className="flex h-10 w-10 items-center justify-center rounded-pill glass-chip transition-colors cursor-pointer"
                  >
                    <TextAa size={17} weight="bold" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("sticker")}
                    aria-label="Add sticker"
                    className="flex h-10 w-10 items-center justify-center rounded-pill glass-chip transition-colors cursor-pointer"
                  >
                    <Sticker size={17} weight="bold" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("draw")}
                    aria-label="Draw"
                    className="flex h-10 w-10 items-center justify-center rounded-pill glass-chip transition-colors cursor-pointer"
                  >
                    <Scribble size={17} weight="bold" />
                  </button>
                </div>
              )}
              {mode === "none" && isVideo && (
                <button
                  type="button"
                  onClick={() => setTrimOpen(true)}
                  aria-label="Trim video"
                  className="absolute top-2 left-2 flex items-center gap-2 h-10 px-4 rounded-pill glass-chip transition-colors cursor-pointer font-sans text-[13px] font-semibold"
                >
                  <Scissors size={15} weight="bold" />
                  Trim
                </button>
              )}

              {mode === "none" && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  aria-label="Add more slides"
                  className="absolute top-2 right-2 flex h-10 w-10 items-center justify-center rounded-pill glass-chip transition-colors cursor-pointer"
                >
                  <Images size={17} weight="bold" />
                  {queue.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-brand px-1 text-[10px] font-bold text-brand-on font-sans tabular-nums">
                      {queue.length}
                    </span>
                  )}
                </button>
              )}

              {mode === "text" && (
                <TextTool
                  overlay={editingText}
                  stageW={stageW}
                  fonts={fonts}
                  onDone={handleTextDone}
                  onCancel={() => {
                    setEditingTextId(null);
                    setMode("none");
                  }}
                />
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center gap-3 glass-ink-dim hover:glass-ink transition-colors cursor-pointer p-8"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-pill glass-chip">
                <Images size={24} />
              </span>
              <span className="font-sans text-sm font-medium">
                Add a photo or video to your story
              </span>
              <span className="font-sans text-xs glass-ink-faint">
                It disappears after 24 hours
              </span>
            </button>
          )}
          <input
            type="file"
            ref={inputRef}
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handlePick}
          />
        </div>

        {/* Sticker tray — over the bottom panel, inside the studio. */}
        {trimOpen && file && isVideo && (
          <VideoEditor
            file={file}
            onClose={() => setTrimOpen(false)}
            onSave={(edited) => {
              setFile(edited);
              setTrimOpen(false);
            }}
          />
        )}

        {mode === "sticker" && (
          <StickerTray
            onAddCashtag={(symbol) => {
              addOverlay({
                kind: "cashtag",
                id: newOverlayId(),
                x: 0.5,
                y: 0.6,
                scale: 1,
                rotation: 0,
                symbol,
              });
              setMode("none");
            }}
            onAddEmoji={(emoji) => {
              addOverlay({
                kind: "emoji",
                id: newOverlayId(),
                x: 0.5,
                y: 0.5,
                scale: 1,
                rotation: 0,
                emoji,
              });
              setMode("none");
            }}
            onClose={() => setMode("none")}
          />
        )}

        {/* Filters + caption (hidden while drawing — its palette sits there) */}
        {file && mode !== "draw" && (
          <div className="shrink-0 border-t glass-divider px-3 sm:px-4 py-3 space-y-3 pb-safe">
            {!isVideo && (
              <PresetCarousel
                thumbUrl={thumbUrl}
                active={preset}
                onSelect={setPreset}
              />
            )}
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={CAPTION_MAX}
                placeholder="Add a caption…"
                className="flex-1 h-11 sm:h-10 rounded-pill glass-input px-4 text-base sm:text-sm font-sans transition-colors"
              />
              <span
                className={clsx(
                  "shrink-0 text-xs font-sans tabular-nums",
                  caption.length >= CAPTION_MAX
                    ? "text-danger"
                    : "glass-ink-dim",
                )}
                aria-live="polite"
              >
                {CAPTION_MAX - caption.length}
              </span>
            </div>
          </div>
        )}
      </motion.div>
    </ConfirmModalPortal>
  );
}
