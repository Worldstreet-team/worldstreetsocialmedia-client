/**
 * Filters & adjustments — one source of truth for both legs of the preview/
 * export split:
 *
 * - Live preview: a CSS `filter` string (free, 60fps).
 * - Export: a composed color matrix applied per-pixel on canvas ImageData.
 *
 * The two stay pixel-equivalent because every operation here is one of the
 * CSS Filter Effects spec's own primitives (brightness/contrast/saturate/
 * sepia/hue-rotate), each of which the spec defines as a color matrix — the
 * export composes exactly the matrices the CSS string names, in the same
 * order. This is also why export must NOT use ctx.filter: it's still
 * disabled in stable Safari (2026), so we do the matrix ourselves.
 *
 * "Warmth" has no CSS primitive; warm = partial sepia, cool = the
 * hue-rotate(180°) · sepia(a) · hue-rotate(180°) sandwich (an "inverse
 * sepia" that casts blue) — both expressible in CSS and as matrices.
 *
 * Presets are named bundles of the same adjustment values (finance-native
 * looks per the Studio blueprint); the user's sliders stack on top.
 */

import type { Adjustments, PresetId } from "./document";

export interface Preset {
  id: PresetId;
  label: string;
  adjustments: Partial<Adjustments>;
  /** 0..1 — Ticker's mono comes from this, not from saturation -100. */
  grayscale?: number;
  /** Film-grain pass at export (echoes the dark theme's body texture). */
  grain?: boolean;
}

export const PRESETS: Preset[] = [
  {
    id: "gold-rush",
    label: "Gold Rush",
    adjustments: { warmth: 45, saturation: 8, brightness: 4, contrast: 6 },
  },
  {
    id: "bull-run",
    label: "Bull Run",
    adjustments: { contrast: 25, saturation: 30 },
  },
  {
    id: "after-hours",
    label: "After Hours",
    adjustments: { brightness: -8, saturation: -35, contrast: 10, warmth: -25 },
  },
  {
    id: "ticker",
    label: "Ticker",
    adjustments: { contrast: 35 },
    grayscale: 1,
  },
  {
    id: "paper",
    label: "Paper",
    adjustments: { brightness: 12, contrast: -18, saturation: -18, warmth: 10 },
  },
  {
    id: "grain",
    label: "Grain",
    adjustments: { saturation: -12, contrast: 8 },
    grain: true,
  },
];

export const getPreset = (id: PresetId | null): Preset | null =>
  id ? (PRESETS.find((p) => p.id === id) ?? null) : null;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** Preset values + user sliders, clamped back into slider range. */
export function effectiveAdjustments(
  user: Adjustments,
  presetId: PresetId | null,
): Adjustments {
  const preset = getPreset(presetId)?.adjustments ?? {};
  return {
    brightness: clamp(user.brightness + (preset.brightness ?? 0), -100, 100),
    contrast: clamp(user.contrast + (preset.contrast ?? 0), -100, 100),
    saturation: clamp(user.saturation + (preset.saturation ?? 0), -100, 100),
    warmth: clamp(user.warmth + (preset.warmth ?? 0), -100, 100),
  };
}

/* Slider-value → filter-amount mappings (shared by CSS and matrix legs). */
const brightnessAmount = (v: number) => 1 + (v / 100) * 0.5;
const contrastAmount = (v: number) => 1 + (v / 100) * 0.5;
const saturateAmount = (v: number) => 1 + (v / 100) * 0.75;
const warmthSepiaAmount = (v: number) => (Math.abs(v) / 100) * 0.4;

/** The CSS `filter` value for live previews. Empty string = identity. */
export function cssFilterFor(
  adjustments: Adjustments,
  presetId: PresetId | null,
): string {
  const a = effectiveAdjustments(adjustments, presetId);
  const grayscale = getPreset(presetId)?.grayscale ?? 0;
  const parts: string[] = [];
  if (grayscale > 0) parts.push(`grayscale(${grayscale})`);
  if (a.brightness !== 0)
    parts.push(`brightness(${brightnessAmount(a.brightness).toFixed(3)})`);
  if (a.contrast !== 0)
    parts.push(`contrast(${contrastAmount(a.contrast).toFixed(3)})`);
  if (a.saturation !== 0)
    parts.push(`saturate(${saturateAmount(a.saturation).toFixed(3)})`);
  if (a.warmth > 0) {
    parts.push(`sepia(${warmthSepiaAmount(a.warmth).toFixed(3)})`);
  } else if (a.warmth < 0) {
    parts.push(
      `hue-rotate(180deg) sepia(${warmthSepiaAmount(a.warmth).toFixed(3)}) hue-rotate(180deg)`,
    );
  }
  return parts.join(" ");
}

