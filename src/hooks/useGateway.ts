"use client";

import { useAuth } from "@clerk/nextjs";
import axios from "axios";
import { useCallback, useRef } from "react";
import { BACKEND_URL } from "@/const";

const API_URL = process.env.NEXT_PUBLIC_API_URL || BACKEND_URL;

/**
 * Direct browser → gateway reads — the fix the fetch audit prescribed and
 * production measurement confirmed.
 *
 * Measured on the live site: a direct authenticated gateway call is
 * 194-344ms (feed ~500-700ms), of which ~150ms is pure network from the
 * reader to the server. The server-action versions of the same reads pay
 * browser → Next → gateway instead, and Next runs one client's actions ONE
 * AT A TIME — the app-load burst of half a dozen reads was 2.5-4s of
 * serialized waiting that these same calls do in parallel in ~350ms.
 *
 * The return shape mirrors the actions ({ success, data, message? }) so a
 * call site migrates by swapping the function, not rewriting its logic.
 * Server actions remain the right tool for WRITES, where the serialization
 * is a feature.
 */
/** How long a read fired before Clerk has loaded waits for a token. */
const TOKEN_WAIT_MS = 6000;

export function useGatewayRead() {
	const { getToken, isLoaded } = useAuth();
	// The newest of each, for a read that is already waiting: the getToken
	// captured when the read started can stay null after Clerk loads.
	const latest = useRef({ getToken, isLoaded });
	latest.current = { getToken, isLoaded };
	return useCallback(
		async <T = any>(
			path: string,
			pick?: (body: any) => T,
		): Promise<
			| { success: true; data: T }
			| {
					success: false;
					data?: undefined;
					message?: string;
					/** The gateway's HTTP status; absent when it never answered. */
					status?: number;
			  }
		> => {
			try {
				// A read fired on first paint runs before Clerk has loaded, when
				// getToken() is null. It used to fail as "Unauthorized" (and the
				// right rail cached that as its answer); it waits for the token.
				let token = await getToken();
				for (let waited = 0; !token && waited < TOKEN_WAIT_MS; waited += 150) {
					if (latest.current.isLoaded) {
						token = await latest.current.getToken();
						break;
					}
					await new Promise((r) => setTimeout(r, 150));
				}
				if (!token) return { success: false, message: "Unauthorized" };
				const res = await axios.get(`${API_URL}${path}`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				return {
					success: true,
					data: (pick ? pick(res.data) : res.data) as T,
				};
			} catch (err: any) {
				return {
					success: false,
					message: err?.response?.data?.message,
					status: err?.response?.status,
				};
			}
		},
		[getToken],
	);
}
