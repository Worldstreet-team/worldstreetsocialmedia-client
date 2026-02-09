"use server";

import { BACKEND_URL } from "@/const";
import axios from "axios";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || BACKEND_URL;

export async function getFeedAction(page: number = 1, limit: number = 10) {
	const cookieStore = await cookies();
	const accessToken = cookieStore.get("accessToken")?.value;

	if (!accessToken) {
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
