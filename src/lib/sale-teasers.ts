"use client";

/**
 * Teaser assets for paid posts, generated at post time in the seller's own
 * browser — because the rule of the paywall is that a non-buyer must never
 * receive the real asset in any form. A CSS-blurred copy of the real image
 * is fake security (the file is in the page, one devtools click from
 * stolen); a 24px-wide thumb upscaled is the honest tease — real colours
 * and composition, physically unrecoverable detail.
 */

const THUMB_W = 24;

/** Tiny preview thumb from an image or video file. Returns null on any
 *  failure — a missing tease degrades the storefront, never blocks the post. */
export async function makeTinyThumb(file: File): Promise<File | null> {
	try {
		let source: CanvasImageSource;
		let w: number;
		let h: number;

		if (file.type.startsWith("video/")) {
			const video = document.createElement("video");
			video.muted = true;
			video.playsInline = true;
			video.src = URL.createObjectURL(file);
			await new Promise<void>((resolve, reject) => {
				video.onloadeddata = () => resolve();
				video.onerror = () => reject(new Error("video load"));
			});
			// A beat in, not frame zero — openings are often black.
			video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
			await new Promise<void>((resolve) => {
				video.onseeked = () => resolve();
				setTimeout(resolve, 1500);
			});
			source = video;
			w = video.videoWidth;
			h = video.videoHeight;
			URL.revokeObjectURL(video.src);
		} else {
			const bitmap = await createImageBitmap(file);
			source = bitmap;
			w = bitmap.width;
			h = bitmap.height;
		}
		if (!w || !h) return null;

		const canvas = document.createElement("canvas");
		canvas.width = THUMB_W;
		canvas.height = Math.max(1, Math.round((h / w) * THUMB_W));
		const ctx = canvas.getContext("2d");
		if (!ctx) return null;
		ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

		const blob = await new Promise<Blob | null>((r) =>
			canvas.toBlob(r, "image/jpeg", 0.7),
		);
		if (!blob) return null;
		return new File([blob], "sale-thumb.jpg", { type: "image/jpeg" });
	} catch {
		return null;
	}
}

/** The first `seconds` of an audio file as a WAV — the audible taste a
 *  locked voice post offers. WAV because the browser has no compressed
 *  encoder handy; at 22.05kHz mono a 15s taste is ~650KB. */
export async function cutAudioPreview(
	file: File,
	seconds = 15,
): Promise<File | null> {
	try {
		const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
		const ctx = new Ctx();
		const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
		void ctx.close();
		// Shorter than the tease? The whole thing IS the tease — skip, and
		// the card just plays the real preview-less lock.
		if (decoded.duration <= seconds + 1) return null;

		const rate = 22050;
		const frames = Math.floor(seconds * rate);
		const off = new OfflineAudioContext(1, frames, rate);
		const src = off.createBufferSource();
		src.buffer = decoded;
		src.connect(off.destination);
		src.start(0);
		const cut = await off.startRendering();

		const data = cut.getChannelData(0);
		const buf = new ArrayBuffer(44 + data.length * 2);
		const v = new DataView(buf);
		const ws = (o: number, str: string) => {
			for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i));
		};
		ws(0, "RIFF");
		v.setUint32(4, 36 + data.length * 2, true);
		ws(8, "WAVEfmt ");
		v.setUint32(16, 16, true);
		v.setUint16(20, 1, true);
		v.setUint16(22, 1, true);
		v.setUint32(24, rate, true);
		v.setUint32(28, rate * 2, true);
		v.setUint16(32, 2, true);
		v.setUint16(34, 16, true);
		ws(36, "data");
		v.setUint32(40, data.length * 2, true);
		for (let i = 0; i < data.length; i++) {
			const s = Math.max(-1, Math.min(1, data[i]));
			v.setInt16(44 + i * 2, s * 0x7fff, true);
		}
		return new File([buf], "sale-preview.wav", { type: "audio/wav" });
	} catch {
		return null;
	}
}
