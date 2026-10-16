import type { PartSpec, Scene, SceneSet } from "@/lib/morph/driver";
import { Pen, shapes, type Pt } from "@/lib/morph/geometry";

/**
 * Vivid's hello (owner 2026-10-16: "the dots could use some svg morphs and
 * maybe change / morph into a vivid then rotating dots then hello").
 *
 * One cast of twelve dots that changes job four times, on the morph engine
 * (src/lib/morph, the Signal's driver):
 *
 *   dots   three dots in a row, typing (a wave)
 *   mark   the dots spread into Vivid's mark: a sphere of dots, the same
 *          construction as VividOrb, turning slowly
 *   spin   they gather into a ring that turns, Vivid thinking
 *   hello  five of them stretch into a handwritten "hello"; the rest fold
 *
 * Monochrome, like the orb (owner 2026-10-16): every paint is the theme's
 * ink. Each dot is a closed outline and each letter a there-and-back
 * stroke of the same N, so a dot can become a letter and back.
 */

export const HELLO_SCENES = ["dots", "mark", "spin", "hello"] as const;
export type HelloScene = (typeof HELLO_SCENES)[number];

export const HELLO_VIEWBOX = "0 0 240 160";

const N = 32;
const k = shapes(N);
const C: Pt = [120, 80];
const CAST = Array.from({ length: 12 }, (_, i) => `d${i + 1}`);

const dot = (x: number, y: number, r: number) => k.circle(x, y, r);

/* mark: a sunflower disc, big dots in front, small toward the rim. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const markDots = Array.from({ length: 12 }, (_, i) => {
	const t = (i + 0.5) / 12;
	const r = 40 * Math.sqrt(t);
	const a = i * GOLDEN;
	return { x: C[0] + r * Math.cos(a), y: C[1] + r * Math.sin(a), size: 6.2 - 3.6 * t };
});

/* spin: eight dots on a ring, a tail that thins behind the lead dot. */
const spinDots = Array.from({ length: 8 }, (_, i) => {
	const a = (-90 + i * 45) * (Math.PI / 180);
	return { x: C[0] + 26 * Math.cos(a), y: C[1] + 26 * Math.sin(a), size: 5.4 - i * 0.45 };
});

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

function scene(focus: Pt, parts: Scene["parts"]): Scene {
	return { focus, parts };
}

export function createHelloScenes(): SceneSet {
	const dots: Record<string, PartSpec> = {};
	[104, 120, 136].forEach((x, i) => {
		dots[CAST[i]] = { paint: "dot", d: dot(x, 80, 5.5), idle: { kind: "wave", offset: i * 0.16 } };
	});

	const mark: Record<string, PartSpec> = {};
	markDots.forEach((p, i) => {
		mark[CAST[i]] = {
			paint: i < 7 ? "dot" : "faint",
			d: dot(p.x, p.y, p.size),
			idle: { kind: "turn", origin: C },
		};
	});

	const spin: Record<string, PartSpec> = {};
	spinDots.forEach((p, i) => {
		spin[CAST[i]] = { paint: "dot", d: dot(p.x, p.y, p.size), idle: { kind: "spin", origin: C } };
	});

	const hello: Record<string, PartSpec> = {};
	LETTERS.forEach((d, i) => {
		hello[CAST[i]] = { paint: "line", d };
	});

	return {
		N,
		cast: CAST,
		paints: ["dot", "faint", "line"],
		first: "dots",
		viewBox: HELLO_VIEWBOX,
		scenes: {
			dots: scene(C, dots),
			mark: scene(C, mark),
			spin: scene(C, spin),
			hello: scene([120, 92], hello),
		},
	};
}
