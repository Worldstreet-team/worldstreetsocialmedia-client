"use client";

import {
	type ChatTheme,
	type ThemeMode,
	type ThemeWallpaper,
	contrast,
	luminance,
	mixHex,
	pictureGround,
} from "./chatTheme";

/**
 * A theme derived from a picture (owner 2026-09-25: "themes with aesthetic
 * images where the theme is derived from the image"). The picture is read
 * once, small, and four colours come out of it: its tint and tone (the
 * ground family), the most vivid colour with real presence (my bubbles,
 * the bars, the send button) and a second colour at least 45 degrees of
 * hue away (their bubbles). Everything else the thread paints derives
 * from those in themeVars(), the same as for a curated card.
 *
 * An own photo is sampled from the FILE at upload: the served copy is a
 * presigned R2 url with no CORS headers, and drawing that taints the
 * canvas. A preset is same-origin and can be sampled from its url.
 */

export interface ImageSample {
	/** The mean colour of the picture. */
	tint: string;
	/** The pole the picture sits nearest: dark under 0.35 mean luminance. */
	tone: ThemeMode;
	/** The most vivid colour with presence, as measured. */
	accent: string;
	/** A second hue at least 45 degrees from the accent, else the tint. */
	second: string;
}

const SIZE = 48;
const BINS = 24;

