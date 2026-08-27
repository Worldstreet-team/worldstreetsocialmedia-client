"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import axios from "axios";

const API_URL = BACKEND_URL;

export async function getProfileByUsernameAction(username: string) {
	const { getToken } = await auth();
	const accessToken = await getToken();

	if (!accessToken) {
		return { success: false, message: "Unauthorized: No access token found" };
	}

	try {
		const response = await axios.get(`${API_URL}/api/users/${username}`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		return { success: true, data: response.data };
	} catch (error: any) {
		console.error(
			"Get Profile By Username Error:",
			error.response?.data || error.message,
		);

		if (axios.isAxiosError(error) && error.response?.status === 404) {
			return { success: false, message: "User not found" };
		}

		return { success: false, message: "Something went wrong" };
	}
}

export async function followUserAction(targetUserId: string) {
	const { getToken } = await auth();
	const accessToken = await getToken();

	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		const res = await axios.post(
			`${API_URL}/api/users/${targetUserId}/follow`,
			{},
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);
		return { success: true, data: res.data };
	} catch (error: any) {
		console.error("Follow User Error:", error.response?.data || error.message);
		return {
			success: false,
			message: error.response?.data?.message || "Failed to follow user",
		};
	}
}

export async function unfollowUserAction(targetUserId: string) {
	const { getToken } = await auth();
	const accessToken = await getToken();

	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		const res = await axios.post(
			`${API_URL}/api/users/${targetUserId}/unfollow`,
			{},
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);
		return { success: true, data: res.data };
	} catch (error: any) {
		console.error(
			"Unfollow User Error:",
			error.response?.data || error.message,
		);
		return {
			success: false,
			message: error.response?.data?.message || "Failed to unfollow user",
		};
	}
}

export async function getWhoToFollowAction() {
	const { getToken } = await auth();
	const accessToken = await getToken();
	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		const res = await axios.get(`${API_URL}/api/users/who-to-follow`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		return { success: true, data: res.data.data };
	} catch (error: any) {
		console.error(
			"Get Who to Follow Error:",
			error.response?.data || error.message,
		);
		return {
			success: false,
			message:
				error.response?.data?.message ||
				"Failed to fetch who to follow suggestions",
		};
	}
}

export async function updateMyProfileAction(formData: FormData) {
	const { getToken } = await auth();
	const accessToken = await getToken();

	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		const res = await fetch(`${API_URL}/api/users/me`, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
			body: formData,
		});

		const data = await res.json();

		if (!res.ok) {
			return { success: false, message: data.message || "Failed to update" };
		}

		// Tell the middleware its cached copy of this profile is dead. It keeps
		// a 30s per-user cache and stringifies it into `x-user-data`, which is
		// what re-hydrates the client's user atom on every navigation — so
		// without this flag a freshly changed avatar or display name reverts on
		// the next page load and only "takes" once the TTL lapses. Cookies are
		// the only channel: middleware runs in a different runtime and cannot
		// see this module's memory.
		(await cookies()).set("profile_stale", "1", {
			path: "/",
			httpOnly: false,
			maxAge: 60,
		});

		return { success: true, data };
	} catch (error: any) {
		console.error("Update Profile Error:", error);
		return { success: false, message: "Something went wrong" };
	}
}

export async function getFollowersAction(userId: string) {
	const { getToken } = await auth();
	const accessToken = await getToken();

	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		const res = await axios.get(`${API_URL}/api/users/${userId}/followers`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		return { success: true, data: res.data.data };
	} catch (error: any) {
		console.error(
			"Get Followers Error:",
			error.response?.data || error.message,
		);
		return {
			success: false,
			message: error.response?.data?.message || "Failed to fetch followers",
		};
	}
}

export async function getFollowingAction(userId: string) {
	const { getToken } = await auth();
	const accessToken = await getToken();

	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		const res = await axios.get(`${API_URL}/api/users/${userId}/following`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		return { success: true, data: res.data.data };
	} catch (error: any) {
		console.error(
			"Get Following Error:",
			error.response?.data || error.message,
		);
		return {
			success: false,
			message: error.response?.data?.message || "Failed to fetch following",
		};
	}
}

export async function blockUserAction(targetUserId: string) {
	const { getToken } = await auth();
	const accessToken = await getToken();

	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		const res = await axios.post(
			`${API_URL}/api/users/${targetUserId}/block`,
			{},
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);
		return { success: true, data: res.data };
	} catch (error: any) {
		console.error("Block User Error:", error.response?.data || error.message);
		return {
			success: false,
			message: error.response?.data?.message || "Failed to block user",
		};
	}
}

export async function unblockUserAction(targetUserId: string) {
	const { getToken } = await auth();
	const accessToken = await getToken();

	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		const res = await axios.post(
			`${API_URL}/api/users/${targetUserId}/unblock`,
			{},
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);
		return { success: true, data: res.data };
	} catch (error: any) {
		console.error("Unblock User Error:", error.response?.data || error.message);
		return {
			success: false,
			message: error.response?.data?.message || "Failed to unblock user",
		};
	}
}

export async function searchUsersAction(query: string) {
	const { getToken } = await auth();
	const accessToken = await getToken();

	// Search can be public? Maybe not for now.
	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		const res = await axios.get(`${API_URL}/api/users/search`, {
			params: { q: query },
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		return { success: true, data: res.data.data };
	} catch (error: any) {
		console.error("Search Users Error:", error.response?.data || error.message);
		return {
			success: false,
			message: error.response?.data?.message || "Failed to search users",
		};
	}
}

/** Which of these handles are real accounts, and what a mention chip needs. */
export async function resolveHandlesAction(usernames: string[]) {
	const { getToken } = await auth();
	const accessToken = await getToken();
	if (!accessToken) return { success: false as const, users: [] };
	try {
		const res = await axios.post(
			`${API_URL}/api/users/resolve`,
			{ usernames },
			{ headers: { Authorization: `Bearer ${accessToken}` } },
		);
		return { success: true as const, users: res.data?.users ?? [] };
	} catch {
		return { success: false as const, users: [] };
	}
}

/**
 * Is this handle free? Answered where it is asked (onboarding step 1) rather
 * than at submit — the profile POST used to be the first time anyone learned
 * a username was taken, two steps later.
 */
export async function checkUsernameAction(username: string) {
	const { getToken } = await auth();
	const accessToken = await getToken();
	if (!accessToken) {
		return { available: false as const, reason: "error" as const, message: "" };
	}
	try {
		const res = await axios.get(`${API_URL}/api/users/username-available`, {
			params: { u: username },
			headers: { Authorization: `Bearer ${accessToken}` },
			timeout: 8000,
		});
		return {
			available: Boolean(res.data?.available),
			reason: String(res.data?.reason ?? "ok") as
				| "ok"
				| "taken"
				| "invalid"
				| "error",
			message: String(res.data?.message ?? ""),
		};
	} catch {
		// Network failure must NOT block the flow: the gateway re-checks on
		// submit, so an unreachable check is a missing hint, not a wall.
		return { available: true as const, reason: "error" as const, message: "" };
	}
}
