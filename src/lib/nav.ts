"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

/**
 * Back, but honest about deep links.
 *
 * Half the app's back arrows called bare `router.back()`, which on a fresh
 * tab (shared post/profile URLs) is a silent no-op; the other half pushed a
 * hardcoded "/" — which is how "click the X in The Space and land on home"
 * happened, plus a ghost history entry.
 *
 * Module state, deliberately not sessionStorage: a full document load wipes
 * it, which is exactly when going back is unsafe. `history.length` lies (it
 * counts entries from other sites), and Next's history-state markers
 * describe the current entry, not the previous one.
 */
let hasInAppHistory = false;

/** Mounted once in the root layout. Flips after the first client-side
 *  navigation, i.e. the moment a real in-app entry exists below us. */
export function NavHistoryTracker() {
	const pathname = usePathname();
	const first = useRef(true);
	useEffect(() => {
		if (first.current) {
			first.current = false;
			return;
		}
		hasInAppHistory = true;
	}, [pathname]);
	return null;
}

/** Back when this session created the entry below; otherwise REPLACE with
 *  the surface's natural parent, so the fallback does not stack on top of
 *  the current page and make the next back bounce. */
export function useBackWithFallback() {
	const router = useRouter();
	return useCallback(
		(fallback: string) => {
			if (hasInAppHistory) router.back();
			else router.replace(fallback);
		},
		[router],
	);
}
