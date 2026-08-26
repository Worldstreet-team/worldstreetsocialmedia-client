/**
 * Story canvases for text + voice stories: designed mesh gradients plus a
 * curated shelf of photographic backdrops.
 *
 * Each canvas renders twice — as CSS (the live stage preview and the voice
 * recorder's canvas) and as canvas paint (the exported 1080×1920 file). Both
 * legs read the same descriptor, so a canvas that previews correctly exports
 * correctly.
 *
 * A `mesh` is a base fill plus soft radial blobs, which is what stops these
 * reading as flat two-stop wallpaper: the light has a direction and the
 * corners fall off. A `photo` is a remote image served with CORS headers
 * (Picsum/Unsplash-class CDN) so it can be drawn into the export canvas
 * without tainting it.
 */

interface Blob {
  /** Center, normalized 0..1 of the canvas. */
  x: number;
  y: number;
  /** Radius as a fraction of the canvas WIDTH. */
  r: number;
  color: string;
  /** Peak opacity at the blob's center. */
  alpha: number;
}

interface CanvasBase {
  id: string;
  label: string;
  /** Ink that reads over this canvas — drives text defaults + UI accents. */
  ink: "light" | "dark";
}

export interface StoryBackground extends CanvasBase {
  kind: "mesh";
  /** CSS linear-gradient angle, degrees (0 = to top, clockwise). */
  angle: number;
  /** Evenly-spaced color stops, top of the gradient line first. */
  stops: string[];
  blobs?: Blob[];
}

export interface StoryPhotoBackdrop extends CanvasBase {
  kind: "photo";
  /** Full-resolution image, CORS-enabled. */
  url: string;
  /** Small preview for the picker tile. */
  thumb: string;
}

export type StoryCanvas = StoryBackground | StoryPhotoBackdrop;

export const STORY_BACKGROUNDS: StoryBackground[] = [
  {
    kind: "mesh",
    id: "obsidian",
    label: "Obsidian",
    angle: 165,
    stops: ["#292524", "#0c0a09"],
    blobs: [
      { x: 0.5, y: 0.18, r: 0.85, color: "#57534e", alpha: 0.5 },
      { x: 0.12, y: 0.9, r: 0.6, color: "#1c1917", alpha: 0.6 },
    ],
    ink: "light",
  },
  {
    kind: "mesh",
    id: "bullion",
    label: "Bullion",
    angle: 160,
    stops: ["#78350f", "#0c0a09"],
    blobs: [
      { x: 0.28, y: 0.22, r: 0.8, color: "#eab308", alpha: 0.55 },
      { x: 0.85, y: 0.72, r: 0.7, color: "#b45309", alpha: 0.45 },
    ],
    ink: "light",
  },
  {
    kind: "mesh",
    id: "ember",
    label: "Ember",
    angle: 155,
    stops: ["#450a0a", "#0c0a09"],
    blobs: [
      { x: 0.78, y: 0.2, r: 0.78, color: "#f97316", alpha: 0.5 },
      { x: 0.2, y: 0.78, r: 0.72, color: "#7f1d1d", alpha: 0.55 },
    ],
    ink: "light",
  },
  {
    kind: "mesh",
    id: "orchid",
    label: "Orchid",
    angle: 170,
    stops: ["#2e1065", "#0c0a09"],
    blobs: [
      { x: 0.24, y: 0.24, r: 0.82, color: "#a855f7", alpha: 0.45 },
      { x: 0.8, y: 0.8, r: 0.72, color: "#4338ca", alpha: 0.5 },
    ],
    ink: "light",
  },
  {
    kind: "mesh",
    id: "vault",
    label: "Vault",
    angle: 160,
    stops: ["#052e16", "#0c0a09"],
    blobs: [
      { x: 0.3, y: 0.8, r: 0.8, color: "#15803d", alpha: 0.5 },
      { x: 0.82, y: 0.16, r: 0.66, color: "#ca8a04", alpha: 0.32 },
    ],
    ink: "light",
  },
  {
    kind: "mesh",
    id: "rose",
    label: "Rose",
    angle: 165,
    stops: ["#4c0519", "#0c0a09"],
    blobs: [
      { x: 0.68, y: 0.24, r: 0.78, color: "#e11d48", alpha: 0.45 },
      { x: 0.2, y: 0.82, r: 0.66, color: "#831843", alpha: 0.5 },
    ],
    ink: "light",
  },
  {
    kind: "mesh",
    id: "paper",
    label: "Paper",
    angle: 165,
    stops: ["#fafaf9", "#e7e5e4"],
    blobs: [
      { x: 0.3, y: 0.2, r: 0.8, color: "#ffffff", alpha: 0.9 },
      { x: 0.85, y: 0.85, r: 0.7, color: "#d6d3d1", alpha: 0.7 },
    ],
    ink: "dark",
  },
  {
    kind: "mesh",
    id: "linen",
    label: "Linen",
    angle: 160,
    stops: ["#fef3c7", "#d6d3d1"],
    blobs: [
      { x: 0.24, y: 0.26, r: 0.82, color: "#fde68a", alpha: 0.75 },
      { x: 0.86, y: 0.8, r: 0.7, color: "#a8a29e", alpha: 0.45 },
    ],
    ink: "dark",
  },
];

