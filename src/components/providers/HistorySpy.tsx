"use client";

import { useEffect } from "react";

/**
 * DEV ONLY — the route-hijack detective.
 *
 * Production users report landing back on the previous page after
 * navigating. Whoever does that must go through pushState / replaceState /
 * a popstate — so wrap all three and log every call WITH ITS STACK. When
 * the bounce reproduces, the console names the culprit; no more guessing.
 *
 * Renders nothing, ships nothing: the layout only mounts it in
 * development.
 */
export function HistorySpy() {
	useEffect(() => {
		if (process.env.NODE_ENV === "production") return;
		const w = window as any;
		if (w.__wsHistorySpy) return;
		w.__wsHistorySpy = true;

		const log = (kind: string, url: unknown, state: unknown) => {
			// eslint-disable-next-line no-console
			console.warn(
				`[HistorySpy] ${kind} -> ${String(url)} @ ${location.pathname}${location.search} | state=${state === null ? "NULL!" : typeof state}`,
				new Error("stack").stack
					?.split("\n")
					.slice(2, 8)
					.join("\n"),
			);
		};

		const origPush = history.pushState.bind(history);
		const origReplace = history.replaceState.bind(history);
		history.pushState = function (state, unused, url) {
			log("pushState", url, state);
			return origPush(state, unused, url as any);
		};
		history.replaceState = function (state, unused, url) {
			log("replaceState", url, state);
			return origReplace(state, unused, url as any);
		};
		const onPop = (e: PopStateEvent) =>
			log("popstate", location.href, e.state);
		window.addEventListener("popstate", onPop);
		return () => {
			history.pushState = origPush;
			history.replaceState = origReplace;
			window.removeEventListener("popstate", onPop);
			w.__wsHistorySpy = false;
		};
	}, []);
	return null;
}
