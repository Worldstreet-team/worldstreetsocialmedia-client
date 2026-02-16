"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
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
