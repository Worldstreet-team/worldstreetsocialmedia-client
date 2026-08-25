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

export type TextStyle = "display" | "clean" | "ticker";
export type TextColor = "light" | "dark" | "gold";

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
  /** Background pill behind the text. Ticker style always renders one. */
  pill: boolean;
  color: TextColor;
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

export type Overlay = TextOverlay | CashtagOverlay | EmojiOverlay;

export interface Stroke {
  /** Normalized 0..1 points in stage space. */
  points: { x: number; y: number }[];
  color: string;
  /** Line width as a fraction of canvas width. */
  width: number;
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

export const TEXT_COLORS: Record<TextColor, { text: string; pill: string }> = {
  light: { text: "#FAFAF9", pill: "rgba(12, 10, 9, 0.6)" },
  dark: { text: "#0C0A09", pill: "rgba(250, 250, 249, 0.88)" },
  gold: { text: "#EAB308", pill: "rgba(12, 10, 9, 0.6)" },
};

/** Ticker is a fixed brand moment: gold mono on a dark pill, always. */
export const TICKER_COLORS = {
  text: "#EAB308",
  pill: "rgba(12, 10, 9, 0.75)",
};

export const CASHTAG_COLORS = {
  text: "#EAB308",
  pill: "rgba(12, 10, 9, 0.75)",
  border: "#EAB308",
};

export interface OverlayFonts {
  display: string;
  ui: string;
  mono: string;
}

export const MONO_STACK =
  'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, monospace';

/** Resolve the app's real (next/font-hashed) families for canvas use. */
export function resolveOverlayFonts(): OverlayFonts {
  const styles = getComputedStyle(document.documentElement);
  return {
    display:
      styles.getPropertyValue("--ws-font-display").trim() ||
      '"Poppins", system-ui, sans-serif',
    ui:
      styles.getPropertyValue("--ws-font-ui").trim() ||
      '"Public Sans", system-ui, sans-serif',
    mono: MONO_STACK,
  };
}

export function fontFamilyFor(style: TextStyle, fonts: OverlayFonts): string {
  if (style === "display") return fonts.display;
  if (style === "ticker") return fonts.mono;
  return fonts.ui;
}

export const fontWeightFor = (style: TextStyle) =>
  style === "display" ? 700 : 600;

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
  const ticker = overlay.style === "ticker";
  const colors = ticker ? TICKER_COLORS : TEXT_COLORS[overlay.color];
  const pill = ticker || overlay.pill;

  ctx.font = `${fontWeightFor(overlay.style)} ${fontPx}px ${fontFamilyFor(overlay.style, fonts)}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const widths = lines.map((line) => ctx.measureText(line).width);
  const blockW = Math.max(...widths);
  const blockH = lines.length * lineH;

  if (pill) {
    const padX = fontPx * PILL_PAD_X;
    const padY = fontPx * PILL_PAD_Y;
    ctx.fillStyle = colors.pill;
    roundedRect(
      ctx,
      -blockW / 2 - padX,
      -blockH / 2 - padY,
      blockW + padX * 2,
      blockH + padY * 2,
      fontPx * PILL_RADIUS,
    );
    ctx.fill();
  }

  ctx.fillStyle = colors.text;
  lines.forEach((line, i) => {
    ctx.fillText(line, 0, -blockH / 2 + lineH * (i + 0.5));
  });
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
  for (const stroke of strokes) drawStroke(ctx, w, h, stroke);
  for (const overlay of overlays) {
    ctx.save();
    ctx.translate(overlay.x * w, overlay.y * h);
    ctx.rotate((overlay.rotation * Math.PI) / 180);
    if (overlay.kind === "text") drawTextOverlay(ctx, w, overlay, fonts);
    else if (overlay.kind === "cashtag")
      drawCashtagOverlay(ctx, w, overlay, fonts);
    else drawEmojiOverlay(ctx, w, overlay);
    ctx.restore();
  }
}
