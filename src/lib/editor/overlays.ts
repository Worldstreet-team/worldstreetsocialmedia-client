/**
 * Story overlays — text, cashtag chips, emoji stickers, and draw strokes.
 *
 * One module owns both halves of the parity contract:
 * - the METRICS (size/pad/radius as fractions of canvas width, coordinates
 *   normalized 0..1) that the DOM preview computes from the stage width, and
 * - the CANVAS compositor that draws the same overlays into the 1080×1920
 *   export.
 * Because both sides derive every pixel from the same fractions, the posted
 * story matches the editor preview by construction.
 *
 * Colors here are deliberate literals, not classes: they are canvas paint
 * over a photo (theme-independent) and mirror the token values — gold
 * #EAB308 (brand), #FAFAF9 / #0C0A09 (ink/paper), #EF4444 / #10B981
 * (status danger/success).
 */

/**
 * The five story voices. Adding one means adding a face to layout.tsx, a var
 * to globals.css, a branch in fontFamilyFor/fontWeightFor, and a row to the
 * TextTool picker — the canvas export reads the same three, so a voice that
 * previews correctly exports correctly.
 */
export type TextStyle =
  | "display"
  | "editorial"
  | "clean"
  | "poster"
  | "condensed"
  | "script"
  | "ticker";

/**
 * How the text sits on its background. Every style is drawn by BOTH legs
 * from the same geometry helpers below, so the preview and the export agree.
 * - none    bare type
 * - solid   one rounded plate behind the whole block
 * - line    a plate per line, ragged to each line's width
 * - marker  a squat highlighter swipe per line, riding the baseline
 * - outline hollow letters, stroked in the text colour
 */
export type PillStyle = "none" | "solid" | "line" | "marker" | "outline";

interface OverlayBase {
  id: string;
  /** Center of the overlay, normalized 0..1 of the story canvas. */
  x: number;
  y: number;
  scale: number;
  /** Degrees. */
  rotation: number;
}

export interface TextOverlay extends OverlayBase {
  kind: "text";
  text: string;
  style: TextStyle;
  pill: PillStyle;
  /** Any hex the palette or the custom picker produced. */
  color: string;
}

export interface CashtagOverlay extends OverlayBase {
  kind: "cashtag";
  /** Uppercase symbol without the $ (e.g. "XAU"). */
  symbol: string;
}

export interface EmojiOverlay extends OverlayBase {
  kind: "emoji";
  emoji: string;
}

/** An @tag placed on the canvas. `userId` is the Profile _id so the tag can
 *  round-trip once the gateway grows a mentions field. */
export interface MentionOverlay extends OverlayBase {
  kind: "mention";
  username: string;
  userId: string;
}

export type Overlay =
  | TextOverlay
  | CashtagOverlay
  | EmojiOverlay
  | MentionOverlay;

export interface Stroke {
  /** Normalized 0..1 points in stage space. */
  points: { x: number; y: number }[];
  color: string;
  /** Line width as a fraction of canvas width. */
  width: number;
  /** Erase strokes composite out what is under them, on both legs. */
  erase?: boolean;
}

let idCounter = 0;
export const newOverlayId = () => `ov-${++idCounter}-${Date.now()}`;

/* ── Metrics (fractions of canvas WIDTH; scale multiplies) ──────────────── */

export const TEXT_SIZE_FRACTION = 0.055;
export const EMOJI_SIZE_FRACTION = 0.15;
export const CASHTAG_SIZE_FRACTION = 0.048;
export const TEXT_LINE_HEIGHT = 1.25;
export const PILL_PAD_X = 0.5; // × font size
export const PILL_PAD_Y = 0.24; // × font size
export const PILL_RADIUS = 0.38; // × font size
export const STROKE_WIDTH_FRACTION = 0.012;

export const STROKE_COLORS = [
  "#EAB308",
  "#FAFAF9",
  "#0C0A09",
  "#EF4444",
  "#10B981",
];

export const INK_LIGHT = "#FAFAF9";
export const INK_DARK = "#0C0A09";
export const INK_GOLD = "#EAB308";

export interface TextPalette {
  id: string;
  label: string;
  colors: string[];
}

/** Named palettes for story type. The first row is the neutral/brand set the
 *  canvas defaults draw from; the rest are editorial ranges. */
