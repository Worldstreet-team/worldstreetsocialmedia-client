import type { PartSpec, SceneSet } from "@/lib/morph/driver";
import { Pen, shapes } from "@/lib/morph/geometry";

/**
 * The Products dial's hub glyph: one duotone drawing that morphs into
 * whichever WorldStreet product is in focus (owner 2026-10-16: "a more sleek
 * ui and nice transition and nice blur with svg morph"). It opens as the
 * rail's own Products glyph, four squares, and the squares become the card,
 * the coin, the star, the cap, the bag and the rest.
 *
 * Drawn the Phosphor duotone way, like StateArt: an ink outline over the
 * same ink at 20%, on the art kit's faint disc, with one brand accent per
 * product. Parts by job, bottom to top:
 *
 * - tone, ring: the body (its fill and its outline)
 * - line, line2: ink details (the chart line, the B, the d-pad)
 * - hi, hi2: the brand accent (the arrowhead, the tassel, the buttons)
 *
 * Scene ids are the ECOSYSTEM titles' keys (productScene()).
 */

export const PRODUCT_VIEWBOX = "0 0 160 160";

const N = 24;
const k = shapes(N);

/** A rounded rectangle, clockwise from the top edge. */
const rrect = (x0: number, y0: number, x1: number, y1: number, r: number) =>
	k.outline(
		new Pen(x0 + r, y0)
			.to(x1 - r, y0)
			.arc(x1 - r, y0 + r, r, r, -90, 0)
			.to(x1, y1 - r)
			.arc(x1 - r, y1 - r, r, r, 0, 90)
			.to(x0 + r, y1)
			.arc(x0 + r, y1 - r, r, r, 90, 180)
			.to(x0, y0 + r)
			.arc(x0 + r, y0 + r, r, r, 180, 270)
			.close(),
	);

const disc = (): PartSpec => ({ paint: "disc", d: k.circle(80, 80, 64) });

/* ── the bodies ─────────────────────────────────────────────────────────── */

/** Four squares, the rail's Products glyph. */
const SQ = { a: 45, b: 75, c: 85, d: 115, r: 7 };

/** A four-point star with its sides drawn in: Vivid's sparkle. */
const sparkle = () =>
	k.outline(
		new Pen(72, 44)
			.cu(74, 72, 80, 84, 106, 86)
			.cu(80, 88, 74, 100, 72, 128)
			.cu(70, 100, 64, 88, 38, 86)
			.cu(64, 84, 70, 72, 72, 44)
			.close(),
	);

/** The mortarboard, a flat diamond. */
const board = () =>
	k.outline(new Pen(80, 48).to(124, 68).to(80, 88).to(36, 68).to(80, 48).close());

/** A controller: a capsule with room for the d-pad and two buttons. */
const pad = () =>
	k.outline(
		new Pen(58, 58)
			.to(102, 58)
			.arc(102, 80, 22, 22, -90, 90)
			.to(58, 102)
			.arc(58, 80, 22, 22, 90, 270)
			.close(),
	);

/** An eye, two curves meeting at the corners. */
const eye = () =>
	k.outline(
		new Pen(36, 80).cu(52, 54, 108, 54, 124, 80).cu(108, 106, 52, 106, 36, 80).close(),
	);

/** The B of a bitcoin: stem, two bowls, one stroke. */
const bee = () =>
	k.stroke(
		new Pen(70, 60)
			.to(86, 60)
			.arc(86, 69.5, 9.5, 9.5, -90, 90)
			.to(70, 79)
			.to(88, 79)
			.arc(88, 89.5, 10.5, 10.5, -90, 90)
			.to(70, 100)
			.to(70, 60)
			.open(),
	);