/* ── Color-matrix leg ─────────────────────────────────────────────────────
   3×3 RGB matrix + offset vector, values in 0..1 space. Composition order
   matches the CSS filter list above (left-to-right application). */

interface ColorOp {
  m: number[]; // row-major 3×3
  o: [number, number, number];
}

const identityOp = (): ColorOp => ({
  m: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  o: [0, 0, 0],
});

const scaleOp = (s: number): ColorOp => ({
  m: [s, 0, 0, 0, s, 0, 0, 0, s],
  o: [0, 0, 0],
});

/** contrast(c): slope c, intercept 0.5·(1−c) — per the filter-effects spec. */
const contrastOp = (c: number): ColorOp => ({
  m: [c, 0, 0, 0, c, 0, 0, 0, c],
  o: [0.5 * (1 - c), 0.5 * (1 - c), 0.5 * (1 - c)],
});

/* Rec.709 luminance weights, as used by the spec's saturate/hue matrices. */
const LR = 0.2126;
const LG = 0.7152;
const LB = 0.0722;

const saturateOp = (s: number): ColorOp => ({
  m: [
    LR + (1 - LR) * s,
    LG * (1 - s),
    LB * (1 - s),
    LR * (1 - s),
    LG + (1 - LG) * s,
    LB * (1 - s),
    LR * (1 - s),
    LG * (1 - s),
    LB + (1 - LB) * s,
  ],
  o: [0, 0, 0],
});

const SEPIA = [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131];

const sepiaOp = (a: number): ColorOp => {
  const id = identityOp().m;
  return {
    m: id.map((v, i) => v + (SEPIA[i] - v) * a),
    o: [0, 0, 0],
  };
};

const hueRotateOp = (deg: number): ColorOp => {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    m: [
      LR + cos * (1 - LR) + sin * -LR,
      LG + cos * -LG + sin * -LG,
      LB + cos * -LB + sin * (1 - LB),
      LR + cos * -LR + sin * 0.143,
      LG + cos * (1 - LG) + sin * 0.14,
      LB + cos * -LB + sin * -0.283,
      LR + cos * -LR + sin * -(1 - LR),
      LG + cos * -LG + sin * LG,
      LB + cos * (1 - LB) + sin * LB,
    ],
    o: [0, 0, 0],
  };
};

/**
 * The ordered color ops for export, or null when everything is identity.
 * Deliberately NOT composed into one matrix: CSS clamps each filter
 * primitive's output to [0,1] before the next primitive runs, so the export
 * must apply the ops as sequential passes with the same clamping (the 8-bit
 * write-back between passes provides it) — a single composed matrix
 * diverges from the live preview whenever an intermediate overflows, e.g.
 * brightness up followed by contrast down.
 */
export function colorOpsFor(
  adjustments: Adjustments,
  presetId: PresetId | null,
): ColorOp[] | null {
  const a = effectiveAdjustments(adjustments, presetId);
  const grayscale = getPreset(presetId)?.grayscale ?? 0;
  const ops: ColorOp[] = [];
  if (grayscale > 0) ops.push(saturateOp(1 - grayscale));
  if (a.brightness !== 0) ops.push(scaleOp(brightnessAmount(a.brightness)));
  if (a.contrast !== 0) ops.push(contrastOp(contrastAmount(a.contrast)));
  if (a.saturation !== 0) ops.push(saturateOp(saturateAmount(a.saturation)));
  if (a.warmth > 0) {
    ops.push(sepiaOp(warmthSepiaAmount(a.warmth)));
  } else if (a.warmth < 0) {
    ops.push(hueRotateOp(180));
    ops.push(sepiaOp(warmthSepiaAmount(a.warmth)));
    ops.push(hueRotateOp(180));
  }
  return ops.length > 0 ? ops : null;
}

export type { ColorOp };

/* ── Grain ────────────────────────────────────────────────────────────────
   A tileable noise square, drawn once and reused: as a repeated background
   for the live preview overlay, and pattern-filled with `overlay` blending
   at export. */

export const GRAIN_TILE = 128;
export const GRAIN_ALPHA = 0.28;

let grainCanvas: HTMLCanvasElement | null = null;

export function getGrainTile(): HTMLCanvasElement {
  if (grainCanvas) return grainCanvas;
  const canvas = document.createElement("canvas");
  canvas.width = GRAIN_TILE;
  canvas.height = GRAIN_TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  const image = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 128 + Math.round((Math.random() - 0.5) * 90);
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  grainCanvas = canvas;
  return canvas;
}

let grainUrl: string | null = null;

export function getGrainTileUrl(): string {
  // Cached: a fresh toDataURL per call would re-encode the tile and hand
  // each overlay a distinct string, defeating the browser's image cache.
  grainUrl ??= getGrainTile().toDataURL("image/png");
  return grainUrl;
}
