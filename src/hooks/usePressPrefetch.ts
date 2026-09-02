"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

/**
 * Prefetch a route at finger-down instead of after the click resolves.
 *
 * On touch there is no hover, so the ~80-120ms between pointerdown and the
 * click event is the only free head start a tap offers — long enough to get
 * the RSC request on the wire before navigation is even requested. Paired
 * with `staleTimes.dynamic`, the prefetched render is then reused instead of
 * re-rendered.
 *
 * Spread the result onto a nav <Link>: `{...press(href)}`. Deduped per href
 * per mount; `router.prefetch` itself is safe to call repeatedly.
 */
export function usePressPrefetch() {
	const router = useRouter();
	const warmed = useRef<Set<string>>(new Set());

	return useCallback(
		(href: string) => ({
			onPointerDown: () => {
				if (warmed.current.has(href)) return;
				warmed.current.add(href);
				router.prefetch(href);
			},
		}),
		[router],
	);
}
