"use client";

import { BACKEND_URL } from "@/const";
import { sendFormProgress } from "@/lib/upload-direct";

/**
 * The Vivid window's client: one streamed turn at a time against the
 * gateway's harness (POST /api/vivid/turns, text/event-stream). Called from
 * the browser with the person's own Clerk token, the way sendFormDirect
 * reaches the gateway, because a server action cannot stream to the page.
 *
 * Events, as the harness sends them (gateway services/vivid-agent/agent.ts):
 *   thread · token · tool · card · title · access · done · error
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
			preview?: VividPreview;
			status: "pending" | "done" | "cancelled" | "expired" | "failed";
			expiresAt?: string;
	  }
	| { kind: "open"; tool: string; summary: string; intent: VividIntent }
	| { kind: "meeting"; meeting: VividMeeting };

/** A WorldMeet recap (gateway tools.ts meetingCard). */
export type VividMeeting = {
	id: string;
	title: string;
	recordedAt: string | null;
	durationMin: number;
	people: { name: string; avatar: string | null }[];
	summary: string;
	actions: { text: string; owner: string | null; done: boolean }[];
	chapters: string[];
	status: string;
	url: string;
};

/** A post someone sent to Vivid ("Ask Vivid" on a post): what its card draws. */
export type VividPostRef = {
	id: string;
	author: string;
	authorName: string;
	avatar?: string | null;
	text: string;
	image?: string | null;
};

/** What a confirm card draws, by tool (gateway tools.ts `prepare`). */
export type VividPreview = {
	text?: string;
	title?: string;
	startsAt?: string | null;
	person?: { id: string; username: string; name: string; avatar: string | null; isVerified?: boolean };
	/** start_meeting: the group the link goes to. */
	group?: string;
	members?: number | null;
	post?: { id: string; text: string; author: string | null };
	poll?: { options: string[] } | null;
	[key: string]: unknown;
};

/**
 * A quick action (plan: "Quick actions"): the app opens a screen filled in
 * and the person finishes it. Runs in the browser, instantly, with no
 * confirm, because nothing happens until they press the screen's own button.
 * The gateway's open tools (tools.ts) produce these; vivid-actions.ts runs them.
 */
export type VividIntent =
	| { type: "go_live"; title?: string; category?: string }
	| { type: "compose"; text?: string }
	| { type: "chat"; profileId: string; username: string; draft?: string }
	| { type: "space"; title?: string }
	| { type: "navigate"; to: string }
	| {
			type: "appearance";
			theme?: "dark" | "light";
			palette?: string;
			textScale?: number | "auto";
			dataSaver?: "on" | "off" | "auto";
	  }
	| { type: "premium" }
	| { type: "search"; query: string }
	| { type: "linked"; app: string; url: string };

export type VividEvent =
	| { type: "thread"; threadId: string }
	| { type: "token"; content: string }
	| { type: "tool"; id: string; name: string; status: "start" | "done" | "error"; label?: string }
	| { type: "card"; card: VividCard }
	| { type: "title"; title: string }
	/** Whether this turn has the WorldStreet Vivid plan ($100, billed on the hub). */
	| { type: "access"; entitled: boolean; subscribeUrl: string }
	| { type: "done"; threadId: string; messageId: string | null }
	| { type: "error"; message: string; code?: string };

async function token() {
	return (await (window as any).Clerk?.session?.getToken?.()) as string | undefined;
}

/** Stream one turn. Resolves when the stream ends; `onEvent` sees every event. */
export async function streamVividTurn(input: {
	text: string;
	threadId?: string | null;
	/** `web`: the composer's "Search the web" is on. `page`: where they asked from. */
	context?: { web?: boolean; page?: string; postId?: string } | null;
	/** Where the conversation is happening: the window, or the Vivid chat in Messages. */
	surface?: "window" | "messages";
	/** Files uploaded with uploadVividFile, at most five. */
	attachments?: string[];
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
			body: JSON.stringify({
				text: input.text,
				threadId: input.threadId ?? undefined,
				context: input.context ?? undefined,
				surface: input.surface ?? "window",
				attachments: input.attachments?.length ? input.attachments : undefined,
			}),
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

/* ── history, feedback and the credits meter ─────────────────────────────── */

async function call<T>(method: string, path: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
	const t = await token();
	if (!t) return { ok: false, message: "Sign in first." };
	try {
		const res = await fetch(`${API_URL}/api/vivid${path}`, {
			method,
			headers: { Authorization: `Bearer ${t}`, ...(body ? { "Content-Type": "application/json" } : {}) },
			body: body ? JSON.stringify(body) : undefined,
		});
		const json = await res.json().catch(() => null);
		if (!res.ok) return { ok: false, message: json?.message || "Something went wrong." };
		return { ok: true, data: (json?.data ?? json) as T };
	} catch {
		return { ok: false, message: "Network error" };
	}
}

export type VividThreadRow = { _id: string; title?: string | null; lastMessageAt?: string; createdAt?: string };
export type VividStoredMessage = {
	_id: string;
	role: "user" | "assistant";
	content: string;
	blocks?: { kind: string; data: Record<string, unknown> }[];
	feedback?: "up" | "down" | null;
	createdAt?: string;
};
/** The window's plan state. `entitled` is null when the hub couldn't be read. */
export type VividUsage = {
	entitled: boolean | null;
	subscribeUrl: string;
	turnsToday: number;
	available: boolean;
};

export const vividApi = {
	threads: () => call<VividThreadRow[]>("GET", "/threads"),
	thread: (id: string) =>
		call<{ thread: VividThreadRow; messages: VividStoredMessage[] }>("GET", `/threads/${encodeURIComponent(id)}`),
	deleteThread: (id: string) => call<unknown>("DELETE", `/threads/${encodeURIComponent(id)}`),
	feedback: (messageId: string, value: "up" | "down" | null) =>
		call<unknown>("POST", `/messages/${encodeURIComponent(messageId)}/feedback`, { value }),
	usage: () => call<VividUsage>("GET", "/usage"),
};

/* ── files ───────────────────────────────────────────────────────────────── */

/** A file Vivid has read (gateway vivid-attachments.service summaryOf). */
export type VividFile = {
	id: string;
	kind: "pdf" | "docx" | "text" | "image" | "audio";
	name: string;
	chars: number;
	truncated: boolean;
	pages: number | null;
	durationSec: number | null;
};

/** Upload one file for Vivid to read; the gateway extracts it before answering. */
export async function uploadVividFile(
	file: File,
	opts: { durationSec?: number | null; onProgress?: (frac: number) => void; signal?: AbortSignal } = {},
): Promise<{ ok: true; file: VividFile } | { ok: false; message: string; aborted?: boolean }> {
	const fd = new FormData();
	fd.append("file", file, file.name);
	if (opts.durationSec) fd.append("durationSec", String(Math.round(opts.durationSec)));
	const r = await sendFormProgress("/api/vivid/attachments", fd, { onProgress: opts.onProgress, signal: opts.signal });
	if (!r.success) return { ok: false, message: r.message, aborted: r.aborted };
	const data = r.data?.data ?? r.data;
	if (!data?.id) return { ok: false, message: "That file couldn't be read." };
	return { ok: true, file: data as VividFile };
}

/** Drop a file that was never sent. */
export const deleteVividFile = (id: string) => call<unknown>("DELETE", `/attachments/${encodeURIComponent(id)}`);
