"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

const API_URL = BACKEND_URL;

export async function getNotificationsAction() {
	const { getToken } = await auth();
	const accessToken = await getToken();

	if (!accessToken) {
		return { success: false, message: "Unauthorized" };
	}

	try {
		const res = await axios.get(`${API_URL}/api/notifications`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		return { success: true, data: res.data };
	} catch (error: any) {
		console.error(
			"Get Notifications Error:",
			error.response?.data || error.message,
		);
		return { success: false, message: "Failed to fetch notifications" };
	}
}

export async function markNotificationsReadAction(notificationIds?: string[]) {
	const { getToken } = await auth();
	const accessToken = await getToken();

	if (!accessToken) {
		return { success: false, message: "Unauthorized" };
	}

	try {
		await axios.post(
			`${API_URL}/api/notifications/mark-read`,
			{ notificationIds },
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);
		return { success: true };
	} catch (error: any) {
		console.error(
			"Mark Notifications Read Error:",
			error.response?.data || error.message,
		);
		return { success: false, message: "Failed to mark notifications as read" };
	}
}