const hex = (r: number, g: number, b: number) =>
	`#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;

function hsl(r: number, g: number, b: number): [number, number, number] {
	const R = r / 255;
	const G = g / 255;
	const B = b / 255;
	const max = Math.max(R, G, B);
	const min = Math.min(R, G, B);
	const l = (max + min) / 2;
	const d = max - min;
	if (d === 0) return [0, 0, l];
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h: number;
	if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) * 60;
	else if (max === G) h = ((B - R) / d + 2) * 60;
	else h = ((R - G) / d + 4) * 60;
	return [h, s, l];
}

/** Relative luminance of one 8-bit channel triple, the WCAG way. */
function relLum(r: number, g: number, b: number): number {
	const c = [r, g, b].map((v) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

async function load(src: File | Blob | string): Promise<ImageBitmap | HTMLImageElement> {
	if (typeof src !== "string") return createImageBitmap(src);
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.decoding = "async";
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error("The picture could not be read"));
		img.src = src;
	});
}

/** Read a picture's colours. Throws when the picture cannot be read. */
export async function sampleImage(src: File | Blob | string): Promise<ImageSample> {
	const bmp = await load(src);
	const w = "naturalWidth" in bmp ? bmp.naturalWidth : bmp.width;
	const h = "naturalHeight" in bmp ? bmp.naturalHeight : bmp.height;
	const canvas = document.createElement("canvas");
	canvas.width = SIZE;
	canvas.height = SIZE;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx || !w || !h) throw new Error("The picture could not be read");
	// Cover, centred: the middle of a picture is what a person chose it for.
	const scale = Math.max(SIZE / w, SIZE / h);
	const dw = w * scale;
	const dh = h * scale;
	ctx.drawImage(bmp, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh);
	if ("close" in bmp) bmp.close();
	const data = ctx.getImageData(0, 0, SIZE, SIZE).data;

	let sr = 0;
	let sg = 0;
	let sb = 0;
	let sl = 0;
	let n = 0;
	const bins = Array.from({ length: BINS }, () => ({
		w: 0,
		px: [] as { wt: number; r: number; g: number; b: number }[],
	}));
	for (let i = 0; i < data.length; i += 4) {
		const r = data[i];
		const g = data[i + 1];
		const b = data[i + 2];
		sr += r;
		sg += g;
		sb += b;
		sl += relLum(r, g, b);
		n++;
		const [hh, s, l] = hsl(r, g, b);
		// Only colour with body counts toward the accent: not the greys,
		// not the near-black shadows, not the blown highlights.
		if (s < 0.3 || l < 0.15 || l > 0.85) continue;
		const bin = bins[Math.floor(hh / (360 / BINS)) % BINS];
		const wt = s * (1 - Math.abs(l - 0.5) * 1.2);
		bin.w += wt;
		bin.px.push({ wt, r, g, b });
	}
	const tint = hex(sr / n, sg / n, sb / n);
	const tone: ThemeMode = sl / n < 0.35 ? "dark" : "light";
	// A hue is judged with half of each neighbour, so a colour that straddles
	// two bins is not out-voted by a narrower one.
	const score = bins.map(
		(b, i) => b.w + 0.5 * (bins[(i + BINS - 1) % BINS].w + bins[(i + 1) % BINS].w),
	);
	let best = 0;
	for (let i = 1; i < BINS; i++) if (score[i] > score[best]) best = i;
	// A hue's colour is the mean of its most vivid sixth, not of all its
	// pixels: a glow that fades into black has far more dark pixels than
	// bright ones, and a plain mean landed on a muddy wine where the
	// picture said red.
	const vivid = (b: (typeof bins)[number]) => {
		const px = [...b.px].sort((x, y) => y.wt - x.wt);
		const top = px.slice(0, Math.max(8, Math.ceil(px.length * 0.15)));
		let r = 0;
		let g = 0;
		let bl = 0;
		for (const p of top) {
			r += p.r;
			g += p.g;
			bl += p.b;
		}
		return hex(r / top.length, g / top.length, bl / top.length);
	};
	// A picture with no colour in it (a black-and-white photograph) keeps
	// its tint as the accent; themeFromSample turns that into ink.
	const accent = bins[best].w > 0 ? vivid(bins[best]) : tint;
	let secondAt = -1;
	for (let i = 0; i < BINS; i++) {
		const dist = Math.min((i - best + BINS) % BINS, (best - i + BINS) % BINS);
		if (dist < 3 || bins[i].w < bins[best].w * 0.12) continue;
		if (secondAt < 0 || score[i] > score[secondAt]) secondAt = i;
	}
	const second = secondAt >= 0 ? vivid(bins[secondAt]) : tint;
	return { tint, tone, accent, second };
}

const sat = (c: string) => {
	const n = Number.parseInt(c.slice(1), 16);
	return hsl(n >> 16, (n >> 8) & 255, n & 255)[1];
};
const lightnessOf = (c: string) => {
	const n = Number.parseInt(c.slice(1), 16);
	return hsl(n >> 16, (n >> 8) & 255, n & 255)[2];
};

/**
 * Turn a sample into a whole theme, on the rules every curated card keeps:
 * my fill deep enough for white ink at 4.5:1 (a fill between 0.18 and 0.42
 * luminance gets white ink and fails, so never land there), their fill
 * legible with its own ink and standing off the ground (1.6:1 in the dark,
 * 1.2:1 on paper), bubbles 22/8, and the bars coloured.
 */
export function themeFromSample(
	s: ImageSample,
	picture: Pick<ThemeWallpaper, "type" | "preset" | "imageKey" | "imageUrl">,
): ChatTheme {
	const dark = s.tone === "dark";
	// A busy picture wants a wash under the text; a pale one barely any.
	const dim = dark ? 20 : 6;
	const wallpaper: ThemeWallpaper = {
		...picture,
		frost: 0,
		hue: "none",
		dim,
		// A preset carries its tint on its row; only an own photo stores one.
		tint: picture.type === "image" ? s.tint : undefined,
		tone: picture.type === "image" ? s.tone : undefined,
	};
	const { base } = pictureGround(s.tint, s.tone, dim);

	let accent = s.accent;
	// Two ways to a legible fill, chosen by what the colour IS. A light
	// colour (a gold, a cyan, a peach) stays light and takes dark ink, the
	// way Lamplight's gold does; darkened for white ink it turns to mud. A
	// deep colour is walked under 0.18 luminance for white ink. Nothing
	// lands between 0.18 and 0.42, where white ink fails.
	const light = lightnessOf(accent) >= 0.55;
	if (sat(accent) < 0.12) {
		// No colour to take: the accent is ink, like Obsidian.
		accent = dark ? "#F4F4F5" : "#18181B";
	} else if (light) {
		// To 0.5, not the 0.42 line: the gradient's second stop sits a
		// little under the first, and the ink is chosen by their average.
		for (let i = 0; i < 14 && luminance(accent) < 0.5; i++) accent = mixHex(accent, "#FFFFFF", 0.1);
	} else {
		for (let i = 0; i < 14 && luminance(accent) > 0.18; i++) accent = mixHex(accent, "#000000", 0.1);
		// A colour that was already deep (a navy, a wine) must still stand
		// off a dark ground; lifted a little, never past the white-ink line.
		for (let i = 0; i < 10 && contrast(accent, base) < 1.8 && luminance(accent) < 0.17; i++)
			accent = mixHex(accent, "#FFFFFF", 0.06);
	}
	const mine: ChatTheme["bubbles"]["mine"] =
		sat(accent) < 0.12
			? { kind: "solid", color: accent }
			: { kind: "gradient", stops: [accent, mixHex(accent, "#000000", light ? 0.08 : 0.25)], angle: 140 };

	let theirs = s.second;
	if (dark) {
		theirs = mixHex(theirs, "#000000", 0.5);
		for (let i = 0; i < 12 && luminance(theirs) > 0.15; i++) theirs = mixHex(theirs, "#000000", 0.1);
		for (let i = 0; i < 12 && contrast(theirs, base) < 1.6; i++) theirs = mixHex(theirs, "#FFFFFF", 0.06);
	} else {
		theirs = mixHex(theirs, "#FFFFFF", 0.55);
		for (let i = 0; i < 12 && luminance(theirs) < 0.5; i++) theirs = mixHex(theirs, "#FFFFFF", 0.1);
		for (let i = 0; i < 12 && contrast(theirs, base) < 1.2 && luminance(theirs) > 0.45; i++)
			theirs = mixHex(theirs, "#000000", 0.05);
	}
	return {
		wallpaper,
		bubbles: { mine, theirs: { color: theirs }, shape: "rounded" },
	};
}

/** Read a picture and build its theme in one go. */
export async function themeFromPicture(
	src: File | Blob | string,
	picture: Pick<ThemeWallpaper, "type" | "preset" | "imageKey" | "imageUrl">,
): Promise<ChatTheme> {
	return themeFromSample(await sampleImage(src), picture);
}
