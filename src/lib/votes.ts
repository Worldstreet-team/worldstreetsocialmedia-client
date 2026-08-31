"use client";

import { BACKEND_URL } from "@/const";
import { postJsonDirect } from "@/lib/upload-direct";

const API_URL = process.env.NEXT_PUBLIC_API_URL || BACKEND_URL;

/**
 * The Weekly Vote, client side. Everything money-adjacent goes browser ->
 * gateway directly (the skew rule: a vote must land even from a tab older
 * than the current deployment).
 */

export interface VoteCycleInfo {
	cycle: string;
	startsAt: string;
	endsAt: string;
	priceMinor: number;
	freeAvailable: boolean;
}

let cycleCache: { data: VoteCycleInfo; at: number } | null = null;
let cycleInflight: Promise<VoteCycleInfo | null> | null = null;

/**
 * One cycle fetch shared by every chip on the page. The answer changes when
 * a vote is cast (freeAvailable flips) — callers bust it via markFreeUsed —
 * and weekly when the cycle rolls, which the 60s TTL covers.
 */
export async function getVoteCycle(): Promise<VoteCycleInfo | null> {
	if (cycleCache && Date.now() - cycleCache.at < 60_000) return cycleCache.data;
	if (cycleInflight) return cycleInflight;
	cycleInflight = (async () => {
		try {
			const token = await (window as any).Clerk?.session?.getToken?.();
			if (!token) return null;
			const res = await fetch(`${API_URL}/api/votes/cycle`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) return null;
			const data = (await res.json()) as VoteCycleInfo;
			cycleCache = { data, at: Date.now() };
			return data;
		} catch {
			return null;
		} finally {
			cycleInflight = null;
		}
	})();
	return cycleInflight;
}

export function markFreeVoteUsed() {
	if (cycleCache) cycleCache.data.freeAvailable = false;
}

export async function castVote(postId: string, quantity: number) {
	return postJsonDirect(`/api/votes/${postId}`, { quantity });
}

export async function getVoteLeaderboard(cycle?: string) {
	try {
		const token = await (window as any).Clerk?.session?.getToken?.();
		if (!token) return null;
		const qs = cycle ? `?cycle=${encodeURIComponent(cycle)}` : "";
		const res = await fetch(`${API_URL}/api/votes/leaderboard${qs}`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}

let leaderCache: { data: any; at: number } | null = null;

/** The top three faces for the sidebar — cached so the nav costs one
 *  leaderboard read per few minutes, not one per render. */
export async function getVoteLeaders(): Promise<
	{ avatar?: string; username?: string }[]
> {
	if (leaderCache && Date.now() - leaderCache.at < 180_000)
		return leaderCache.data;
	const res: any = await getVoteLeaderboard();
	const top = (res?.board ?? [])
		.slice(0, 3)
		.map((r: any) => r.author)
		.filter(Boolean);
	leaderCache = { data: top, at: Date.now() };
	return top;
}