/** Curated Picsum photo ids — moody, texture-forward scenes that hold white
 *  type. Picsum serves `Access-Control-Allow-Origin: *`, so these draw into
 *  the export canvas cleanly. Ids are stable references to fixed photos. */
const picsum = (id: number, label: string): StoryPhotoBackdrop => ({
  kind: "photo",
  id: `photo-${id}`,
  label,
  url: `https://picsum.photos/id/${id}/1080/1920`,
  thumb: `https://picsum.photos/id/${id}/135/240`,
  ink: "light",
});

export const STORY_PHOTO_BACKDROPS: StoryPhotoBackdrop[] = [
  picsum(1015, "River"),
  picsum(1016, "Canyon"),
  picsum(1018, "Highlands"),
  picsum(1036, "Summit"),
  picsum(1039, "Falls"),
  picsum(1043, "Dusk"),
];

export const STORY_CANVASES: StoryCanvas[] = [
  ...STORY_BACKGROUNDS,
  ...STORY_PHOTO_BACKDROPS,
];

/** #rrggbb → `rgba(r, g, b, a)`. Blobs fade to their OWN color at alpha 0:
 *  fading to `transparent` interpolates through black and dirties the edge. */
function rgba(hex: string, alpha: number): string {
  const int = Number.parseInt(hex.slice(1), 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** The story frame's aspect. Blob radii are fractions of WIDTH in both legs;
 *  CSS ellipse percentages are per-axis, so the Y radius carries this factor
 *  to stay a true circle like the canvas one. */
export const STORY_ASPECT = 1080 / 1920;

export function storyCanvasCss(canvas: StoryCanvas): string {
  if (canvas.kind === "photo") {
    // The dark fill paints while the image streams in.
    return `url("${canvas.url}") center / cover no-repeat, #171412`;
  }
  const base = `linear-gradient(${canvas.angle}deg, ${canvas.stops.join(", ")})`;
  if (!canvas.blobs?.length) return base;
  // Radial layers paint above the base, so they come FIRST in the shorthand.
  const layers = canvas.blobs.map(
    (b) =>
      `radial-gradient(ellipse ${b.r * 100}% ${(b.r * 100 * STORY_ASPECT).toFixed(2)}% at ${b.x * 100}% ${b.y * 100}%, ${rgba(
        b.color,
        b.alpha,
      )} 0%, ${rgba(b.color, 0)} 100%)`,
  );
  return [...layers, base].join(", ");
}

function paintMesh(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bg: StoryBackground,
) {
  // CSS gradient-line geometry: direction (sin A, -cos A) through the center,
  // long enough to cover the box corners.
  const rad = (bg.angle * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  const cx = w / 2;
  const cy = h / 2;
  const gradient = ctx.createLinearGradient(
    cx - (dx * len) / 2,
    cy - (dy * len) / 2,
    cx + (dx * len) / 2,
    cy + (dy * len) / 2,
  );
  const last = bg.stops.length - 1;
  bg.stops.forEach((stop, i) => {
    gradient.addColorStop(last === 0 ? 0 : i / last, stop);
  });
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  for (const blob of bg.blobs ?? []) {
    const radius = blob.r * w;
    const glow = ctx.createRadialGradient(
      blob.x * w,
      blob.y * h,
      0,
      blob.x * w,
      blob.y * h,
      radius,
    );
    glow.addColorStop(0, rgba(blob.color, blob.alpha));
    glow.addColorStop(1, rgba(blob.color, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }
}

export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

const photoCache = new Map<string, Promise<HTMLImageElement>>();

/** CORS-clean image load, cached per url so the recorder + export share it. */
export function loadBackdropImage(url: string): Promise<HTMLImageElement> {
  const cached = photoCache.get(url);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      photoCache.delete(url); // let a flaky network retry later
      reject(new Error("backdrop failed to load"));
    };
    img.src = url;
  });
  photoCache.set(url, promise);
  return promise;
}

/** Export leg — awaits the photo when the canvas is photographic. */
export async function paintStoryCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  canvas: StoryCanvas,
): Promise<void> {
  if (canvas.kind === "photo") {
    const img = await loadBackdropImage(canvas.url);
    drawImageCover(ctx, img, w, h);
    return;
  }
  paintMesh(ctx, w, h, canvas);
}

/** Frame-loop leg (the voice recorder): never awaits. Pass the preloaded
 *  photo when there is one; until it arrives the frame paints a dark fill. */
export function paintStoryCanvasSync(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  canvas: StoryCanvas,
  photo?: HTMLImageElement | null,
) {
  if (canvas.kind === "photo") {
    if (photo) {
      drawImageCover(ctx, photo, w, h);
    } else {
      ctx.fillStyle = "#171412";
      ctx.fillRect(0, 0, w, h);
    }
    return;
  }
  paintMesh(ctx, w, h, canvas);
}
