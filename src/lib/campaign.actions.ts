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

export async function getMyCampaignsAction() {
	const { getToken } = await auth();
	const token = await getToken();
	if (!token) return { success: false as const, message: "Unauthorized" };
	try {
		const res = await axios.get(`${BACKEND_URL}/api/campaigns/mine`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		return { success: true as const, campaigns: res.data?.campaigns ?? [] };
	} catch (error: any) {
		return {
			success: false as const,
			message:
				error.response?.data?.message || "Could not load campaigns",
		};
	}
}

export async function updateCampaignAction(
	id: string,
	body: {
		status?: "active" | "paused";
		addBudgetUsdMinor?: number;
		/** Required by the gateway for any top-up: proof the UI showed the
		 *  price before spending. The studio button states the amount. */
		confirmCharge?: boolean;
	},
) {
	const { getToken } = await auth();
	const token = await getToken();
	if (!token) return { success: false as const, message: "Unauthorized" };
	try {
		const res = await axios.patch(
			`${BACKEND_URL}/api/campaigns/${id}`,
			body,
			{ headers: { Authorization: `Bearer ${token}` } },
		);
		return { success: true as const, status: res.data?.status };
	} catch (error: any) {
		return {
			success: false as const,
			message:
				error.response?.data?.message || "Could not update campaign",
		};
	}
}
