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
		resolved.set(handle, (found.get(handle) as ResolvedHandle) ?? null);
		inFlight.delete(handle);
	}
	notify();
}

/** Ask for a handle. Coalesced into one batched request per tick. */
export function requestHandle(handle: string) {
	const key = handle.toLowerCase();
	if (resolved.has(key) || inFlight.has(key)) return;
	inFlight.set(key, Promise.resolve());
	queue.add(key);
	if (!flushTimer) flushTimer = setTimeout(flush, 40);
}