export function createProductScenes(): SceneSet {
	const card = rrect(40, 48, 120, 112, 11);
	const coin = k.circle(80, 80, 38);
	const star = sparkle();
	const cap = board();
	const bag = rrect(46, 58, 114, 116, 9);
	const dot = k.circle(80, 80, 9);
	const target = k.circle(80, 80, 38);
	const controller = pad();
	const almond = eye();
	const sq = (x0: number, y0: number) => rrect(x0, y0, x0 + 30, y0 + 30, SQ.r);
	return {
		N,
		cast: ["disc", "tone", "ring", "line", "line2", "hi", "hi2"],
		paints: ["disc", "tone", "ink", "dot", "hi"],
		first: "products",
		viewBox: PRODUCT_VIEWBOX,
		scenes: {
			// The rail's Products glyph: where the dial starts and ends.
			products: {
				focus: [80, 80],
				parts: {
					disc: disc(),
					tone: { paint: "tone", d: sq(SQ.a, SQ.a) },
					ring: { paint: "ink", d: sq(SQ.a, SQ.a) },
					line: { paint: "ink", d: sq(SQ.c, SQ.a) },
					line2: { paint: "ink", d: sq(SQ.a, SQ.c) },
					hi: { paint: "hi", d: sq(SQ.c, SQ.c) },
				},
			},
			// A chart climbing inside a card, the arrowhead in brand.
			forex: {
				focus: [80, 80],
				parts: {
					disc: disc(),
					tone: { paint: "tone", d: card },
					ring: { paint: "ink", d: card },
					line: { paint: "ink", d: k.line([54, 98], [70, 80], [83, 90], [104, 66]) },
					hi: { paint: "hi", small: true, d: k.line([92, 64], [105, 64], [105, 77]) },
				},
			},
			// A coin with a B, its two ticks in brand.
			crypto: {
				focus: [80, 80],
				parts: {
					disc: disc(),
					tone: { paint: "tone", d: coin },
					ring: { paint: "ink", d: coin },
					line: { paint: "ink", d: bee() },
					hi: { paint: "hi", small: true, d: k.line([76, 51], [76, 59]) },
					hi2: { paint: "hi", small: true, d: k.line([78, 101], [78, 109]) },
				},
			},
			// Vivid: the sparkle, with a small brand one beside it.
			vivid: {
				focus: [76, 84],
				parts: {
					disc: disc(),
					tone: { paint: "tone", d: star },
					ring: { paint: "ink", d: star },
					hi: { paint: "hi", small: true, d: k.line([112, 40], [112, 62]) },
					hi2: { paint: "hi", small: true, d: k.line([101, 51], [123, 51]) },
				},
			},
			// The cap: the board, the band under it, the tassel in brand.
			academy: {
				focus: [80, 76],
				parts: {
					disc: disc(),
					tone: { paint: "tone", d: cap },
					ring: { paint: "ink", d: cap },
					line: { paint: "ink", d: k.stroke(new Pen(58, 79).to(58, 96).cu(66, 108, 94, 108, 102, 96).to(102, 79).open()) },
					hi: { paint: "hi", small: true, d: k.line([124, 68], [124, 96]) },
				},
			},
			// The bag, its handle in brand.
			commerce: {
				focus: [80, 86],
				parts: {
					disc: disc(),
					tone: { paint: "tone", d: bag },
					ring: { paint: "ink", d: bag },
					hi: { paint: "hi", d: k.stroke(new Pen(66, 72).cu(66, 92, 94, 92, 94, 72).open()) },
				},
			},
			// Broadcasting: a dot with its waves, the outer pair in brand.
			xstream: {
				focus: [80, 80],
				parts: {
					disc: disc(),
					tone: { paint: "tone", d: dot },
					ring: { paint: "dot", d: dot },
					line: { paint: "ink", d: k.arcLine(80, 80, 22, 140, 220) },
					line2: { paint: "ink", d: k.arcLine(80, 80, 22, -40, 40) },
					hi: { paint: "hi", d: k.arcLine(80, 80, 38, -46, 46) },
					hi2: { paint: "hi", d: k.arcLine(80, 80, 38, 134, 226) },
				},
			},
			// A target, its arrow in brand.
			prediction: {
				focus: [80, 80],
				parts: {
					disc: disc(),
					tone: { paint: "tone", d: target },
					ring: { paint: "ink", d: target },
					line: { paint: "ink", d: k.ringLine(80, 80, 23) },
					line2: { paint: "dot", small: true, d: k.circle(80, 80, 8) },
					hi: { paint: "hi", d: k.line([86, 74], [116, 44]) },
					hi2: { paint: "hi", small: true, d: k.line([106, 44], [116, 44], [116, 34]) },
				},
			},
			// A controller: d-pad in ink, two buttons in brand.
			arcade: {
				focus: [80, 80],
				parts: {
					disc: disc(),
					tone: { paint: "tone", d: controller },
					ring: { paint: "ink", d: controller },
					line: { paint: "ink", small: true, d: k.line([60, 71], [60, 89]) },
					line2: { paint: "ink", small: true, d: k.line([51, 80], [69, 80]) },
					hi: { paint: "hi", small: true, d: k.circle(97, 75, 4) },
					hi2: { paint: "hi", small: true, d: k.circle(106, 86, 4) },
				},
			},
			// An eye: the iris in ink, a brand glint.
			vision: {
				focus: [80, 80],
				parts: {
					disc: disc(),
					tone: { paint: "tone", d: almond },
					ring: { paint: "ink", d: almond },
					line: { paint: "ink", d: k.circle(80, 80, 14) },
					line2: { paint: "dot", small: true, d: k.circle(80, 80, 5) },
					hi: { paint: "hi", small: true, d: k.arcLine(80, 80, 9, 200, 250) },
				},
			},
		},
	};
}

/** The scene for each product, by its ECOSYSTEM title. */
const BY_TITLE: Record<string, string> = {
	"Forex Markets": "forex",
	Cryptocurrencies: "crypto",
	"Vivid AI": "vivid",
	Academy: "academy",
	"e-Commerce": "commerce",
	Xstream: "xstream",
	Prediction: "prediction",
	Arcade: "arcade",
	Vision: "vision",
};

export const productScene = (title: string) => BY_TITLE[title] ?? "products";
