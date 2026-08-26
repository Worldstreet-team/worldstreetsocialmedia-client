"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

async function bearer() {
	const { getToken } = await auth();
	const token = await getToken();
	return token ? { Authorization: `Bearer ${token}` } : null;
}

export interface SubscriptionState {
	available: boolean;
	priceUsdMinor: number;
	subscription: {
		status: "active" | "past_due" | "canceled" | "expired";
		currentPeriodEnd: string;
		cancelAtPeriodEnd: boolean;
		priceUsdMinor: number;
	} | null;
	entitlements: {
		verified: boolean;
		subscriber: boolean;
		postCharBudget: number;
		mediaSlots: number;
		creatorAnalytics: boolean;
		/** May summon @vivid — tagging her triggers an AI reply. */
		canTagVivid?: boolean;
	};
	badges: { type: string; tier?: string; season?: string }[];
	/** Vivid AI credit meter — null for non-premium accounts. */
	vividCredits: {
		balance: number;
		cycleGrant: number;
		cycleEnd: string | null;
	} | null;
}

export async function getSubscriptionAction() {
	const headers = await bearer();
	if (!headers) return { success: false as const, message: "Unauthorized" };
	try {
		const res = await axios.get(`${BACKEND_URL}/api/subscription`, { headers });
		return { success: true as const, data: res.data as SubscriptionState };
	} catch (error: any) {
		return {
			success: false as const,
			message: error.response?.data?.message || "Failed to load subscription",
		};
	}
}

export async function subscribeAction() {
	const headers = await bearer();
	if (!headers) return { success: false as const, message: "Unauthorized" };
	try {
		const res = await axios.post(`${BACKEND_URL}/api/subscription`, {}, { headers });
		return { success: true as const, data: res.data };
	} catch (error: any) {
		return {
			success: false as const,
			code: error.response?.data?.code as string | undefined,
			status: error.response?.status as number | undefined,
			message: error.response?.data?.message || "Could not subscribe",
		};
	}
}

export async function cancelSubscriptionAction() {
	const headers = await bearer();
	if (!headers) return { success: false as const, message: "Unauthorized" };
	try {
		const res = await axios.delete(`${BACKEND_URL}/api/subscription`, { headers });
		return { success: true as const, data: res.data };
	} catch (error: any) {
		return {
			success: false as const,
			message: error.response?.data?.message || "Could not cancel",
		};
	}
}
