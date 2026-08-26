"use client";

import { ArrowUUpLeft, Check, Eraser, Trash } from "@phosphor-icons/react";
import clsx from "clsx";
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
  onClear: () => void;
  onDone: () => void;
}

/** Nib sizes, as multiples of the base stroke width. */
const NIBS = [
  { id: "fine", label: "Fine", factor: 0.45 },
  { id: "medium", label: "Medium", factor: 1 },
  { id: "bold", label: "Bold", factor: 2.1 },
  { id: "marker", label: "Marker", factor: 4 },
] as const;

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
  onClear,
  onDone,
}: DrawLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const liveStrokeRef = useRef<Stroke | null>(null);
  const [color, setColor] = useState(STROKE_COLORS[0]);
  const [nib, setNib] = useState<(typeof NIBS)[number]["id"]>("medium");
  const [erasing, setErasing] = useState(false);
  const factor = NIBS.find((n) => n.id === nib)?.factor ?? 1;

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
      // The eraser is a stroke like any other — it just composites out. The
      // export leg reads the same flag, so an erased line stays erased.
      color,
      width: STROKE_WIDTH_FRACTION * factor * (erasing ? 1.6 : 1),
      erase: erasing || undefined,
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
        <div className="absolute inset-x-0 bottom-0 z-20 space-y-1.5 px-3 py-2 pb-safe">
          {/* Nibs — each dot is drawn at its own true relative weight. */}
          <div className="flex items-center justify-center gap-1">
            {NIBS.map((option) => {
              const on = nib === option.id && !erasing;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setNib(option.id);
                    setErasing(false);
                  }}
                  aria-label={`${option.label} nib`}
                  aria-pressed={on}
                  className={clsx(
                    "flex h-9 w-9 items-center justify-center rounded-pill transition-colors cursor-pointer",
                    on ? "glass-chip-active" : "glass-chip backdrop-blur-md",
                  )}
                >
                  <span
                    className="block rounded-pill"
                    style={{
                      width: Math.min(20, 5 + option.factor * 3.4),
                      height: Math.min(20, 5 + option.factor * 3.4),
                      background: on ? "#0c0a09" : color,
                    }}
                  />
                </button>
              );
            })}
            <span className="mx-0.5 h-5 w-px bg-[#fafaf9]/12" />
            <button
              type="button"
              onClick={() => setErasing((v) => !v)}
              aria-label="Eraser"
              aria-pressed={erasing}
              className={clsx(
                "flex h-9 w-9 items-center justify-center rounded-pill transition-colors cursor-pointer",
                erasing ? "glass-chip-active" : "glass-chip backdrop-blur-md",
              )}
            >
              <Eraser size={15} weight="bold" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-0.5">
              {STROKE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(c);
                    setErasing(false);
                  }}
                  aria-label={`Draw color ${c}`}
                  aria-pressed={color === c && !erasing}
                  className={clsx(
                    "flex h-9 w-9 items-center justify-center cursor-pointer transition-opacity",
                    color === c && !erasing
                      ? "opacity-100"
                      : "opacity-55 hover:opacity-90",
                  )}
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-pill shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
                    style={{ background: c }}
                  >
                    {color === c && !erasing && (
                      <Check
                        size={11}
                        weight="bold"
                        style={{
                          color: c === "#0C0A09" ? "#fafaf9" : "#0c0a09",
                        }}
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onUndo}
                disabled={strokes.length === 0}
                aria-label="Undo last stroke"
                className="flex h-9 w-9 items-center justify-center rounded-pill glass-chip backdrop-blur-md transition-colors disabled:opacity-40 cursor-pointer"
              >
                <ArrowUUpLeft size={15} weight="bold" />
              </button>
              <button
                type="button"
                onClick={onClear}
                disabled={strokes.length === 0}
                aria-label="Clear all strokes"
                className="flex h-9 w-9 items-center justify-center rounded-pill glass-chip backdrop-blur-md transition-colors disabled:opacity-40 cursor-pointer"
              >
                <Trash size={15} weight="bold" />
              </button>
              <button
                type="button"
                onClick={onDone}
                className="flex items-center gap-2 glass-cta px-4 h-9 rounded-pill font-semibold text-[13px] transition-colors font-sans cursor-pointer"
              >
                <Check size={15} weight="bold" />
                Done
              </button>
            </div>
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
  ctx.save();
  if (stroke.erase) ctx.globalCompositeOperation = "destination-out";
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
  ctx.restore();
}
