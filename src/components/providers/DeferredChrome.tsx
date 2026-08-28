"use client";

import dynamic from "next/dynamic";

/**
 * App chrome that ships as its own chunks, after hydration.
 *
 * These three are mounted on every page and open on almost none of them: the
 * palette behind Ctrl+K, the search window, the first-run tour. Statically
 * imported from the root layout they were part of the critical bundle on
 * every load — code the browser had to download, parse and hydrate before
 * anything was interactive, for overlays that are closed 99% of the time.
 *
 * `ssr: false` is correct here, not a shortcut: all three render `null` until
 * their open-atom flips (the tour also reads localStorage), so there is no
 * server HTML to lose — only bytes to move off the critical path. Their
 * chunks start downloading right after mount, so the palette answers Ctrl+K
 * within moments of the page becoming interactive.
 *
 * If one of these ever needs to paint in the first frame, move it back to a
 * static import in the layout — do not reach for `loading:` spinners here.
 */
const CommandPalette = dynamic(
	() =>
		import("@/components/ui/CommandPalette").then((m) => m.CommandPalette),
	{ ssr: false },
);
const SearchWindow = dynamic(
	() => import("@/components/search/SearchWindow").then((m) => m.SearchWindow),
	{ ssr: false },
);
const WelcomeTour = dynamic(
	() => import("@/components/ui/WelcomeTour").then((m) => m.WelcomeTour),
	{ ssr: false },
);

export function DeferredChrome() {
	return (
		<>
			<CommandPalette />
			<SearchWindow />
			<WelcomeTour />
		</>
	);
}
