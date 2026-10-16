import type { PartSpec, SceneSet } from "@/lib/morph/driver";
import { Pen, shapes } from "@/lib/morph/geometry";

/**
 * The Products dial's hub: one drawing that morphs into whichever
 * WorldStreet product is in focus. Owner 2026-10-16: "use the xtream logo
 * for xtream and the worldstreet logo for worldstreet, the vivid dots for
 * vivid, it's not constrained to the icons only". So the dial opens on
 * WorldStreet's own W (BrandMark's two polygons, in its literal gold), and
 * the products that have a mark wear it: Xstream's chilli under its flames,
 * Vivid's twelve dots (the mark VividHello forms). The rest are drawn the
 * Phosphor duotone way, ink over the same ink at 20%, one brand accent.
 *
 * No ground disc under the drawing (owner: "remove the rounded border").
 *
 * Twelve parts, bottom to top, each with a job per scene so the change
 * travels instead of fading: the W's two halves become the flames, the
 * dots, the card and its outline; the body of one product is the body of
 * the next. Parts a scene doesn't use fold into its focus.
 */

export const PRODUCT_VIEWBOX = "0 0 160 160";

const N = 24;
const k = shapes(N);
const CAST = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"] as const;

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

/** A closed polygon, clockwise. */
const poly = (...pts: [number, number][]) => {
	const p = new Pen(pts[0][0], pts[0][1]);
	for (const q of pts.slice(1)) p.to(q[0], q[1]);
	return k.outline(p.close());
};

/* ── WorldStreet: BrandMark's W (viewBox 435.32 x 245.73), 104 wide ───── */

const W = (x: number, y: number): [number, number] => [28 + x * 0.2389, 50.65 + y * 0.2389];
const wLeft = () => poly(W(0, 0), W(159.68, 0), W(217.66, 102.5), W(139.01, 245.73));
const wRight = () => poly(W(275.64, 0), W(435.32, 0), W(296.32, 245.73), W(217.66, 102.5));

/* ── Vivid: VividHello's mark, a heart, five close, six faint on the rim ── */

const ring = (r: number, deg: number): [number, number] => [80 + r * Math.cos((deg * Math.PI) / 180), 80 + r * Math.sin((deg * Math.PI) / 180)];
const INNER = [-90, -18, 54, 126, 198];
const OUTER = [-60, 0, 60, 120, 180, 240];

/* ── Xstream: the chilli lying under its flames ─────────────────────────── */

const flameBig = () =>
	k.outline(new Pen(46, 99).cu(40, 82, 52, 68, 52, 53).cu(56, 61, 62, 53, 62, 38).cu(72, 54, 80, 72, 75, 99).close());
const flameMid = () =>
	k.outline(new Pen(72, 99).cu(69, 86, 78, 74, 80, 61).cu(84, 67, 87, 59, 87, 52).cu(95, 66, 99, 82, 93, 99).close());
const flameSmall = () =>
	k.outline(new Pen(90, 99).cu(89, 90, 96, 81, 98, 72).cu(102, 78, 104, 73, 105, 67).cu(111, 79, 113, 90, 107, 99).close());
const chilli = () =>
	k.outline(
		new Pen(22, 92)
			.cu(40, 104, 70, 106, 98, 101)
			.cu(112, 98, 120, 91, 126, 85)
			.cu(139, 93, 139, 113, 121, 121)
			.cu(97, 131, 55, 127, 22, 92)
			.close(),
	);

/* ── the duotone bodies ─────────────────────────────────────────────────── */

const board = () => poly([80, 48], [124, 68], [80, 88], [36, 68]);
const pad = () =>
	k.outline(new Pen(58, 58).to(102, 58).arc(102, 80, 22, 22, -90, 90).to(58, 102).arc(58, 80, 22, 22, 90, 270).close());
const eye = () => k.outline(new Pen(36, 80).cu(52, 54, 108, 54, 124, 80).cu(108, 106, 52, 106, 36, 80).close());
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

type Parts = Partial<Record<(typeof CAST)[number], PartSpec>>;

