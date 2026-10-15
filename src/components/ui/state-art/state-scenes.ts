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
 * And the four empty notification filters (owner 2026-10-15: "I want our
 * notifications to be like an svg morph too"), so switching tabs on an
 * empty list morphs one glyph into the next:
 *
 * - bell (All): a bell that rings now and then, a brand sound arc
 * - mention (Mentions): a speech bubble with an @ in brand ink
 * - align (Alignments): a person with a brand plus
 * - verified (Verified): a scalloped seal turning slowly, a brand check
 *
 * The lens becomes the head, the bell, the bubble, the seal and the cloud;
 * the handle becomes the shoulders, the clapper and the slash; the tint
 * follows the outline it fills.
 */

export const STATE_SCENES = [
	"search",
	"missing",
	"offline",
	"bell",
	"mention",
	"align",
	"verified",
] as const;
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

/* The bell: a dome on straight sides that flare into the skirt. */
const bell = () =>
	k.outline(
		new Pen(80, 47)
			.arc(80, 72, 25, 25, -90, 0)
			.to(105, 88)
			.cu(105, 96, 112, 100, 114, 104)
			.to(46, 104)
			.cu(48, 100, 55, 96, 55, 88)
			.to(55, 72)
			.arc(80, 72, 25, 25, 180, 270)
			.close(),
	);

/* A speech bubble with its tail at the lower left. */
const bubble = () =>
	k.outline(
		new Pen(60, 50)
			.to(100, 50)
			.arc(100, 64, 14, 14, -90, 0)
			.to(114, 84)
			.arc(100, 84, 14, 14, 0, 90)
			.to(74, 98)
			.to(56, 112)
			.to(62, 98)
			.arc(60, 84, 14, 14, 90, 180)
			.to(46, 64)
			.arc(60, 64, 14, 14, 180, 270)
			.close(),
	);

/* The @'s stem and outer sweep, one stroke: down the stem, a hook to the
   right, then round the outside and into the tail. */
const atSweep = () =>
	k.stroke(
		new Pen(88, 66)
			.to(88, 78)
			.cu(88, 84, 96, 84, 96, 76)
			.arc(80, 74, 16, 16, 7, -280)
			.open(),
	);

/* A seal: six scallops round a circle, centred on the disc so the slow
   turn spins it in place. Closed through its own N points (Catmull-Rom):
   four per scallop, so each has a crown, two flanks and a notch.
   (ringPoints gives only N / 2, too few: eight scallops on twelve points
   aliased into a four-lobed diamond.) */
const seal = () => {
	const pts = Array.from({ length: N }, (_, i): [number, number] => {
		const th = (i / N) * Math.PI * 2 - Math.PI / 2;
		const r = 36 + 3.6 * Math.cos(6 * (th + Math.PI / 2));
		return [80 + r * Math.cos(th), 80 + r * Math.sin(th)];
	});
	const P = pts.length;
	const c = pts.map((p1, i) => {
		const p0 = pts[(i - 1 + P) % P];
		const p2 = pts[(i + 1) % P];
		const p3 = pts[(i + 2) % P];
		return [
			p1[0],
			p1[1],
			p1[0] + (p2[0] - p0[0]) / 6,
			p1[1] + (p2[1] - p0[1]) / 6,
			p2[0] - (p3[0] - p1[0]) / 6,
			p2[1] - (p3[1] - p1[1]) / 6,
			p2[0],
			p2[1],
		] as [number, number, number, number, number, number, number, number];
	});
	return k.outline(c);
};

export function createStateScenes(): SceneSet {
	const lens = k.circle(72, 72, 22);
	const head = k.circle(80, 69, 13);
	const cloudShape = cloud();
	const bellShape = bell();
	const bubbleShape = bubble();
	const sealShape = seal();
	const alignHead = k.circle(72, 68, 12);
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
			bell: {
				focus: [80, 76],
				parts: {
					disc: { paint: "disc", d: k.circle(...C, 64) },
					tone: { paint: "tone", d: bellShape, idle: { kind: "swing" } },
					ring: { paint: "ink", d: bellShape, idle: { kind: "swing" } },
					line: {
						paint: "ink",
						d: k.arcLine(80, 104, 10, 25, 155),
						idle: { kind: "swing" },
					},
					glint: {
						paint: "hi",
						small: true,
						d: k.arcLine(80, 75, 42, -55, -25),
						idle: { kind: "blink" },
					},
				},
			},
			mention: {
				focus: [80, 76],
				parts: {
					disc: { paint: "disc", d: k.circle(...C, 64) },
					tone: { paint: "tone", d: bubbleShape, idle: { kind: "bob" } },
					ring: { paint: "ink", d: bubbleShape, idle: { kind: "bob" } },
					line: { paint: "ink", d: k.ringLine(80, 74, 8), idle: { kind: "bob" } },
					glint: { paint: "hi", d: atSweep(), idle: { kind: "bob" } },
				},
			},
			align: {
				focus: [76, 80],
				parts: {
					disc: { paint: "disc", d: k.circle(...C, 64) },
					tone: { paint: "tone", d: alignHead },
					ring: { paint: "ink", d: alignHead },
					line: { paint: "ink", d: k.arcLine(72, 112, 26, 216, 324) },
					glint: {
						paint: "hi",
						small: true,
						d: k.line([99, 62], [113, 62], [106, 62], [106, 55], [106, 69]),
						idle: { kind: "blink" },
					},
				},
			},
			verified: {
				focus: [80, 80],
				parts: {
					disc: { paint: "disc", d: k.circle(...C, 64) },
					tone: { paint: "tone", d: sealShape, idle: { kind: "spin" } },
					ring: { paint: "ink", d: sealShape, idle: { kind: "spin" } },
					glint: {
						paint: "hi",
						small: true,
						d: k.line([67, 80], [76, 89], [94, 70]),
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
