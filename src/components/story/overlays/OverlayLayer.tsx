"use client";

import { ArrowsOutSimple } from "@phosphor-icons/react";
import clsx from "clsx";
import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import TextBlock from "@/components/story/overlays/TextBlock";
import {
  CASHTAG_COLORS,
  CASHTAG_SIZE_FRACTION,
  EMOJI_SIZE_FRACTION,
  MENTION_COLORS,
  MENTION_SIZE_FRACTION,
  type Overlay,
  type OverlayFonts,
  PILL_PAD_X,
  PILL_PAD_Y,
  TEXT_SIZE_FRACTION,
} from "@/lib/editor/overlays";

interface OverlayLayerProps {
  overlays: Overlay[];
  /** Stage width in CSS px — the preview's scale reference. */
  stageW: number;
  fonts: OverlayFonts;
  /** False while the draw layer owns the pointer. */
  interactive: boolean;
  onChange: (id: string, patch: Partial<Overlay>) => void;
  onDelete: (id: string) => void;
  onEditText: (id: string) => void;
}

interface GestureState {
  id: string;
  pointers: Map<number, { x: number; y: number }>;
  startX: number;
  startY: number;
  startScale: number;
  startRotation: number;
  startDist: number;
  startAngle: number;
  moved: boolean;
  startedAt: number;
  /** Set when the drag began on the transform grip (mouse scale + rotate). */
  transforming?: boolean;
}

const TRASH_RADIUS = 44;

/** Guides the canvas snaps to, in normalized stage coordinates. */
const SNAP_X = [0.5];
const SNAP_Y = [0.25, 0.5, 0.75];
/** How close (in stage fractions) a drag must get before it locks on. */
const SNAP_RANGE = 0.018;
/** Rotation detents, in degrees. */
const SNAP_ANGLES = [0, 90, 180, 270, -90, -180, -270];
const SNAP_ANGLE_RANGE = 6;

function snapTo(value: number, targets: number[], range: number) {
  for (const target of targets) {
    if (Math.abs(value - target) < range) return { value: target, hit: target };
  }
  return { value, hit: null as number | null };
}

/**
 * The direct-manipulation layer over the story canvas: one-finger drag,
 * two-finger pinch + rotate, tap a text overlay to re-edit, drag toward
 * the bottom-center trash to delete — the Instagram gesture grammar.
 *
 * Every metric comes from the same fractions the export compositor uses
 * (overlays.ts), keyed off the live stage width, so what's dragged into
 * place here is where it lands in the 1080×1920 file.
 */
