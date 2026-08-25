/**
 * The edit document — plain serializable state for a media edit session.
 * Deliberately platform-agnostic (no DOM types): the same shape drives the
 * web editor today and a React Native/Skia editor later. Coordinates that
 * matter are normalized or expressed in oriented-source pixels so preview
 * and export stay in one space.
 *
 * Phase 1 covers crop/rotate/flip. Adjustments, presets, and overlays
 * (Phases 2/4) extend this interface without breaking stored docs.
 */

export type Rotation = 0 | 90 | 180 | 270;

/** Pixel rect in the oriented working-canvas space. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AspectId = "original" | "1:1" | "4:5" | "16:9";

/** Numeric ratios for the preset chips; "original" resolves at runtime. */
export const ASPECT_RATIOS: Record<Exclude<AspectId, "original">, number> = {
  "1:1": 1,
  "4:5": 4 / 5,
  "16:9": 16 / 9,
};

export const ASPECT_LABELS: { id: AspectId; label: string }[] = [
  { id: "original", label: "Original" },
  { id: "1:1", label: "1:1" },
  { id: "4:5", label: "4:5" },
  { id: "16:9", label: "16:9" },
];

/** Slider values, all -100..100 with 0 = untouched. */
export interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
}

export type PresetId =
  | "gold-rush"
  | "bull-run"
  | "after-hours"
  | "ticker"
  | "paper"
  | "grain";

export interface EditDocument {
  rotation: Rotation;
  flipH: boolean;
  aspectId: AspectId;
  /** Cropper pan offset (react-easy-crop's `crop` prop), oriented space. */
  position: { x: number; y: number };
  zoom: number;
  /**
   * The saved crop in oriented-source pixels — the value that survives a
   * round-trip. position/zoom are container-relative, so restoring from
   * them alone drifts when the editor reopens at a different size; this
   * feeds react-easy-crop's initialCroppedAreaPixels instead.
   */
  cropPixels: CropRect | null;
  adjustments: Adjustments;
  /** Named look layered under the user's sliders; null = no preset. */
  preset: PresetId | null;
  /**
   * Alt text — held client-side for now: the gateway's post model has no
   * media metadata fields yet (images are bare URL strings).
   */
  alt: string;
}

export const createAdjustments = (): Adjustments => ({
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
});

export const createEditDocument = (): EditDocument => ({
  rotation: 0,
  flipH: false,
  aspectId: "original",
  position: { x: 0, y: 0 },
  zoom: 1,
  cropPixels: null,
  adjustments: createAdjustments(),
  preset: null,
  alt: "",
});
