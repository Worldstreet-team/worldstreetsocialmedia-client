"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";
import type { ReportReasonId, ReportTargetType } from "@/lib/reports";

const API_URL = BACKEND_URL;

/**
 * File a report. Reporting used to hit an endpoint that was a `console.log`
 * and a 200 — the user was told "reported" and nothing was written. This
 * writes a real record into the moderation queue.
 *
 * Filing twice against the same thing updates the open report rather than
 * duplicating it, so the caller can treat repeat submissions as success.
 */
export async function reportAction(input: {
	targetType: ReportTargetType;
	targetId: string;
	reason: ReportReasonId;
	details?: string;
}) {
	const { getToken } = await auth();
	const accessToken = await getToken();

	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		const res = await axios.post(
			`${API_URL}/api/reports`,
			{
				targetType: input.targetType,
				targetId: input.targetId,
				reason: input.reason,
				details: input.details?.trim() || undefined,
			},
			{ headers: { Authorization: `Bearer ${accessToken}` } },
		);
		return { success: true, data: res.data?.data };
	} catch (error: any) {
		console.error("Report Error:", error.response?.data || error.message);
		return {
			success: false,
			message:
				error.response?.data?.message || "That report could not be sent",
		};
	}
}

/**
 * Accounts the signed-in user has blocked. Blocking used to be discoverable
 * only by navigating back to the person's profile, which made it effectively
 * one-way.
 */
export async function getBlockedUsersAction() {
	const { getToken } = await auth();
	const accessToken = await getToken();

	if (!accessToken) return { success: false, message: "Unauthorized", data: [] };

	try {
		const res = await axios.get(`${API_URL}/api/users/me/blocked`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		return { success: true, data: res.data?.data ?? [] };
	} catch (error: any) {
		console.error(
			"Get Blocked Users Error:",
			error.response?.data || error.message,
		);
		return {
			success: false,
			message:
				error.response?.data?.message || "Could not load blocked accounts",
			data: [],
		};
	}
}
