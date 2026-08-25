"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

async function bearer() {
	const { getToken } = await auth();
	const token = await getToken();
	return token ? { Authorization: `Bearer ${token}` } : null;
}

export async function getSpacesAction() {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.get(`${BACKEND_URL}/api/spaces`, { headers });
		return {
			success: true,
			live: res.data?.live ?? [],
			upcoming: res.data?.upcoming ?? [],
		};
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Failed to load spaces",
		};
	}
}

export async function createSpaceAction(
	title: string,
	scheduledFor?: string,
	communityId?: string,
) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.post(
			`${BACKEND_URL}/api/spaces`,
			{ title, scheduledFor, communityId },
			{ headers },
		);
		return { success: true, spaceId: res.data?.spaceId };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Could not create the space",
		};
	}
}

export async function joinSpaceAction(id: string) {
	const headers = await bearer();
	if (!headers) return { success: false };
	try {
		await axios.post(`${BACKEND_URL}/api/spaces/${id}/join`, {}, { headers });
		return { success: true };
	} catch {
		return { success: false };
	}
}

export async function startSpaceAction(id: string) {
	const headers = await bearer();
	if (!headers) return { success: false };
	try {
		await axios.post(`${BACKEND_URL}/api/spaces/${id}/start`, {}, { headers });
		return { success: true };
	} catch (error: any) {
		return { success: false, message: error.response?.data?.message };
	}
}

export async function endSpaceAction(id: string) {
	const headers = await bearer();
	if (!headers) return { success: false };
	try {
		await axios.post(`${BACKEND_URL}/api/spaces/${id}/end`, {}, { headers });
		return { success: true };
	} catch (error: any) {
		return { success: false, message: error.response?.data?.message };
	}
}
