"use client";

import { rgbaToThumbHash, thumbHashToDataURL } from "thumbhash";

/**
 * Geometry + placeholder for an image at SEND time. The receiver reserves
 * the exact box (no layout shift under the bottom pin) and paints the
 * thumbhash before a single media byte arrives — the Telegram/Signal trick,
 * computed here because only the sender ever holds the file.
 */
export async function imageMeta(
	file: File,
): Promise<{ width: number; height: number; thumbhash?: string }> {
	const bitmap = await createImageBitmap(file);
	const { width, height } = bitmap;
	let thumbhash: string | undefined;
	try {
		// ThumbHash wants ≤100px on the long side.
		const scale = 100 / Math.max(width, height);
		const w = Math.max(1, Math.round(width * scale));
		const h = Math.max(1, Math.round(height * scale));
		const canvas = document.createElement("canvas");
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.drawImage(bitmap, 0, 0, w, h);
			const pixels = ctx.getImageData(0, 0, w, h);
			const hash = rgbaToThumbHash(w, h, pixels.data);
			thumbhash = btoa(String.fromCharCode(...hash));
		}
	} catch {
		// A placeholder is a garnish; geometry alone still reserves the box.
	}
	bitmap.close();
	return { width, height, thumbhash };
}

/**
 * Geometry, duration and a poster-frame thumbhash for a VIDEO at send time
 * (register 70). The frame grab replaces a poster upload: the receiver's
 * reserved box paints the hash instantly, and the element's own
 * `preload="metadata"` supplies real pixels a beat later.
 */
export function videoMeta(file: File): Promise<{
	width?: number;
	height?: number;
	durationSec?: number;
	thumbhash?: string;
}> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const video = document.createElement("video");
		const done = (meta: {
			width?: number;
			height?: number;
			durationSec?: number;
			thumbhash?: string;
		}) => {
			URL.revokeObjectURL(url);
			video.src = "";
			resolve(meta);
		};
		// Metadata is an enhancement; a codec the browser can't probe must
		// never block the send.
		const bail = setTimeout(() => done({}), 4000);
		video.muted = true;
		video.playsInline = true;
		video.preload = "metadata";
		video.onerror = () => {
			clearTimeout(bail);
			done({});
		};
		video.onloadedmetadata = () => {
			video.currentTime = Math.min(0.1, video.duration || 0);
		};
		video.onseeked = () => {
			clearTimeout(bail);
			const width = video.videoWidth || undefined;
			const height = video.videoHeight || undefined;
			const durationSec =
				Number.isFinite(video.duration) && video.duration > 0
					? Math.round(video.duration)
					: undefined;
			let thumbhash: string | undefined;
			try {
				if (width && height) {
					const scale = 100 / Math.max(width, height);
					const w = Math.max(1, Math.round(width * scale));
					const h = Math.max(1, Math.round(height * scale));
					const canvas = document.createElement("canvas");
					canvas.width = w;
					canvas.height = h;
					const ctx = canvas.getContext("2d");
					if (ctx) {
						ctx.drawImage(video, 0, 0, w, h);
						const pixels = ctx.getImageData(0, 0, w, h);
						const hash = rgbaToThumbHash(w, h, pixels.data);
						thumbhash = btoa(String.fromCharCode(...hash));
					}
				}
			} catch {
				// Cross-codec canvas taint or decode hiccup: geometry survives.
			}
			done({ width, height, durationSec, thumbhash });
		};
		video.src = url;
	});
}

/** Decode a stored thumbhash into a data URL for a background image. */
export function thumbhashToDataURL(hash?: string): string | undefined {
	if (!hash) return undefined;
	try {
		const bytes = Uint8Array.from(atob(hash), (c) => c.charCodeAt(0));
		return thumbHashToDataURL(bytes);
	} catch {
		return undefined;
	}
}

/**
 * Aspect ratio (width / height) of a video by URL, learned WITHOUT playing
 * it, and remembered for the session.
 *
 * The feed reserves a clip's box from its real shape. On mobile a browser
 * will not load a clip's metadata until it actually plays, so a paused or
 * not-yet-autoplayed portrait clip had no known shape and fell back to the
 * 16:9 placeholder, letterboxed in a wide box (owner report 2026-09-16). A
 * detached `preload="metadata"` element reads the dimensions off the same
 * bytes without becoming a visible, playing video, and the cache means each
 * URL is probed at most once and every later mount is instant.
 */
const VIDEO_RATIO_CACHE = new Map<string, number>();

/** The remembered raw ratio for a URL, if we have it. */
export function cachedVideoRatio(src: string): number | undefined {
	return VIDEO_RATIO_CACHE.get(src);
}

/** Remember a ratio learned elsewhere (e.g. the visible element's own
 *  loadedmetadata), so siblings and later mounts of the same URL get it. */
export function rememberVideoRatio(src: string, ratio: number): void {
	if (src && Number.isFinite(ratio) && ratio > 0) {
		VIDEO_RATIO_CACHE.set(src, ratio);
	}
}

/** Learn a URL's ratio via a detached metadata load. Resolves null when the
 *  browser will not surface it (e.g. iOS deferring metadata until a gesture);
 *  the visible element's own play still fills the cache in that case. */
export function probeVideoRatio(src: string): Promise<number | null> {
	const hit = VIDEO_RATIO_CACHE.get(src);
	if (hit) return Promise.resolve(hit);
	if (typeof document === "undefined") return Promise.resolve(null);
	return new Promise((resolve) => {
		const video = document.createElement("video");
		let settled = false;
		const finish = (r: number | null) => {
			if (settled) return;
			settled = true;
			clearTimeout(bail);
			video.onloadedmetadata = null;
			video.onerror = null;
			video.removeAttribute("src");
			resolve(r);
		};
		// Metadata is an enhancement; a codec the browser cannot probe must
		// never hang a pending promise.
		const bail = setTimeout(() => finish(null), 4000);
		video.muted = true;
		video.playsInline = true;
		video.preload = "metadata";
		video.onerror = () => finish(null);
		video.onloadedmetadata = () => {
			const w = video.videoWidth;
			const h = video.videoHeight;
			if (w > 0 && h > 0) {
				const r = w / h;
				VIDEO_RATIO_CACHE.set(src, r);
				finish(r);
			} else finish(null);
		};
		video.src = src;
	});
}
