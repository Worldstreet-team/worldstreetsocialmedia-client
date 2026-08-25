/**
 * Client-side render pipeline for the media editor. The gateway does zero
 * image processing (no resize, no EXIF strip, no transcode), so whatever we
 * emit here is byte-for-byte what R2 stores and the feed serves.
 *
 * Pipeline: createImageBitmap (applies EXIF orientation natively — no exif
 * lib needed, and re-encoding strips GPS metadata) → downscale to a working
 * size → bake rotation/flip into an oriented canvas → crop → encode.
 *
 * Two hard constraints shape the numbers:
 * - iOS Safari caps canvases around ~16MP; downscale BEFORE compositing.
 * - Server actions cap request bodies at 20mb (next.config.ts); the
 *   downscale + webp re-encode keeps every export far under it.
 *
 * The filter/adjustment leg must NOT use ctx.filter — it is still disabled
 * in stable Safari (2026); it's a CPU color-matrix pass instead (see
 * applyColorMatrix below).
 */

import type { Rotation } from "./document";
import { type ColorMatrix, GRAIN_ALPHA, getGrainTile } from "./presets";

/** Long-edge cap for the editor's working bitmap (~2560×1920 ≈ 5MP, safe). */
const WORKING_MAX = 2560;
/** Long-edge cap for exported files — the social-platform standard tier. */
const EXPORT_MAX = 2048;

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Decode a File into an EXIF-oriented bitmap, downscaled to the working cap.
 * Caller owns the bitmap and should close() it when done.
 */
export async function loadOrientedBitmap(file: File): Promise<ImageBitmap> {
  const full = await createImageBitmap(file);
  const longEdge = Math.max(full.width, full.height);
  if (longEdge <= WORKING_MAX) return full;
  const scale = WORKING_MAX / longEdge;
  const resized = await createImageBitmap(full, {
    resizeWidth: Math.round(full.width * scale),
    resizeHeight: Math.round(full.height * scale),
    resizeQuality: "high",
  });
  full.close();
  return resized;
}

/**
 * Bake rotation + horizontal flip into a canvas so the cropper and the
 * export both work in one already-oriented pixel space.
 */
export function orientCanvas(
  bitmap: ImageBitmap,
  rotation: Rotation,
  flipH: boolean,
): HTMLCanvasElement {
  const swap = rotation === 90 || rotation === 270;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? bitmap.height : bitmap.width;
  canvas.height = swap ? bitmap.width : bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  if (flipH) ctx.scale(-1, 1);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Output dimensions after the export cap — drives the editor's readout. */
export function finalDimensions(crop: CropRect): { w: number; h: number } {
  const scale = Math.min(1, EXPORT_MAX / Math.max(crop.width, crop.height));
  return {
    w: Math.max(1, Math.round(crop.width * scale)),
    h: Math.max(1, Math.round(crop.height * scale)),
  };
}

export interface RenderEffects {
  /** Composed adjustment/preset matrix (presets.ts); null = skip the pass. */
  matrix?: ColorMatrix | null;
  /** Film-grain overlay pass. */
  grain?: boolean;
  /** Exact output size (stories: 1080×1920). Defaults to the crop, capped. */
  target?: { w: number; h: number };
}

/**
 * The per-pixel color-matrix pass. CPU on ImageData rather than ctx.filter
 * (disabled in stable Safari) — a one-shot ≤4MP loop at save time, well
 * under jank territory; swap for a WebGL quad if profiling ever says so.
 */
function applyColorMatrix(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  matrix: ColorMatrix,
) {
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const { m, o } = matrix;
  const o0 = o[0] * 255;
  const o1 = o[1] * 255;
  const o2 = o[2] * 255;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    d[i] = Math.min(255, Math.max(0, m[0] * r + m[1] * g + m[2] * b + o0));
    d[i + 1] = Math.min(255, Math.max(0, m[3] * r + m[4] * g + m[5] * b + o1));
    d[i + 2] = Math.min(255, Math.max(0, m[6] * r + m[7] * g + m[8] * b + o2));
  }
  ctx.putImageData(image, 0, 0);
}

function applyGrain(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const pattern = ctx.createPattern(getGrainTile(), "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.globalAlpha = GRAIN_ALPHA;
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * Crop the oriented source, apply effects, and encode to a File ready for
 * the existing FormData submit paths. WebP at 0.82, falling back to JPEG
 * 0.85 when the UA ignores the webp request (sniffed from the blob type).
 */
export async function exportCroppedFile(
  source: HTMLCanvasElement,
  crop: CropRect,
  originalName: string,
  effects: RenderEffects = {},
): Promise<File> {
  const { w, h } = effects.target ?? finalDimensions(crop);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, w, h);
  if (effects.matrix) applyColorMatrix(ctx, w, h, effects.matrix);
  if (effects.grain) applyGrain(ctx, w, h);

  let blob = await canvasToBlob(out, "image/webp", 0.82);
  if (!blob || blob.type !== "image/webp") {
    blob = await canvasToBlob(out, "image/jpeg", 0.85);
  }
  if (!blob) throw new Error("Image encode failed");

  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const base = originalName.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}-edited.${ext}`, { type: blob.type });
}
