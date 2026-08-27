"use client";

import { resolveHandlesAction } from "@/lib/user.actions";

export interface ResolvedHandle {
	username: string;
	name: string;
	avatar: string;
	isVerified: boolean;
	tier: "bronze" | "silver" | "gold";
	badges: { type: "wolf" | "developer"; tier?: string }[];
}

/**
 * One module-level cache of resolved handles, shared by every mention on the
 * page.
 *
 * `null` is a real cached answer meaning "no such account", so a handle that
 * does not exist is looked up once rather than on every render of every post
 * that names it.
 */
const resolved = new Map<string, ResolvedHandle | null>();
const inFlight = new Map<string, Promise<void>>();
/** Seeded handles still missing their real record (avatar, name, tier). */
const partial = new Set<string>();

/** Handles queued this tick, so one post costs one request, not one per chip. */
let queue = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

let notifyQueued = false;

/**
 * Always asynchronous.
 *
 * `seedHandles` is called from inside render (PostCard memoises its rich
 * text), and notifying synchronously would setState on a subscribed Mention
 * while a different component is rendering, which React rightly complains
 * about. Deferring one tick makes seeding safe from anywhere.
 */
function notify() {
	if (notifyQueued) return;
	notifyQueued = true;
	queueMicrotask(() => {
		notifyQueued = false;
		for (const fn of listeners) fn();
	});
}

export function subscribeMentions(fn: () => void) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

export function peekHandle(handle: string): ResolvedHandle | null | undefined {
	return resolved.get(handle.toLowerCase());
}

/**
 * Seed from metadata a post already carries, so mentions on stored posts paint
 * correctly on first render with no request at all.
 */
export function seedHandles(
	entries: { username: string; isVerified?: boolean; avatar?: string }[],
) {
	let added = false;
	for (const e of entries) {
		const key = e.username?.toLowerCase();
		if (!key || resolved.has(key)) continue;
		resolved.set(key, {
			username: e.username,
			name: e.username,
			avatar: e.avatar ?? "",
			isVerified: Boolean(e.isVerified),
			tier: "gold",
			badges: [],
		});
		// A post's stored mentions carry {username, isVerified} and NOTHING
		// else — no avatar, no display name, no tier. Seeding is for instant
		// paint, so it must not count as knowing the person: without this the
		// seed satisfied requestHandle's cache check, the real lookup never
		// ran, and every mention chip rendered with an empty photo forever.
		if (!e.avatar) partial.add(key);
		added = true;
	}
	if (added) notify();
}

async function flush() {
	flushTimer = null;
	const batch = [...queue];
	queue = new Set();
	if (batch.length === 0) return;

	const res = await resolveHandlesAction(batch);
	const found = new Map(
		(res.users ?? []).map((u: any) => [String(u.username).toLowerCase(), u]),
	);
	for (const handle of batch) {
		// Absent from the response means the account does not exist. Cached as
		// null so it is never asked about again.
		const full = found.get(handle) as ResolvedHandle | undefined;
		// Absent from the response means the account does not exist — but only
		// downgrade to null if we were not already showing a seeded chip for
		// it; a failed request must not erase a mention the post vouched for.
		if (full || !partial.has(handle)) {
			resolved.set(handle, full ?? null);
		}
		if (full) partial.delete(handle);
		inFlight.delete(handle);
	}
	notify();
}

/** Ask for a handle. Coalesced into one batched request per tick. */
export function requestHandle(handle: string) {
	const key = handle.toLowerCase();
	// A partial entry paints, but still owes us the real record.
	if ((resolved.has(key) && !partial.has(key)) || inFlight.has(key)) return;
	inFlight.set(key, Promise.resolve());
	queue.add(key);
	if (!flushTimer) flushTimer = setTimeout(flush, 40);
}
