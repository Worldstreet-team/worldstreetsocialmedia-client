"use client";

import {
  Check,
  Images,
  Microphone,
  PaperPlaneTilt,
  Plus,
  Scissors,
  Scribble,
  Sticker,
  TextAa,
  X,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import GrainOverlay from "@/components/editor/GrainOverlay";
import PresetCarousel from "@/components/editor/PresetCarousel";
import VideoEditor from "@/components/editor/VideoEditor";
import type { MentionUser } from "@/components/feed/MentionAutocomplete";
import DrawLayer from "@/components/story/overlays/DrawLayer";
import OverlayLayer from "@/components/story/overlays/OverlayLayer";
import StickerTray from "@/components/story/overlays/StickerTray";
import TextTool from "@/components/story/overlays/TextTool";
import type { StoryKind } from "@/components/story/StoryCreateSheet";
import VoiceRecorder from "@/components/story/VoiceRecorder";
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
  INK_DARK,
  INK_LIGHT,
  MONO_STACK,
  newOverlayId,
  type Overlay,
  type OverlayFonts,
  resolveOverlayFonts,
  type Stroke,
  type TextOverlay,
} from "@/lib/editor/overlays";
import { colorOpsFor, cssFilterFor, getPreset } from "@/lib/editor/presets";
import {
  loadBackdropImage,
  paintStoryCanvas,
  STORY_CANVASES,
  type StoryCanvas,
  storyCanvasCss,
} from "@/lib/editor/storyBackgrounds";
import { renderVoiceVideo, type VoiceTake } from "@/lib/editor/voiceRender";
import { createStoryAction } from "@/lib/stories.actions";

type ToolMode = "none" | "text" | "sticker" | "draw";

const STORY_W = 1080;
const STORY_H = 1920;
const CAPTION_MAX = POST_CHAR_BUDGET;
const EASE = [0.2, 0, 0, 1] as const;

const TITLES: Record<StoryKind, string> = {
  media: "Photo & video",
  text: "Text",
  voice: "Voice note",
};

/** One slide of a media story, carrying its full edit state so switching
 *  between slides loses nothing. */
interface Slide {
  id: string;
  file: File;
  /** Object URL for the picker thumbnail / video preview. */
  url: string;
  position: { x: number; y: number };
  zoom: number;
  preset: PresetId | null;
  croppedPx: Area | null;
  overlays: Overlay[];
  strokes: Stroke[];
  caption: string;
}

let slideCounter = 0;
const newSlideId = () => `slide-${++slideCounter}-${Date.now()}`;

/** Centered max 9:16 rect — the export crop for slides never opened in the
 *  editor (they post exactly as the auto-cover preview shows them). */
function coverCrop(canvas: HTMLCanvasElement): Area {
  const target = STORY_W / STORY_H;
  const ratio = canvas.width / canvas.height;
  const width = ratio > target ? canvas.height * target : canvas.width;
  const height = ratio > target ? canvas.height : canvas.width / target;
  return {
    x: (canvas.width - width) / 2,
    y: (canvas.height - height) / 2,
    width,
    height,
  };
}

/** One labelled block in the control dock. */
function DockSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <h3 className="glass-eyebrow font-sans">{label}</h3>
      {children}
    </section>
  );
}

