"use client";

import { useAuth } from "@clerk/nextjs";
import axios from "axios";
import { useSetAtom } from "jotai";
import { useEffect } from "react";
import { BACKEND_URL } from "@/const";
import { unreadBmCountAtom } from "@/store/ui.atom";

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
		const t = setInterval(() => void load(), 60_000);
		const onFocus = () => void load();
		window.addEventListener("focus", onFocus);
		return () => {
			cancelled = true;
			clearInterval(t);
			window.removeEventListener("focus", onFocus);
		};
	}, [getToken, setCount]);

	return null;
}
