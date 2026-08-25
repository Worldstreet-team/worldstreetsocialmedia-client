"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import clsx from "clsx";
import { motion } from "framer-motion";
import {
  Check,
  FlipHorizontal2,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import PresetCarousel from "@/components/editor/PresetCarousel";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import { useToast } from "@/components/ui/Toast/ToastContext";
import {
  type Adjustments,
  ASPECT_LABELS,
  ASPECT_RATIOS,
  type AspectId,
  createAdjustments,
  createEditDocument,
  type EditDocument,
  type Rotation,
} from "@/lib/editor/document";
import {
  exportCroppedFile,
  finalDimensions,
  loadOrientedBitmap,
  orientCanvas,
} from "@/lib/editor/export";
import {
  colorMatrixFor,
  cssFilterFor,
  getGrainTileUrl,
  getPreset,
} from "@/lib/editor/presets";

type EditorTab = "crop" | "adjust" | "alt";

const ADJUSTMENT_SLIDERS: { key: keyof Adjustments; label: string }[] = [
  { key: "brightness", label: "Brightness" },
  { key: "contrast", label: "Contrast" },
  { key: "saturation", label: "Saturation" },
  { key: "warmth", label: "Warmth" },
];

/** 64px cover-cropped snapshot of the oriented source for filter thumbs. */
function makeThumb(source: HTMLCanvasElement): string {
  const size = 64;
  const thumb = document.createElement("canvas");
  thumb.width = size;
  thumb.height = size;
  const ctx = thumb.getContext("2d");
  if (!ctx) return "";
  const side = Math.min(source.width, source.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    source,
    (source.width - side) / 2,
    (source.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  return thumb.toDataURL("image/jpeg", 0.7);
}

export interface MediaEditResult {
  file: File;
  doc: EditDocument;
}

interface MediaEditorProps {
  /** The ORIGINAL source file — callers keep it so edits stay re-editable. */
  file: File;
  /** Prior edit state to restore; omit for a fresh session. */
  doc?: EditDocument | null;
  /** Fixed aspect (avatar 1, banner 3). Hides the preset chips. */
  lockAspect?: number;
  /** Circular crop mask (avatar). */
  round?: boolean;
  title?: string;
  onClose: () => void;
  onSave: (result: MediaEditResult) => void;
}

/**
 * The Studio sheet — Phase 1 of the WorldStreet media editor: crop, aspect
 * presets, rotate, flip. Follows the EditProfileModal portal/scrim/panel
 * recipe exactly (template.tsx's transient transform makes portalling to
 * document.body mandatory for fixed UI).
 *
 * Non-destructive by construction: the caller passes the original file plus
 * the stored EditDocument; Save re-renders from the original every time.
 */
export default function MediaEditor({
  file,
  doc: initialDoc,
  lockAspect,
  round = false,
  title = "Edit media",
  onClose,
  onSave,
}: MediaEditorProps) {
  const { toast } = useToast();
  // Merge over defaults so docs saved before newer fields existed stay valid.
  const [doc, setDoc] = useState<EditDocument>(() => ({
    ...createEditDocument(),
    ...initialDoc,
  }));
  const [tab, setTab] = useState<EditorTab>("crop");
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [grainUrl, setGrainUrl] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceSize, setSourceSize] = useState<{ w: number; h: number } | null>(
    null,
  );
  const [croppedPx, setCroppedPx] = useState<Area | null>(null);
  const [interacting, setInteracting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const bitmapRef = useRef<ImageBitmap | null>(null);
  const orientedRef = useRef<HTMLCanvasElement | null>(null);
  const sourceUrlRef = useRef<string | null>(null);

  // Bake rotation/flip into an oriented canvas and hand the cropper a fresh
  // object URL of it — cropper coordinates then live in oriented space, so
  // export needs no transform math beyond the crop rect itself.
  const rebuild = useCallback(async (rotation: Rotation, flipH: boolean) => {
    const bitmap = bitmapRef.current;
    if (!bitmap) return;
    const canvas = orientCanvas(bitmap, rotation, flipH);
    orientedRef.current = canvas;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) return;
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    const url = URL.createObjectURL(blob);
    sourceUrlRef.current = url;
    setSourceUrl(url);
    setSourceSize({ w: canvas.width, h: canvas.height });
    setThumbUrl(makeThumb(canvas));
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: decode once per file — rebuild is a stable useCallback and re-running on toast/onClose identity would re-decode the bitmap.
  useEffect(() => {
    let cancelled = false;
    loadOrientedBitmap(file)
      .then((bitmap) => {
        if (cancelled) {
          bitmap.close();
          return;
        }
        bitmapRef.current = bitmap;
        // Restore the stored orientation on open (fresh docs are 0/false).
        setDoc((d) => {
          void rebuild(d.rotation, d.flipH);
          return d;
        });
      })
      .catch(() => {
        toast("Couldn't open this image", { type: "error" });
        onClose();
      });
    return () => {
      cancelled = true;
      bitmapRef.current?.close();
      bitmapRef.current = null;
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    };
  }, [file]);

  // Scroll lock — restore the PREVIOUS value, not "unset": the editor can sit
  // on top of another modal (EditProfileModal) that holds its own lock.
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

  const applyRotate = () => {
    const rotation = ((doc.rotation + 90) % 360) as Rotation;
    setDoc((d) => ({ ...d, rotation, position: { x: 0, y: 0 }, zoom: 1 }));
    void rebuild(rotation, doc.flipH);
  };

  const applyFlip = () => {
    const flipH = !doc.flipH;
    setDoc((d) => ({ ...d, flipH, position: { x: 0, y: 0 }, zoom: 1 }));
    void rebuild(doc.rotation, flipH);
  };

  const selectAspect = (aspectId: AspectId) => {
    setDoc((d) => ({ ...d, aspectId }));
  };

  const aspect =
    lockAspect ??
    (doc.aspectId === "original"
      ? sourceSize
        ? sourceSize.w / sourceSize.h
        : 1
      : ASPECT_RATIOS[doc.aspectId]);

  const readout = croppedPx ? finalDimensions(croppedPx) : null;
  const previewFilter = cssFilterFor(doc.adjustments, doc.preset);
  const grainActive = !!getPreset(doc.preset)?.grain;
  const adjustmentsDirty =
    doc.preset !== null ||
    ADJUSTMENT_SLIDERS.some(({ key }) => doc.adjustments[key] !== 0);

  // The grain preview tile is canvas-generated — client only, so post-mount.
  useEffect(() => {
    if (grainActive && !grainUrl) setGrainUrl(getGrainTileUrl());
  }, [grainActive, grainUrl]);

  const tabs: { id: EditorTab; label: string }[] = [
    { id: "crop", label: "Crop" },
    { id: "adjust", label: "Adjust" },
    // Alt text is per-post-image; avatar/banner (locked) don't carry one.
    ...(lockAspect ? [] : [{ id: "alt" as EditorTab, label: "Alt" }]),
  ];

  const handleSave = async () => {
    if (!orientedRef.current || !croppedPx || exporting) return;
    setExporting(true);
    try {
      const outFile = await exportCroppedFile(
        orientedRef.current,
        croppedPx,
        file.name,
        {
          matrix: colorMatrixFor(doc.adjustments, doc.preset),
          grain: grainActive,
        },
      );
      onSave({ file: outFile, doc });
    } catch {
      toast("Couldn't save the edit", { type: "error" });
      setExporting(false);
    }
  };

  return (
    <ConfirmModalPortal>
      <div className="fixed inset-0 z-modal flex items-center justify-center p-3 sm:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onClose}
          className="absolute inset-0 bg-scrim"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          className="relative w-full max-w-xl bg-surface border border-hairline rounded-xl shadow-nav overflow-hidden flex flex-col max-h-[90dvh] text-primary"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-2 px-2 sm:px-4 py-2 sm:py-3 border-b border-hairline">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                type="button"
                onClick={onClose}
                aria-label="Discard edits"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill hover:bg-raised transition-colors text-muted hover:text-primary cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="font-display text-lg font-semibold tracking-tight truncate">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={!croppedPx || exporting}
              className="shrink-0 flex items-center gap-2 bg-brand text-brand-on px-5 sm:px-6 h-11 sm:h-9 rounded-pill font-semibold text-sm hover:bg-brand-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-sans cursor-pointer"
            >
              {exporting ? (
                <div className="w-4 h-4 border-2 border-brand-on/30 border-t-brand-on rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Save
            </button>
          </div>

          {/* Stage — stays mounted across tabs so crop state survives; the
              adjustment preview is a CSS filter on the cropper's media. */}
          <div className="relative w-full h-[min(52dvh,420px)] bg-sunken ws-cropper">
            {sourceUrl ? (
              <Cropper
                image={sourceUrl}
                crop={doc.position}
                zoom={doc.zoom}
                minZoom={1}
                maxZoom={3}
                aspect={aspect}
                cropShape={round ? "round" : "rect"}
                showGrid={interacting}
                style={
                  previewFilter
                    ? { mediaStyle: { filter: previewFilter } }
                    : undefined
                }
                onCropChange={(position) => setDoc((d) => ({ ...d, position }))}
                onZoomChange={(zoom) => setDoc((d) => ({ ...d, zoom }))}
                onCropComplete={(_area, areaPixels) => setCroppedPx(areaPixels)}
                onInteractionStart={() => setInteracting(true)}
                onInteractionEnd={() => setInteracting(false)}
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
          </div>

          {/* Tab bar — gold underline slides via layoutId (FeedTabs motion). */}
          <div className="flex shrink-0 border-t border-hairline">
            {tabs.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-pressed={tab === id}
                className={clsx(
                  "relative flex-1 h-11 text-[13px] font-semibold font-sans transition-colors cursor-pointer",
                  tab === id ? "text-primary" : "text-muted hover:text-primary",
                )}
              >
                {label}
                {id === "adjust" && adjustmentsDirty && tab !== "adjust" && (
                  <span className="absolute top-2 ml-1 inline-block h-1.5 w-1.5 rounded-pill bg-gold" />
                )}
                {tab === id && (
                  <motion.span
                    layoutId="ws-editor-tab"
                    className="absolute inset-x-8 top-0 h-0.5 rounded-pill bg-brand"
                    transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Controls */}
          {tab === "adjust" && (
            <div className="shrink-0 px-3 sm:px-4 py-3 space-y-3 border-t border-hairline overflow-y-auto">
              <div className="space-y-2">
                {ADJUSTMENT_SLIDERS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-[76px] shrink-0 text-[11px] uppercase tracking-[1px] font-medium text-muted font-sans">
                      {label}
                    </span>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={1}
                      value={doc.adjustments[key]}
                      onChange={(e) =>
                        setDoc((d) => ({
                          ...d,
                          adjustments: {
                            ...d.adjustments,
                            [key]: Number(e.target.value),
                          },
                        }))
                      }
                      onDoubleClick={() =>
                        setDoc((d) => ({
                          ...d,
                          adjustments: { ...d.adjustments, [key]: 0 },
                        }))
                      }
                      aria-label={label}
                      className="ws-slider flex-1"
                    />
                    <span className="w-9 shrink-0 text-right text-xs text-subtle font-sans tabular-nums">
                      {doc.adjustments[key]}
                    </span>
                  </div>
                ))}
              </div>
              <PresetCarousel
                thumbUrl={thumbUrl}
                active={doc.preset}
                onSelect={(preset) => setDoc((d) => ({ ...d, preset }))}
              />
              {adjustmentsDirty && (
                <button
                  type="button"
                  onClick={() =>
                    setDoc((d) => ({
                      ...d,
                      adjustments: createAdjustments(),
                      preset: null,
                    }))
                  }
                  className="text-[13px] font-medium font-sans text-muted hover:text-primary transition-colors cursor-pointer"
                >
                  Reset adjustments
                </button>
              )}
            </div>
          )}

          {tab === "alt" && (
            <div className="shrink-0 px-3 sm:px-4 py-3 border-t border-hairline">
              <label
                htmlFor="ws-editor-alt"
                className="block text-[11px] uppercase tracking-[1px] font-medium text-muted mb-1 font-sans"
              >
                Alt text
              </label>
              <textarea
                id="ws-editor-alt"
                value={doc.alt}
                onChange={(e) => setDoc((d) => ({ ...d, alt: e.target.value }))}
                maxLength={1000}
                placeholder="Describe the image for people using screen readers"
                className="w-full rounded-md border border-hairline focus-within:border-brand/60 bg-transparent p-3 outline-none text-base sm:text-sm font-sans resize-none min-h-[72px] placeholder:text-subtle text-primary"
              />
            </div>
          )}

          <div
            className={clsx(
              "shrink-0 px-3 sm:px-4 py-3 space-y-3 border-t border-hairline",
              tab !== "crop" && "hidden",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              {lockAspect ? (
                <span className="text-[11px] uppercase tracking-[1px] font-medium text-subtle font-sans">
                  {round ? "Profile photo" : "Banner"}
                </span>
              ) : (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {ASPECT_LABELS.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => selectAspect(id)}
                      className={clsx(
                        "h-8 px-3 rounded-pill text-[13px] font-medium font-sans transition-colors whitespace-nowrap cursor-pointer tabular-nums",
                        doc.aspectId === id
                          ? "bg-brand/10 text-gold"
                          : "border border-hairline text-muted hover:bg-raised hover:text-primary",
                      )}
                      aria-pressed={doc.aspectId === id}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={applyRotate}
                  aria-label="Rotate 90 degrees"
                  className="flex h-10 w-10 items-center justify-center rounded-pill text-muted hover:bg-raised hover:text-primary transition-colors cursor-pointer"
                >
                  <RotateCw className="w-[18px] h-[18px]" />
                </button>
                <button
                  type="button"
                  onClick={applyFlip}
                  aria-label="Flip horizontally"
                  className={clsx(
                    "flex h-10 w-10 items-center justify-center rounded-pill transition-colors cursor-pointer",
                    doc.flipH
                      ? "bg-brand/10 text-gold"
                      : "text-muted hover:bg-raised hover:text-primary",
                  )}
                  aria-pressed={doc.flipH}
                >
                  <FlipHorizontal2 className="w-[18px] h-[18px]" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ZoomOut className="w-4 h-4 text-subtle shrink-0" aria-hidden />
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={doc.zoom}
                onChange={(e) =>
                  setDoc((d) => ({ ...d, zoom: Number(e.target.value) }))
                }
                aria-label="Zoom"
                className="ws-slider flex-1"
              />
              <ZoomIn className="w-4 h-4 text-subtle shrink-0" aria-hidden />
              <span
                className="text-xs text-subtle font-sans tabular-nums w-[84px] text-right shrink-0"
                aria-live="polite"
              >
                {readout ? `${readout.w} × ${readout.h}` : "—"}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </ConfirmModalPortal>
  );
}