interface StoryStudioProps {
  onClose: () => void;
  /** Called after a successful post so the rail can refetch. */
  onPosted: () => void;
  /** Which lane the create sheet picked. Defaults to the media flow. */
  initialKind?: StoryKind;
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
export default function StoryStudio({
  onClose,
  onPosted,
  initialKind = "media",
}: StoryStudioProps) {
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const kind = initialKind;
  const [file, setFile] = useState<File | null>(null);
  const [bg, setBg] = useState<StoryCanvas>(STORY_CANVASES[0]);
  // Media stories are a deck of slides, every one individually editable; the
  // single-slide editor state below always belongs to the ACTIVE slide, and
  // switching snapshots it into the deck.
  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [postLabel, setPostLabel] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [preset, setPreset] = useState<PresetId | null>(null);
  const [croppedPx, setCroppedPx] = useState<Area | null>(null);
  const [caption, setCaption] = useState("");
  // The uploader's call: whether viewers can pay to download this story.
  const [allowSave, setAllowSave] = useState(false);
  const [posting, setPosting] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [trimOpen, setTrimOpen] = useState(false);
  // Voice lane: the recorded audio take. The video is only rendered on Share,
  // which is what lets the canvas stay editable after recording.
  const [take, setTake] = useState<VoiceTake | null>(null);
  const [renderPct, setRenderPct] = useState(0);
  const isVideo = !!file && file.type.startsWith("video/");

  // Phase 4 decoration state. A text story drops straight into the type
  // tool — the gradient canvas with nothing on it isn't a story yet.
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [mode, setMode] = useState<ToolMode>(kind === "text" ? "text" : "none");
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [stageW, setStageW] = useState(0);
  const [fonts] = useState<OverlayFonts>(() =>
    typeof document === "undefined"
      ? {
          display: '"Poppins", system-ui, sans-serif',
          editorial: '"Instrument Serif", Georgia, serif',
          ui: '"Public Sans", system-ui, sans-serif',
          poster: '"Archivo Black", Impact, sans-serif',
          condensed: '"Bebas Neue", "Arial Narrow", sans-serif',
          script: '"Caveat", cursive',
          mono: MONO_STACK,
        }
      : resolveOverlayFonts(),
  );

  const orientedRef = useRef<HTMLCanvasElement | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Crop state to restore after the decode effect (it resets position/zoom
  // for fresh picks; a slide switch must land on the slide's saved framing).
  const pendingCropRef = useRef<{
    position: { x: number; y: number };
    zoom: number;
  } | null>(null);
  const slideUrlsRef = useRef<string[]>([]);
  const modeRef = useRef<ToolMode>("none");
  modeRef.current = mode;

  // Live stage width — the DOM preview's scale reference for overlays.
  // A callback ref (not an effect) because ConfirmModalPortal renders null on
  // its first pass: a mount-time effect would run before the stage exists,
  // and for text/voice stories nothing re-triggers it (`file` never changes),
  // leaving stageW at 0 and every overlay scaled to nothing.
  const stageObserverRef = useRef<ResizeObserver | null>(null);
  const stageRef = useCallback((el: HTMLDivElement | null) => {
    stageObserverRef.current?.disconnect();
    stageObserverRef.current = null;
    if (!el) return;
    const sync = () => setStageW(el.getBoundingClientRect().width);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    stageObserverRef.current = observer;
  }, []);

  const neutral = createAdjustments();
  const previewFilter = cssFilterFor(neutral, preset);
  const grainActive = !!getPreset(preset)?.grain;

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

  // Decode the picked file into an oriented working canvas (EXIF-corrected,
  // downscaled) and hand the cropper a blob URL of it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: decode once per file; toast/onClose identity changes must not re-decode.
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
        const restore = pendingCropRef.current;
        pendingCropRef.current = null;
        setPosition(restore?.position ?? { x: 0, y: 0 });
        setZoom(restore?.zoom ?? 1);
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

  // Object URLs live as long as the studio does.
  useEffect(
    () => () => {
      for (const url of slideUrlsRef.current) URL.revokeObjectURL(url);
    },
    [],
  );

  /** Point the editor at a slide (does NOT snapshot the outgoing one). */
  const loadSlide = (target: Slide) => {
    setOverlays(target.overlays);
    setStrokes(target.strokes);
    setPreset(target.preset);
    setCaption(target.caption);
    setCroppedPx(target.croppedPx);
    setMode("none");
    setEditingTextId(null);
    pendingCropRef.current = {
      position: target.position,
      zoom: target.zoom,
    };
    setPosition(target.position);
    setZoom(target.zoom);
    setActiveId(target.id);
    setFile(target.file);
  };

  /** Fold the live editor state back into the active slide's deck entry. */
  const snapshotActive = () => {
    if (!activeId) return;
    setSlides((prev) =>
      prev.map((slide) =>
        slide.id === activeId
          ? {
              ...slide,
              position,
              zoom,
              preset,
              croppedPx,
              overlays,
              strokes,
              caption,
            }
          : slide,
      ),
    );
  };

  /** The deck with the active slide's LIVE state folded in — what Share posts. */
  const snapshotAll = (): Slide[] =>
    slides.map((slide) =>
      slide.id === activeId
        ? {
            ...slide,
            position,
            zoom,
            preset,
            croppedPx,
            overlays,
            strokes,
            caption,
          }
        : slide,
    );

  const switchSlide = (id: string) => {
    if (id === activeId) return;
    const target = slides.find((slide) => slide.id === id);
    if (!target) return;
    snapshotActive();
    loadSlide(target);
  };

  const removeSlide = (id: string) => {
    const idx = slides.findIndex((slide) => slide.id === id);
    if (idx < 0) return;
    const rest = slides.filter((slide) => slide.id !== id);
    setSlides(rest);
    if (id !== activeId) return;
    const next = rest[Math.min(idx, rest.length - 1)];
    if (next) {
      loadSlide(next);
    } else {
      setActiveId(null);
      setFile(null);
      setOverlays([]);
      setStrokes([]);
      setPreset(null);
      setCroppedPx(null);
      setCaption("");
      setMode("none");
      setEditingTextId(null);
    }
  };

  /** A trimmed video replaces the active slide's file (and the voice lane's
   *  bare file when no deck exists). */
  const replaceActiveFile = (edited: File) => {
    if (activeId) {
      const url = URL.createObjectURL(edited);
      slideUrlsRef.current.push(url);
      setSlides((prev) =>
        prev.map((slide) =>
          slide.id === activeId ? { ...slide, file: edited, url } : slide,
        ),
      );
    }
    setFile(edited);
  };

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length > 0) {
      const added = picked.map((f): Slide => {
        const url = URL.createObjectURL(f);
        slideUrlsRef.current.push(url);
        return {
          id: newSlideId(),
          file: f,
          url,
          position: { x: 0, y: 0 },
          zoom: 1,
          preset: null,
          croppedPx: null,
          overlays: [],
          strokes: [],
          caption: "",
        };
      });
      setSlides((prev) => [...prev, ...added]);
      if (!activeId) loadSlide(added[0]);
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

  const finishPost = (count: number) => {
    onPosted();
    toast(count > 1 ? `${count} slides posted!` : "Story posted!", {
      type: "success",
    });
    onClose();
  };

  const postFile = async (
    media: File,
    slideCaption: string,
    tagged: Overlay[] = [],
  ) => {
    const formData = new FormData();
    formData.append("media", media);
    if (slideCaption.trim()) formData.append("caption", slideCaption.trim());
    if (allowSave) formData.append("allowSave", "true");
    // Tags are burned into the image, so they are always VISIBLE on the story.
    // This field carries them as data too, for whenever the gateway grows a
    // mentions column — POST /api/stories reads only media/caption/mediaUrl
    // today, so nothing is notified yet. Same forward-compatible seam as
    // `categories`; do not claim it notifies anyone until the gateway does.
    const mentions = tagged
      .filter(
        (o): o is Extract<Overlay, { kind: "mention" }> => o.kind === "mention",
      )
      .map((o) => ({ userId: o.userId, username: o.username }));
    if (mentions.length > 0) {
      formData.append("mentions", JSON.stringify(mentions));
    }
    return createStoryAction(formData);
  };

  const handleShare = async () => {
    if (posting) return;

    if (kind === "text") {
      // Text story: paint the canvas (mesh or photo backdrop) at story size
      // and let the existing export pipeline composite the same overlays the
      // stage shows.
      if (overlays.length === 0 && strokes.length === 0) return;
      setPosting(true);
      try {
        await document.fonts.ready;
        const bgCanvas = document.createElement("canvas");
        bgCanvas.width = STORY_W;
        bgCanvas.height = STORY_H;
        const bgCtx = bgCanvas.getContext("2d");
        if (!bgCtx) throw new Error("Canvas 2D unavailable");
        try {
          await paintStoryCanvas(bgCtx, STORY_W, STORY_H, bg);
        } catch {
          toast("That backdrop didn't load — try another canvas", {
            type: "error",
          });
          setPosting(false);
          return;
        }
        const outFile = await exportCroppedFile(
          bgCanvas,
          { x: 0, y: 0, width: STORY_W, height: STORY_H },
          "text-story",
          {
            target: { w: STORY_W, h: STORY_H },
            decorations: { overlays, strokes, fonts },
          },
        );
        const result = await postFile(outFile, caption, overlays);
        if (result.success) {
          finishPost(1);
        } else {
          toast(result.message || "Failed to post story", { type: "error" });
          setPosting(false);
        }
      } catch {
        toast("Something went wrong", { type: "error" });
        setPosting(false);
      }
      return;
    }

    if (kind === "voice") {
      if (!take) return;
      setPosting(true);
      setRenderPct(0);
      try {
        // The picture is composed now, from the take plus whatever canvas is
        // selected — which is why the backdrop stayed changeable until here.
        const photo =
          bg.kind === "photo"
            ? await loadBackdropImage(bg.url).catch(() => null)
            : null;
        if (bg.kind === "photo" && !photo) {
          toast("That backdrop didn't load — try another canvas", {
            type: "error",
          });
          setPosting(false);
          return;
        }
        const video = await renderVoiceVideo({
          take,
          canvas: bg,
          photo,
          onProgress: setRenderPct,
        });
        setPostLabel("Posting");
        const result = await postFile(video, caption);
        if (result.success) {
          finishPost(1);
        } else {
          toast(result.message || "Failed to post story", { type: "error" });
          setPosting(false);
          setPostLabel(null);
        }
      } catch {
        toast("Couldn't put your voice note together", { type: "error" });
        setPosting(false);
        setPostLabel(null);
      }
      return;
    }

    // Media: export and post the whole deck, in order. Slides never opened in
    // the editor ship with their auto-cover framing.
    const deck = snapshotAll();
    if (deck.length === 0) return;
    setPosting(true);
    try {
      // Canvas text uses the same hashed next/font faces the preview shows —
      // make sure they're loaded before measuring/drawing.
      await document.fonts.ready;
      for (let i = 0; i < deck.length; i++) {
        const slide = deck[i];
        if (deck.length > 1) setPostLabel(`Posting ${i + 1} of ${deck.length}`);
        let out: File;
        if (slide.file.type.startsWith("video/")) {
          // Videos post as-is (or as trimmed) — the canvas pipeline is
          // image-only.
          out = slide.file;
        } else {
          let canvas: HTMLCanvasElement;
          if (slide.id === activeId && orientedRef.current) {
            canvas = orientedRef.current;
          } else {
            const bitmap = await loadOrientedBitmap(slide.file);
            canvas = orientCanvas(bitmap, 0, false);
            bitmap.close();
          }
          out = await exportCroppedFile(
            canvas,
            slide.croppedPx ?? coverCrop(canvas),
            slide.file.name,
            {
              ops: colorOpsFor(neutral, slide.preset),
              grain: !!getPreset(slide.preset)?.grain,
              target: { w: STORY_W, h: STORY_H },
              decorations:
                slide.overlays.length > 0 || slide.strokes.length > 0
                  ? { overlays: slide.overlays, strokes: slide.strokes, fonts }
                  : undefined,
            },
          );
        }
        const result = await postFile(out, slide.caption, slide.overlays);
        if (!result.success) {
          toast(
            deck.length > 1
              ? `Slide ${i + 1}: ${result.message || "failed to post"}`
              : result.message || "Failed to post story",
            { type: "error" },
          );
          setPosting(false);
          setPostLabel(null);
          return;
        }
      }
      finishPost(deck.length);
    } catch {
      toast("Something went wrong", { type: "error" });
      setPosting(false);
      setPostLabel(null);
    }
  };

  // Shared between the media and text stages, so the two can't drift.
  const decorationLayers = (
    <>
      <DrawLayer
        strokes={strokes}
        active={mode === "draw"}
        onCommitStroke={(stroke) => setStrokes((prev) => [...prev, stroke])}
        onUndo={() => setStrokes((prev) => prev.slice(0, -1))}
        onClear={() => setStrokes([])}
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
    </>
  );

  /** Ink that reads on the current canvas — the default for new text. */
  const canvasInk = bg.ink === "dark" ? INK_DARK : INK_LIGHT;

  // Swapping to a paper canvas would leave white text invisible on white, so
  // text still wearing the old canvas's default ink flips with it. A colour
  // the user picked deliberately from a palette is never touched.
  const applyBackground = (next: StoryCanvas) => {
    if (next.ink !== bg.ink) {
      const from = canvasInk.toLowerCase();
      const to = next.ink === "dark" ? INK_DARK : INK_LIGHT;
      setOverlays((all) =>
        all.map((o) =>
          o.kind === "text" && o.color.toLowerCase() === from
            ? { ...o, color: to }
            : o,
        ),
      );
    }
    setBg(next);
  };

  // A text story needs something ON the canvas; media needs a committed crop
  // (or, for video, just the file).
  const canShare =
    kind === "text"
      ? overlays.length > 0 || strokes.length > 0
      : kind === "voice"
        ? !!take
        : isVideo
          ? !!file
          : !!croppedPx;

  /* ── Stage chrome ─────────────────────────────────────────────────────── */

  const STAGE_FRAME =
    "relative h-full max-h-full aspect-[9/16] rounded-2xl overflow-hidden glass-stage";

  // Vertical rail on the frame's inner edge — it sits clear of the artwork's
  // center and never competes with the header the way the old top-left
  // cluster did.
  const toolRail = (
    <div className="absolute top-3 right-3 flex flex-col gap-2">
      {[
        {
          label: "Add text",
          icon: <TextAa size={17} weight="bold" />,
          onClick: () => {
            setEditingTextId(null);
            setMode("text");
          },
        },
        {
          label: "Add sticker",
          icon: <Sticker size={17} weight="bold" />,
          onClick: () => setMode("sticker"),
        },
        {
          label: "Draw",
          icon: <Scribble size={17} weight="bold" />,
          onClick: () => setMode("draw"),
        },
      ].map((tool) => (
        <button
          key={tool.label}
          type="button"
          onClick={tool.onClick}
          aria-label={tool.label}
          className="flex h-10 w-10 items-center justify-center rounded-pill glass-chip-canvas backdrop-blur-md backdrop-saturate-150 transition-colors cursor-pointer"
        >
          {tool.icon}
        </button>
      ))}
    </div>
  );

  const textToolEl = (
    <TextTool
      overlay={editingText}
      stageW={stageW}
      fonts={fonts}
      defaultColor={canvasInk}
      onDone={handleTextDone}
      onCancel={() => {
        setEditingTextId(null);
        setMode("none");
      }}
    />
  );

  const stickerTrayEl = (
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
      onAddMention={(user: MentionUser) => {
        addOverlay({
          kind: "mention",
          id: newOverlayId(),
          x: 0.5,
          y: 0.7,
          scale: 1,
          rotation: 0,
          username: user.username,
          userId: user._id,
        });
        setMode("none");
      }}
      onClose={() => setMode("none")}
    />
  );

  const stage = file ? (
    <div
      ref={stageRef}
      className={clsx(STAGE_FRAME, "bg-[#141110] ws-cropper")}
    >
      {isVideo && videoUrl ? (
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
            ...(previewFilter ? { mediaStyle: { filter: previewFilter } } : {}),
          }}
          onCropChange={setPosition}
          onZoomChange={setZoom}
          onCropComplete={(_area, areaPixels) => setCroppedPx(areaPixels)}
        />
      ) : (
        <div className="absolute inset-0 skeleton" />
      )}
      {grainActive && <GrainOverlay />}

      {/* Decoration layers: strokes under stickers (IG order). */}
      {decorationLayers}

      {mode === "none" && !isVideo && toolRail}
      {mode === "none" && isVideo && (
        <button
          type="button"
          onClick={() => (kind === "voice" ? setFile(null) : setTrimOpen(true))}
          aria-label={kind === "voice" ? "Record again" : "Trim video"}
          className="absolute top-3 right-3 flex items-center gap-2 h-10 px-4 rounded-pill glass-chip-canvas backdrop-blur-md backdrop-saturate-150 transition-colors cursor-pointer font-sans text-[13px] font-semibold"
        >
          {kind === "voice" ? (
            <Microphone size={15} weight="bold" />
          ) : (
            <Scissors size={15} weight="bold" />
          )}
          {kind === "voice" ? "Record again" : "Trim"}
        </button>
      )}

      {mode === "text" && textToolEl}
      {mode === "sticker" && stickerTrayEl}
    </div>
  ) : kind === "text" ? (
    <div
      ref={stageRef}
      className={STAGE_FRAME}
      style={{ background: storyCanvasCss(bg) }}
    >
      {decorationLayers}
      {mode === "none" && toolRail}
      {mode === "none" && overlays.length === 0 && strokes.length === 0 && (
        <button
          type="button"
          onClick={() => {
            setEditingTextId(null);
            setMode("text");
          }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 cursor-text"
        >
          <span
            className={clsx(
              "font-editorial text-[34px] leading-none",
              bg.ink === "dark" ? "text-[#0c0a09]/45" : "text-[#fafaf9]/45",
            )}
          >
            Tap to write
          </span>
          <span
            className={clsx(
              "font-sans text-[11px]",
              bg.ink === "dark" ? "text-[#0c0a09]/35" : "text-[#fafaf9]/35",
            )}
          >
            Choose a typeface and a canvas
          </span>
        </button>
      )}
      {mode === "text" && textToolEl}
      {mode === "sticker" && stickerTrayEl}
    </div>
  ) : kind === "voice" ? (
    <div ref={stageRef} className={clsx(STAGE_FRAME, "bg-[#141110]")}>
      <VoiceRecorder background={bg} take={take} onTake={setTake} />
    </div>
  ) : (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className={clsx(
        STAGE_FRAME,
        "group flex flex-col items-center justify-center gap-3 bg-[#171412] hover:bg-[#1c1917] transition-colors cursor-pointer",
      )}
    >
      <span className="relative flex h-16 w-16 items-center justify-center rounded-pill glass-chip transition-colors">
        <Images size={26} weight="light" />
      </span>
      <span className="relative font-display text-[17px] font-semibold tracking-tight">
        Add photos and videos
      </span>
      <span className="relative font-sans text-[12px] glass-ink-faint">
        Select several to build a multi-slide story
      </span>
    </button>
  );

  /* ── Dock ─────────────────────────────────────────────────────────────── */

  // The voice canvas stays editable AFTER recording now — the picture is not
  // baked until Share.
  const showCanvasPicker = kind === "text" || kind === "voice";
  const showFilters = kind === "media" && !!file && !isVideo;
  const showCaption =
    kind === "media" ? slides.length > 0 : kind === "text" || !!take;

  const canvasPicker = (
    <DockSection label="Canvas">
      {/* Phone: one scrolling row so the dock stays short and the stage
          keeps its height. Desktop: a 3-up grid — designed meshes first,
          then the photographic backdrops. Selection is borderless: the
          chosen tile sits at full strength with a check badge while the
          rest recede. */}
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] lg:grid lg:grid-cols-3 lg:overflow-visible">
        {STORY_CANVASES.map((option) => {
          const active = bg.id === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => applyBackground(option)}
              aria-label={option.label}
              aria-pressed={active}
              className={clsx(
                "relative h-16 w-14 shrink-0 lg:w-auto rounded-[10px] overflow-hidden cursor-pointer transition-opacity",
                active ? "opacity-100" : "opacity-60 hover:opacity-90",
              )}
              style={
                option.kind === "mesh"
                  ? { background: storyCanvasCss(option) }
                  : undefined
              }
            >
              {option.kind === "photo" && (
                // biome-ignore lint/performance/noImgElement: remote CORS thumb; next/image needs domain config it shouldn't get for a picker tile.
                <img
                  src={option.thumb}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover bg-[#171412]"
                />
              )}
              {active && (
                <span
                  className={clsx(
                    "absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-pill",
                    option.ink === "dark"
                      ? "bg-[#0c0a09] text-[#fafaf9]"
                      : "bg-[#fafaf9] text-[#0c0a09]",
                  )}
                >
                  <Check size={11} weight="bold" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </DockSection>
  );

  const dock = (
    <>
      {showFilters && (
        <DockSection label="Filter">
          <PresetCarousel
            thumbUrl={thumbUrl}
            active={preset}
            onSelect={setPreset}
          />
        </DockSection>
      )}

      {showCanvasPicker && canvasPicker}

      {kind === "media" && slides.length > 0 && (
        <DockSection
          label={slides.length > 1 ? `Slides · ${slides.length}` : "Slides"}
        >
          {/* Every slide is directly editable: tap a tile to load it into
              the stage with its crop, filter and decorations intact. */}
          <div className="grid grid-cols-3 gap-2">
            {slides.map((slide, i) => {
              const active = slide.id === activeId;
              return (
                <div
                  key={slide.id}
                  className="relative aspect-[9/16] rounded-[10px] overflow-hidden group/slide"
                >
                  <button
                    type="button"
                    onClick={() => switchSlide(slide.id)}
                    aria-label={`Edit slide ${i + 1}`}
                    aria-pressed={active}
                    className="absolute inset-0 h-full w-full cursor-pointer"
                  >
                    {slide.file.type.startsWith("video/") ? (
                      <video
                        src={slide.url}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover bg-[#171412]"
                      />
                    ) : (
                      // biome-ignore lint/performance/noImgElement: object URLs can't go through the next/image loader.
                      <img
                        src={slide.url}
                        alt=""
                        className="h-full w-full object-cover bg-[#171412]"
                      />
                    )}
                    <span
                      className={clsx(
                        "absolute inset-0 transition-colors",
                        active
                          ? "bg-transparent"
                          : "bg-[#0c0a09]/55 group-hover/slide:bg-[#0c0a09]/25",
                      )}
                    />
                    <span
                      className={clsx(
                        "absolute bottom-1 left-1 flex h-4 min-w-4 items-center justify-center rounded-pill px-1 font-sans text-[9px] font-bold tabular-nums",
                        active
                          ? "bg-[#fafaf9] text-[#0c0a09]"
                          : "bg-[#0c0a09]/60 text-[#fafaf9]/80",
                      )}
                    >
                      {i + 1}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSlide(slide.id)}
                    aria-label={`Remove slide ${i + 1}`}
                    className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-pill bg-[#0c0a09]/65 text-[#fafaf9] opacity-0 group-hover/slide:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer"
                  >
                    <X size={10} weight="bold" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label="Add slides"
              className="flex aspect-[9/16] flex-col items-center justify-center gap-1 rounded-[10px] glass-card cursor-pointer"
            >
              <Plus size={16} weight="bold" className="glass-ink-dim" />
              <span className="font-sans text-[10px] glass-ink-dim">Add</span>
            </button>
          </div>
        </DockSection>
      )}

      {showCaption && (
        <DockSection
          label={
            kind === "media" && slides.length > 1
              ? `Caption · slide ${
                  slides.findIndex((slide) => slide.id === activeId) + 1
                }`
              : "Caption"
          }
        >
          <div className="rounded-xl glass-input px-3 py-2.5">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={CAPTION_MAX}
              rows={2}
              placeholder="Say something about it…"
              className="w-full bg-transparent outline-none resize-none font-sans text-[13px] leading-relaxed placeholder:text-[#fafaf9]/32"
            />
            <div className="flex justify-end">
              <span
                className={clsx(
                  "font-sans text-[11px] tabular-nums",
                  caption.length >= CAPTION_MAX
                    ? "text-danger"
                    : "glass-ink-faint",
                )}
                aria-live="polite"
              >
                {CAPTION_MAX - caption.length}
              </span>
            </div>
          </div>
          {/* Saves are the uploader's call. Off by default: a story is
              ephemeral unless its owner decides otherwise. */}
          <button
            type="button"
            onClick={() => setAllowSave((v) => !v)}
            aria-pressed={allowSave}
            className="mt-2 flex w-full cursor-pointer items-center gap-2.5 rounded-xl glass-input px-3 py-2.5 text-left transition-colors"
          >
            <span
              className={clsx(
                "relative h-5 w-9 shrink-0 rounded-pill transition-colors",
                allowSave ? "bg-brand" : "bg-[#fafaf9]/20",
              )}
            >
              <span
                className={clsx(
                  "absolute top-0.5 h-4 w-4 rounded-pill bg-[#fafaf9] transition-all",
                  allowSave ? "left-[18px]" : "left-0.5",
                )}
              />
            </span>
            <span className="min-w-0">
              <span className="block font-sans text-[12.5px] font-semibold">
                Allow saves
              </span>
              <span className="block font-sans text-[11px] glass-ink-faint">
                People can download this story for $1.
              </span>
            </span>
          </button>
        </DockSection>
      )}

      <div className="mt-auto space-y-2 pt-1">
        {kind === "media" && slides.length === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full h-12 items-center justify-center gap-2 rounded-pill glass-cta font-sans font-semibold text-[14px] transition-colors cursor-pointer active:brightness-95"
          >
            <Images size={16} weight="bold" />
            Choose media
          </button>
        ) : (
          <button
            type="button"
            onClick={handleShare}
            disabled={posting || !canShare}
            className="flex w-full h-12 items-center justify-center gap-2 rounded-pill glass-cta font-sans font-semibold text-[14px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:brightness-95"
          >
            {posting ? (
              <span className="w-4 h-4 border-2 border-[#0c0a09]/25 border-t-[#0c0a09] rounded-pill animate-spin" />
            ) : (
              <PaperPlaneTilt size={16} weight="bold" />
            )}
            {posting && kind === "voice" && !postLabel
              ? `Composing ${Math.round(renderPct * 100)}%`
              : posting && postLabel
                ? postLabel
                : kind === "media" && slides.length > 1
                  ? `Share ${slides.length} slides`
                  : "Share to your story"}
          </button>
        )}
        <p className="text-center font-sans text-[11px] glass-ink-faint">
          {kind === "voice" && !take
            ? "Record a note to continue"
            : kind === "voice" && posting
              ? "Composing your voice note in real time"
              : "Disappears after 24 hours"}
        </p>
      </div>
    </>
  );

  return (
    <ConfirmModalPortal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: EASE }}
        className="fixed inset-0 z-modal glass-veil backdrop-blur-lg backdrop-saturate-150 glass-ink flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={TITLES[kind]}
      >
        <header className="shrink-0 flex items-center gap-3 px-4 sm:px-6 h-14 sm:h-16">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close story studio"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill glass-chip transition-colors cursor-pointer"
          >
            <X size={17} weight="bold" />
          </button>
          <div className="min-w-0">
            <span className="glass-eyebrow font-sans block leading-none">
              Story
            </span>
            <h2 className="font-display text-[15px] sm:text-[17px] font-semibold tracking-tight truncate mt-1 leading-none">
              {TITLES[kind]}
            </h2>
          </div>
        </header>

        <div className="flex-1 min-h-0 w-full max-w-[1140px] mx-auto px-4 sm:px-6 pb-4 sm:pb-6 flex flex-col lg:flex-row lg:items-stretch gap-4 lg:gap-8">
          <motion.div
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.99 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.32,
              ease: EASE,
              delay: reduce ? 0 : 0.04,
            }}
            className="flex-1 min-h-0 flex items-center justify-center"
          >
            {stage}
          </motion.div>

          <motion.aside
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.32,
              ease: EASE,
              delay: reduce ? 0 : 0.12,
            }}
            // Baseline-aligned to the stage rather than stretched: the dock
            // hugs its sections and its CTA lands on the stage's bottom edge,
            // so a two-section text story doesn't leave a void down the panel.
            className="shrink-0 w-full max-h-[46vh] lg:max-h-full lg:w-[336px] lg:self-end glass-dock backdrop-blur-xl backdrop-saturate-150 rounded-2xl p-4 sm:p-5 flex flex-col gap-5 overflow-y-auto [scrollbar-width:none]"
          >
            {dock}
          </motion.aside>
        </div>

        <input
          type="file"
          ref={inputRef}
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={handlePick}
        />

        {trimOpen && file && isVideo && (
          <VideoEditor
            file={file}
            onClose={() => setTrimOpen(false)}
            onSave={(edited) => {
              replaceActiveFile(edited);
              setTrimOpen(false);
            }}
          />
        )}
      </motion.div>
    </ConfirmModalPortal>
  );
}
