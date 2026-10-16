"use client";

import { BACKEND_URL } from "@/const";

/**
 * The Vivid window's client: one streamed turn at a time against the
 * gateway's harness (POST /api/vivid/turns, text/event-stream). Called from
 * the browser with the person's own Clerk token, the way sendFormDirect
 * reaches the gateway, because a server action cannot stream to the page.
 *
 * Events, as the harness sends them (gateway services/vivid-agent/agent.ts):
 *   thread · token · tool · card · title · done · error
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || BACKEND_URL;

export type VividCard =
	| { kind: "posts"; posts: { id: string; text: string; author: string | null; authorName: string | null; createdAt?: string | null }[] }
	| { kind: "people"; people: { id: string; username: string; name: string; avatar: string | null; isVerified?: boolean }[] }
	| { kind: "trends"; trends: { title: string; posts: number | null; category: string | null }[] }
	| { kind: "sources"; sources: { title: string; url: string }[] }
	| {
			kind: "confirm";
			actionId: string;
			tool: string;
			verb?: string;
			summary: string;
			preview?: unknown;
			status: "pending" | "done" | "cancelled" | "expired" | "failed";
			expiresAt?: string;
	  };

export type VividEvent =
	| { type: "thread"; threadId: string }
	| { type: "token"; content: string }
	| { type: "tool"; id: string; name: string; status: "start" | "done" | "error"; label?: string }
	| { type: "card"; card: VividCard }
	| { type: "title"; title: string }
	| { type: "done"; threadId: string; messageId: string; credits?: unknown }
	| { type: "error"; message: string; code?: string };

async function token() {
	return (await (window as any).Clerk?.session?.getToken?.()) as string | undefined;
}

/** Stream one turn. Resolves when the stream ends; `onEvent` sees every event. */
export async function streamVividTurn(input: {
	text: string;
	threadId?: string | null;
	signal?: AbortSignal;
	onEvent: (e: VividEvent) => void;
}) {
	const t = await token();
	if (!t) {
		input.onEvent({ type: "error", code: "auth", message: "Sign in to talk to Vivid." });
		return;
	}
	let res: Response;
	try {
		res = await fetch(`${API_URL}/api/vivid/turns`, {
			method: "POST",
			headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
			body: JSON.stringify({ text: input.text, threadId: input.threadId ?? undefined }),
			signal: input.signal,
		});
	} catch (e) {
		if ((e as Error)?.name === "AbortError") return;
		input.onEvent({ type: "error", code: "network", message: "Couldn't reach Vivid. Check your connection." });
		return;
	}
	if (!res.ok || !res.body) {
		const body = await res.json().catch(() => null);
		input.onEvent({ type: "error", code: String(res.status), message: body?.message || "Vivid couldn't answer that." });
		return;
	}
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buf = "";
	try {
		for (;;) {
			const { value, done } = await reader.read();
			if (done) break;
			buf += decoder.decode(value, { stream: true });
			let cut = buf.indexOf("\n\n");
			while (cut !== -1) {
				const chunk = buf.slice(0, cut);
				buf = buf.slice(cut + 2);
				for (const line of chunk.split("\n")) {
					if (!line.startsWith("data:")) continue;
					try {
						input.onEvent(JSON.parse(line.slice(5).trim()) as VividEvent);
					} catch {
						/* a partial or keep-alive line */
					}
				}
				cut = buf.indexOf("\n\n");
			}
		}
	} catch (e) {
		if ((e as Error)?.name !== "AbortError") {
			input.onEvent({ type: "error", code: "network", message: "The answer was cut off." });
		}
	}
}

/** Confirm or cancel an action Vivid prepared (a post, a follow…). */
export async function settleVividAction(actionId: string, verb: "confirm" | "cancel") {
	const t = await token();
	if (!t) return { ok: false as const, message: "Sign in first." };
	try {
		const res = await fetch(`${API_URL}/api/vivid/actions/${encodeURIComponent(actionId)}/${verb}`, {
			method: "POST",
			headers: { Authorization: `Bearer ${t}` },
		});
		const body = await res.json().catch(() => null);
		return res.ok ? { ok: true as const, body } : { ok: false as const, message: body?.message || "That didn't go through." };
	} catch {
		return { ok: false as const, message: "Network error" };
	}
}
