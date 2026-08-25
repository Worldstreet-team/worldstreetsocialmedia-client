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
