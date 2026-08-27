"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
	DEFAULT_TTL,
	type CacheEntry,
	fetchCached,
	invalidate,
	isFresh,
	readCache,
	subscribe,
} from "@/lib/cache";

interface Options {
	/** How long a copy counts as fresh. Past this it is still shown, but revalidated. */
	ttl?: number;
	/** Skip the request entirely (a key that is not resolvable yet). */
	enabled?: boolean;
}

/**
 * Read a cached resource, revalidating only when it has actually gone stale.
 *
 * `loading` is true only when there is nothing to show — a stale-but-present
 * copy renders immediately while the refresh happens underneath, so navigating
 * back to a profile does not blank the screen. See `@/lib/cache` for the
 * freshness contract.
 */
export function useCachedResource<T>(
	key: string | null,
	fetcher: () => Promise<T>,
	{ ttl = DEFAULT_TTL, enabled = true }: Options = {},
) {
	const active = Boolean(key) && enabled;

	const entry = useSyncExternalStore<CacheEntry<T> | undefined>(
		useCallback(
			(onChange) => (key ? subscribe(key, onChange) : () => {}),
			[key],
		),
		useCallback(() => (key ? readCache<T>(key) : undefined), [key]),
		() => undefined,
	);

	const [loading, setLoading] = useState(active && !entry);
	const [error, setError] = useState<unknown>(null);

	const run = useCallback(
		async (force: boolean) => {
			if (!key || !active) return;
			if (force) invalidate(key);
			// Nothing cached means the caller has nothing to render meanwhile.
			setLoading(!readCache<T>(key));
			setError(null);
			try {
				await fetchCached<T>(key, fetcher, force ? 0 : ttl);
			} catch (err) {
				setError(err);
			} finally {
				setLoading(false);
			}
		},
		// `fetcher` is intentionally excluded: callers define it inline, so
		// depending on it would re-run this on every render. The key is the
		// identity of the request.
		[key, active, ttl],
	);

	useEffect(() => {
		if (!key || !active) return;
		// The whole point: a fresh copy is not re-requested.
		if (isFresh(readCache<T>(key), ttl)) {
			setLoading(false);
			return;
		}
		void run(false);
	}, [key, active, ttl, run]);

	return {
		data: entry?.data,
		loading,
		error,
		/** Force a round trip — for pull-to-refresh and post-mutation reloads. */
		refresh: useCallback(() => run(true), [run]),
	};
}
