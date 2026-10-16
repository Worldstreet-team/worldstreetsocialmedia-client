"use client";

/**
 * Getting files ready for Vivid in the browser (owner 2026-10-16: "uploading
 * of files, latex files, audio"). Pictures are shrunk to 1600px JPEG before
 * they leave the device (smaller, faster, and the EXIF goes with the
 * re-encode); audio is measured so the transcript can say how long it was.
 * The gateway reads everything else.
 */

export const VIVID_FILE_ACCEPT = [
	".pdf",
	".docx",
	".txt",
	".md",
	".markdown",
	".csv",
	".tsv",
	".tex",
	".bib",
	".json",
	".yaml",
	".yml",
	".log",
	"image/*",
	"audio/*",
	".mp3",
	".m4a",
	".wav",
	".ogg",
	".opus",
	".webm",
	".aac",
	".flac",
].join(",");

export const MAX_FILES = 5;

export type FileFamily = "image" | "audio" | "doc";

export function familyOf(file: File): FileFamily {
	if (file.type.startsWith("image/")) return "image";
	if (file.type.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|oga|opus|webm|aac|flac)$/i.test(file.name)) return "audio";
	return "doc";
}

/** 1600px on the long side, JPEG at 0.85. A picture the browser can't decode comes back as it was. */
export async function shrinkImage(file: File, max = 1600, quality = 0.85): Promise<File> {
	let bitmap: ImageBitmap | null = null;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		return file;
	}
	const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
	const w = Math.max(1, Math.round(bitmap.width * scale));
	const h = Math.max(1, Math.round(bitmap.height * scale));
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	if (!ctx) return file;
	ctx.drawImage(bitmap, 0, 0, w, h);
	bitmap.close();
	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
	if (!blob) return file;
	return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "picture"}.jpg`, { type: "image/jpeg" });
}

/** An audio file's length in seconds, or null when the browser can't tell. */
export function audioDuration(file: File): Promise<number | null> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const audio = new Audio();
		audio.preload = "metadata";
		const done = (v: number | null) => {
			URL.revokeObjectURL(url);
			resolve(v);
		};
		audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? audio.duration : null);
		audio.onerror = () => done(null);
		setTimeout(() => done(null), 4000);
		audio.src = url;
	});
}

export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
