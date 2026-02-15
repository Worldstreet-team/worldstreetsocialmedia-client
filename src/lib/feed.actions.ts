"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

const API_URL = BACKEND_URL;

export async function getFeedAction(page: number = 1, limit: number = 10) {
	const { getToken } = await auth();
	const accessToken = await getToken();
	console.log("FeedAction: AccessToken present?", !!accessToken);

	if (!accessToken) {
		console.log("FeedAction: No token");
		return { success: false, message: "Unauthorized: No access token found" };
	}

	try {
		console.log(`Fetching feed page ${page} from ${API_URL}/api/feed`);
		const response = await axios.get(`${API_URL}/api/feed`, {
			params: { page, limit },
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		return { success: true, data: response.data };
	} catch (error: any) {
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

		console.log(
			`Fetching user feed ${type} for ${userId} from ${API_URL}${endpoint}`,
		);

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
