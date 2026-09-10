"use client";

import axios from "axios";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { useAuth } from "@clerk/nextjs";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import {
	DEFAULTS,
	PREFS_CACHE_KEY,
	type Preferences,
	applyPrefsToDocument,
	normalizePrefs,
} from "@/lib/preferences";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

type Patch = {
	[K in keyof Preferences]?: Partial<Preferences[K]>;
};

interface Ctx {
	prefs: Preferences;
	/** Optimistic: paints now, saves in the background, syncs everywhere. */
	setPrefs: (patch: Patch) => void;
	resetPrefs: () => Promise<void>;
	/** False until the account's copy has arrived (the cache paints first). */
	synced: boolean;
}

const PreferencesContext = createContext<Ctx>({
	prefs: DEFAULTS,
	setPrefs: () => {},
	resetPrefs: async () => {},
	synced: false,
});

export const usePreferences = () => useContext(PreferencesContext);

function readCache(): Preferences {
	try {
		return normalizePrefs(JSON.parse(localStorage.getItem(PREFS_CACHE_KEY) || "{}"));
	} catch {
		return DEFAULTS;
	}
}
function writeCache(p: Preferences) {
	try {
		localStorage.setItem(PREFS_CACHE_KEY, JSON.stringify(p));
	} catch {
		/* private window, quota — the account copy is still the truth */
	}
}

/**
 * Preferences, everywhere, on every device.
 *
 * Three copies and a clear precedence:
 *   localStorage  paints instantly, so there is no flash of the wrong size
 *   the profile   is the truth, and wins the moment it arrives
 *   this state    is what the app reads
 *
 * Writes are optimistic and coalesced: the paint moves on the keystroke,
 * the PATCH goes out ~400ms later, and the gateway merges rather than
 * replaces, so two devices editing different settings do not clobber each
 * other. `prefs:updated` on the person's own channel carries the patch to
 * their other tabs and devices.
 */
export function PreferencesProvider({ children }: { children: React.ReactNode }) {
	const { getToken, isSignedIn } = useAuth();
	const { client, isConnected } = useRealtime();
	const me = useAtomValue(userAtom);
	const [prefs, setState] = useState<Preferences>(DEFAULTS);
	const [synced, setSynced] = useState(false);
	const pending = useRef<Patch>({});
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Paint from the cache on mount. The pre-paint script in the root layout
	// has already stamped <html>; this brings React state in line with it.
	useEffect(() => {
		const cached = readCache();
		setState(cached);
		applyPrefsToDocument(cached);
	}, []);

	// The account's copy is the truth.
	useEffect(() => {
		if (!isSignedIn) return;
		let gone = false;
		(async () => {
			try {
				const token = await getToken();
				const r = await axios.get(`${API_URL}/api/users/me/preferences`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				if (gone) return;
				const next = normalizePrefs(r.data?.preferences);
				setState(next);
				writeCache(next);
				applyPrefsToDocument(next);
			} catch {
				/* keep the cached copy */
			} finally {
				if (!gone) setSynced(true);
			}
		})();
		return () => {
			gone = true;
		};
	}, [isSignedIn, getToken]);

	const flush = useCallback(async () => {
		const patch = pending.current;
		pending.current = {};
		if (!Object.keys(patch).length || !isSignedIn) return;
		try {
			const token = await getToken();
			await axios.patch(
				`${API_URL}/api/users/me/preferences`,
				{ preferences: patch },
				{ headers: { Authorization: `Bearer ${token}` } },
			);
		} catch {
			/* the cache still holds it; the next change retries the lot */
		}
	}, [getToken, isSignedIn]);

	const setPrefs = useCallback(
		(patch: Patch) => {
			setState((prev) => {
				const next = normalizePrefs({
					...prev,
					...Object.fromEntries(
						Object.entries(patch).map(([ns, bag]) => [
							ns,
							{ ...(prev as any)[ns], ...(bag as object) },
						]),
					),
				});
				writeCache(next);
				applyPrefsToDocument(next);
				return next;
			});
			for (const [ns, bag] of Object.entries(patch)) {
				(pending.current as any)[ns] = {
					...((pending.current as any)[ns] ?? {}),
					...(bag as object),
				};
			}
			if (timer.current) clearTimeout(timer.current);
			timer.current = setTimeout(() => void flush(), 400);
		},
		[flush],
	);

	// A tab closing mid-debounce must not lose the change.
	useEffect(() => {
		const onHide = () => {
			if (document.visibilityState === "hidden") void flush();
		};
		document.addEventListener("visibilitychange", onHide);
		return () => {
			document.removeEventListener("visibilitychange", onHide);
			void flush();
		};
	}, [flush]);

	const resetPrefs = useCallback(async () => {
		setState(DEFAULTS);
		writeCache(DEFAULTS);
		applyPrefsToDocument(DEFAULTS);
		if (!isSignedIn) return;
		try {
			const token = await getToken();
			await axios.delete(`${API_URL}/api/users/me/preferences`, {
				headers: { Authorization: `Bearer ${token}` },
			});
		} catch {
			/* next load reconciles */
		}
	}, [getToken, isSignedIn]);

	// Another device changed something.
	useEffect(() => {
		if (!client || !isConnected || !me?._id) return;
		const channel = client.channels.get(`user:${me._id}`);
		const onEvent = (msg: any) => {
			const t = msg?.data?.type;
			if (t !== "prefs:updated" && t !== "prefs:reset") return;
			setState((prev) => {
				const next =
					t === "prefs:reset"
						? DEFAULTS
						: normalizePrefs({
								...prev,
								...Object.fromEntries(
									Object.entries(msg.data.patch ?? {}).map(([ns, bag]) => [
										ns,
										{ ...(prev as any)[ns], ...(bag as object) },
									]),
								),
							});
				writeCache(next);
				applyPrefsToDocument(next);
				return next;
			});
		};
		channel.subscribe("event", onEvent);
		return () => channel.unsubscribe("event", onEvent);
	}, [client, isConnected, me?._id]);

	// `auto` follows the device, so the device changing its mind counts.
	useEffect(() => {
		const queries = [
			"(prefers-contrast: more)",
			"(prefers-reduced-motion: reduce)",
		].map((q) => window.matchMedia(q));
		const sync = () => applyPrefsToDocument(prefs);
		for (const q of queries) q.addEventListener("change", sync);
		return () => {
			for (const q of queries) q.removeEventListener("change", sync);
		};
	}, [prefs]);

	return (
		<PreferencesContext.Provider value={{ prefs, setPrefs, resetPrefs, synced }}>
			{children}
		</PreferencesContext.Provider>
	);
}
