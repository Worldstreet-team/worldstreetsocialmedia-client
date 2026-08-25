"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

async function bearer() {
	const { getToken } = await auth();
	const token = await getToken();
	return token ? { Authorization: `Bearer ${token}` } : null;
}

export async function getCommunitiesAction() {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.get(`${BACKEND_URL}/api/communities`, { headers });
		return { success: true, communities: res.data?.communities ?? [] };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Failed to load communities",
		};
	}
}

export async function createCommunityAction(
	name: string,
	description: string,
	category: string,
) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.post(
			`${BACKEND_URL}/api/communities`,
			{ name, description, category },
			{ headers },
		);
		return { success: true, slug: res.data?.slug };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Could not create community",
		};
	}
}

export async function toggleCommunityAction(id: string, join: boolean) {
	const headers = await bearer();
	if (!headers) return { success: false };
	try {
		await axios.post(
			`${BACKEND_URL}/api/communities/${id}/${join ? "join" : "leave"}`,
			{},
			{ headers },
		);
		return { success: true };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message,
		};
	}
}
