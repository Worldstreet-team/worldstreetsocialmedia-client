"use client";

import clsx from "clsx";
import { Check, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  STROKE_COLORS,
  STROKE_WIDTH_FRACTION,
  type Stroke,
} from "@/lib/editor/overlays";

interface DrawLayerProps {
  strokes: Stroke[];
  /** Drawing mode: layer captures the pointer; otherwise render-only. */
  active: boolean;
  onCommitStroke: (stroke: Stroke) => void;
  onUndo: () => void;
  onDone: () => void;
}

/**
 * Freehand draw layer. Points are stored normalized (0..1 of the stage),
 * smoothed through quadratic midpoints — the exact path the export
 * compositor replays, so the posted line is the drawn line. Always mounted
 * so committed strokes stay visible under the other tools; interactive
 * only in draw mode.
 */
export default function DrawLayer({
  strokes,
  active,
  onCommitStroke,
  onUndo,
  onDone,
}: DrawLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const liveStrokeRef = useRef<Stroke | null>(null);
  const [color, setColor] = useState(STROKE_COLORS[0]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const all = liveStrokeRef.current
      ? [...strokes, liveStrokeRef.current]
      : strokes;
    for (const stroke of all) {
      drawStrokePath(ctx, canvas.width, canvas.height, stroke);
    }
  }, [strokes]);

  // Keep the canvas buffer matched to the stage size (device pixels).
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const sync = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      redraw();
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [redraw]);

  // Repaint when committed strokes change (redraw's identity tracks them).
  useEffect(() => {
    redraw();
  }, [redraw]);

  const normalizedPoint = (e: React.PointerEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = normalizedPoint(e);
    if (!point) return;
    liveStrokeRef.current = {
      points: [point],
      color,
      width: STROKE_WIDTH_FRACTION,
    };
    redraw();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const live = liveStrokeRef.current;
    if (!active || !live) return;
    const point = normalizedPoint(e);
    if (!point) return;
    live.points.push(point);
    redraw();
  };

  const handlePointerUp = () => {
    const live = liveStrokeRef.current;
    if (!live) return;
    liveStrokeRef.current = null;
    if (live.points.length > 1) onCommitStroke(live);
    else redraw();
  };

  return (
    <>
      <div
        ref={wrapRef}
        className={clsx(
          "absolute inset-0",
          active ? "z-20" : "pointer-events-none",
        )}
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
      {active && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-2 px-3 py-2 pb-safe">
          <div className="flex items-center gap-1">
            {STROKE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Draw color ${c}`}
                aria-pressed={color === c}
                className="flex h-10 w-10 items-center justify-center cursor-pointer"
              >
                <span
                  className={clsx(
                    "block h-6 w-6 rounded-pill border-2 transition-colors",
                    color === c ? "border-gold" : "border-hairline",
                  )}
                  style={{ background: c }}
                />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onUndo}
              disabled={strokes.length === 0}
              aria-label="Undo last stroke"
              className="flex h-10 w-10 items-center justify-center rounded-pill bg-scrim text-primary hover:bg-raised transition-colors disabled:opacity-40 cursor-pointer"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onDone}
              className="flex items-center gap-2 bg-brand text-brand-on px-5 h-11 sm:h-9 rounded-pill font-semibold text-sm hover:bg-brand-active transition-colors font-sans cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Same smoothing the export uses (overlays.ts drawStroke). */
function drawStrokePath(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  stroke: Stroke,
) {
  const pts = stroke.points;
  if (pts.length === 0) return;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = Math.max(1, stroke.width * w);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0].x * w, pts[0].y * h);
  if (pts.length < 3) {
    for (const p of pts) ctx.lineTo(p.x * w, p.y * h);
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = ((pts[i].x + pts[i + 1].x) / 2) * w;
      const midY = ((pts[i].y + pts[i + 1].y) / 2) * h;
      ctx.quadraticCurveTo(pts[i].x * w, pts[i].y * h, midX, midY);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x * w, last.y * h);
  }
  ctx.stroke();
}
