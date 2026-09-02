"use client";

import { BACKEND_URL } from "@/const";
import { applyMyFollowState } from "@/lib/engagementStore";

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
 * sendFormDirect with a progress meter and a cancel handle (register 68).
 *
 * fetch() cannot report UPLOAD progress — only download — so the one place
 * the user stares at a moving number has to be XMLHttpRequest. Same token,
 * same `{ success, data?, message? }` contract; `aborted` distinguishes the
 * user's own cancel from a network failure so callers don't toast about it.
 */
export function sendFormProgress(
	path: string,
	formData: FormData,
	opts: {
		onProgress?: (frac: number) => void;
		signal?: AbortSignal;
	} = {},
): Promise<
	| { success: true; data: any }
	| { success: false; message: string; aborted?: boolean }
> {
	return new Promise((resolve) => {
		void (async () => {
			const token = await (window as any).Clerk?.session?.getToken?.();
			if (!token) {
				resolve({ success: false, message: "Unauthorized" });
				return;
			}
			const xhr = new XMLHttpRequest();
			xhr.open("POST", `${API_URL}${path}`);
			xhr.setRequestHeader("Authorization", `Bearer ${token}`);
			xhr.responseType = "json";
			xhr.upload.onprogress = (e) => {
				if (e.lengthComputable && opts.onProgress)
					opts.onProgress(Math.min(1, e.loaded / e.total));
			};
			xhr.onload = () => {
				if (xhr.status >= 200 && xhr.status < 300) {
					resolve({ success: true, data: xhr.response });
				} else {
					resolve({
						success: false,
						message: xhr.response?.message || "Upload failed",
					});
				}
			};
			xhr.onerror = () =>
				resolve({ success: false, message: "Network error" });
			xhr.onabort = () =>
				resolve({ success: false, message: "Cancelled", aborted: true });
			if (opts.signal) {
				if (opts.signal.aborted) {
					resolve({ success: false, message: "Cancelled", aborted: true });
					return;
				}
				opts.signal.addEventListener("abort", () => xhr.abort(), {
					once: true,
				});
			}
			xhr.send(formData);
		})();
	});
}

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

/**
 * Align/unalign, direct. The follow button is the highest-frequency write
 * in the app and it was riding a server action — every redeploy turned it
 * into "tap, wait 3s, watch it revert" on already-open tabs (the action id
 * dies with the deployment, the rollback branch reads the 404 as failure).
 * Same shape as the actions so call sites swap one identifier.
 */
export const followUserDirect = async (targetUserId: string) => {
	const res = await postJsonDirect(`/api/users/${targetUserId}/follow`);
	if (res.success) applyMyFollowState(targetUserId, true);
	return res;
};
export const unfollowUserDirect = async (targetUserId: string) => {
	const res = await postJsonDirect(`/api/users/${targetUserId}/unfollow`);
	if (res.success) applyMyFollowState(targetUserId, false);
	return res;
};
