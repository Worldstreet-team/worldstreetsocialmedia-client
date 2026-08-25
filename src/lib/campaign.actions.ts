"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

// Default promotion: $10 budget, 5¢ per engagement — the gateway enforces
// ownership and one-active-campaign-per-post.
export async function promotePostAction(postId: string) {
	const { getToken } = await auth();
	const token = await getToken();
	if (!token) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.post(
			`${BACKEND_URL}/api/campaigns`,
			{ postId },
			{ headers: { Authorization: `Bearer ${token}` } },
		);
		return { success: true, campaignId: res.data?.campaignId };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Could not promote the post",
		};
	}
}
