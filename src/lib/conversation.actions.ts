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
	content: string | null,
	type: "text" | "image" | "audio" | "video" | "call" = "text",
	file?: File | Blob,
) {
	try {
		const headers = await getAuthHeader();
		// If file is present, we need to use FormData and NOT set Content-Type header
		// (browser sets it with boundary for multipart/form-data)

		let body: FormData | string;
		const requestHeaders: any = {
			Authorization: headers.Authorization,
		};

		if (file) {
			const formData = new FormData();
			if (content) formData.append("content", content);
			formData.append("type", type);
			formData.append("file", file);
			body = formData;
			// delete Content-Type to let browser set it
		} else {
			requestHeaders["Content-Type"] = "application/json";
			body = JSON.stringify({ content, type });
		}

		const res = await fetch(
			`${API_URL}/api/conversations/${conversationId}/messages`,
			{
				method: "POST",
				headers: requestHeaders,
				body,
			},
		);

		const data = await res.json();
		return data;
	} catch (error) {
		console.error("Error sending message:", error);
		return { success: false, message: "Failed to send message" };
	}
}
