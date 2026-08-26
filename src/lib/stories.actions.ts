"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

async function bearer() {
	const { getToken } = await auth();
	const token = await getToken();
	return token ? { Authorization: `Bearer ${token}` } : null;
}

export async function getStoriesAction() {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.get(`${BACKEND_URL}/api/stories`, { headers });
		return { success: true, data: res.data };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Failed to load stories",
		};
	}
}

export async function viewStoryAction(storyId: string) {
	const headers = await bearer();
	if (!headers) return { success: false };
	try {
		await axios.post(`${BACKEND_URL}/api/stories/${storyId}/view`, {}, { headers });
		return { success: true };
	} catch {
		return { success: false };
	}
}

export async function createStoryAction(formData: FormData) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.post(`${BACKEND_URL}/api/stories`, formData, {
			headers: { ...headers, "Content-Type": "multipart/form-data" },
			maxBodyLength: 30 * 1024 * 1024,
		});
		return { success: true, data: res.data };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Failed to post story",
		};
	}
}

/** Author only: who has seen a story of yours, and the live total. */
export async function getStoryViewersAction(storyId: string) {
	const headers = await bearer();
	if (!headers) return { success: false as const, viewers: [], viewsCount: 0 };
	try {
		const res = await axios.get(
			`${BACKEND_URL}/api/stories/${storyId}/viewers`,
			{ headers },
		);
		return {
			success: true as const,
			viewsCount: Number(res.data?.viewsCount ?? 0),
			viewers: (res.data?.viewers ?? []) as {
				id: string;
				username: string;
				avatar: string;
				isVerified: boolean;
				name: string;
			}[],
		};
	} catch {
		return { success: false as const, viewers: [], viewsCount: 0 };
	}
}

/**
 * One person's live stories, for the ring on their profile.
 *
 * The rail is follow-gated by design; this is the path that lets anyone who
 * can see a profile also see what that person posted.
 */
export async function getUserStoriesAction(username: string) {
	const { getToken } = await auth();
	const accessToken = await getToken();
	if (!accessToken) return { success: false as const, entry: null };
	try {
		const res = await axios.get(
			`${BACKEND_URL}/api/stories/user/${encodeURIComponent(username)}`,
			{ headers: { Authorization: `Bearer ${accessToken}` } },
		);
		return { success: true as const, entry: res.data?.entry ?? null };
	} catch {
		return { success: false as const, entry: null };
	}
}

/** Reply to a story. Lands in the normal DM thread with the author. */
export async function replyToStoryAction(storyId: string, text: string) {
	const headers = await bearer();
	if (!headers) return { success: false as const, message: "Unauthorized" };
	try {
		const res = await axios.post(
			`${BACKEND_URL}/api/stories/${encodeURIComponent(storyId)}/reply`,
			{ text },
			{ headers },
		);
		return {
			success: true as const,
			conversationId: res.data?.conversationId as string,
		};
	} catch (error: any) {
		return {
			success: false as const,
			message: error.response?.data?.message || "Could not send reply",
		};
	}
}

/** The $1 unlock. Idempotent server-side; re-calls after payment are free. */
export async function unlockStoryAction(storyId: string) {
	const headers = await bearer();
	if (!headers) return { success: false as const, message: "Unauthorized" };
	try {
		const res = await axios.post(
			`${BACKEND_URL}/api/stories/${encodeURIComponent(storyId)}/unlock`,
			{},
			{ headers },
		);
		return {
			success: true as const,
			url: res.data?.url as string,
		};
	} catch (error: any) {
		return {
			success: false as const,
			code: error.response?.data?.code as string | undefined,
			message: error.response?.data?.message || "Could not unlock",
		};
	}
}
