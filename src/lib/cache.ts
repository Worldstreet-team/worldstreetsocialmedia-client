"use client";

/**
 * A keyed client cache with freshness, request de-duplication and explicit
 * invalidation.
 *
 * The app already had per-surface Jotai caches, but every one of them was
 * "show the cached copy, then refetch anyway" — so revisiting a profile fired
 * the same request every time and the screen reflowed under the reader for no
 * new data. What was missing was not storage, it was a notion of *fresh*.
 *
 * The contract here:
 *
 * - **fresh** (within `ttl`): served from memory, no request at all.
 * - **stale** (past `ttl`): served from memory immediately AND revalidated in
 *   the background — the reader never waits, the data still converges.
 * - **absent**: a real load, with `loading` true.
 *
 * Mutations call `invalidate` / `invalidatePrefix` rather than reaching into
 * component state, so "I followed someone" is expressed once and every surface
 * showing that profile picks it up.
 *
 * Deliberately not a persistent cache: this is in-memory and dies with the
 * tab. Anything that must survive a reload belongs in the gateway or in
 * localStorage with its own migration story.
 */

export interface CacheEntry<T> {
	data: T;
	/** When the data landed, for TTL comparison. */
	at: number;
}

const store = new Map<string, CacheEntry<unknown>>();
/** Key -> in-flight promise, so N callers for one key make ONE request. */
const inflight = new Map<string, Promise<unknown>>();
const listeners = new Map<string, Set<() => void>>();

export const DEFAULT_TTL = 60_000;

/* ------------------------------------------------------------------ */
/* Warm start (delivery plan phase 0, 2026-09-25).
 *
 * This store used to be memory only, so a reload or a new tab threw away
 * explore, the profiles, who-to-follow and the notifications page and
 * held the reader on a skeleton for the whole round trip, which on a
 * queueing database is seconds. The entries now ride localStorage under
 * a key scoped to the ACCOUNT (set by JotaiHydrator once the profile is
 * known, so a shared device never shows one person another's cache).
 * Consumers already render a stale copy and revalidate underneath
 * (useCachedResource), so a warm start needs no new rule anywhere else:
 * the copy paints, the request runs, the fresh answer replaces it.
 *
 * Bounded on purpose: entries older than a day are dropped on load, one
 * entry over 200 KB is never written, and the whole file stays under
 * 1 MB by evicting the oldest. Every storage call is wrapped: a private
 * window or a full quota must never reach React. */
const PERSIST_KEY = "ws-cache-v1";
const PERSIST_MAX_AGE = 24 * 3600_000;
const PERSIST_ENTRY_CAP = 200_000;
const PERSIST_TOTAL_CAP = 1_000_000;
let scope: string | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function storageKey(): string | null {
	return scope ? `${PERSIST_KEY}:${scope}` : null;
}

/** Called once the signed-in profile is known; hydrates that account's copy. */
export function setCacheScope(id: string | null | undefined): void {
	const next = id ? String(id) : null;
	if (next === scope) return;
	scope = next;
	if (typeof window === "undefined" || !scope) return;
	try {
		const raw = localStorage.getItem(storageKey() as string);
		if (!raw) return;
		const parsed = JSON.parse(raw) as Record<string, CacheEntry<unknown>>;
		const now = Date.now();
		for (const [key, entry] of Object.entries(parsed)) {
			if (!entry || typeof entry.at !== "number") continue;
			if (now - entry.at > PERSIST_MAX_AGE) continue;
			// Memory wins: a copy this tab already fetched is newer.
			if (!store.has(key)) {
				store.set(key, entry);
				emit(key);
			}
		}
	} catch {
		/* no storage, or a corrupt file: start cold */
	}
	// Whatever this tab fetched before the profile was known is written
	// now; otherwise the first page after a cold start never persists.
	persistSoon();
}

function persistSoon(): void {
	if (typeof window === "undefined" || !scope) return;
	if (persistTimer) clearTimeout(persistTimer);
	persistTimer = setTimeout(persistNow, 400);
}

