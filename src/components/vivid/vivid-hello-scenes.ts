import type { PartSpec, SceneSet } from "@/lib/morph/driver";
import { Pen, shapes, type Pt } from "@/lib/morph/geometry";

/**
 * Vivid's hello (owner 2026-10-16: "the dots could use some svg morphs and
 * maybe change / morph into a vivid then rotating dots then hello").
 *
 * One cast of twelve dots that changes job four times, on the morph engine
 * (src/lib/morph, the Signal's driver):
 *
 *   dots   three dots in a row, typing (a wave)
 *   mark   they split into Vivid's mark, a sphere of dots in rings like
 *          VividOrb, breathing
 *   spin   they settle on a ring and a bright head chases round it, Vivid
 *          thinking
 *   hello  five of them write a handwritten "hello"; the other seven tuck
 *          into the strokes
 *
 * Owner 2026-10-16, "the dot isn't perfectly rounded": the three dots were
 * twelve circles stacked four to a spot, and stacked copies of one shape
 * add up their soft edges into a hard, stepped one. Exactly one dot shows
 * on each spot now; the other nine wait inside it, folded to a point, and
 * split out of it when the mark forms.
 *
 * Every dot has one role in every scene (ROLES), chosen so each change is a
 * short, clean move: mark to ring is straight out or in along the dot's own
 * angle, ring to hello takes each letter from the ring dot nearest it, and
 * back at the dots the e and the two l's roll up into the three dots while
 * the h and the o fold into them, so the word never fades out to nothing
 * before the dots arrive.
 *
 * The spinner chases instead of turning: the dots hold still and a bright
 * head runs round them. A turning ring would have to unwind (or land its
 * letters from wherever the turn had left them) when the hello starts.
 *
 * Monochrome, like the orb: every paint is the theme's ink. A dot is a
 * filled circle with no stroke and a letter is a there-and-back stroke with
 * the same ink in both, so a dot turning into a letter stays solid ink the
 * whole way (it grows its stroke) instead of passing through grey.
 */

export const HELLO_SCENES = ["dots", "mark", "spin", "hello"] as const;
export type HelloScene = (typeof HELLO_SCENES)[number];

export const HELLO_VIEWBOX = "0 0 240 160";

const N = 32;
const k = shapes(N);
const C: Pt = [120, 80];
const CAST = Array.from({ length: 12 }, (_, i) => `d${i + 1}`);

const onRing = (r: number, deg: number): Pt => [
	C[0] + r * Math.cos((deg * Math.PI) / 180),
	C[1] + r * Math.sin((deg * Math.PI) / 180),
];

/* dots: left, middle, right. */
const SPOTS: Pt[] = [
	[104, 80],
	[120, 80],
	[136, 80],
];
const SPOT_R = 5.5;

/* mark: a heart, five close round it, six fainter on the rim. */
const INNER = 19;
const OUTER = 37;

/* spin: twelve dots on one ring, a head every 1.05s (vivid-morph.module.css). */
const RING = 28;
const RING_R = 4.4;
const CHASE_S = 1.05;

/* hello, handwritten: baseline 104, x-height 80, ascenders 46. */
const LETTERS = [
	// h: the stem, then back up and over the hump
	k.stroke(new Pen(60, 46).to(60, 104).to(60, 89).cu(63, 80, 82, 77, 82, 90).to(82, 104).open()),
	// e: the bar, round the bowl, out
	k.stroke(
		new Pen(92, 93)
			.to(111, 92)
			.cu(112, 83, 104, 79, 99, 80)
			.cu(92, 81, 89, 88, 90, 95)
			.cu(91, 103, 99, 106, 105, 105)
			.cu(109, 104, 112, 102, 113, 100)
			.open(),
	),
	// l: a looped ascender
	k.stroke(new Pen(118, 101).cu(125, 86, 129, 60, 125, 48).cu(122, 41, 116, 46, 117, 58).cu(118, 74, 120, 94, 125, 104).open()),
	k.stroke(new Pen(134, 101).cu(141, 86, 145, 60, 141, 48).cu(138, 41, 132, 46, 133, 58).cu(134, 74, 136, 94, 141, 104).open()),
	// o: round, with a little exit flick
	k.stroke(new Pen(160, 82).arc(161, 93, 11, 12, -95, 255).cu(162, 81, 168, 80, 175, 83).open()),
];

