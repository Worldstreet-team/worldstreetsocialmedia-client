"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

// Forward a batch of telemetry events to the gateway. Fire-and-forget from the
// client's point of view — failures are swallowed; telemetry must never
// surface an error to the person using the app.
export async function sendEventsAction(events: unknown[]) {
	if (!Array.isArray(events) || events.length === 0) return { success: true };

	const { getToken } = await auth();
	const accessToken = await getToken();
	if (!accessToken) return { success: false };

	try {
		await axios.post(
			`${BACKEND_URL}/api/events`,
			{ events },
			{
				headers: { Authorization: `Bearer ${accessToken}` },
				timeout: 10_000,
			},
		);
		return { success: true };
	} catch {
		return { success: false };
	}
}
