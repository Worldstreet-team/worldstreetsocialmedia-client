"use client";

import { BACKEND_URL } from "@/const";

const API_URL = process.env.NEXT_PUBLIC_API_URL || BACKEND_URL;

/**
 * Multipart create, straight from the browser to the gateway.
 *
 * Media uploads used to ride server actions, which means the bytes travel
 * TWICE (phone -> Next server -> gateway) and the whole trip has to fit
 * inside one serverless function invocation. A camera photo on mobile data
 * blew past that window and every big story or post died as a bare
 * "Server error". Voice notes never had the bug because MessageBox always
 * posted directly — this makes stories and posts do the same.
 *
 * Mirrors the actions' `{ success, data?, message? }` shape so call sites
 * swap the function and keep their logic. Writes without files stay on
 * server actions, where the serialization is a feature.
 */
export async function sendFormDirect(
	path: string,
	formData: FormData,
	method: "POST" | "PUT" | "PATCH" = "POST",
) {
	try {
		const token = await (window as any).Clerk?.session?.getToken?.();
		if (!token) return { success: false as const, message: "Unauthorized" };
		const res = await fetch(`${API_URL}${path}`, {
			method,
			headers: { Authorization: `Bearer ${token}` },
			body: formData,
		});
		const body = await res.json().catch(() => null);
		if (!res.ok) {
			return {
				success: false as const,
				message: body?.message || "Upload failed",
			};
		}
		return { success: true as const, data: body };
	} catch {
		return { success: false as const, message: "Network error" };
	}
}

export const postFormDirect = (path: string, formData: FormData) =>
	sendFormDirect(path, formData, "POST");

/**
 * JSON write, browser -> gateway, same contract as sendFormDirect. For the
 * few writes that must survive a redeploy mid-session: a server action id
 * dies with its deployment ("Failed to find Server Action") and 2,499 of
 * those in one log window is what "nobody can pay" looked like. Money paths
 * call the gateway directly so a stale tab can still buy.
 */
export async function postJsonDirect(path: string, body?: unknown) {
	try {
		const token = await (window as any).Clerk?.session?.getToken?.();
		if (!token) return { success: false as const, message: "Unauthorized" };
		const res = await fetch(`${API_URL}${path}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		const payload = await res.json().catch(() => null);
		if (!res.ok) {
			return {
				success: false as const,
				code: payload?.code as string | undefined,
				message: payload?.message || "Request failed",
			};
		}
		return { success: true as const, data: payload?.data ?? payload };
	} catch {
		return { success: false as const, message: "Network error" };
	}
}