export const TEXT_PALETTES: TextPalette[] = [
  {
    id: "core",
    label: "Core",
    colors: [INK_LIGHT, INK_DARK, INK_GOLD, "#A8A29E", "#57534E", "#B45309"],
  },
  {
    id: "market",
    label: "Market",
    colors: ["#10B981", "#34D399", "#EF4444", "#F87171", "#F59E0B", "#0EA5E9"],
  },
  {
    id: "dusk",
    label: "Dusk",
    colors: ["#FDE68A", "#FB923C", "#F43F5E", "#C026D3", "#7C3AED", "#4338CA"],
  },
  {
    id: "flora",
    label: "Flora",
    colors: ["#ECFDF5", "#6EE7B7", "#14B8A6", "#0E7490", "#166534", "#3F6212"],
  },
];

/** sRGB relative luminance, for picking a contrasting plate colour. */
export function luminanceOf(hex: string): number {
  const int = Number.parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((int >> 16) & 255) +
    0.7152 * channel((int >> 8) & 255) +
    0.0722 * channel(int & 255)
  );
}

/** The plate behind the text always opposes the ink, so any palette colour
 *  stays legible without asking the user to choose a second colour. */
export function plateColorFor(textHex: string, style: PillStyle): string {
  const light = luminanceOf(textHex) > 0.5;
  if (style === "marker") {
    // A highlighter reads as a translucent swipe, not an opaque plate.
    return light ? "rgba(12, 10, 9, 0.55)" : "rgba(250, 250, 249, 0.75)";
  }
  return light ? "rgba(12, 10, 9, 0.62)" : "rgba(250, 250, 249, 0.9)";
}

export const CASHTAG_COLORS = {
  text: "#EAB308",
  pill: "rgba(12, 10, 9, 0.75)",
  border: "#EAB308",
};

/** Tags read as brand chips — gold on ink, no rim, so they never look like
 *  the bordered cashtag ticker. */
export const MENTION_COLORS = {
  text: "#EAB308",
  pill: "rgba(12, 10, 9, 0.72)",
};
export const MENTION_SIZE_FRACTION = 0.045;

export interface OverlayFonts {
  display: string;
  editorial: string;
  ui: string;
  poster: string;
  condensed: string;
  script: string;
  mono: string;
}

export const MONO_STACK =
  'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, monospace';

/** Resolve the app's real (next/font-hashed) families for canvas use. */
export function resolveOverlayFonts(): OverlayFonts {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  return {
    display: read("--ws-font-display", '"Poppins", system-ui, sans-serif'),
    editorial: read(
      "--ws-font-editorial",
      '"Instrument Serif", Georgia, serif',
    ),
    ui: read("--ws-font-ui", '"Public Sans", system-ui, sans-serif'),
    poster: read("--ws-font-poster", '"Archivo Black", Impact, sans-serif'),
    condensed: read(
      "--ws-font-condensed",
      '"Bebas Neue", "Arial Narrow", sans-serif',
    ),
    script: read("--ws-font-script", '"Caveat", cursive'),
    mono: read("--ws-font-mono", MONO_STACK),
  };
}

export function fontFamilyFor(style: TextStyle, fonts: OverlayFonts): string {
  if (style === "display") return fonts.display;
  if (style === "editorial") return fonts.editorial;
  if (style === "poster") return fonts.poster;
  if (style === "condensed") return fonts.condensed;
  if (style === "script") return fonts.script;
  if (style === "ticker") return fonts.mono;
  return fonts.ui;
}

/** Instrument Serif and Archivo Black ship one weight each — asking for 700
 *  would synthesise a bold and lose the face's real drawing. */
export const fontWeightFor = (style: TextStyle) => {
  if (style === "display") return 700;
  // Instrument Serif, Archivo Black and Bebas Neue each ship ONE weight —
  // asking for 700 would synthesise a fake bold and lose the real drawing.
  if (style === "editorial" || style === "poster" || style === "condensed") {
    return 400;
  }
  if (style === "script") return 700;
  if (style === "ticker") return 700;
  return 600;
};

/** Per-face optical tracking — the poster face wants to be tight, the serif
 *  wants air. Fraction of font size. */
