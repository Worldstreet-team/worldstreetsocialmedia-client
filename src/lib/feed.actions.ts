"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

const API_URL = BACKEND_URL;

export async function getFeedAction(
	cursor: string | null = null,
	limit: number = 10,
	mode: "foryou" | "following" = "foryou",
) {
	const { getToken } = await auth();
	const accessToken = await getToken();

	if (!accessToken) {
		console.log("FeedAction: No token");
		return { success: false, message: "Unauthorized: No access token found" };
	}

	try {
		const response = await axios.get(`${API_URL}/api/feed`, {
			params: { limit, mode, ...(cursor ? { cursor } : {}) },
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		return { success: true, data: response.data };
	} catch (error: any) {
		console.log("ERROR: ", error);
		console.log("Feed API Error: ", error.response?.data || error.message);

		if (axios.isAxiosError(error)) {
			return {
				success: false,
				message: error.response?.data?.message || "Failed to fetch feed",
			};
		}

		return { success: false, message: "Something went wrong" };
	}
}

export async function getUserFeedAction(
	userId: string,
	type: "posts" | "replies" | "media" | "likes" = "posts",
	page: number = 1,
	limit: number = 10,
) {
	const { getToken } = await auth();
	const accessToken = await getToken();

	if (!accessToken) {
		return { success: false, message: "Unauthorized: No access token found" };
	}

	try {
		let endpoint = `/api/posts/user/${userId}`;
		if (type === "replies") endpoint += "/replies";
		if (type === "media") endpoint += "/media";
		if (type === "likes") endpoint += "/likes";


		const response = await axios.get(`${API_URL}${endpoint}`, {
			params: { page, limit },
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		return { success: true, data: response.data };
	} catch (error: any) {
		console.log(
			`User Feed API Error (${type}): `,
			error.response?.data || error.message,
		);

		if (axios.isAxiosError(error)) {
			return {
				success: false,
				message: error.response?.data?.message || "Failed to fetch user feed",
			};
		}

		return { success: false, message: "Something went wrong" };
	}
}

export async function getVideoFeedAction(
	cursor: string | null = null,
	limit: number = 8,
) {
	const { getToken } = await auth();
	const accessToken = await getToken();
	if (!accessToken) {
		return { success: false, message: "Unauthorized: No access token found" };
	}
	try {
		const response = await axios.get(`${API_URL}/api/feed/videos`, {
			params: { limit, ...(cursor ? { cursor } : {}) },
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		return { success: true, data: response.data };
	} catch (error: any) {
		if (axios.isAxiosError(error)) {
			return {
				success: false,
				message: error.response?.data?.message || "Failed to fetch videos",
			};
		}
		return { success: false, message: "Something went wrong" };
	}
}
