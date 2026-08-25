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

export interface EditDocument {
  rotation: Rotation;
  flipH: boolean;
  aspectId: AspectId;
  /** Cropper pan offset (react-easy-crop's `crop` prop), oriented space. */
  position: { x: number; y: number };
  zoom: number;
}

export const createEditDocument = (): EditDocument => ({
  rotation: 0,
  flipH: false,
  aspectId: "original",
  position: { x: 0, y: 0 },
  zoom: 1,
});
