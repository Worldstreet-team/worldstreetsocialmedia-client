"use client";

/**
 * Browser-side image compression, applied at the moment a file enters any
 * upload pipeline. Phones hand over 4-12MB originals; the feed renders at
 * ~600px. Shipping the original is why images "paint small small" — the
 * fix belongs at upload, so every reader forever gets a light file, rather
 * than at render, where each client pays again.
 *
 * WebP q0.82 capped at 2048px longest edge ≈ 150-400KB for a typical photo
 * (10-30x smaller). GIFs (animation), SVGs and already-small files pass
 * through untouched, and ANY failure returns the original — compression is
 * an optimisation, never a gate.
 */

import { PREFS_CACHE_KEY, normalizePrefs, saverOn } from "@/lib/preferences";
const MAX_EDGE = 2048;
const QUALITY = 0.82;
const SKIP_UNDER_BYTES = 300 * 1024;

/** Smaller files, either because it was chosen or because data saver is on. */
function lightUploads(): boolean {
	if (typeof window === "undefined") return false;
	try {
		const p = normalizePrefs(
			JSON.parse(localStorage.getItem(PREFS_CACHE_KEY) || "{}"),
		);
		return (
			p.data.uploadQuality === "low" ||
			(p.data.uploadQuality === "auto" && saverOn(p))
		);
	} catch {
		return false;
	}
}

export interface CompressOptions {
	/** Longest-edge cap. The HD send tier passes 4096 (register 66). */
	maxEdge?: number;
	quality?: number;
	skipUnderBytes?: number;
}

export async function compressImage(
	file: File,
	opts: CompressOptions = {},
): Promise<File> {
	// The owner's upload-quality setting. Read from the preference cache
	// rather than a hook: this runs from plain functions with no React
	// context above them. An explicit opts value always wins - the HD path
	// and the group avatar pass their own and must not be shrunk further.
	const light = lightUploads();
	const maxEdge = opts.maxEdge ?? (light ? 1280 : MAX_EDGE);
	const quality = opts.quality ?? (light ? 0.7 : QUALITY);
	const skipUnder =
		opts.skipUnderBytes ?? (light ? 100 * 1024 : SKIP_UNDER_BYTES);
	try {
		if (!file.type.startsWith("image/")) return file;
		if (file.type === "image/gif" || file.type === "image/svg+xml")
			return file;
		if (file.size < skipUnder) return file;

		const bitmap = await createImageBitmap(file);
		const scale = Math.min(
			1,
			maxEdge / Math.max(bitmap.width, bitmap.height),
		);
		const w = Math.round(bitmap.width * scale);
		const h = Math.round(bitmap.height * scale);

		const canvas = document.createElement("canvas");
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext("2d");
		if (!ctx) return file;
		ctx.drawImage(bitmap, 0, 0, w, h);
		bitmap.close();

		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, "image/webp", quality),
		);
		// A "compressed" file bigger than the original is a downgrade.
		if (!blob || blob.size >= file.size) return file;

		return new File(
			[blob],
			file.name.replace(/\.[^.]+$/, "") + ".webp",
			{ type: "image/webp" },
		);
	} catch {
		return file;
	}
}

/** Convenience for multi-file intakes (picker + paste share it). */
export function compressImages(files: File[]): Promise<File[]> {
	return Promise.all(files.map((f) => compressImage(f)));
}
