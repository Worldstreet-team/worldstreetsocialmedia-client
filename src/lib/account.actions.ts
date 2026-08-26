"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

const API_URL = BACKEND_URL;

async function token() {
	const { getToken } = await auth();
	return getToken();
}

/**
 * Account lifecycle. None of this existed: the only deletion primitive in the
 * whole product was deletePost, so an account could be created but never
 * paused, exported or removed.
 */

export async function deactivateAccountAction() {
	const accessToken = await token();
	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		await axios.post(
			`${API_URL}/api/users/me/deactivate`,
			{},
			{ headers: { Authorization: `Bearer ${accessToken}` } },
		);
		return { success: true };
	} catch (error: any) {
		return {
			success: false,
			message:
				error.response?.data?.message || "Could not deactivate your account",
		};
	}
}

export async function reactivateAccountAction() {
	const accessToken = await token();
	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		await axios.post(
			`${API_URL}/api/users/me/reactivate`,
			{},
			{ headers: { Authorization: `Bearer ${accessToken}` } },
		);
		return { success: true };
	} catch (error: any) {
		return {
			success: false,
			message:
				error.response?.data?.message || "Could not reactivate your account",
		};
	}
}

/**
 * The export is returned as a JSON string rather than a URL: the download is
 * assembled in the browser, so the file never needs a public link.
 */
export async function exportMyDataAction() {
	const accessToken = await token();
	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		const res = await axios.get(`${API_URL}/api/users/me/export`, {
			headers: { Authorization: `Bearer ${accessToken}` },
			// Keep it as text so the bytes reach the browser unchanged.
			transformResponse: (d) => d,
		});
		return { success: true, json: res.data as string };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Could not build your export",
		};
	}
}

/** `confirm` must be the account's own username, checked server-side too. */
export async function deleteAccountAction(confirm: string) {
	const accessToken = await token();
	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		await axios.delete(`${API_URL}/api/users/me`, {
			headers: { Authorization: `Bearer ${accessToken}` },
			data: { confirm },
		});
		return { success: true };
	} catch (error: any) {
		return {
			success: false,
			message:
				error.response?.data?.message || "Could not delete your account",
		};
	}
}