export const letterSpacingFor = (style: TextStyle) => {
  if (style === "poster") return -0.02;
  if (style === "editorial") return 0.005;
  if (style === "condensed") return 0.03;
  if (style === "ticker") return 0.04;
  return 0;
};

/* ── Pill geometry — the shared contract ─────────────────────────────────
   The DOM preview and the canvas export both size their plates from this,
   so a pill that hugs in the editor hugs identically in the exported file.
   Every number is a fraction of the font size. */

export interface PillGeometry {
  /** Horizontal padding around each line's text. */
  padX: number;
  /** Plate height (line/marker draw one per line). */
  boxH: number;
  radius: number;
  /** Vertical nudge, used to sit the marker on the baseline. */
  offsetY: number;
  /** Stroke width for the outline style. */
  strokeW: number;
  /** True when the plate is drawn once per line rather than once per block. */
  perLine: boolean;
}

export function pillGeometry(style: PillStyle): PillGeometry {
  switch (style) {
    case "solid":
      return {
        padX: 0.5,
        boxH: 0,
        radius: 0.38,
        offsetY: 0,
        strokeW: 0,
        perLine: false,
      };
    case "line":
      return {
        padX: 0.42,
        boxH: TEXT_LINE_HEIGHT + 0.1,
        radius: 0.34,
        offsetY: 0,
        strokeW: 0,
        perLine: true,
      };
    case "marker":
      return {
        padX: 0.22,
        boxH: 0.86,
        radius: 0.06,
        offsetY: 0.08,
        strokeW: 0,
        perLine: true,
      };
    case "outline":
      return {
        padX: 0,
        boxH: 0,
        radius: 0,
        offsetY: 0,
        strokeW: 0.036,
        perLine: false,
      };
    default:
      return {
        padX: 0,
        boxH: 0,
        radius: 0,
        offsetY: 0,
        strokeW: 0,
        perLine: false,
      };
  }
}

