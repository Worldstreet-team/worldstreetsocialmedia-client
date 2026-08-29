"use client";

import { useAuth } from "@clerk/nextjs";
import axios from "axios";
import { useCallback } from "react";
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
export function useGatewayRead() {
	const { getToken } = useAuth();
	return useCallback(
		async <T = any>(
			path: string,
			pick?: (body: any) => T,
		): Promise<
			| { success: true; data: T }
			| { success: false; data?: undefined; message?: string }
		> => {
			try {
				const token = await getToken();
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
				};
			}
		},
		[getToken],
	);
}