type Role = {
	/** Its place in the mark; `faint` sits on the rim. */
	mark: { at: Pt; r: number; faint?: boolean };
	/** Its angle on the spinner's ring, clockwise, -90 is 12 o'clock. */
	ring: number;
	/** The letter it writes (index into LETTERS), or the point on a stroke it tucks into. */
	hello: number | Pt;
	/** Its spot in the dots (0 left, 1 middle, 2 right); `shows` is the one dot drawn there. */
	spot: 0 | 1 | 2;
	shows?: true;
};

const ROLES: Role[] = [
	{ mark: { at: C, r: 6.4 }, ring: 90, hello: [125, 104], spot: 1 },
	{ mark: { at: onRing(INNER, -90), r: 5.2 }, ring: -90, hello: 2, spot: 1, shows: true },
	{ mark: { at: onRing(INNER, -18), r: 5.2 }, ring: -30, hello: [142, 66], spot: 2 },
	{ mark: { at: onRing(INNER, 54), r: 5.2 }, ring: 30, hello: [150, 93], spot: 2 },
	{ mark: { at: onRing(INNER, 126), r: 5.2 }, ring: 150, hello: 1, spot: 0, shows: true },
	{ mark: { at: onRing(INNER, 198), r: 5.2 }, ring: 210, hello: [99, 80], spot: 0 },
	{ mark: { at: onRing(OUTER, -60), r: 3.6, faint: true }, ring: -60, hello: 3, spot: 2, shows: true },
	{ mark: { at: onRing(OUTER, 0), r: 3.6, faint: true }, ring: 0, hello: 4, spot: 2 },
	{ mark: { at: onRing(OUTER, 60), r: 3.6, faint: true }, ring: 60, hello: [141, 104], spot: 2 },
	{ mark: { at: onRing(OUTER, 120), r: 3.6, faint: true }, ring: 120, hello: [105, 105], spot: 0 },
	{ mark: { at: onRing(OUTER, 180), r: 3.6, faint: true }, ring: 180, hello: 0, spot: 0 },
	{ mark: { at: onRing(OUTER, 240), r: 3.6, faint: true }, ring: 240, hello: [117, 58], spot: 0 },
];

export function createHelloScenes(): SceneSet {
	const dots: Record<string, PartSpec> = {};
	const mark: Record<string, PartSpec> = {};
	const spin: Record<string, PartSpec> = {};
	const hello: Record<string, PartSpec> = {};

	ROLES.forEach((role, i) => {
		const id = CAST[i];
		const [sx, sy] = SPOTS[role.spot];
		dots[id] = role.shows
			? {
					paint: "dot",
					d: k.circle(sx, sy, SPOT_R),
					idle: { kind: "wave", offset: role.spot * 0.16, carry: true },
				}
			: { fold: SPOTS[role.spot] };

		mark[id] = {
			paint: role.mark.faint ? "faint" : "dot",
			d: k.circle(role.mark.at[0], role.mark.at[1], role.mark.r),
			small: true,
			idle: { kind: "breathe", origin: C, carry: true },
		};

		// Clockwise from 12 o'clock, so the head runs clockwise.
		const step = (((role.ring + 90) / 30) % 12 + 12) % 12;
		const [rx, ry] = onRing(RING, role.ring);
		spin[id] = {
			paint: "dot",
			d: k.circle(rx, ry, RING_R),
			idle: { kind: "chase", offset: (step * CHASE_S) / 12, carry: true },
		};

		hello[id] =
			typeof role.hello === "number"
				? { paint: "line", d: LETTERS[role.hello], wire: true }
				: { fold: role.hello };
	});

	// Every change ripples out from the middle; the hello writes left to right.
	const ripple = { kind: "radius" as const, c: C, max: 60 };
	return {
		N,
		cast: CAST,
		paints: ["dot", "faint", "line"],
		first: "dots",
		viewBox: HELLO_VIEWBOX,
		scenes: {
			dots: { focus: C, sweep: ripple, parts: dots },
			mark: { focus: C, sweep: ripple, parts: mark },
			spin: { focus: C, sweep: ripple, parts: spin },
			hello: { focus: [120, 92], sweep: { kind: "x", a: 50, b: 190 }, parts: hello },
		},
	};
}