export function createProductScenes(): SceneSet {
	const card = rrect(40, 48, 120, 112, 11);
	const coin = k.circle(80, 80, 38);
	const cap = board();
	const bag = rrect(46, 58, 114, 116, 9);
	const target = k.circle(80, 80, 38);
	const controller = pad();
	const almond = eye();

	const vivid: Parts = { a: { paint: "dot", small: true, d: k.circle(80, 80, 8) } };
	INNER.forEach((deg, i) => {
		const [x, y] = ring(24, deg);
		vivid[CAST[1 + i]] = { paint: "dot", small: true, d: k.circle(x, y, 6.4) };
	});
	OUTER.forEach((deg, i) => {
		const [x, y] = ring(46, deg);
		vivid[CAST[6 + i]] = { paint: "faint", small: true, d: k.circle(x, y, 4.4) };
	});

	const scene = (focus: [number, number], parts: Parts) => ({ focus, parts });
	return {
		N,
		cast: CAST,
		paints: ["tone", "ink", "dot", "faint", "hi", "gold", "chilli", "flame", "flame2", "ember", "stem"],
		first: "worldstreet",
		viewBox: PRODUCT_VIEWBOX,
		scenes: {
			// WorldStreet's W: where the dial opens and where it closes.
			worldstreet: scene([80, 80], {
				a: { paint: "gold", d: wLeft() },
				b: { paint: "gold", d: wRight() },
			}),
			// Vivid's dots.
			vivid: scene([80, 80], vivid),
			// Xstream's chilli under its flames; the flames sit behind it.
			xstream: scene([80, 92], {
				a: { paint: "flame", d: flameBig() },
				b: { paint: "flame2", d: flameMid() },
				c: { paint: "ember", d: flameSmall() },
				d: { paint: "chilli", d: chilli() },
				e: { paint: "stem", small: true, d: k.stroke(new Pen(126, 86).cu(128, 77, 134, 72, 139, 65).open()) },
			}),
			// A chart climbing inside a card, the arrowhead in brand.
			forex: scene([80, 80], {
				a: { paint: "tone", d: card },
				b: { paint: "ink", d: card },
				c: { paint: "ink", d: k.line([54, 98], [70, 80], [83, 90], [104, 66]) },
				d: { paint: "hi", small: true, d: k.line([92, 64], [105, 64], [105, 77]) },
			}),
			// A coin with a B, its two ticks in brand.
			crypto: scene([80, 80], {
				a: { paint: "tone", d: coin },
				b: { paint: "ink", d: coin },
				c: { paint: "ink", d: bee() },
				d: { paint: "hi", small: true, d: k.line([76, 51], [76, 59]) },
				e: { paint: "hi", small: true, d: k.line([78, 101], [78, 109]) },
			}),
			// The cap: the board, the band under it, the tassel in brand.
			academy: scene([80, 76], {
				a: { paint: "tone", d: cap },
				b: { paint: "ink", d: cap },
				c: { paint: "ink", d: k.stroke(new Pen(58, 79).to(58, 96).cu(66, 108, 94, 108, 102, 96).to(102, 79).open()) },
				d: { paint: "hi", small: true, d: k.line([124, 68], [124, 96]) },
			}),
			// The bag, its handle in brand.
			commerce: scene([80, 86], {
				a: { paint: "tone", d: bag },
				b: { paint: "ink", d: bag },
				c: { paint: "hi", d: k.stroke(new Pen(66, 72).cu(66, 92, 94, 92, 94, 72).open()) },
			}),
			// A target, its arrow in brand.
			prediction: scene([80, 80], {
				a: { paint: "tone", d: target },
				b: { paint: "ink", d: target },
				c: { paint: "ink", d: k.ringLine(80, 80, 23) },
				d: { paint: "dot", small: true, d: k.circle(80, 80, 8) },
				e: { paint: "hi", d: k.line([86, 74], [116, 44]) },
				f: { paint: "hi", small: true, d: k.line([106, 44], [116, 44], [116, 34]) },
			}),
			// A controller: the d-pad in ink, two buttons in brand.
			arcade: scene([80, 80], {
				a: { paint: "tone", d: controller },
				b: { paint: "ink", d: controller },
				c: { paint: "ink", small: true, d: k.line([60, 71], [60, 89]) },
				d: { paint: "ink", small: true, d: k.line([51, 80], [69, 80]) },
				e: { paint: "hi", small: true, d: k.circle(97, 75, 4) },
				f: { paint: "hi", small: true, d: k.circle(106, 86, 4) },
			}),
			// An eye: the iris in ink, a brand glint.
			vision: scene([80, 80], {
				a: { paint: "tone", d: almond },
				b: { paint: "ink", d: almond },
				c: { paint: "ink", d: k.circle(80, 80, 14) },
				d: { paint: "dot", small: true, d: k.circle(80, 80, 5) },
				e: { paint: "hi", small: true, d: k.arcLine(80, 80, 9, 200, 250) },
			}),
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

export const productScene = (title: string) => BY_TITLE[title] ?? "worldstreet";