export default function OverlayLayer({
  overlays,
  stageW,
  fonts,
  interactive,
  onChange,
  onDelete,
  onEditText,
}: OverlayLayerProps) {
  const gestureRef = useRef<GestureState | null>(null);
  const stageElRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overTrash, setOverTrash] = useState(false);
  // Which guides the active drag is currently locked to, so they can be drawn.
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  });

  const trashCenter = () => {
    const el = stageElRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.bottom - 56 };
  };

  const updateTrashHover = (clientX: number, clientY: number) => {
    const trash = trashCenter();
    if (!trash) return false;
    const within =
      Math.hypot(clientX - trash.x, clientY - trash.y) < TRASH_RADIUS;
    setOverTrash(within);
    return within;
  };

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    overlay: Overlay,
  ) => {
    if (!interactive) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const g = gestureRef.current;
    if (g && g.id === overlay.id) {
      g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (g.pointers.size === 2) {
        const [a, b] = [...g.pointers.values()];
        g.startDist = Math.hypot(b.x - a.x, b.y - a.y);
        g.startAngle = Math.atan2(b.y - a.y, b.x - a.x);
        g.startScale = overlay.scale;
        g.startRotation = overlay.rotation;
      }
      return;
    }
    gestureRef.current = {
      id: overlay.id,
      pointers: new Map([[e.pointerId, { x: e.clientX, y: e.clientY }]]),
      startX: overlay.x,
      startY: overlay.y,
      startScale: overlay.scale,
      startRotation: overlay.rotation,
      startDist: 0,
      startAngle: 0,
      moved: false,
      startedAt: performance.now(),
    };
    setDraggingId(overlay.id);
  };

  const handlePointerMove = (
    e: React.PointerEvent<Element>,
    overlay: Overlay,
  ) => {
    const g = gestureRef.current;
    const stage = stageElRef.current;
    if (!g || g.id !== overlay.id || !stage || !g.pointers.has(e.pointerId))
      return;
    const prev = g.pointers.get(e.pointerId);
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!prev) return;
    if (Math.hypot(e.clientX - prev.x, e.clientY - prev.y) > 2) g.moved = true;

    const rect = stage.getBoundingClientRect();
    if (g.transforming) {
      // Mouse/single-pointer transform: distance from the overlay's centre
      // drives scale, bearing drives rotation — the standard corner-grip.
      const cx = rect.left + overlay.x * rect.width;
      const cy = rect.top + overlay.y * rect.height;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
      const raw = g.startRotation + ((angle - g.startAngle) * 180) / Math.PI;
      const snappedAngle = snapTo(
        ((raw + 540) % 360) - 180,
        SNAP_ANGLES,
        SNAP_ANGLE_RANGE,
      );
      onChange(overlay.id, {
        scale:
          g.startDist > 0
            ? Math.min(6, Math.max(0.3, g.startScale * (dist / g.startDist)))
            : overlay.scale,
        rotation: snappedAngle.value,
      });
      return;
    }
    if (g.pointers.size === 1) {
      const dx = (e.clientX - prev.x) / rect.width;
      const dy = (e.clientY - prev.y) / rect.height;
      // Snap to the canvas centre line and the horizontal thirds, and show
      // the guide that caught — the same grammar as a design tool.
      const nextX = snapTo(
        Math.min(1.05, Math.max(-0.05, overlay.x + dx)),
        SNAP_X,
        SNAP_RANGE,
      );
      const nextY = snapTo(
        Math.min(1.05, Math.max(-0.05, overlay.y + dy)),
        SNAP_Y,
        SNAP_RANGE,
      );
      setGuides({ x: nextX.hit, y: nextY.hit });
      onChange(overlay.id, { x: nextX.value, y: nextY.value });
      updateTrashHover(e.clientX, e.clientY);
    } else if (g.pointers.size === 2 && g.startDist > 0) {
      const [a, b] = [...g.pointers.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const raw = g.startRotation + ((angle - g.startAngle) * 180) / Math.PI;
      onChange(overlay.id, {
        scale: Math.min(6, Math.max(0.3, g.startScale * (dist / g.startDist))),
        rotation: snapTo(
          ((raw + 540) % 360) - 180,
          SNAP_ANGLES,
          SNAP_ANGLE_RANGE,
        ).value,
      });
    }
  };

  const handlePointerUp = (
    e: React.PointerEvent<Element>,
    overlay: Overlay,
  ) => {
    const g = gestureRef.current;
    if (!g || g.id !== overlay.id) return;
    g.pointers.delete(e.pointerId);
    if (g.pointers.size > 0) return; // other finger still down
    gestureRef.current = null;
    setDraggingId(null);
    setOverTrash(false);
    setGuides({ x: null, y: null });
    if (g.transforming) return;

    if (updateTrashHover(e.clientX, e.clientY) && g.moved) {
      setOverTrash(false);
      onDelete(overlay.id);
      return;
    }
    const quickTap = !g.moved && performance.now() - g.startedAt < 300;
    if (quickTap && overlay.kind === "text") onEditText(overlay.id);
  };

  const renderOverlay = (overlay: Overlay) => {
    let content: React.ReactNode;
    if (overlay.kind === "text") {
      // Same component the editor renders, so placing changes nothing.
      content = (
        <TextBlock
          text={overlay.text}
          style={overlay.style}
          pill={overlay.pill}
          color={overlay.color}
          fontPx={TEXT_SIZE_FRACTION * stageW * overlay.scale}
          fonts={fonts}
        />
      );
    } else if (overlay.kind === "mention") {
      const fontPx = MENTION_SIZE_FRACTION * stageW * overlay.scale;
      content = (
        <div
          style={{
            fontFamily: fonts.ui,
            fontWeight: 700,
            fontSize: fontPx,
            lineHeight: 1,
            color: MENTION_COLORS.text,
            background: MENTION_COLORS.pill,
            padding: `${fontPx * PILL_PAD_Y}px ${fontPx * PILL_PAD_X}px`,
            borderRadius: 999,
            whiteSpace: "nowrap",
          }}
        >
          @{overlay.username}
        </div>
      );
    } else if (overlay.kind === "cashtag") {
      const fontPx = CASHTAG_SIZE_FRACTION * stageW * overlay.scale;
      content = (
        <div
          style={{
            fontFamily: fonts.mono,
            fontWeight: 600,
            fontSize: fontPx,
            lineHeight: 1,
            color: CASHTAG_COLORS.text,
            background: CASHTAG_COLORS.pill,
            border: `${Math.max(1, fontPx * 0.06)}px solid ${CASHTAG_COLORS.border}`,
            padding: `${fontPx * PILL_PAD_Y}px ${fontPx * PILL_PAD_X}px`,
            borderRadius: 999,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          ${overlay.symbol}
        </div>
      );
    } else {
      const fontPx = EMOJI_SIZE_FRACTION * stageW * overlay.scale;
      content = (
        <div style={{ fontSize: fontPx, lineHeight: 1 }}>{overlay.emoji}</div>
      );
    }

    return (
      <div
        key={overlay.id}
        className="absolute select-none touch-none group/ov"
        style={{
          left: `${overlay.x * 100}%`,
          top: `${overlay.y * 100}%`,
          transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg)`,
          pointerEvents: interactive ? "auto" : "none",
          cursor: interactive ? "grab" : undefined,
          opacity: draggingId === overlay.id && overTrash ? 0.5 : 1,
        }}
        onPointerDown={(e) => handlePointerDown(e, overlay)}
        onPointerMove={(e) => handlePointerMove(e, overlay)}
        onPointerUp={(e) => handlePointerUp(e, overlay)}
        onPointerCancel={(e) => handlePointerUp(e, overlay)}
      >
        {content}
        {/* Corner grip: scale + rotate for anyone without two fingers. It
            only appears while this overlay is the one being touched, or on
            hover, so it never litters the canvas. */}
        {interactive && (
          <button
            type="button"
            aria-label="Resize and rotate"
            onPointerDown={(e) => {
              e.stopPropagation();
              const stage = stageElRef.current;
              if (!stage) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              const rect = stage.getBoundingClientRect();
              const cx = rect.left + overlay.x * rect.width;
              const cy = rect.top + overlay.y * rect.height;
              gestureRef.current = {
                id: overlay.id,
                pointers: new Map([
                  [e.pointerId, { x: e.clientX, y: e.clientY }],
                ]),
                startX: overlay.x,
                startY: overlay.y,
                startScale: overlay.scale,
                startRotation: overlay.rotation,
                startDist: Math.hypot(e.clientX - cx, e.clientY - cy),
                startAngle: Math.atan2(e.clientY - cy, e.clientX - cx),
                moved: false,
                startedAt: performance.now(),
                transforming: true,
              };
              setDraggingId(overlay.id);
            }}
            onPointerMove={(e) => {
              e.stopPropagation();
              handlePointerMove(e, overlay);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              handlePointerUp(e, overlay);
            }}
            onPointerCancel={(e) => {
              e.stopPropagation();
              handlePointerUp(e, overlay);
            }}
            className={clsx(
              "absolute -bottom-3 -right-3 flex h-7 w-7 items-center justify-center rounded-pill bg-[#fafaf9] text-[#0c0a09] shadow-[0_2px_10px_rgba(0,0,0,0.5)] transition-opacity cursor-nwse-resize touch-none",
              draggingId === overlay.id
                ? "opacity-100"
                : "opacity-0 group-hover/ov:opacity-100 focus-visible:opacity-100",
            )}
          >
            <ArrowsOutSimple size={13} weight="bold" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      ref={stageElRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
    >
      {/* Alignment guides — only while a drag is actually locked on. */}
      {guides.x !== null && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 w-px bg-brand"
          style={{ left: `${guides.x * 100}%` }}
        />
      )}
      {guides.y !== null && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 h-px bg-brand"
          style={{ top: `${guides.y * 100}%` }}
        />
      )}
      {overlays.map(renderOverlay)}
      {draggingId && (
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex h-12 w-12 items-center justify-center rounded-pill bg-scrim text-primary transition-colors"
          style={overTrash ? { color: "#EF4444" } : undefined}
          aria-hidden
        >
          <Trash2 className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}
