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

export async function getCreatorStatsAction() {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.get(`${BACKEND_URL}/api/creator/stats`, { headers });
		return { success: true, data: res.data?.stats };
	} catch (error: any) {
		return {
			success: false,
			notCreator: error.response?.status === 403,
			message: error.response?.data?.message || "Could not load stats",
		};
	}
}
