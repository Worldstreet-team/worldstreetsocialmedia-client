"use client";

import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import {
  CASHTAG_COLORS,
  CASHTAG_SIZE_FRACTION,
  EMOJI_SIZE_FRACTION,
  fontFamilyFor,
  fontWeightFor,
  type Overlay,
  type OverlayFonts,
  PILL_PAD_X,
  PILL_PAD_Y,
  PILL_RADIUS,
  TEXT_COLORS,
  TEXT_LINE_HEIGHT,
  TEXT_SIZE_FRACTION,
  TICKER_COLORS,
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
}

const TRASH_RADIUS = 44;

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
    e: React.PointerEvent<HTMLDivElement>,
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
    if (g.pointers.size === 1) {
      const dx = (e.clientX - prev.x) / rect.width;
      const dy = (e.clientY - prev.y) / rect.height;
      onChange(overlay.id, {
        x: Math.min(1.05, Math.max(-0.05, overlay.x + dx)),
        y: Math.min(1.05, Math.max(-0.05, overlay.y + dy)),
      });
      updateTrashHover(e.clientX, e.clientY);
    } else if (g.pointers.size === 2 && g.startDist > 0) {
      const [a, b] = [...g.pointers.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      onChange(overlay.id, {
        scale: Math.min(6, Math.max(0.3, g.startScale * (dist / g.startDist))),
        rotation: g.startRotation + ((angle - g.startAngle) * 180) / Math.PI,
      });
    }
  };

  const handlePointerUp = (
    e: React.PointerEvent<HTMLDivElement>,
    overlay: Overlay,
  ) => {
    const g = gestureRef.current;
    if (!g || g.id !== overlay.id) return;
    g.pointers.delete(e.pointerId);
    if (g.pointers.size > 0) return; // other finger still down
    gestureRef.current = null;
    setDraggingId(null);
    setOverTrash(false);

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
      const fontPx = TEXT_SIZE_FRACTION * stageW * overlay.scale;
      const ticker = overlay.style === "ticker";
      const colors = ticker ? TICKER_COLORS : TEXT_COLORS[overlay.color];
      const pill = ticker || overlay.pill;
      content = (
        <div
          style={{
            fontFamily: fontFamilyFor(overlay.style, fonts),
            fontWeight: fontWeightFor(overlay.style),
            fontSize: fontPx,
            lineHeight: TEXT_LINE_HEIGHT,
            color: colors.text,
            textAlign: "center",
            whiteSpace: "pre",
            background: pill ? colors.pill : undefined,
            padding: pill
              ? `${fontPx * PILL_PAD_Y}px ${fontPx * PILL_PAD_X}px`
              : undefined,
            borderRadius: pill ? fontPx * PILL_RADIUS : undefined,
            fontVariantNumeric: ticker ? "tabular-nums" : undefined,
          }}
        >
          {overlay.text}
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
        className="absolute select-none touch-none"
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
      </div>
    );
  };

  return (
    <div
      ref={stageElRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
    >
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