/* ── Canvas compositor (export leg) ─────────────────────────────────────── */

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  stroke: Stroke,
) {
  if (stroke.points.length === 0) return;
  ctx.save();
  if (stroke.erase) ctx.globalCompositeOperation = "destination-out";
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = Math.max(1, stroke.width * w);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  const pts = stroke.points;
  ctx.moveTo(pts[0].x * w, pts[0].y * h);
  if (pts.length < 3) {
    for (const p of pts) ctx.lineTo(p.x * w, p.y * h);
  } else {
    // Quadratic smoothing through midpoints — same path the DrawLayer draws.
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

function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  overlay: TextOverlay,
  fonts: OverlayFonts,
) {
  const fontPx = TEXT_SIZE_FRACTION * w * overlay.scale;
  const lineH = fontPx * TEXT_LINE_HEIGHT;
  const lines = overlay.text.split("\n");
  const geo = pillGeometry(overlay.pill);
  const plate = plateColorFor(overlay.color, overlay.pill);

  ctx.font = `${fontWeightFor(overlay.style)} ${fontPx}px ${fontFamilyFor(overlay.style, fonts)}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // ctx.letterSpacing is ignored by engines that lack it, which only costs
  // the optical tracking — never the layout, since widths are measured after.
  ctx.letterSpacing = `${letterSpacingFor(overlay.style) * fontPx}px`;

  const widths = lines.map((line) => ctx.measureText(line).width);
  const blockW = Math.max(...widths);
  const blockH = lines.length * lineH;
  const centerY = (i: number) => -blockH / 2 + lineH * (i + 0.5);

  if (overlay.pill === "solid") {
    const padX = fontPx * geo.padX;
    const padY = fontPx * PILL_PAD_Y;
    ctx.fillStyle = plate;
    roundedRect(
      ctx,
      -blockW / 2 - padX,
      -blockH / 2 - padY,
      blockW + padX * 2,
      blockH + padY * 2,
      fontPx * geo.radius,
    );
    ctx.fill();
  } else if (geo.perLine) {
    // One plate per line, each hugging that line's own width — the ragged
    // edge is the point of the style.
    const padX = fontPx * geo.padX;
    const boxH = fontPx * geo.boxH;
    ctx.fillStyle = plate;
    lines.forEach((line, i) => {
      const lineW = widths[i];
      if (!line.trim()) {
        return;
      }
      roundedRect(
        ctx,
        -lineW / 2 - padX,
        centerY(i) - boxH / 2 + fontPx * geo.offsetY,
        lineW + padX * 2,
        boxH,
        fontPx * geo.radius,
      );
      ctx.fill();
    });
  }

  if (overlay.pill === "outline") {
    ctx.lineWidth = Math.max(1, fontPx * geo.strokeW);
    ctx.lineJoin = "round";
    ctx.strokeStyle = overlay.color;
    for (const [i, line] of lines.entries()) {
      ctx.strokeText(line, 0, centerY(i));
    }
    return;
  }

  ctx.fillStyle = overlay.color;
  for (const [i, line] of lines.entries()) {
    ctx.fillText(line, 0, centerY(i));
  }
}

function drawMentionOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  overlay: MentionOverlay,
  fonts: OverlayFonts,
) {
  const fontPx = MENTION_SIZE_FRACTION * w * overlay.scale;
  const label = `@${overlay.username}`;
  ctx.font = `700 ${fontPx}px ${fonts.ui}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = "0px";
  const textW = ctx.measureText(label).width;
  const padX = fontPx * PILL_PAD_X;
  const padY = fontPx * PILL_PAD_Y;
  const chipW = textW + padX * 2;
  const chipH = fontPx + padY * 2;

  ctx.fillStyle = MENTION_COLORS.pill;
  roundedRect(ctx, -chipW / 2, -chipH / 2, chipW, chipH, chipH / 2);
  ctx.fill();
  ctx.fillStyle = MENTION_COLORS.text;
  ctx.fillText(label, 0, 0);
}

function drawCashtagOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  overlay: CashtagOverlay,
  fonts: OverlayFonts,
) {
  const fontPx = CASHTAG_SIZE_FRACTION * w * overlay.scale;
  const label = `$${overlay.symbol}`;
  ctx.font = `600 ${fontPx}px ${fonts.mono}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const textW = ctx.measureText(label).width;
  const padX = fontPx * PILL_PAD_X;
  const padY = fontPx * PILL_PAD_Y;
  const chipW = textW + padX * 2;
  const chipH = fontPx + padY * 2;

  ctx.fillStyle = CASHTAG_COLORS.pill;
  roundedRect(ctx, -chipW / 2, -chipH / 2, chipW, chipH, chipH / 2);
  ctx.fill();
  ctx.strokeStyle = CASHTAG_COLORS.border;
  ctx.lineWidth = Math.max(1, fontPx * 0.06);
  ctx.stroke();
  ctx.fillStyle = CASHTAG_COLORS.text;
  ctx.fillText(label, 0, 0);
}

function drawEmojiOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  overlay: EmojiOverlay,
) {
  const fontPx = EMOJI_SIZE_FRACTION * w * overlay.scale;
  ctx.font = `${fontPx}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(overlay.emoji, 0, 0);
}

/**
 * Draw strokes then overlays (IG's layer order: drawing under stickers)
 * onto an export canvas. Caller should `await document.fonts.ready` first
 * so the hashed Poppins/Public Sans faces are measurable.
 */
export function drawDecorations(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  overlays: Overlay[],
  strokes: Stroke[],
  fonts: OverlayFonts,
) {
  if (strokes.length > 0) {
    // Strokes are composited on their OWN transparent layer first. An eraser
    // stroke uses destination-out, which would otherwise cut a hole straight
    // through the photo underneath instead of just removing ink.
    const layer = document.createElement("canvas");
    layer.width = w;
    layer.height = h;
    const layerCtx = layer.getContext("2d");
    if (layerCtx) {
      for (const stroke of strokes) drawStroke(layerCtx, w, h, stroke);
      ctx.drawImage(layer, 0, 0);
    }
  }
  for (const overlay of overlays) {
    ctx.save();
    ctx.translate(overlay.x * w, overlay.y * h);
    ctx.rotate((overlay.rotation * Math.PI) / 180);
    if (overlay.kind === "text") drawTextOverlay(ctx, w, overlay, fonts);
    else if (overlay.kind === "cashtag")
      drawCashtagOverlay(ctx, w, overlay, fonts);
    else if (overlay.kind === "mention")
      drawMentionOverlay(ctx, w, overlay, fonts);
    else drawEmojiOverlay(ctx, w, overlay);
    ctx.restore();
  }
}
