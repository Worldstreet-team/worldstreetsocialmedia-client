"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

const API_URL = BACKEND_URL;

/**
 * Staff-only reads.
 *
 * The gateway is the only thing that decides who is staff — these actions
 * just forward the caller's token. Hiding the nav entry on the client is a
 * courtesy; the 404 from `requireStaff` is the actual permission.
 */
async function adminGet(path: string, days?: number) {
	const { getToken } = await auth();
	const accessToken = await getToken();
	if (!accessToken) {
		return { success: false as const, message: "Unauthorized" };
	}
	try {
		const res = await axios.get(`${API_URL}/api/admin/${path}`, {
			params: days ? { days } : undefined,
			headers: { Authorization: `Bearer ${accessToken}` },
			timeout: 20_000,
		});
		return { success: true as const, data: res.data };
	} catch (error: any) {
		// A non-staff caller gets 404 by design, so the console cannot be used
		// to enumerate which admin routes exist. Report it as "not permitted"
		// rather than "missing", which is what it means to the person asking.
		const status = error?.response?.status;
		return {
			success: false as const,
			forbidden: status === 404 || status === 403,
			message:
				status === 404 || status === 403
					? "Not permitted"
					: (error?.response?.data?.message ?? "Failed to load"),
		};
	}
}

export async function getAdminOverviewAction(days = 30) {
	return adminGet("overview", days);
}

export async function getAdminRevenueAction(days = 30) {
	return adminGet("revenue", days);
}

export async function getAdminHealthAction(days = 30) {
	return adminGet("health", days);
}

export async function getAuditTrailAction() {
	return adminGet("audit");
}
