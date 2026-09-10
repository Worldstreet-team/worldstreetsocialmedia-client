"use client";

import { memo, useEffect, useRef } from "react";
import { groundCss, type ThemeWallpaper, wallpaperSrc } from "./chatTheme";

/**
 * The picture behind a chat. Absolute under the transparent header, list
 * and composer of whatever pane it sits in.
 *
 * Frost, the cyan hue and the dim are BAKED, not filtered (2026-09-10).
 * They used to be a CSS blur and grayscale on the image, a mix-blend layer
 * and a wash div, stacked under the virtualised thread: that asks the
 * compositor to redo a full-pane blur and blend on every frame it redraws,
 * and from scratch every time the pane changes size, which on a phone is
 * every scroll that collapses the browser bar. Promoting that stack to its
 * own layer (translateZ + will-change + contain: paint) was tried as the
 * cure and never measured. Measured in the real thread (2026-09-10, Chrome
 * 152, 144Hz, DPR 2, rAF-driven scroll, frames over 1.5x the refresh
 * counted): flat ground 13-49 slow frames of ~400; that same stack promoted
 * at 24px blur 89 slow of 303 with p95 20.8ms, and UNpromoted 5 slow of 425
 * with p95 7.5ms. The promotion was the cost: a filter on a composited layer
 * is re-applied every frame, while an unpromoted one is rasterised once and
 * tiled. Baked, the themed thread measures the same as the flat one (20-45
 * slow of ~400, p95 7.8-13.9ms, inside the flat run's own variance). What
 * jank remains is the thread's rows, not the wallpaper.
 *
 * So: the picture is drawn once into a canvas when the wallpaper changes,
 * and what sits under the thread is one plain texture. Nothing about it
 * costs anything per frame or per resize, and nothing here promotes a layer.
 *
 * `resolution` is the working width of that canvas. The pane wants the
 * full 1280; a gallery card is 150px wide and wants nothing like it.
 */
export const ThemeBackdrop = memo(function ThemeBackdrop({
	wallpaper,
	resolution = 1280,
}: {
	wallpaper: ThemeWallpaper;
	resolution?: number;
}) {
	const src = wallpaperSrc(wallpaper);
	const painted = groundCss(wallpaper);
	const ref = useRef<HTMLCanvasElement>(null);
	const { frost, hue, dim } = wallpaper;
	useEffect(() => {
		const canvas = ref.current;
		if (!src || !canvas) return;
		let gone = false;
		const img = new Image();
		img.decoding = "async";
		// No crossOrigin: an own photo is a presigned R2 url, and without
		// CORS headers the load would fail outright. Drawing a cross-origin
		// image only taints the canvas, and nothing here reads pixels back.
		img.onload = () => {
			if (gone) return;
			bake(canvas, img, { frost, hue, dim }, resolution);
			canvas.style.opacity = "1";
		};
		img.src = src;
		return () => {
			gone = true;
		};
	}, [src, frost, hue, dim, resolution]);

	// A painted ground needs no image, no blur and no dim - it IS the colour.
	if (!src)
		return painted ? (
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0"
				style={{ background: painted }}
			/>
		) : null;
	return (
		<div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
			<canvas
				ref={ref}
				className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity"
			/>
		</div>
	);
});

/**
 * Draw the wallpaper with its treatments into the canvas, once. Frost is a
 * blur of 0..24 css px at the pane; the canvas is `W` wide but covers the
 * pane's css width, so the radius is rescaled to keep the same look.
 */
function bake(
	canvas: HTMLCanvasElement,
	img: HTMLImageElement,
	w: Pick<ThemeWallpaper, "frost" | "hue" | "dim">,
	resolution: number,
) {
	const iw = img.naturalWidth || resolution;
	const ih = img.naturalHeight || resolution;
	const W = Math.min(resolution, iw);
	const H = Math.max(1, Math.round((ih * W) / iw));
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	const cssWidth = canvas.getBoundingClientRect().width || W;
	const blur = ((w.frost / 100) * 24 * W) / cssWidth;
	// 4% bleed on every side, so the blur's soft edge never shows the pane.
	const ox = W * 0.04;
	const oy = H * 0.04;
	if (blur < 0.5) {
		ctx.drawImage(img, -ox, -oy, W + 2 * ox, H + 2 * oy);
	} else if ("filter" in ctx) {
		ctx.filter = `blur(${blur.toFixed(1)}px)`;
		ctx.drawImage(img, -ox, -oy, W + 2 * ox, H + 2 * oy);
		ctx.filter = "none";
	} else {
		drawBlurredFallback(ctx, img, W, H, ox, oy, blur);
	}
	if (w.hue === "cyan") {
		// Grayscale, then the brand colour in `color` blend at 0.92: the same
		// two operations the CSS stack used to do, drawn once.
		ctx.globalCompositeOperation = "saturation";
		ctx.fillStyle = "#000000";
		ctx.fillRect(0, 0, W, H);
		ctx.globalCompositeOperation = "color";
		ctx.globalAlpha = 0.92;
		ctx.fillStyle =
			getComputedStyle(canvas).getPropertyValue("--ws-brand-primary").trim() ||
			"#EAB308";
		ctx.fillRect(0, 0, W, H);
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = "source-over";
	}
	if (w.dim > 0) {
		ctx.fillStyle = `rgba(0,0,0,${w.dim / 100})`;
		ctx.fillRect(0, 0, W, H);
	}
}

/**
 * A browser without `ctx.filter`: halve the picture until one step is about
 * the blur radius, then draw it back up. Bilinear both ways passes for a
 * Gaussian under a dim, and a frosted wallpaper is under a dim.
 */
function drawBlurredFallback(
	ctx: CanvasRenderingContext2D,
	img: HTMLImageElement,
	W: number,
	H: number,
	ox: number,
	oy: number,
	blur: number,
) {
	const steps = Math.max(1, Math.min(5, Math.round(Math.log2(Math.max(2, blur)))));
	let src: CanvasImageSource = img;
	let sw = W + 2 * ox;
	let sh = H + 2 * oy;
	for (let i = 0; i < steps; i++) {
		const c = document.createElement("canvas");
		c.width = Math.max(1, Math.round(sw / 2));
		c.height = Math.max(1, Math.round(sh / 2));
		const cx = c.getContext("2d");
		if (!cx) return;
		cx.imageSmoothingEnabled = true;
		cx.imageSmoothingQuality = "high";
		cx.drawImage(src, 0, 0, c.width, c.height);
		src = c;
		sw = c.width;
		sh = c.height;
	}
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = "high";
	ctx.drawImage(src, -ox, -oy, W + 2 * ox, H + 2 * oy);
}
