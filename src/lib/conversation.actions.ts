"use server";

import { getAccessToken } from "./auth.actions";
import { BACKEND_URL } from "@/const";

const API_URL = BACKEND_URL;

async function getAuthHeader() {
	const token = await getAccessToken();
	return {
		"Content-Type": "application/json",
		Authorization: `Bearer ${token}`,
	};
}

export async function getConversationsAction() {
	try {
		const headers = await getAuthHeader();
		const res = await fetch(`${API_URL}/api/conversations`, {
			method: "GET",
			headers,
			cache: "no-store",
		});

		const data = await res.json();
		return data;
	} catch (error) {
		console.error("Error fetching conversations:", error);
		return { success: false, message: "Failed to fetch conversations" };
	}
}

export async function startConversationAction(recipientId: string) {
	try {
		const headers = await getAuthHeader();
		const res = await fetch(`${API_URL}/api/conversations`, {
			method: "POST",
			headers,
			body: JSON.stringify({ recipientId }),
		});

		const data = await res.json();
		return data;
	} catch (error) {
		console.error("Error starting conversation:", error);
		return { success: false, message: "Failed to start conversation" };
	}
}

export async function getMessagesAction(conversationId: string) {
	try {
		const headers = await getAuthHeader();
		const res = await fetch(
			`${API_URL}/api/conversations/${conversationId}/messages`,
			{
				method: "GET",
				headers,
				cache: "no-store",
			},
		);

		const data = await res.json();
		return data;
	} catch (error) {
		console.error("Error fetching messages:", error);
		return { success: false, message: "Failed to fetch messages" };
	}
}

export async function sendMessageAction(
	conversationId: string,
	content: string,
	type: "text" | "image" | "audio" = "text",
	mediaUrl?: string,
) {
	try {
		const headers = await getAuthHeader();
		const res = await fetch(
			`${API_URL}/api/conversations/${conversationId}/messages`,
			{
				method: "POST",
				headers,
				body: JSON.stringify({ content, type, mediaUrl }),
			},
		);

		const data = await res.json();
		return data;
	} catch (error) {
		console.error("Error sending message:", error);
		return { success: false, message: "Failed to send message" };
	}
}
