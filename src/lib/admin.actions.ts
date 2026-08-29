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

/* ── The write desks' generic bridge ─────────────────────────────────────────
 *
 * Reports, People, Money, Ranking and Ops speak to /api/admin through one
 * generic caller each for GET/POST/PUT: every admin endpoint shares the same
 * dialect (bearer token, JSON, 404 for non-staff), so the desks compose
 * their own calls from paths instead of minting thirty near-identical
 * actions. Same permission story as the typed reads above: the gateway
 * decides, this just forwards the token.
 */

export type AdminApiResult<T = any> =
	| { success: true; data: T }
	| { success: false; status?: number; code?: string; message: string };

async function callAdminApi(
	method: "GET" | "POST" | "PUT",
	path: string,
	body?: Record<string, unknown>,
	params?: Record<string, string | number | undefined>,
): Promise<AdminApiResult> {
	const { getToken } = await auth();
	const token = await getToken();
	if (!token) return { success: false, message: "Not signed in" };

	try {
		const res = await axios.request({
			method,
			url: `${API_URL}/api/admin${path}`,
			data: body,
			params,
			headers: { Authorization: `Bearer ${token}` },
			timeout: 20_000,
		});
		return { success: true, data: res.data };
	} catch (error: any) {
		if (axios.isAxiosError(error)) {
			return {
				success: false,
				status: error.response?.status,
				code: error.response?.data?.code,
				message:
					error.response?.data?.message ??
					`Request failed (${error.response?.status ?? "network"})`,
			};
		}
		return { success: false, message: "Something went wrong" };
	}
}

export async function adminApiGet(
	path: string,
	params?: Record<string, string | number | undefined>,
): Promise<AdminApiResult> {
	return callAdminApi("GET", path, undefined, params);
}

export async function adminApiPost(
	path: string,
	body?: Record<string, unknown>,
): Promise<AdminApiResult> {
	return callAdminApi("POST", path, body);
}

export async function adminApiPut(
	path: string,
	body?: Record<string, unknown>,
): Promise<AdminApiResult> {
	return callAdminApi("PUT", path, body);
}
