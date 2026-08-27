"use client";

import { BACKEND_URL } from "@/const";

/**
 * Search reads, straight from the browser to the gateway.
 *
 * Everything else in this app goes through a `"use server"` action, and for
 * mutations that is right. Search is the exception, for two reasons:
 *
 * 1. A server action is a POST to the current route that makes Next re-render
 *    the whole page's RSC tree and ship it back. Per keystroke, that is an
 *    enormous amount of work to answer "who is called crypto" — the network
 *    panel shows a full `/?_rsc=` refetch behind every single call.
 * 2. It cannot be cancelled. Search needs `AbortController`: when you type
 *    another letter, the previous query should stop, not race the new one.
 *
 * The app already reaches the backend directly from the client where that is
 * the better transport — the live surface, the realtime provider and the
 * message box all do it — so this is an established seam, not a new one. Auth
 * is the same Clerk JWT the server actions forward.
 */

const API = BACKEND_URL;

async function authHeaders(): Promise<HeadersInit | null> {
	const token = await (window as any).Clerk?.session?.getToken();
	return token ? { Authorization: `Bearer ${token}` } : null;
}

async function get<T>(path: string, signal: AbortSignal, fallback: T): Promise<T> {
	try {
		const headers = await authHeaders();
		if (!headers) return fallback;
		const res = await fetch(`${API}${path}`, { headers, signal });
		if (!res.ok) return fallback;
		return (await res.json()) as T;
	} catch {
		// An aborted request is the normal case for a fast typist, not an
		// error worth surfacing. A real failure degrades to "no results",
		// which the panel already renders honestly.
		return fallback;
	}
}

export async function searchUsers(q: string, signal: AbortSignal) {
	const body = await get<{ data?: any[] }>(
		`/api/users/search?q=${encodeURIComponent(q)}`,
		signal,
		{},
	);
	return body.data ?? [];
}

export async function searchPosts(q: string, signal: AbortSignal) {
	const body = await get<{ data?: any[] }>(
		`/api/posts/search?q=${encodeURIComponent(q)}`,
		signal,
		{},
	);
	return body.data ?? [];
}

export async function listCommunities(signal: AbortSignal) {
	const body = await get<{ communities?: any[] }>(
		"/api/communities",
		signal,
		{},
	);
	return body.communities ?? [];
}
