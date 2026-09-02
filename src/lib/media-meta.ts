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
