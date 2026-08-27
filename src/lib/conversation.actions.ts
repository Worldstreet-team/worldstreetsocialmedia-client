"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || BACKEND_URL;

export async function startConversationAction(recipientId: string) {
	try {
		const { getToken } = await auth();
		const token = await getToken();

		// We need to pass the recipientId to the start endpoint
		// The endpoint expects { recipientId } in body
		const response = await axios.post(
			`${API_URL}/api/messages/start`,
			{ recipientId },
			{
				headers: {
					Authorization: `Bearer ${token}`,
				},
			},
		);

		return response.data;
	} catch (error: any) {
		console.error("Error starting conversation:", error?.message || error);
		// Forward the gateway's reason. A 403 here is a rule the person can
		// act on (follow them back), not a generic failure, and swallowing it
		// left the UI saying only "could not open the conversation".
		return {
			success: false,
			error:
				error?.response?.data?.message ?? "Failed to start conversation",
		};
	}
}

export async function getConversationsAction() {
	try {
		const { getToken } = await auth();
		const token = await getToken();

		if (!token) return { success: false, message: "Unauthorized" };

		const response = await axios.get(`${API_URL}/api/messages/conversations`, {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		return { success: true, data: response.data };
	} catch (error) {
		console.error("Error fetching conversations:", error);
		return { success: false, error: "Failed to fetch conversations" };
	}
}
