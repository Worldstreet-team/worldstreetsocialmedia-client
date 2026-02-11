"use server";

import { BACKEND_URL, JWT_TOKEN } from "@/const";
import axios from "axios";
import { cookies } from "next/headers";
import { getAccessToken } from "./auth.actions";

const API_URL = BACKEND_URL;

export async function getProfileByUsernameAction(username: string) {
	const cookieStore = await cookies();
	const accessToken = await getAccessToken();

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
	const accessToken = await getAccessToken();
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
	const accessToken = await getAccessToken();
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
	const accessToken = await getAccessToken();
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
