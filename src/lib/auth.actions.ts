"use server";

import { BACKEND_URL, JWT_TOKEN, REFRESH_TOKEN } from "@/const";
import { cookies } from "next/headers";

const API_URL = BACKEND_URL;

export async function updateSession(accessToken: string, refreshToken: string) {
	const cookieStore = await cookies();
	cookieStore.set("accessToken", accessToken, {
		httpOnly: true,
		secure: true,
		path: "/",
	});
	cookieStore.set("refreshToken", refreshToken, {
		httpOnly: true,
		secure: true,
		path: "/",
	});
}

export async function clearSession() {
	const cookieStore = await cookies();
	cookieStore.delete("accessToken");
	cookieStore.delete("refreshToken");
}

export async function syncUser() {
	const token = await getAccessToken();

	if (!token) return null;

	try {
		const res = await fetch(`${API_URL}/api/users/sync`, {
			headers: { Authorization: `Bearer ${token}` },
			cache: "no-store",
		});

		console.log("RES ISH SYNC: ", res);

		if (!res.ok) {
			if (res.status === 404) return { status: "not_found" };
			return null;
		}

		const data = await res.json();
		return data; // Expected to be the user object directly or { data: user } depending on API
	} catch (error) {
		console.error("Sync user error:", error);
		return null;
	}
}

export async function getAccessToken() {
	const cookieStore = await cookies();
	const token = cookieStore.get("accessToken")?.value;

	if (token) return token;

	// Fallback to hardcoded token and set it in cookie
	// if (JWT_TOKEN) {
	// 	cookieStore.set("accessToken", JWT_TOKEN, {
	// 		httpOnly: true,
	// 		secure: true,
	// 		path: "/",
	// 	});
	// 	return JWT_TOKEN;
	// }

	return undefined;
}

export async function getRefreshToken() {
	const cookieStore = await cookies();
	const token = cookieStore.get("refreshToken")?.value;

	if (token) return token;

	// Fallback to hardcoded token and set it in cookie
	// if (REFRESH_TOKEN) {
	// 	cookieStore.set("refreshToken", REFRESH_TOKEN, {
	// 		httpOnly: true,
	// 		secure: true,
	// 		path: "/",
	// 	});
	// 	return REFRESH_TOKEN;
	// }

	return undefined;
}
