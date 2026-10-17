"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

const API_URL = BACKEND_URL;

/**
 * Mute: the quiet alternative to block (gateway mute.controller.ts). A
 * muted account's posts leave your feeds and its actions stop notifying
 * you; it is never told, and can still see you and message you.
 */

async function bearer() {
	const { getToken } = await auth();
	const token = await getToken();
	return token ? { Authorization: `Bearer ${token}` } : null;
}

const fail = (error: any, fallback: string) => ({
	success: false as const,
	message: (error?.response?.data?.message as string) || fallback,
});

export async function muteUserAction(targetUserId: string) {
	const headers = await bearer();
	if (!headers) return { success: false as const, message: "Unauthorized" };
	try {
		await axios.post(`${API_URL}/api/users/${targetUserId}/mute`, {}, { headers });
		return { success: true as const };
	} catch (error: any) {
		console.error("Mute User Error:", error.response?.data || error.message);
		return fail(error, "Could not mute");
	}
}

export async function unmuteUserAction(targetUserId: string) {
	const headers = await bearer();
	if (!headers) return { success: false as const, message: "Unauthorized" };
	try {
		await axios.post(`${API_URL}/api/users/${targetUserId}/unmute`, {}, { headers });
		return { success: true as const };
	} catch (error: any) {
		console.error("Unmute User Error:", error.response?.data || error.message);
		return fail(error, "Could not unmute");
	}
}

export async function getMutedUsersAction() {
	const headers = await bearer();
	if (!headers) return { success: false as const, message: "Unauthorized", data: [] };
	try {
		const res = await axios.get(`${API_URL}/api/users/me/muted`, { headers });
		return { success: true as const, data: res.data?.data ?? [] };
	} catch (error: any) {
		console.error("Get Muted Users Error:", error.response?.data || error.message);
		return { ...fail(error, "Could not load muted accounts"), data: [] };
	}
}

export async function getMutedWordsAction() {
	const headers = await bearer();
	if (!headers) return { success: false as const, message: "Unauthorized", data: [] as string[] };
	try {
		const res = await axios.get(`${API_URL}/api/users/me/muted-words`, { headers });
		return { success: true as const, data: (res.data?.data ?? []) as string[] };
	} catch (error: any) {
		console.error("Get Muted Words Error:", error.response?.data || error.message);
		return { ...fail(error, "Could not load muted words"), data: [] as string[] };
	}
}

/** The whole list, replaced. Returns the list as the gateway stored it. */
export async function setMutedWordsAction(words: string[]) {
	const headers = await bearer();
	if (!headers) return { success: false as const, message: "Unauthorized", data: [] as string[] };
	try {
		const res = await axios.put(`${API_URL}/api/users/me/muted-words`, { words }, { headers });
		return { success: true as const, data: (res.data?.data ?? []) as string[] };
	} catch (error: any) {
		console.error("Set Muted Words Error:", error.response?.data || error.message);
		return { ...fail(error, "Could not save muted words"), data: [] as string[] };
	}
}
