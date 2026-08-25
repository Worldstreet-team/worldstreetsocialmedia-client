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
