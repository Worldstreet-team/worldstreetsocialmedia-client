"use client";

import axios from "axios";
import { BACKEND_URL } from "@/const";

const API_URL = process.env.NEXT_PUBLIC_API_URL || BACKEND_URL;

/**
 * Fire-and-forget counters, browser -> gateway directly. These are metrics,
 * not actions: they must never ride the serialized server-action lane, never
 * block anything, and a lost one is a rounding error, not a bug.
 */
export async function recordVideoPlayAction(postId: string): Promise<void> {
	try {
		const token = await (window as any).Clerk?.session?.getToken();
		if (!token) return;
		await axios.post(
			`${API_URL}/api/posts/${postId}/video-play`,
			{},
			{ headers: { Authorization: `Bearer ${token}` } },
		);
	} catch {
		/* a lost play is fine */
	}
}
