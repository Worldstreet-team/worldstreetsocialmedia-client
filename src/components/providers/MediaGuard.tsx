"use client";

import { useEffect } from "react";

/**
 * Closes the easy routes to saving someone else's media.
 *
 * Three of them, and they are all browser affordances rather than anything
 * the app offers: the right-click menu's "Save image as", dragging a picture
 * out of the page onto the desktop, and the iOS long-press sheet (that last
 * one is CSS — `-webkit-touch-callout` in globals.css).
 *
 * `VideoPlayer` has blocked its own context menu since it was written, with a
 * comment saying the browser menu "would route around anything the product
 * decides about downloads". It was right, and it was the only component doing
 * it — so every avatar, post image, story frame and DM attachment was still
 * one right-click from disk. Doing it once at the document means the next
 * component that renders an image is covered without having to remember.
 *
 * Be clear about what this is: friction, not protection. The bytes are in the
 * page. Devtools, the network panel, a direct URL and a screenshot all still
 * work, and nothing running in a browser can change that. It stops casual
 * saving, which is what it is for.
 */
export function MediaGuard() {
	useEffect(() => {
		const isMedia = (target: EventTarget | null) => {
			if (!(target instanceof Element)) return false;
			const tag = target.tagName;
			// `data-media` lets a background-image carrier opt in — a div with
			// a `background-image` has no "save image" menu entry of its own,
			// but it can still be dragged in some browsers.
			return tag === "IMG" || tag === "VIDEO" || !!target.closest("[data-media]");
		};

		const block = (e: Event) => {
			if (isMedia(e.target)) e.preventDefault();
		};

		// Capture phase: a component that stops propagation on its own media
		// (the cropper, the story viewer) must not open a hole here.
		document.addEventListener("contextmenu", block, true);
		document.addEventListener("dragstart", block, true);
		return () => {
			document.removeEventListener("contextmenu", block, true);
			document.removeEventListener("dragstart", block, true);
		};
	}, []);

	return null;
}
