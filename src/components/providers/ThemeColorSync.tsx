"use client";

import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { browserChromeAtom } from "@/store/ui.atom";

/**
 * Keeps `<meta name="theme-color">` honest (owner 2026-09-25: the theme
 * should reach "other browsers that support customisation").
 *
 * The layout renders one static value, black. Safari on iOS tints the tab
 * bar and status bar with it, Chrome and Samsung Internet on Android paint
 * the address bar, and an installed app (Chrome, Edge, Safari) paints its
 * title bar; none of them re-read the page colour when the mode or the
 * palette moves. So this watches the two attributes that move it and
 * writes the resolved page colour back, and lets an open chat on a phone
 * override it with its own bar colour through `browserChromeAtom`.
 */
export function ThemeColorSync() {
	const override = useAtomValue(browserChromeAtom);
	useEffect(() => {
		const root = document.documentElement;
		let desired = "";
		const assert = () => {
			if (!desired) return;
			const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
			if (!metas.length) {
				const meta = document.createElement("meta");
				meta.name = "theme-color";
				meta.content = desired;
				document.head.appendChild(meta);
				return;
			}
			// Every one of them: the browser reads the first, and the layout's
			// own tag is re-rendered by the router on each navigation.
			for (const meta of metas) if (meta.content !== desired) meta.content = desired;
		};
		const write = () => {
			const value = override ?? getComputedStyle(root).getPropertyValue("--ws-bg-page").trim();
			const color = resolveCssColor(value);
			if (!color) return;
			desired = color;
			assert();
		};
		write();
		// The mode and the palette move the page colour with no event.
		const attrs = new MutationObserver(write);
		attrs.observe(root, { attributes: true, attributeFilter: ["data-ws-theme", "data-ws-palette", "style"] });
		// The router re-renders the layout's static tag (black) after the
		// first paint and on every navigation; put the real colour back.
		const head = new MutationObserver(assert);
		head.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["content"] });
		return () => {
			attrs.disconnect();
			head.disconnect();
		};
	}, [override]);
	return null;
}

/**
 * Any CSS colour (a hex, a `var()`, a `color-mix()`) as the `rgb()` the
 * browser paints it, resolved by painting it: the meta tag's parser does
 * not take a variable, and an alpha would be ignored on the status bar.
 */
export function resolveCssColor(value: string): string | null {
	if (!value) return null;
	const probe = document.createElement("span");
	probe.style.color = value;
	probe.style.position = "absolute";
	probe.style.visibility = "hidden";
	document.body.appendChild(probe);
	const out = getComputedStyle(probe).color;
	probe.remove();
	if (!out || out === "rgba(0, 0, 0, 0)") return null;
	// Flatten an alpha over black: a translucent bar over the page is the
	// closest the status bar can get to what sits under it.
	const m = out.match(/rgba?\(([^)]+)\)/);
	if (!m) return out;
	const [r, g, b, a = "1"] = m[1].split(/[\s,/]+/).filter(Boolean);
	const alpha = Number.parseFloat(a);
	if (!Number.isFinite(alpha) || alpha >= 1) return `rgb(${r}, ${g}, ${b})`;
	const f = (v: string) => Math.round(Number.parseFloat(v) * alpha);
	return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}
