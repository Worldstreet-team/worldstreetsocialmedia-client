"use server";

import { XSTREAM_API_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

// Start a stream on Xstream with the user's own Clerk session token. The
// token carries this app's origin as its azp claim, which Xstream's
// authorizedParties list accepts — the same instance both services verify
// against. Xstream auto-provisions a user on first authenticated call, so a
// socials user needs no prior Xstream account.
// Xstream validates category against ITS contract enum ("Bitcoin Trading",
// "Market Analysis", ...). The socials sheet speaks the socials taxonomy
// ("markets", "crypto", ...) — translate here so every caller is safe, and
// pass unknown values through only when they're already contract-valid.
const XSTREAM_CATEGORIES = [
	"Bitcoin Trading",
	"Altcoins & DeFi",
	"NFTs & Web3",
	"Market Analysis",
	"Crypto Education",
	"General / Just Chatting",
] as const;

const CATEGORY_TO_XSTREAM: Record<string, string> = {
	markets: "Market Analysis",
	crypto: "Bitcoin Trading",
	forex: "Market Analysis",
	stocks: "Market Analysis",
	general: "General / Just Chatting",
};

function toXstreamCategory(category: string): string {
	// Xstream accepts free-form categories now — the socials taxonomy labels
	// ride through verbatim. Only the old socials 5-string values still map.
	const mapped = CATEGORY_TO_XSTREAM[category.toLowerCase()] ?? category;
	return mapped.slice(0, 48) || "General / Just Chatting";
}

export type GoLiveSource = "camera" | "screen" | "obs";

export async function goLiveAction(
	title: string,
	category: string,
	source: GoLiveSource = "camera",
	notifyFollowers = true,
) {
	const { getToken } = await auth();
	const token = await getToken();
	if (!token) return { success: false as const, message: "Unauthorized" };

	try {
		const res = await axios.post(
			`${XSTREAM_API_URL}/v1/streams`,
			{
				title,
				category: toXstreamCategory(category),
				source,
				notifyFollowers,
			},
			{
				headers: { Authorization: `Bearer ${token}` },
				timeout: 20_000,
			},
		);
		const stream = res.data?.data?.stream;
		const ingress = res.data?.data?.ingress;
		return {
			success: true as const,
			streamId: stream?.id ? String(stream.id) : undefined,
			roomName: stream?.livekitRoomName
				? String(stream.livekitRoomName)
				: undefined,
			// Native broadcast: socials publishes into the room itself with
			// these instead of redirecting to the Xstream studio.
			livekitToken: res.data?.data?.livekitToken
				? String(res.data.data.livekitToken)
				: undefined,
			livekitUrl: res.data?.data?.livekitUrl
				? String(res.data.data.livekitUrl)
				: undefined,
			// OBS only: RTMP server + key for the encoder.
			ingress: ingress
				? {
						url: String(ingress.url ?? ""),
						streamKey: String(ingress.streamKey ?? ""),
					}
				: undefined,
		};
	} catch (error: any) {
		return {
			success: false as const,
			message:
				error.response?.data?.message || "Could not start the stream",
		};
	}
}

/**
 * Preflight against the local Xstream API: proves the link (same Clerk
 * instance, azp accepted, service reachable) BEFORE the user hits Go Live —
 * "can I actually stream from here?" answered up front, not at submit.
 * Xstream auto-provisions on first authenticated call, so a 200 here also
 * guarantees the account exists.
 */
export async function xstreamStatusAction() {
	const { getToken } = await auth();
	const token = await getToken();
	if (!token) return { connected: false as const, message: "Unauthorized" };

	try {
		const res = await axios.get(`${XSTREAM_API_URL}/v1/user/me`, {
			headers: { Authorization: `Bearer ${token}` },
			timeout: 8_000,
		});
		const user = res.data?.data?.user ?? res.data?.data ?? res.data;
		return {
			connected: true as const,
			username: user?.username ? String(user.username) : undefined,
			displayName: user?.displayName
				? String(user.displayName)
				: undefined,
			isLive: Boolean(user?.isLive),
		};
	} catch (error: any) {
		return {
			connected: false as const,
			message:
				error.code === "ECONNREFUSED"
					? "Xstream server is not running"
					: error.response?.data?.message || "Xstream unreachable",
		};
	}
}

export async function endStreamAction(streamId: string) {
	const { getToken } = await auth();
	const token = await getToken();
	if (!token) return { success: false as const };
	try {
		await axios.post(
			`${XSTREAM_API_URL}/v1/streams/${streamId}/end`,
			{},
			{ headers: { Authorization: `Bearer ${token}` }, timeout: 10_000 },
		);
		return { success: true as const };
	} catch (error: any) {
		// A stream that is already over is the outcome we wanted. Xstream
		// answers 400 STREAM_OFFLINE (or 404 if it is gone); treating those
		// as failures is what left docks stuck live with an End button that
		// could never succeed.
		const status = error.response?.status;
		const code = error.response?.data?.code;
		if (
			status === 404 ||
			code === "STREAM_OFFLINE" ||
			code === "STREAM_NOT_FOUND"
		) {
			return { success: true as const, alreadyEnded: true };
		}
		return {
			success: false as const,
			message: error.response?.data?.message || "Could not end the stream",
		};
	}
}

/** Public stream info for the in-app viewer. */
export async function getStreamAction(streamId: string) {
	try {
		const res = await axios.get(`${XSTREAM_API_URL}/v1/streams/${streamId}`, {
			timeout: 10_000,
		});
		const st = res.data?.data?.stream;
		if (!st) return { success: false as const };
		return {
			success: true as const,
			stream: {
				id: String(st._id ?? st.id),
				title: String(st.title ?? ""),
				category: String(st.category ?? ""),
				isLive: Boolean(st.isLive),
				viewers: Number(st.viewers ?? 0),
				startedAt: st.startedAt ? String(st.startedAt) : undefined,
				streamer: {
					username: String(st.streamerId?.username ?? ""),
					displayName: String(st.streamerId?.displayName ?? ""),
					avatar: String(st.streamerId?.avatar ?? ""),
				},
			},
		};
	} catch {
		return { success: false as const };
	}
}

/** Viewer token: signed-in identity so chat carries the real handle. */
export async function getViewerTokenAction(streamId: string) {
	const { getToken } = await auth();
	const token = await getToken();
	try {
		const res = await axios.get(
			`${XSTREAM_API_URL}/v1/streams/${streamId}/token?platform=worldspace`,
			{
				headers: token ? { Authorization: `Bearer ${token}` } : undefined,
				timeout: 10_000,
			},
		);
		return {
			success: true as const,
			token: String(res.data?.data?.token ?? ""),
			livekitUrl: String(res.data?.data?.livekitUrl ?? ""),
		};
	} catch (error: any) {
		return {
			success: false as const,
			message: error.response?.data?.message || "Could not join the stream",
		};
	}
}

/** Everything currently live, for the rail rings and the live directory. */
export async function listLiveStreamsAction() {
	try {
		// live=true is not optional: without it the endpoint returns page 1 of
		// EVERY stream ever created, sorted by viewers descending. With 700+
		// records, a stream that just went live has ~0 viewers and sorts below
		// every ended stream that ever accumulated a handful, so it is never in
		// the page and the rail renders empty while someone is broadcasting.
		//
		// Passing it also opts into the server's stale-stream reconciliation,
		// which drops streams whose LiveKit room has gone away. sort=recent so
		// the newest broadcast leads rather than the biggest.
		const res = await axios.get(`${XSTREAM_API_URL}/v1/streams`, {
			params: { live: "true", sort: "recent", limit: 50 },
			timeout: 10_000,
		});
		const streams = (res.data?.data?.streams ?? [])
			// Belt and braces: the server already filtered, but a stale record
			// slipping through would otherwise show a dead ring.
			.filter((st: any) => st.isLive)
			.map((st: any) => ({
				id: String(st._id ?? st.id),
				title: String(st.title ?? ""),
				category: String(st.category ?? ""),
				viewers: Number(st.viewers ?? 0),
				// The rail renders a heart for live streams too, so the count
				// has to travel with the listing — otherwise every broadcast
				// shows 0 until someone clicks it.
				likes: Number(st.likes ?? 0),
				username: String(st.streamerId?.username ?? ""),
				avatar: String(st.streamerId?.avatar ?? ""),
				// Forward-compatible: shown when Xstream populates them, and
				// the name falls back to the handle when it does not.
				firstName: st.streamerId?.firstName ?? undefined,
				lastName: st.streamerId?.lastName ?? undefined,
				isVerified: Boolean(st.streamerId?.isVerified),
				// Co-live: approved guests publish into the host's room and the
				// listing carries them. Only status "live" counts — a pending
				// request is not on the stage and must not show in the ring.
				stage: (st.guests ?? [])
					.filter((g: any) => g.status === "live")
					.map((g: any) => ({
						username: String(g.username ?? ""),
						avatar: String(g.avatar ?? ""),
					})),
			}));
		return { success: true as const, streams };
	} catch (error: any) {
		// Loudly, and only on the server. An empty rail is indistinguishable
		// from "nobody is live", so a swallowed error here is invisible: the
		// production rail was empty for a WEEK because XSTREAM_API_URL was
		// unset and every call was hitting the fallback localhost:3001 on the
		// production host itself.
		console.error(
			`[live] listLiveStreams failed against ${XSTREAM_API_URL}:`,
			error?.code || error?.message || error,
		);
		return { success: false as const, streams: [] };
	}
}

/** The caller's own active stream, if one is live. Recovery path for the
 *  broadcaster dock after a page reload. */
export async function getMyActiveStreamAction() {
	const { getToken } = await auth();
	const token = await getToken();
	if (!token) return { success: false as const };
	try {
		const res = await axios.get(
			`${XSTREAM_API_URL}/v1/streams/active/mine`,
			{ headers: { Authorization: `Bearer ${token}` }, timeout: 8_000 },
		);
		const st = res.data?.data?.stream;
		if (!st) return { success: true as const, stream: null };
		return {
			success: true as const,
			stream: {
				id: String(st.id ?? st._id),
				title: String(st.title ?? ""),
				category: String(st.category ?? ""),
				roomName: String(st.livekitRoomName ?? ""),
				source: (st.source === "screen" ? "screen" : "camera") as
					| "camera"
					| "screen",
			},
		};
	} catch {
		return { success: false as const };
	}
}
