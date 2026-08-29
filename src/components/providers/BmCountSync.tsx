"use client";

import { useAuth } from "@clerk/nextjs";
import axios from "axios";
import { useSetAtom } from "jotai";
import { useEffect } from "react";
import { BACKEND_URL } from "@/const";
import { unreadBmCountAtom } from "@/store/ui.atom";
import { useUserEvents } from "@/hooks/useUserEvents";

const API_URL = process.env.NEXT_PUBLIC_API_URL || BACKEND_URL;

/**
 * Seeds and refreshes the Business badge — same job MessageCountSync does
 * for DMs, on the direct browser→gateway path. Polls slowly and re-checks
 * on focus; BM has no realtime channel yet, and a deal notification that
 * is a minute late is fine where a chat one would not be.
 */
export function BmCountSync() {
	const setCount = useSetAtom(unreadBmCountAtom);
	const { getToken } = useAuth();

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			try {
				const token = await getToken();
				if (!token) return;
				const res = await axios.get(`${API_URL}/api/bm/unread-count`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				if (!cancelled && typeof res.data?.count === "number") {
					setCount(res.data.count);
				}
			} catch {
				// A missed poll keeps the last honest number.
			}
		};
		void load();
		// The poll is the FALLBACK now — bm events on the user channel land
		// instantly; this catches whatever a dropped connection missed.
		const t = setInterval(() => void load(), 120_000);
		const onFocus = () => void load();
		window.addEventListener("focus", onFocus);
		return () => {
			cancelled = true;
			clearInterval(t);
			window.removeEventListener("focus", onFocus);
		};
	}, [getToken, setCount]);

	// Instant path: the gateway publishes type:"bm" on the user channel the
	// moment a thread gains news. Refetching the count (one tiny GET) beats
	// counting locally — the server is the only honest source.
	useUserEvents((event) => {
		if (event.type !== "bm") return;
		const token = getToken();
		void token.then((tk) =>
			tk
				? axios
						.get(`${API_URL}/api/bm/unread-count`, {
							headers: { Authorization: `Bearer ${tk}` },
						})
						.then((res) => {
							if (typeof res.data?.count === "number")
								setCount(res.data.count);
						})
						.catch(() => {})
				: undefined,
		);
	});

	return null;
}
