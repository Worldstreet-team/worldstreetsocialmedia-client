"use client";

import axios from "axios";
import type { ChatTheme, ThemeByMode, ThemeMode } from "./chatTheme";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
type GetToken = () => Promise<string | null>;

const auth = async (getToken: GetToken) => ({
	headers: { Authorization: `Bearer ${await getToken()}` },
});

/** The profile-wide theme (both modes), image keys already presigned. */
export async function fetchGlobalTheme(getToken: GetToken): Promise<ThemeByMode> {
	const r = await axios.get(`${API_URL}/api/messages/theme`, await auth(getToken));
	return (r.data?.chatTheme ?? {}) as ThemeByMode;
}

/** null clears that mode back to the house default. */
export async function saveGlobalTheme(
	getToken: GetToken,
	mode: ThemeMode,
	theme: ChatTheme | null,
): Promise<ThemeByMode> {
	const r = await axios.patch(
		`${API_URL}/api/messages/theme`,
		{ mode, theme },
		await auth(getToken),
	);
	return (r.data?.chatTheme ?? {}) as ThemeByMode;
}

export async function saveChatTheme(
	getToken: GetToken,
	conversationId: string,
	mode: ThemeMode,
	theme: ChatTheme | null,
): Promise<ThemeByMode> {
	const r = await axios.patch(
		`${API_URL}/api/messages/${conversationId}/theme`,
		{ mode, theme },
		await auth(getToken),
	);
	return (r.data?.theme ?? {}) as ThemeByMode;
}

/** Downscale + re-encode (EXIF dies as a side effect) before upload. */
async function encodeWallpaper(file: File): Promise<Blob> {
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
	const w = Math.round(bitmap.width * scale);
	const h = Math.round(bitmap.height * scale);
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
	bitmap.close();
	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(b) => (b ? resolve(b) : reject(new Error("encode failed"))),
			"image/jpeg",
			0.82,
		),
	);
}

/**
 * Own photo, browser -> gateway -> R2 (media never rides a server action).
 * Rides the message upload endpoint, so a conversation the person is in
 * authorises it; the key is what gets stored, the url is for the preview.
 */
export async function uploadWallpaperImage(
	getToken: GetToken,
	file: File,
	conversationId: string,
): Promise<{ key: string; url: string }> {
	const blob = await encodeWallpaper(file);
	const fd = new FormData();
	fd.append("file", new File([blob], "wallpaper.jpg", { type: "image/jpeg" }));
	fd.append("conversationId", conversationId);
	const token = await getToken();
	const up = await axios.post(`${API_URL}/api/messages/upload`, fd, {
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "multipart/form-data",
		},
	});
	return { key: up.data.key ?? up.data.url, url: up.data.url };
}
