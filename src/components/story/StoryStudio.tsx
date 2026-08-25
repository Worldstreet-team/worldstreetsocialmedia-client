"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { ImagePlus, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import PresetCarousel from "@/components/editor/PresetCarousel";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import { useToast } from "@/components/ui/Toast/ToastContext";
import type { PresetId } from "@/lib/editor/document";
import { createAdjustments } from "@/lib/editor/document";
import {
  exportCroppedFile,
  loadOrientedBitmap,
  makeSquareThumb,
  orientCanvas,
} from "@/lib/editor/export";
import {
  colorMatrixFor,
  cssFilterFor,
  getGrainTileUrl,
  getPreset,
} from "@/lib/editor/presets";
import { createStoryAction } from "@/lib/story.actions";

const STORY_W = 1080;
const STORY_H = 1920;
const CAPTION_MAX = 280;

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
 * Overlay tools (text, cashtags, draw) arrive in Phase 4.
 */
export default function StoryStudio({ onClose, onPosted }: StoryStudioProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [grainUrl, setGrainUrl] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [preset, setPreset] = useState<PresetId | null>(null);
  const [croppedPx, setCroppedPx] = useState<Area | null>(null);
  const [caption, setCaption] = useState("");
  const [posting, setPosting] = useState(false);

  const orientedRef = useRef<HTMLCanvasElement | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const neutral = createAdjustments();
  const previewFilter = cssFilterFor(neutral, preset);
  const grainActive = !!getPreset(preset)?.grain;

  useEffect(() => {
    if (grainActive && !grainUrl) setGrainUrl(getGrainTileUrl());
  }, [grainActive, grainUrl]);

  // Decode the picked file into an oriented working canvas (EXIF-corrected,
  // downscaled) and hand the cropper a blob URL of it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: decode once per file; toast/onClose identity changes must not re-decode.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let bitmap: ImageBitmap | null = null;
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
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) setFile(picked);
    e.target.value = "";
  };

  const handleShare = async () => {
    if (!orientedRef.current || !croppedPx || posting || !file) return;
    setPosting(true);
    try {
      const outFile = await exportCroppedFile(
        orientedRef.current,
        croppedPx,
        file.name,
        {
          matrix: colorMatrixFor(neutral, preset),
          grain: grainActive,
          target: { w: STORY_W, h: STORY_H },
        },
      );
      const formData = new FormData();
      formData.append("media", outFile);
      if (caption.trim()) formData.append("caption", caption.trim());
      const result = await createStoryAction(formData);
      if (result.success) {
        toast("Story posted!", { type: "success" });
        onPosted();
        onClose();
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
        className="fixed inset-0 z-modal bg-page text-primary flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="New story"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 px-2 sm:px-4 py-2 sm:py-3 border-b border-hairline">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close story studio"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill hover:bg-raised transition-colors text-muted hover:text-primary cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="font-display text-lg font-semibold tracking-tight truncate">
              New story
            </h2>
          </div>
          <button
            type="button"
            onClick={handleShare}
            disabled={!croppedPx || posting}
            className="shrink-0 flex items-center gap-2 bg-brand text-brand-on px-5 sm:px-6 h-11 sm:h-9 rounded-pill font-semibold text-sm hover:bg-brand-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-sans cursor-pointer"
          >
            {posting ? (
              <div className="w-4 h-4 border-2 border-brand-on/30 border-t-brand-on rounded-full animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Share
          </button>
        </div>

        {/* Stage */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          {file ? (
            <div className="relative h-full max-h-full aspect-[9/16] rounded-xl overflow-hidden bg-sunken border border-hairline ws-cropper">
              {sourceUrl ? (
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
              {grainActive && grainUrl && (
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: `url(${grainUrl})`,
                    backgroundRepeat: "repeat",
                    mixBlendMode: "overlay",
                    opacity: 0.28,
                  }}
                />
              )}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                aria-label="Choose a different photo"
                className="absolute top-2 right-2 flex h-10 w-10 items-center justify-center bg-page/60 hover:bg-page/80 rounded-pill text-primary transition-colors cursor-pointer"
              >
                <ImagePlus className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center gap-3 text-muted hover:text-primary transition-colors cursor-pointer p-8"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-pill bg-raised">
                <ImagePlus className="w-6 h-6" />
              </span>
              <span className="font-sans text-sm font-medium">
                Add a photo to your story
              </span>
              <span className="font-sans text-xs text-subtle">
                It disappears after 24 hours
              </span>
            </button>
          )}
          <input
            type="file"
            ref={inputRef}
            accept="image/*"
            className="hidden"
            onChange={handlePick}
          />
        </div>

        {/* Filters + caption */}
        {file && (
          <div className="shrink-0 border-t border-hairline px-3 sm:px-4 py-3 space-y-3 pb-safe">
            <PresetCarousel
              thumbUrl={thumbUrl}
              active={preset}
              onSelect={setPreset}
            />
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={CAPTION_MAX}
                placeholder="Add a caption…"
                className="flex-1 h-11 sm:h-10 rounded-pill border border-hairline bg-transparent px-4 outline-none text-base sm:text-sm font-sans placeholder:text-subtle text-primary focus:border-brand/60 transition-colors"
              />
              <span
                className={clsx(
                  "shrink-0 text-xs font-sans tabular-nums",
                  caption.length >= CAPTION_MAX ? "text-danger" : "text-subtle",
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
