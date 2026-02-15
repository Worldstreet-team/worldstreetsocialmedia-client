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
	} catch (error) {
		console.error("Error starting conversation:", error);
		return { success: false, error: "Failed to start conversation" };
	}
}
