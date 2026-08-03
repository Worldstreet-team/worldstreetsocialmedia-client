"use server";

import { BACKEND_URL } from "@/const";
import { errorDetail } from "@/lib/utils";
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
	} catch (error) {
		// Narrowed, never the raw axios error — it carries the bearer JWT in
		// `config.headers`.
		console.error("Error starting conversation:", errorDetail(error));
		return { success: false, error: "Failed to start conversation" };
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
		console.error("Error fetching conversations:", errorDetail(error));
		return { success: false, error: "Failed to fetch conversations" };
	}
}
