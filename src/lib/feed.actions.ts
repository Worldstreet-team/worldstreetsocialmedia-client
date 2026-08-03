"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

const API_URL = BACKEND_URL;

export async function getFeedAction(page: number = 1, limit: number = 10) {
	const { getToken } = await auth();
	const accessToken = await getToken();

	if (!accessToken) {
		return { success: false, message: "Unauthorized: No access token found" };
	}

	try {
		const response = await axios.get(`${API_URL}/api/feed`, {
			params: { page, limit },
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		return { success: true, data: response.data };
	} catch (error: any) {
		// Log the message only — the axios error object carries `config.headers`,
		// i.e. the user's bearer JWT, which must never reach server logs.
		console.error("Feed API error:", error.response?.status ?? error.message);

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
	type: "posts" | "media" | "likes" = "posts",
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
		console.error(
			`User feed API error (${type}):`,
			error.response?.status ?? error.message,
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
