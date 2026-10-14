"use server";

import { auth } from "@clerk/nextjs/server";
import axios from "axios";
import { BACKEND_URL } from "@/const";
import type { VerifiedTier } from "@/assets/icons/VerifiedIcon";

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

/**
 * Start or book a room. `communityIds` takes up to three (the gateway's
 * cap); the host must belong to each. A refusal keeps the gateway's own
 * words and its `code` ("NOT_MEMBER", "NO_COMMUNITY", ...) plus the
 * `communityId` it is about, so setup can point at the right token.
 * Rooms no longer pick a colour theme, so no `cover` swatch is sent.
 */
export async function createSpaceAction(input: {
	title: string;
	scheduledFor?: string;
	communityIds?: string[];
	description?: string;
	coverImage?: string;
	category?: string;
}) {
	const headers = await bearer();
	if (!headers)
		return { success: false as const, message: "Unauthorized" as string };
	try {
		const res = await axios.post(
			`${BACKEND_URL}/api/spaces`,
			{
				title: input.title,
				scheduledFor: input.scheduledFor,
				communityIds: input.communityIds ?? [],
				description: input.description,
				coverImage: input.coverImage,
				category: input.category,
			},
			{ headers },
		);
		return {
			success: true as const,
			spaceId: res.data?.spaceId as string | undefined,
		};
	} catch (error: any) {
		const data = error.response?.data;
		return {
			success: false as const,
			message: (data?.message as string) || "Could not create the space",
			code: data?.code as string | undefined,
			communityId: data?.communityId as string | undefined,
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

/** Host only: appoint or dismiss a co-host (cap 2, gateway-enforced). */
export async function setCohostAction(
	id: string,
	profileId: string,
	grant: boolean,
) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		await axios.post(
			`${BACKEND_URL}/api/spaces/${id}/cohosts`,
			{ profileId, grant },
			{ headers },
		);
		return { success: true };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Couldn't update co-hosts",
		};
	}
}

/** Host/co-host: server-enforced mute of a speaker's published audio. */
export async function muteSpeakerAction(id: string, profileId: string) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		await axios.post(
			`${BACKEND_URL}/api/spaces/${id}/mute`,
			{ profileId },
			{ headers },
		);
		return { success: true };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Couldn't mute them",
		};
	}
}

/** Host/co-host: remove someone from the space (disconnect + ban). */
export async function removeFromSpaceAction(id: string, profileId: string) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		await axios.post(
			`${BACKEND_URL}/api/spaces/${id}/remove`,
			{ profileId },
			{ headers },
		);
		return { success: true };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Couldn't remove them",
		};
	}
}

/** Host/co-host: invite a listener to speak (they accept or decline). */
export async function inviteSpeakAction(id: string, profileId: string) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		await axios.post(
			`${BACKEND_URL}/api/spaces/${id}/invite`,
			{ profileId },
			{ headers },
		);
		return { success: true };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Couldn't send the invite",
		};
	}
}

/** The invitee's answer to a speaker invite. */
export async function respondInviteAction(id: string, accept: boolean) {
	const headers = await bearer();
	if (!headers) return { success: false as const, granted: false };
	try {
		const res = await axios.post(
			`${BACKEND_URL}/api/spaces/${id}/invite/respond`,
			{ accept },
			{ headers },
		);
		return {
			success: true as const,
			granted: Boolean(res.data?.granted),
		};
	} catch (error: any) {
		return {
			success: false as const,
			granted: false,
			message: error.response?.data?.message as string | undefined,
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

/** Someone on a recap: the host, or a face on the stage. */
export interface SpaceRecapPerson {
	id: string;
	username: string;
	firstName?: string;
	lastName?: string;
	avatar?: string;
	isVerified?: boolean;
	/** The tick's metal; `UserBadges` reads its tier. */
	verification?: { tier?: VerifiedTier } | null;
	role?: "host" | "cohost" | "speaker";
}

/** What happened in a space, after it ended (GET /api/spaces/:id/recap). */
export interface SpaceRecap {
	spaceId: string;
	title: string;
	category?: string;
	cover?: string;
	coverImage?: string;
	/** Null when the host's account is gone. */
	host: SpaceRecapPerson | null;
	isHost: boolean;
	startedAt: string;
	endedAt: string;
	minutes: number;
	/** Host first, then co-hosts, then everyone who held the mic. */
	stage: SpaceRecapPerson[];
	/** Everyone but the host who was in the room while it was live. */
	attendedCount: number;
	/** Most people in the room at once; null when nothing counted it. */
	peakListeners: number | null;
	/** Empty until live notes ship: the sheet says no notes were taken. */
	notes: {
		summary: string | null;
		moments: { at: number; speaker: string; text: string }[];
	};
}

/**
 * The recap of an ended space, for its host and anyone who was in it.
 * `code` says why not: NOT_ENDED (still live, scheduled or cancelled),
 * NOT_ATTENDED (they weren't in the room), NO_RECAP (it never went live),
 * NOT_FOUND, or FAILED.
 */
export async function getSpaceRecapAction(
	id: string,
): Promise<
	| { success: true; recap: SpaceRecap }
	| { success: false; code: string; message?: string }
> {
	const headers = await bearer();
	if (!headers) return { success: false, code: "UNAUTHORIZED" };
	if (!/^[0-9a-f]{24}$/i.test(id)) return { success: false, code: "NOT_FOUND" };
	try {
		const res = await axios.get(`${BACKEND_URL}/api/spaces/${id}/recap`, {
			headers,
		});
		const recap = res.data?.recap as SpaceRecap | undefined;
		if (!recap) return { success: false, code: "FAILED" };
		return { success: true, recap };
	} catch (error) {
		const res = (
			error as {
				response?: { status?: number; data?: { code?: string; message?: string } };
			}
		).response;
		return {
			success: false,
			code:
				res?.data?.code ??
				(res?.status === 404 ? "NOT_FOUND" : res?.status === 403 ? "NOT_ATTENDED" : "FAILED"),
			message: res?.data?.message,
		};
	}
}
