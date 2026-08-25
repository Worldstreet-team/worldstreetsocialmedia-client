"use server";

import { XSTREAM_API_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

// Start a stream on Xstream with the user's own Clerk session token. The
// token carries this app's origin as its azp claim, which Xstream's
// authorizedParties list accepts — the same instance both services verify
// against. Xstream auto-provisions a user on first authenticated call, so a
// socials user needs no prior Xstream account.
export async function goLiveAction(title: string, category: string) {
	const { getToken } = await auth();
	const token = await getToken();
	if (!token) return { success: false, message: "Unauthorized" };

	try {
		const res = await axios.post(
			`${XSTREAM_API_URL}/v1/streams`,
			{ title, category },
			{
				headers: { Authorization: `Bearer ${token}` },
				timeout: 15_000,
			},
		);
		const stream = res.data?.data?.stream;
		return {
			success: true,
			streamId: stream?.id ? String(stream.id) : undefined,
		};
	} catch (error: any) {
		return {
			success: false,
			message:
				error.response?.data?.message || "Could not start the stream",
		};
	}
}
