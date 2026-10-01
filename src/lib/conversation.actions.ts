"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

const API_URL = BACKEND_URL;

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

		// The gateway answers with the conversation itself. Callers were
		// written against two shapes (`_id` at the top, or `success` + `data`),
		// and the second never matched, so starting a chat from the inbox's
		// suggestions, a shared profile card or the share sheet always said
		// "Couldn't start that chat" (owner 2026-10-01). Both shapes, here,
		// once.
		const conversation = response.data?.data ?? response.data;
		return { ...conversation, success: Boolean(conversation?._id), data: conversation };
	} catch (error: any) {
		console.error("Error starting conversation:", error?.message || error);
		// Forward the gateway's reason. A 403 here is a rule the person can
		// act on (follow them back), not a generic failure, and swallowing it
		// left the UI saying only "could not open the conversation".
		const reason =
			error?.response?.data?.message ?? "Failed to start conversation";
		return { success: false, error: reason, message: reason };
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
