"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

async function bearer() {
	const { getToken } = await auth();
	const token = await getToken();
	return token ? { Authorization: `Bearer ${token}` } : null;
}

export async function getCommunitiesAction() {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.get(`${BACKEND_URL}/api/communities`, { headers });
		return { success: true, communities: res.data?.communities ?? [] };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Failed to load communities",
		};
	}
}

/** One of the caller's own communities, as `/communities/mine` sends it. */
export interface MyCommunity {
	id: string;
	name: string;
	slug: string;
	avatar?: string;
	membersCount: number;
}

/**
 * The caller's OWN communities, searched and paged on the gateway (ranked
 * there: starts with the text, then a word that starts with it, then
 * anywhere). `recent` comes only with the first page of the plain list (no
 * `q`, no `cursor`): up to six they were active in lately. Built for room
 * setup, where the public top 60 hid most of a big joiner's communities.
 */
export async function getMyCommunitiesAction(
	params: { q?: string; cursor?: string | null; limit?: number } = {},
) {
	const headers = await bearer();
	if (!headers) return { success: false as const, message: "Unauthorized" };
	try {
		const res = await axios.get(`${BACKEND_URL}/api/communities/mine`, {
			headers,
			params: {
				...(params.q ? { q: params.q } : {}),
				...(params.cursor ? { cursor: params.cursor } : {}),
				limit: params.limit ?? 40,
			},
		});
		const shape = (c: any): MyCommunity => ({
			id: String(c?.id ?? c?._id ?? ""),
			name: String(c?.name ?? ""),
			slug: String(c?.slug ?? ""),
			...(c?.avatar ? { avatar: String(c.avatar) } : {}),
			membersCount: Number(c?.membersCount) || 0,
		});
		return {
			success: true as const,
			communities: ((res.data?.communities ?? []) as any[]).map(shape),
			recent: Array.isArray(res.data?.recent)
				? (res.data.recent as any[]).map(shape)
				: undefined,
			nextCursor: (res.data?.nextCursor ?? null) as string | null,
			total: Number(res.data?.total) || 0,
		};
	} catch (error: any) {
		return {
			success: false as const,
			message:
				error.response?.data?.message || "Couldn't load your communities",
		};
	}
}

/**
 * FormData rather than JSON so an avatar can ride along on the same request,
 * through the R2 path posts already use.
 */
export async function createCommunityAction(formData: FormData) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.post(`${BACKEND_URL}/api/communities`, formData, {
			// No Content-Type: axios sets the multipart boundary itself.
			headers,
		});
		return {
			success: true,
			slug: res.data?.slug as string,
			communityId: res.data?.communityId as string,
		};
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Could not create community",
		};
	}
}

/** What slug a name will actually get, and whether it was the first choice. */
export async function checkSlugAction(name: string) {
	const headers = await bearer();
	if (!headers) return { success: false as const };
	try {
		const res = await axios.get(`${BACKEND_URL}/api/communities/slug-check`, {
			headers,
			params: { name },
		});
		return {
			success: true as const,
			slug: (res.data?.slug ?? null) as string | null,
			available: Boolean(res.data?.available),
		};
	} catch {
		return { success: false as const };
	}
}

export async function toggleCommunityAction(id: string, join: boolean) {
	const headers = await bearer();
	if (!headers) return { success: false };
	try {
		await axios.post(
			`${BACKEND_URL}/api/communities/${id}/${join ? "join" : "leave"}`,
			{},
			{ headers },
		);
		return { success: true };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message,
		};
	}
}

export async function getCommunityAction(slug: string) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.get(
			`${BACKEND_URL}/api/communities/${encodeURIComponent(slug)}`,
			{ headers },
		);
		return { success: true, community: res.data?.community };
	} catch (error: any) {
		return {
			success: false,
			status: error.response?.status,
			message: error.response?.data?.message || "Failed to load community",
		};
	}
}

export async function getCommunityPostsAction(
	slug: string,
	cursor: string | null = null,
) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.get(
			`${BACKEND_URL}/api/communities/${encodeURIComponent(slug)}/posts`,
			{ headers, params: cursor ? { cursor } : {} },
		);
		return {
			success: true,
			posts: res.data?.posts ?? [],
			nextCursor: res.data?.nextCursor ?? null,
			hasMore: Boolean(res.data?.hasMore),
		};
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Failed to load posts",
		};
	}
}

/**
 * Communities Home: one timeline across every community you belong to, plus
 * the list of those communities for the rail.
 */
export async function getCommunityHomeAction(cursor: string | null = null) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		const res = await axios.get(`${BACKEND_URL}/api/communities/home`, {
			headers,
			params: cursor ? { cursor } : {},
		});
		return {
			success: true,
			posts: res.data?.posts ?? [],
			communities: res.data?.communities ?? [],
			nextCursor: res.data?.nextCursor ?? null,
			hasMore: Boolean(res.data?.hasMore),
		};
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Failed to load communities",
		};
	}
}

/**
 * Owner edits: description, category, avatar. The name (and slug) is
 * immutable server-side — links in the wild are the slug.
 */
export async function updateCommunityAction(id: string, form: FormData) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		await axios.patch(`${BACKEND_URL}/api/communities/${id}`, form, {
			headers,
			timeout: 30_000,
		});
		return { success: true };
	} catch (error: any) {
		return {
			success: false,
			message:
				error.response?.data?.message || "Could not save the changes",
		};
	}
}

/** Owner deletes the community; its posts go with it. */
export async function deleteCommunityAction(id: string) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		await axios.delete(`${BACKEND_URL}/api/communities/${id}`, { headers });
		return { success: true };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Could not delete it",
		};
	}
}

/** Owner removes (and bans) a member. */
export async function removeMemberAction(id: string, profileId: string) {
	const headers = await bearer();
	if (!headers) return { success: false, message: "Unauthorized" };
	try {
		await axios.post(
			`${BACKEND_URL}/api/communities/${id}/remove`,
			{ profileId },
			{ headers },
		);
		return { success: true };
	} catch (error: any) {
		return {
			success: false,
			message: error.response?.data?.message || "Could not remove them",
		};
	}
}

export interface CommunityMemberRow {
	id: string;
	username: string;
	firstName?: string;
	lastName?: string;
	avatar?: string;
	isVerified?: boolean;
	isOwner: boolean;
}

/** Paged member roster for the members sheet. */
export async function getCommunityMembersAction(slug: string, offset = 0) {
	const headers = await bearer();
	if (!headers)
		return { success: false as const, members: [], nextOffset: null };
	try {
		const res = await axios.get(
			`${BACKEND_URL}/api/communities/${slug}/members`,
			{ headers, params: { offset } },
		);
		return {
			success: true as const,
			members: (res.data?.members ?? []) as CommunityMemberRow[],
			nextOffset: (res.data?.nextOffset ?? null) as number | null,
		};
	} catch {
		return { success: false as const, members: [], nextOffset: null };
	}
}
