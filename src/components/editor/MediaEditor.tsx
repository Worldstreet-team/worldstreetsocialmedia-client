"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import {
  ArrowClockwise,
  Check,
  FlipHorizontal,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  X,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { motion } from "framer-motion";
import GrainOverlay from "@/components/editor/GrainOverlay";
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
  makeSquareThumb,
  orientCanvas,
} from "@/lib/editor/export";
import { colorOpsFor, cssFilterFor, getPreset } from "@/lib/editor/presets";

type EditorTab = "crop" | "adjust" | "alt";

const ADJUSTMENT_SLIDERS: { key: keyof Adjustments; label: string }[] = [
  { key: "brightness", label: "Brightness" },
  { key: "contrast", label: "Contrast" },
  { key: "saturation", label: "Saturation" },
  { key: "warmth", label: "Warmth" },
];

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
  /**
   * Show the Alt-text tab. Only true where the caller actually carries alt
   * forward (post images) — offering it where nothing transports it is a
   * promise the product can't keep.
   */
  allowAlt?: boolean;
  title?: string;
  onClose: () => void;
  onSave: (result: MediaEditResult) => void;
  /**
   * Called (before onClose) when the file can't be decoded — e.g. HEIC on
   * Chrome, or a corrupt file. Lets callers fall back to using the original
   * file untouched instead of losing the pick entirely.
   */
  onDecodeError?: (file: File) => void;
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
  allowAlt = false,
  title = "Edit media",
  onClose,
  onSave,
  onDecodeError,
}: MediaEditorProps) {
  const { toast } = useToast();
  // Merge over defaults so docs saved before newer fields existed stay valid.
  const [doc, setDoc] = useState<EditDocument>(() => ({
    ...createEditDocument(),
    ...initialDoc,
  }));
  const [tab, setTab] = useState<EditorTab>("crop");
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  // Restores the saved crop in oriented-source pixels (container-size-proof,
  // unlike position/zoom). Cleared on rotate/flip — those reset the crop.
  const [restoredCrop, setRestoredCrop] = useState<Area | undefined>(
    initialDoc?.cropPixels ?? undefined,
  );
  const [sourceSize, setSourceSize] = useState<{ w: number; h: number } | null>(
    null,
  );
  const [croppedPx, setCroppedPx] = useState<Area | null>(null);
  const [interacting, setInteracting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const bitmapRef = useRef<ImageBitmap | null>(null);
  const orientedRef = useRef<HTMLCanvasElement | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  // Generation token: rapid rotates and unmount both bump it, so a stale
  // toBlob resolution can neither leak a fresh object URL nor land an
  // out-of-order orientation.
  const buildGenRef = useRef(0);
  // Render-time mirror of doc, for async code that must read current state
  // without abusing a setDoc updater (updaters must stay pure — StrictMode
  // runs them twice).
  const docRef = useRef(doc);
  docRef.current = doc;

  // Bake rotation/flip into an oriented canvas and hand the cropper a fresh
  // object URL of it — cropper coordinates then live in oriented space, so
  // export needs no transform math beyond the crop rect itself.
  const rebuild = useCallback(async (rotation: Rotation, flipH: boolean) => {
    const bitmap = bitmapRef.current;
    if (!bitmap) return;
    const gen = ++buildGenRef.current;
    const canvas = orientCanvas(bitmap, rotation, flipH);
    orientedRef.current = canvas;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob || gen !== buildGenRef.current) return;
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    const url = URL.createObjectURL(blob);
    sourceUrlRef.current = url;
    setSourceUrl(url);
    setSourceSize({ w: canvas.width, h: canvas.height });
    setThumbUrl(makeSquareThumb(canvas));
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
        void rebuild(docRef.current.rotation, docRef.current.flipH);
      })
      .catch(() => {
        toast(
          onDecodeError
 ? "Couldn't open this image for editing using the original"
            : "Couldn't open this image",
          { type: "error" },
        );
        onDecodeError?.(file);
        onClose();
      });
    return () => {
      cancelled = true;
      buildGenRef.current++;
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
      if (e.key !== "Escape") return;
      // Escape while typing (alt text) should drop focus, not eat the edits.
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
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const applyRotate = () => {
    const rotation = ((doc.rotation + 90) % 360) as Rotation;
    setDoc((d) => ({ ...d, rotation, position: { x: 0, y: 0 }, zoom: 1 }));
    // The old crop rect lives in the previous orientation's pixel space —
    // clearing it disables Save until the cropper re-reports for the new one.
    setCroppedPx(null);
    setRestoredCrop(undefined);
    void rebuild(rotation, doc.flipH);
  };

  const applyFlip = () => {
    const flipH = !doc.flipH;
    setDoc((d) => ({ ...d, flipH, position: { x: 0, y: 0 }, zoom: 1 }));
    setCroppedPx(null);
    setRestoredCrop(undefined);
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
  // Memoized: pan/zoom re-renders at pointer rate must not re-derive filter
  // strings or hand Cropper a fresh style object every frame.
  const previewFilter = useMemo(
    () => cssFilterFor(doc.adjustments, doc.preset),
    [doc.adjustments, doc.preset],
  );
  const cropperStyle = useMemo(
    () =>
      previewFilter ? { mediaStyle: { filter: previewFilter } } : undefined,
    [previewFilter],
  );
  const grainActive = !!getPreset(doc.preset)?.grain;
  const adjustmentsDirty =
    doc.preset !== null ||
    ADJUSTMENT_SLIDERS.some(({ key }) => doc.adjustments[key] !== 0);

  const selectPreset = useCallback(
    (preset: EditDocument["preset"]) => setDoc((d) => ({ ...d, preset })),
    [],
  );

  const tabs: { id: EditorTab; label: string }[] = [
    { id: "crop", label: "Crop" },
    { id: "adjust", label: "Adjust" },
    ...(allowAlt ? [{ id: "alt" as EditorTab, label: "Alt" }] : []),
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
          ops: colorOpsFor(doc.adjustments, doc.preset),
          grain: grainActive,
        },
      );
      // Persist the pixel-space crop — it's the only representation that
      // restores correctly when the editor reopens at a different size.
      onSave({ file: outFile, doc: { ...doc, cropPixels: croppedPx } });
    } catch {
      toast("Couldn't save the edit", { type: "error" });
      setExporting(false);
    }
  };

  return (
    <ConfirmModalPortal>
      {/* Top-anchored, not centred: the panel's height changes with the tab,
          and centring made the whole sheet re-centre on every switch which
          slid the tab bar out from under the pointer (a second click landed
          on a slider). Pinning the top means only the bottom edge moves. */}
      <div className="fixed inset-0 z-modal flex items-start justify-center overflow-y-auto p-3 sm:p-4 pt-[max(3vh,0.75rem)]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onClose}
          className="absolute inset-0 glass-scrim backdrop-blur-xl backdrop-saturate-150"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          className="relative w-full max-w-xl glass-panel backdrop-blur-2xl backdrop-saturate-150 overflow-hidden flex flex-col max-h-[90dvh] glass-ink"
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
                aria-label="Discard edits"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill glass-chip transition-colors cursor-pointer"
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
              disabled={!croppedPx || exporting}
              className="shrink-0 flex items-center gap-2 glass-cta px-5 sm:px-6 h-10 sm:h-9 rounded-pill font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-sans cursor-pointer"
            >
              {exporting ? (
                <div className="w-4 h-4 border-2 border-[#0c0a09]/25 border-t-[#0c0a09] rounded-full animate-spin" />
              ) : (
                <Check size={16} weight="bold" />
              )}
              Save
            </button>
          </div>

          {/* Stage stays mounted across tabs so crop state survives; the
              adjustment preview is a CSS filter on the cropper's media. */}
          <div className="relative w-full h-[min(52dvh,420px)] ws-cropper">
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
                initialCroppedAreaPixels={restoredCrop}
                style={cropperStyle}
                onCropChange={(position) => setDoc((d) => ({ ...d, position }))}
                onZoomChange={(zoom) => setDoc((d) => ({ ...d, zoom }))}
                onCropComplete={(_area, areaPixels) => setCroppedPx(areaPixels)}
                onInteractionStart={() => setInteracting(true)}
                onInteractionEnd={() => setInteracting(false)}
              />
            ) : (
              <div className="absolute inset-0 skeleton" />
            )}
            {grainActive && <GrainOverlay />}
          </div>

          {/* Tab bar white underline slides via layoutId (FeedTabs motion). */}
          <div className="flex shrink-0 border-t glass-divider">
            {tabs.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-pressed={tab === id}
                className={clsx(
                  "relative flex-1 h-11 text-[13px] font-semibold font-sans transition-colors cursor-pointer",
                  tab === id ? "glass-ink" : "glass-ink-dim hover:glass-ink",
                )}
              >
                {label}
                {id === "adjust" && adjustmentsDirty && tab !== "adjust" && (
                  <span className="absolute top-2 ml-1 inline-block h-1.5 w-1.5 rounded-pill glass-fill" />
                )}
                {tab === id && (
                  <motion.span
                    layoutId="ws-editor-tab"
                    className="absolute inset-x-8 top-0 h-0.5 rounded-pill glass-fill"
                    transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Controls. The panel region keeps one height across all three
              tabs: without it the modal grows/shrinks per tab and, because it
              is vertically centred, the tab bar slides out from under the
              pointer a second click lands on a slider instead of a tab
              (hit while testing). */}
          <div className="shrink-0 flex flex-col">
            {tab === "adjust" && (
              <div className="shrink-0 px-3 sm:px-4 py-3 space-y-3 border-t glass-divider overflow-y-auto">
                <div className="space-y-2">
                  {ADJUSTMENT_SLIDERS.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-[76px] shrink-0 text-[11px] uppercase tracking-[1px] font-medium glass-ink-dim font-sans">
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
                      <span className="w-9 shrink-0 text-right text-xs glass-ink-dim font-sans tabular-nums">
                        {doc.adjustments[key]}
                      </span>
                    </div>
                  ))}
                </div>
                <PresetCarousel
                  thumbUrl={thumbUrl}
                  active={doc.preset}
                  onSelect={selectPreset}
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
                    className="text-[13px] font-medium font-sans glass-ink-dim hover:glass-ink transition-colors cursor-pointer"
                  >
                    Reset adjustments
                  </button>
                )}
              </div>
            )}

            {tab === "alt" && (
              <div className="shrink-0 px-3 sm:px-4 py-3 border-t glass-divider">
                <label
                  htmlFor="ws-editor-alt"
                  className="block text-[11px] uppercase tracking-[1px] font-medium glass-ink-dim mb-1 font-sans"
                >
                  Alt text
                </label>
                <textarea
                  id="ws-editor-alt"
                  value={doc.alt}
                  onChange={(e) =>
                    setDoc((d) => ({ ...d, alt: e.target.value }))
                  }
                  maxLength={1000}
                  placeholder="Describe the image for people using screen readers"
                  className="w-full rounded-lg glass-input p-3 text-base sm:text-sm font-sans resize-none min-h-[72px]"
                />
              </div>
            )}

            <div
              className={clsx(
                "shrink-0 px-3 sm:px-4 py-3 space-y-3 border-t glass-divider",
                tab !== "crop" && "hidden",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                {lockAspect ? (
                  <span className="text-[11px] uppercase tracking-[1px] font-medium glass-ink-dim font-sans">
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
                            ? "glass-chip-active"
                            : "glass-chip ",
                        )}
                        aria-pressed={doc.aspectId === id}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={applyRotate}
                    aria-label="Rotate 90 degrees"
                    className="flex h-10 w-10 items-center justify-center rounded-pill glass-chip transition-colors cursor-pointer"
                  >
                    <ArrowClockwise size={17} weight="bold" />
                  </button>
                  <button
                    type="button"
                    onClick={applyFlip}
                    aria-label="Flip horizontally"
                    className={clsx(
                      "flex h-10 w-10 items-center justify-center rounded-pill transition-colors cursor-pointer",
                      doc.flipH ? "glass-chip-active" : "glass-chip ",
                    )}
                    aria-pressed={doc.flipH}
                  >
                    <FlipHorizontal size={17} weight="bold" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MagnifyingGlassMinus
                  size={16}
                  className="glass-ink-faint shrink-0"
                  aria-hidden
                />
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
                <MagnifyingGlassPlus
                  size={16}
                  className="glass-ink-faint shrink-0"
                  aria-hidden
                />
                <span
                  className="text-xs glass-ink-dim font-sans tabular-nums w-[84px] text-right shrink-0"
                  aria-live="polite"
                >
 {readout ? `${readout.w} × ${readout.h}` : ""}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </ConfirmModalPortal>
  );
}
