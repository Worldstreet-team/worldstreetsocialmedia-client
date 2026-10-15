import type { SceneSet } from "@/lib/morph/driver";
import { Pen, shapes } from "@/lib/morph/geometry";

/**
 * The state glyph: one duotone icon that morphs between what a surface is
 * doing (owner 2026-10-15: "show our svg animated and morphable and use the
 * same icon family that the xtream is using for the left rail"). Xtream's
 * rail is Phosphor duotone at rest, so every scene here is drawn the
 * Phosphor duotone way: an ink outline over the same ink at 20%, on the art
 * kit's faint disc, with at most one brand accent.
 *
 * Unlike the rejected one-wire empty states (2026-10-14: at 200px a single
 * bent line read as a scribble), each part is a whole shape, so every scene
 * is a glyph you recognise at rest and only the change between them morphs:
 *
 * - search: a magnifier with a brand glint, looking around (a retry in flight)
 * - missing: a person drawn in a dashed ring, nobody there (a 404)
 * - offline: a cloud with a brand slash (the gateway never answered)
 *
 * The lens becomes the head and then the cloud, the handle becomes the
 * shoulders and then the slash, the tint follows the outline it fills.
 */

export const STATE_SCENES = ["search", "missing", "offline"] as const;
export type StateScene = (typeof STATE_SCENES)[number];

export const STATE_VIEWBOX = "0 0 160 160";

const N = 24;
const k = shapes(N);
const C: [number, number] = [80, 80];

/* The cloud: three circles on a flat base, traced clockwise along their
   union (intersections worked out once, at 280/174 and 355/261 degrees). */
const cloud = () =>
	k.outline(
		new Pen(60, 100)
			.arc(60, 88, 12, 12, 90, 280)
			.arc(82, 74, 20, 20, 173.7, 354.7)
			.arc(104, 86, 14, 14, 261.4, 450)
			.close(),
	);

export function createStateScenes(): SceneSet {
	const lens = k.circle(72, 72, 22);
	const head = k.circle(80, 69, 13);
	const cloudShape = cloud();
	return {
		N,
		cast: ["disc", "tone", "ring", "line", "glint", "dashes"],
		paints: ["disc", "tone", "ink", "hi", "dashed"],
		first: "search",
		viewBox: STATE_VIEWBOX,
		scenes: {
			search: {
				focus: [72, 72],
				parts: {
					disc: { paint: "disc", d: k.circle(...C, 64) },
					tone: { paint: "tone", d: lens, idle: { kind: "look" } },
					ring: { paint: "ink", d: lens, idle: { kind: "look" } },
					line: {
						paint: "ink",
						d: k.line([88, 88], [108, 108]),
						idle: { kind: "look" },
					},
					glint: {
						paint: "hi",
						small: true,
						d: k.arcLine(72, 72, 13, 200, 255),
						idle: { kind: "look" },
					},
				},
			},
			missing: {
				focus: [80, 80],
				parts: {
					disc: { paint: "disc", d: k.circle(...C, 64) },
					tone: { paint: "tone", d: head },
					ring: { paint: "ink", d: head },
					line: { paint: "ink", d: k.arcLine(80, 121, 29, 216, 324) },
					dashes: {
						paint: "dashed",
						d: k.circle(...C, 42),
						idle: { kind: "spin" },
					},
				},
			},
			offline: {
				focus: [82, 86],
				parts: {
					disc: { paint: "disc", d: k.circle(...C, 64) },
					tone: { paint: "tone", d: cloudShape, idle: { kind: "bob" } },
					ring: { paint: "ink", d: cloudShape, idle: { kind: "bob" } },
					line: {
						paint: "hi",
						d: k.line([54, 58], [108, 112]),
						idle: { kind: "bob" },
					},
				},
			},
		},
	};
}