function persistNow(): void {
	persistTimer = null;
	const key = storageKey();
	if (!key) return;
	try {
		const now = Date.now();
		const rows = [...store.entries()]
			.filter(([, e]) => now - e.at <= PERSIST_MAX_AGE)
			.map(([k, e]) => [k, e, JSON.stringify(e).length] as const)
			.filter(([, , size]) => size <= PERSIST_ENTRY_CAP)
			.sort((a, b) => b[1].at - a[1].at);
		const out: Record<string, CacheEntry<unknown>> = {};
		let total = 0;
		for (const [k, e, size] of rows) {
			if (total + size > PERSIST_TOTAL_CAP) break;
			out[k] = e;
			total += size;
		}
		localStorage.setItem(key, JSON.stringify(out));
	} catch {
		/* quota or a private window: the memory copy still serves this tab */
	}
}

function emit(key: string) {
	const set = listeners.get(key);
	if (!set) return;
	for (const fn of set) fn();
}

export function subscribe(key: string, fn: () => void): () => void {
	let set = listeners.get(key);
	if (!set) {
		set = new Set();
		listeners.set(key, set);
	}
	set.add(fn);
	return () => {
		set.delete(fn);
		if (set.size === 0) listeners.delete(key);
	};
}

export function readCache<T>(key: string): CacheEntry<T> | undefined {
	return store.get(key) as CacheEntry<T> | undefined;
}

export function writeCache<T>(key: string, data: T): void {
	store.set(key, { data, at: Date.now() });
	emit(key);
	persistSoon();
}

export function isFresh(entry: CacheEntry<unknown> | undefined, ttl: number) {
	return !!entry && Date.now() - entry.at < ttl;
}

/**
 * Drop one key. The entry is removed rather than marked stale: callers should
 * re-request, not briefly render data we already know is wrong.
 */
export function invalidate(key: string): void {
	store.delete(key);
	inflight.delete(key);
	emit(key);
	persistSoon();
}

/**
 * Drop every key under a namespace — `invalidatePrefix("profile:")` after an
 * edit, when you cannot know which handles are cached.
 */
export function invalidatePrefix(prefix: string): void {
	for (const key of [...store.keys()]) {
		if (key.startsWith(prefix)) invalidate(key);
	}
}

export function clearCache(): void {
	for (const key of [...store.keys()]) invalidate(key);
	try {
		const key = storageKey();
		if (key && typeof window !== "undefined") localStorage.removeItem(key);
	} catch {
		/* nothing to clear */
	}
}

/**
 * Fetch through the cache. Concurrent callers for the same key share one
 * request; a failed request is not cached, so the next caller retries rather
 * than inheriting an error forever.
 */
export async function fetchCached<T>(
	key: string,
	fetcher: () => Promise<T>,
	ttl: number = DEFAULT_TTL,
): Promise<T> {
	const entry = readCache<T>(key);
	if (isFresh(entry, ttl)) return (entry as CacheEntry<T>).data;

	const existing = inflight.get(key);
	if (existing) return existing as Promise<T>;

	const promise = fetcher()
		.then((data) => {
			writeCache(key, data);
			return data;
		})
		.finally(() => {
			inflight.delete(key);
		});

	inflight.set(key, promise);
	return promise;
}

/** Cache keys live here so a mutation and a read can never spell one differently. */
export const cacheKeys = {
	profile: (handle: string) => `profile:${handle}`,
	profileAll: "profile:",
	userPosts: (userId: string, tab: string) => `userPosts:${userId}:${tab}`,
	userPostsAll: (userId: string) => `userPosts:${userId}:`,
	communities: () => "communities:mine",
	/**
	 * Shared reads — each of these was fetched independently by two different
	 * components, every one with its own atom, loaded flag and timestamp. Same
	 * key here means the SECOND caller gets the first one's result, and two
	 * mounting at once share a single request rather than racing.
	 */
	exploreData: () => "explore:data",
	whoToFollow: () => "explore:whoToFollow",
	notifications: () => "notifications:list",
} as const;
