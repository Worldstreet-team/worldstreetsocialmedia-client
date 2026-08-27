"use server";

import { auth } from "@clerk/nextjs/server";
import axios from "axios";
import { BACKEND_URL } from "@/const";

async function bearer() {
	const { getToken } = await auth();
	const token = await getToken();
	return token ? { Authorization: `Bearer ${token}` } : null;
}

export async function getSpacesAction() {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.get(`${BACKEND_URL}/api/spaces`, { headers });
		return {
			success: true,
			live: res.data?.live ?? [],
			upcoming: res.data?.upcoming ?? [],
		};
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Failed to load spaces",
		};
	}
}

export async function createSpaceAction(
	title: string,
	scheduledFor?: string,
	communityId?: string,
	description?: string,
	cover?: string,
	coverImage?: string,
) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.post(
			`${BACKEND_URL}/api/spaces`,
			{ title, scheduledFor, communityId, description, cover, coverImage },
			{ headers },
		);
		return { success: true, spaceId: res.data?.spaceId };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Could not create the space",
		};
	}
}

/** Audio credentials for a live room. The gateway decides publish rights. */
export async function getSpaceTokenAction(id: string) {
	const headers = await bearer();
	if (!headers) return { success: false as const, code: "UNAUTHORIZED" };
	try {
		const res = await axios.post(
			`${BACKEND_URL}/api/spaces/${id}/token`,
			{},
			{ headers },
		);
		return {
			success: true as const,
			token: res.data.token as string,
			url: res.data.url as string,
			roomName: res.data.roomName as string,
			canSpeak: Boolean(res.data.canSpeak),
		};
	} catch (error) {
		const res = (
			error as {
				response?: {
					status?: number;
					data?: { code?: string; message?: string };
				};
			}
		).response;
		// A gateway that hasn't shipped this endpoint yet, or can't be reached,
		// means "audio isn't on here" — not "audio broke". The room says so.
		const code =
			res?.data?.code ??
			(res?.status === undefined || res.status === 404 || res.status >= 500
				? "AUDIO_OFF"
				: "FAILED");
		return {
			success: false as const,
			code,
			message: res?.data?.message,
		};
	}
}

export async function leaveSpaceAction(id: string) {
	const headers = await bearer();
	if (!headers) return { success: false };
	try {
		await axios.post(`${BACKEND_URL}/api/spaces/${id}/leave`, {}, { headers });
		return { success: true };
	} catch {
		return { success: false };
	}
}

export async function joinSpaceAction(id: string) {
	const headers = await bearer();
	if (!headers) return { success: false };
	try {
		await axios.post(`${BACKEND_URL}/api/spaces/${id}/join`, {}, { headers });
		return { success: true };
	} catch {
		return { success: false };
	}
}

export async function startSpaceAction(id: string) {
	const headers = await bearer();
	if (!headers) return { success: false };
	try {
		await axios.post(`${BACKEND_URL}/api/spaces/${id}/start`, {}, { headers });
		return { success: true };
	} catch (error: any) {
		return { success: false, message: error.response?.data?.message };
	}
}

export async function endSpaceAction(id: string) {
	const headers = await bearer();
	if (!headers) return { success: false };
	try {
		await axios.post(`${BACKEND_URL}/api/spaces/${id}/end`, {}, { headers });
		return { success: true };
	} catch (error: any) {
		return { success: false, message: error.response?.data?.message };
	}
}

/**
 * Edit a scheduled space: retitle, re-cover, or move the time.
 *
 * Only fields present in `patch` are sent, so a caller changing the cover
 * can't accidentally blank the description. `coverImage: ""` is meaningful —
 * it clears a custom image back to the chosen preset.
 */
export async function updateSpaceAction(
	id: string,
	patch: {
		title?: string;
		description?: string;
		cover?: string;
		coverImage?: string;
		scheduledFor?: string;
	},
) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		await axios.patch(`${BACKEND_URL}/api/spaces/${id}`, patch, { headers });
		return { success: true };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Could not save the changes",
			code: error.response?.data?.code,
		};
	}
}

/**
 * Call off a scheduled space. Distinct from ending a live one: this never
 * happened, and everyone who signed up is told rather than left waiting.
 */
export async function cancelSpaceAction(id: string) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		await axios.post(`${BACKEND_URL}/api/spaces/${id}/cancel`, {}, { headers });
		return { success: true };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Could not cancel it",
			code: error.response?.data?.code,
		};
	}
}

/**
 * "Still here." The gateway closes live spaces whose host has gone quiet, so
 * a host who closes the tab no longer leaves a room advertising itself
 * forever with nobody inside.
 */
export async function heartbeatSpaceAction(id: string) {
	const headers = await bearer();
	if (!headers) return { success: false, alive: false };
	try {
		const res = await axios.post(
			`${BACKEND_URL}/api/spaces/${id}/heartbeat`,
			{},
			{ headers },
		);
		return { success: true, alive: Boolean(res.data?.alive) };
	} catch {
		return { success: false, alive: false };
	}
}

/** Raise (or lower) a hand to speak in a live space. */
export async function requestSpeakAction(id: string, cancel = false) {
	const headers = await bearer();
	if (!headers) return { success: false };
	try {
		const res = await axios.post(
			`${BACKEND_URL}/api/spaces/${id}/request-speak`,
			{ cancel },
			{ headers },
		);
		return { success: true, requested: Boolean(res.data?.requested) };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Couldn't send that",
		};
	}
}

/** Host grants or takes back the mic. */
export async function setSpeakerAction(
	id: string,
	profileId: string,
	grant: boolean,
) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		await axios.post(
			`${BACKEND_URL}/api/spaces/${id}/speakers`,
			{ profileId, grant },
			{ headers },
		);
		return { success: true };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Couldn't update speakers",
		};
	}
}

/** Upload a custom cover image; returns the URL to store on the space. */
export async function uploadSpaceCoverAction(form: FormData) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.post(`${BACKEND_URL}/api/spaces/cover`, form, {
			headers,
			timeout: 60_000,
		});
		return { success: true, url: res.data?.url as string };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Could not upload that image",
		};
	}
}

/** One space by id, any status — the deep-link resolver. */
export async function getSpaceAction(id: string) {
	const headers = await bearer();
	if (!headers) return { success: false as const };
	try {
		const res = await axios.get(`${BACKEND_URL}/api/spaces/${id}`, {
			headers,
		});
		return { success: true as const, space: res.data?.space };
	} catch {
		return { success: false as const };
	}
}
