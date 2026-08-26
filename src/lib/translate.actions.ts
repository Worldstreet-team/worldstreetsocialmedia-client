"use server";

import { cookies } from "next/headers";
import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";

// Translate a post into the reader's locale. Target comes from the same
// ws_locale cookie the i18n middleware maintains — one source of truth.
export async function translatePostAction(text: string) {
	const { getToken } = await auth();
	const token = await getToken();
	if (!token) return { success: false as const };

	const jar = await cookies();
	const cookieLocale = jar.get(LOCALE_COOKIE)?.value;
	const target = isLocale(cookieLocale) ? cookieLocale : "en";

	try {
		const res = await axios.post(
			`${BACKEND_URL}/api/util/translate`,
			{ text, target },
			{ headers: { Authorization: `Bearer ${token}` }, timeout: 15_000 },
		);
		return {
			success: true as const,
			translated: res.data?.translated as string | undefined,
			sameLanguage: Boolean(res.data?.sameLanguage),
			source: res.data?.source as string | undefined,
			target,
		};
	} catch {
		return { success: false as const };
	}
}

/** Translate into an explicit target locale (the panel's language tabs). */
export async function translatePostToAction(text: string, target: string) {
	const { getToken } = await auth();
	const token = await getToken();
	if (!token) return { success: false as const };
	if (!isLocale(target)) return { success: false as const };

	try {
		const res = await axios.post(
			`${BACKEND_URL}/api/util/translate`,
			{ text, target },
			{ headers: { Authorization: `Bearer ${token}` }, timeout: 15_000 },
		);
		return {
			success: true as const,
			translated: res.data?.translated as string | undefined,
			sameLanguage: Boolean(res.data?.sameLanguage),
			source: res.data?.source as string | undefined,
			target,
		};
	} catch {
		return { success: false as const };
	}
}

/**
 * Translate a whole page of posts in one round trip.
 *
 * The feed prefetches an entire page as it loads; doing that as N separate
 * server actions was N HTTP calls to the gateway and N more to the provider.
 * The gateway now resolves a batch itself — local language detection first,
 * then cache, then provider — so most pages cost no provider calls at all.
 *
 * Partial success: ids the gateway couldn't resolve are simply missing from
 * the returned record, and the caller treats absence as "not translated".
 */
export async function translatePostsAction(
	items: { id: string; text: string }[],
) {
	const { getToken } = await auth();
	const token = await getToken();
	if (!token) return { success: false as const };

	const jar = await cookies();
	const cookieLocale = jar.get(LOCALE_COOKIE)?.value;
	const target = isLocale(cookieLocale) ? cookieLocale : "en";

	try {
		const res = await axios.post(
			`${BACKEND_URL}/api/util/translate/batch`,
			{ items, target },
			{ headers: { Authorization: `Bearer ${token}` }, timeout: 20_000 },
		);
		return {
			success: true as const,
			target,
			results: (res.data?.results ?? {}) as Record<
				string,
				{ translated?: string; source?: string; sameLanguage?: boolean }
			>,
		};
	} catch {
		return { success: false as const };
	}
}
