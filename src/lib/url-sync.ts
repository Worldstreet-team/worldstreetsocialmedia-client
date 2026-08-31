/**
 * THE way to rewrite the address bar without a router navigation.
 *
 * Three pages keep their UI state in the URL (explore's search box, the
 * live page's active slide, the Business deal room) and must not re-render
 * the route to do it. Raw `history.replaceState` is how each of them, at
 * different times, produced the same bug pair:
 *
 * 1. Fired after the person had ALREADY navigated on (async work resolving
 *    late), rewriting the new page's history entry back to the old URL —
 *    "enter a page, enter another, it takes you back".
 * 2. Passed `null` state, stripping the App Router's tree from the entry,
 *    so the next back/forward restored the wrong page.
 *
 * This helper makes both impossible: it refuses to write unless the page
 * that asked is still the page on screen, and it always carries the
 * router's state through. Do not call history.replaceState directly —
 * grep for it in review; this file should be the only hit.
 *
 * @param expectedPathname the pathname this surface lives at, WITH any
 *   locale prefix — pass `window.location.pathname` captured at call time
 *   if the surface can be mounted under multiple paths.
 */
export function syncUrlIfStillOn(expectedPathname: string, url: string): boolean {
	if (typeof window === "undefined") return false;
	if (window.location.pathname !== expectedPathname) return false;
	window.history.replaceState(window.history.state, "", url);
	return true;
}
