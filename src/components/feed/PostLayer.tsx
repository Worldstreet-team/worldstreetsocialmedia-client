"use client";

import { atom, getDefaultStore, useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import PostPageScreen from "@/app/(main)/post/[id]/PostPageScreen";
import { useAppPathname } from "@/i18n/useAppPathname";

/**
 * A post opens as a layer over the column, never as a new page (owner
 * 2026-09-29: "the flow from feed to comment is terrible ... when a user
 * taps back it glitches").
 *
 * It used to be a route change. The feed and the post are sibling routes,
 * so opening a post UNMOUNTED the feed and back rebuilt it from nothing:
 * every card re-measured from its 420px content-visibility guess while the
 * scroll restore aimed at the old offset, so back landed short and the
 * column jumped as the cards settled. And the open waited on the server
 * (the route's payload goes through proxy.ts) while the replies sat
 * unloaded behind it.
 *
 * Now a tap draws the post over the column from the card's own data and
 * the replies start loading at once; the page underneath is never touched.
 * Each open mints a history entry, WITHOUT changing the URL, so the phone's
 * back gesture and the browser's back button close the layer (the
 * Overlay backSentinel pattern). The URL stays put on purpose: a manual
 * pushState to /post/<id> is synced into Next's router through a queued
 * update, and any router work already in flight (a server action, say)
 * lands on top of it and writes the old URL back (reproduced 2026-09-29).
 * A /post/<id> link still opens the real route, which renders the same
 * view the same way.
 */

/** Posts open in the layer, oldest first; the last one is on screen. */
const postLayerStackAtom = atom<string[]>([]);

/** True inside MainShell, where the layer exists. */
export const PostLayerContext = createContext(false);

// One back listener for the whole page. The document can hold a second,
// hidden MainShell, and two listeners would pop two posts per back.
let popListening = false;
function listenForBack() {
	if (popListening) return;
	popListening = true;
	window.addEventListener("popstate", () => {
		const store = getDefaultStore();
		const stack = store.get(postLayerStackAtom);
		if (stack.length > 0) store.set(postLayerStackAtom, stack.slice(0, -1));
	});
}

/** Open a post: in the layer where there is one, as a navigation anywhere
 *  else. `toReplies` scrolls the layer to the replies. */
export function useOpenPost() {
	const hasLayer = useContext(PostLayerContext);
	const router = useRouter();
	return useCallback(
		(id: string, hash = "") => {
			if (!hasLayer) {
				router.push(`/post/${id}${hash}`);
				return;
			}
			const store = getDefaultStore();
			const stack = store.get(postLayerStackAtom);
			if (stack[stack.length - 1] === id) return;
			listenForBack();
			if (hash === "#comments") pendingReplies = id;
			// Carry Next's own markers (__NA and its tree) into the entry.
			// Next copies them itself when its pushState patch is in the
			// chain, but not when another wrapper sits in front of it; an
			// entry without __NA makes Next RELOAD the page when back lands
			// on it (a nested post's back did exactly that, 2026-09-29).
			window.history.pushState(
				{
					...(window.history.state ?? {}),
					__NA: true,
					wsPostLayer: stack.length + 1,
				},
				"",
			);
			store.set(postLayerStackAtom, [...stack, id]);
		},
		[hasLayer, router],
	);
}

/** The layer's own back arrow: the same as the system back. */
export function closePostLayer() {
	window.history.back();
}

// A post opened from its reply icon lands on the replies.
let pendingReplies: string | null = null;
export function takeRepliesJump(id: string): boolean {
	if (pendingReplies !== id) return false;
	pendingReplies = null;
	return true;
}

export function PostLayer() {
	const stack = useAtomValue(postLayerStackAtom);
	const id = stack[stack.length - 1] ?? null;
	const pathname = useAppPathname();
	// The column is this layer's sibling. Never getElementById: the document
	// can hold a second, hidden #ws-main-scroll (see mainScroller in utils).
	const anchorRef = useRef<HTMLSpanElement>(null);
	// Next can keep a second copy of the shell mounted inside a hidden
	// <div>; the layer there would fetch and subscribe for nothing.
	const [onScreen, setOnScreen] = useState(false);
	useLayoutEffect(() => {
		setOnScreen(!anchorRef.current?.parentElement?.closest("[hidden]"));
	}, []);

	// Esc closes the layer on a desktop, unless someone is typing.
	useEffect(() => {
		if (!id || !onScreen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape" || e.defaultPrevented) return;
			const t = e.target as HTMLElement | null;
			if (t?.closest("input,textarea,[contenteditable=true],[role=dialog]")) return;
			closePostLayer();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [id, onScreen]);

	// A real navigation (a profile, a hashtag) replaces the whole view: the
	// layer goes with the page it was over.
	const lastPath = useRef(pathname);
	useEffect(() => {
		if (lastPath.current === pathname) return;
		lastPath.current = pathname;
		getDefaultStore().set(postLayerStackAtom, []);
	}, [pathname]);

	// The column underneath stays mounted but must not be reachable: no
	// focus, no screen reader, no sound from a video left playing.
	useEffect(() => {
		const column =
			anchorRef.current?.parentElement?.querySelector<HTMLElement>(
				":scope > #ws-main-scroll",
			) ?? null;
		if (!column || !onScreen) return;
		if (!id) {
			column.removeAttribute("inert");
			return;
		}
		column.setAttribute("inert", "");
		for (const v of column.querySelectorAll("video")) v.pause();
	}, [id, onScreen]);

	return (
		<>
			<span ref={anchorRef} hidden />
			{id && onScreen && (
				<div className="absolute inset-0 z-sticky flex flex-col bg-page">
					<PostPageScreen key={id} postId={id} onBack={closePostLayer} />
				</div>
			)}
		</>
	);
}
