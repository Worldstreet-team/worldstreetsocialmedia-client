/**
 * The navigation in flight (owner 2026-10-16: "if i click on something and
 * it delays it returns back to the former page ... if someone click on
 * something let it go").
 *
 * instrumentation-client.ts marks every client navigation as it starts: a
 * link, a router.push, back and forward. Code that would reload the page or
 * step back through history asks here first, because either one, while the
 * next page is still loading, cancels the navigation the person started and
 * lands them on the page they were leaving. On a slow connection a page can
 * take seconds to arrive, which is exactly when that used to happen.
 *
 * Kept on `window`, not in this module: instrumentation-client is bundled as
 * its own entry, and the two copies of a module would not share state.
 */

type Pending = { href: string; at: number };
type WithPending = typeof window & { __wsPendingNav?: Pending | null };

const host = () => (typeof window === "undefined" ? null : (window as WithPending));
const bare = (href: string) => href.split("#")[0];

/** Called by instrumentation-client's onRouterTransitionStart. */
export function markNavigation(url: string) {
	const w = host();
	if (!w) return;
	try {
		w.__wsPendingNav = { href: new URL(url, w.location.href).href, at: Date.now() };
	} catch {
		w.__wsPendingNav = null;
	}
}

/**
 * Where a navigation the person started is going, while it is still on its
 * way; null once the address has arrived there, or after `maxAgeMs`.
 */
export function navigationInFlight(maxAgeMs = 20_000): string | null {
	const w = host();
	const p = w?.__wsPendingNav;
	if (!w || !p) return null;
	if (Date.now() - p.at > maxAgeMs || bare(p.href) === bare(w.location.href)) {
		w.__wsPendingNav = null;
		return null;
	}
	return p.href;
}
