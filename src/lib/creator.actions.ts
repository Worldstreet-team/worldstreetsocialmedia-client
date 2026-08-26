"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

async function bearer() {
	const { getToken } = await auth();
	const token = await getToken();
	return token ? { Authorization: `Bearer ${token}` } : null;
}

export async function becomeCreatorAction(category?: string) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.post(
			`${BACKEND_URL}/api/creator/activate`,
			{ category },
			{ headers },
		);
		return { success: true, role: res.data?.role };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Could not activate",
		};
	}
}

export async function getCreatorStatsAction(days?: number) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.get(`${BACKEND_URL}/api/creator/stats`, {
			headers,
			params: days ? { days } : undefined,
		});
		return { success: true, data: res.data?.stats };
	} catch (error: any) {
		return {
			success: false,
			notCreator: error.response?.status === 403,
			message: error.response?.data?.message || "Could not load stats",
		};
	}
}

export async function getCreatorPostsAction(before?: string) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.get(`${BACKEND_URL}/api/creator/posts`, {
			headers,
			params: before ? { before } : undefined,
		});
		return {
			success: true,
			posts: res.data?.posts ?? [],
			nextCursor: res.data?.nextCursor ?? null,
		};
	} catch (error: any) {
		return {
			success: false,
			notCreator: error.response?.status === 403,
			message: error.response?.data?.message || "Could not load posts",
		};
	}
}

export async function getCreatorPostStatsAction(id: string, days?: number) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.get(
			`${BACKEND_URL}/api/creator/posts/${id}/stats`,
			{ headers, params: days ? { days } : undefined },
		);
		return { success: true, post: res.data?.post, stats: res.data?.stats };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Could not load post stats",
		};
	}
}

export async function listPresetsAction() {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.get(`${BACKEND_URL}/api/creator/presets`, {
			headers,
		});
		return { success: true, presets: res.data?.presets ?? [] };
	} catch (error: any) {
		return {
			success: false,
			notCreator: error.response?.status === 403,
			message: error.response?.data?.message || "Could not load presets",
		};
	}
}

export async function createPresetAction(body: {
	name: string;
	title?: string;
	category?: string;
	isDefault?: boolean;
}) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.post(`${BACKEND_URL}/api/creator/presets`, body, {
			headers,
		});
		return { success: true, preset: res.data?.preset };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Could not save preset",
		};
	}
}

export async function updatePresetAction(
	id: string,
	body: {
		name?: string;
		title?: string;
		category?: string;
		isDefault?: boolean;
	},
) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.patch(
			`${BACKEND_URL}/api/creator/presets/${id}`,
			body,
			{ headers },
		);
		return { success: true, preset: res.data?.preset };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Could not update preset",
		};
	}
}

export async function deletePresetAction(id: string) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		await axios.delete(`${BACKEND_URL}/api/creator/presets/${id}`, {
			headers,
		});
		return { success: true };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Could not delete preset",
		};
	}
}
