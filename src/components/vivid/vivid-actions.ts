"use client";

import { getDefaultStore } from "jotai";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback } from "react";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { CATEGORIES } from "@/data/categories";
import { PALETTE_IDS, type PaletteId } from "@/data/palettes";
import { getCategory, getCategoryLabel, normalizeCategoryIds, suggestCategories } from "@/lib/categories";
import { startConversationAction } from "@/lib/conversation.actions";
import type { TextScale } from "@/lib/preferences";
import { withThemeTransition } from "@/lib/theme-transition";
import type { VividIntent } from "@/lib/vivid.client";
import { pendingDraftAtom } from "@/store/drafts.atom";
import {
	composeOpenAtom,
	goLiveOpenAtom,
	premiumOpenAtom,
	searchOpenAtom,
	searchSeedAtom,
	vividDmDraftAtom,
	vividGoLiveDraftAtom,
	vividSpaceDraftAtom,
} from "@/store/ui.atom";

/**
 * Quick actions (plan: "Quick actions: Vivid opens the app for you"). The
 * gateway's open tools hand the window an intent; this runs it in the app,
 * at once and with no confirm, because all it does is open a screen filled
 * in: nothing happens until the person presses that screen's own button.
 *
 * Sheets that live in the root layout (Go Live, the composer, Verified,
 * search) open over the Vivid window, so the answer keeps streaming under
 * them. Screens that are routes (a chat, Space setup, a page) take the
 * person there. Appearance changes apply at once and hand back an undo.
 *
 * Money only ever opens. Nothing here sends, posts, pays or starts a live.
 */

/** Routes an open_page intent may go to: the app's own pages, nothing else. */
const SAFE_ROUTE = /^\/(?:$|explore|notifications|messages|bookmarks|voice|votes|communities|studio|live|vivid|settings(?:\/[a-z-]+)?(?:#group-[a-z-]+)?|profile\/[A-Za-z0-9_.]{1,40})(?:[?#].*)?$/;

const TEXT_SCALES: TextScale[] = ["auto", 90, 100, 110, 115, 125, 150, 175];

const plainWords = (s: string) =>
	s
		.toLowerCase()
		.replace(/\(.*?\)/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

/**
 * The Go Live category for what the model named: an id, a legacy key, a
 * label in any case ("Football" for "Football (Soccer)"), one of a
 * category's own keywords, or, failing all of those, what the title reads as.
 * Unknown stays unset, so the sheet keeps its own default.
 */
function liveCategory(raw: string | undefined, title: string | undefined) {
	if (raw) {
		const [id] = normalizeCategoryIds([raw]);
		if (id && getCategory(id)) return getCategoryLabel(id);
		const want = plainWords(raw);
		const byLabel = CATEGORIES.find((c) => plainWords(c.label) === want);
		if (byLabel) return byLabel.label;
		const byKeyword = CATEGORIES.find((c) => c.keywords?.some((k) => k.toLowerCase() === want));
		if (byKeyword) return byKeyword.label;
	}
	const guess = suggestCategories([raw, title].filter(Boolean).join(" "), { limit: 1 })[0];
	return guess?.label;
}

export type IntentKind = "overlay" | "route" | "instant";

/** Overlays open while the answer streams; routes wait for it to finish. */
export function intentKind(intent: VividIntent): IntentKind {
	switch (intent.type) {
		case "go_live":
		case "compose":
		case "premium":
		case "search":
		case "linked":
			return "overlay";
		case "appearance":
			return "instant";
		default:
			return "route";
	}
}

/** Run an intent. Resolves with an undo for the ones that can be taken back. */
export function useVividIntent() {
	const router = useRouter();
	const { setTheme, resolvedTheme } = useTheme();
	const { prefs, setPrefs } = usePreferences();

	return useCallback(
		async (intent: VividIntent): Promise<(() => void) | undefined> => {
			const store = getDefaultStore();
			switch (intent.type) {
				case "go_live": {
					store.set(vividGoLiveDraftAtom, {
						title: intent.title?.slice(0, 100),
						category: liveCategory(intent.category, intent.title),
					});
					store.set(goLiveOpenAtom, true);
					return;
				}
				case "compose": {
					if (intent.text) store.set(pendingDraftAtom, intent.text);
					store.set(composeOpenAtom, true);
					return;
				}
				case "premium": {
					store.set(premiumOpenAtom, true);
					return;
				}
				case "search": {
					store.set(searchSeedAtom, intent.query);
					store.set(searchOpenAtom, true);
					return;
				}
				case "linked": {
					if (/^https:\/\/([a-z0-9-]+\.)*(worldstreetgold\.com|tsionark\.com)(\/|$)/.test(intent.url)) {
						window.open(intent.url, "_blank", "noopener,noreferrer");
					}
					return;
				}
				case "space": {
					store.set(vividSpaceDraftAtom, intent.title ? { title: intent.title.slice(0, 100) } : null);
					router.push("/voice?create=1");
					return;
				}
				case "chat": {
					const r = await startConversationAction(intent.profileId);
					const id = r?.success ? String(r.data?._id ?? r._id ?? "") : "";
					if (!id) {
						// A chat they can't start (privacy, a block): their profile is the next best door.
						router.push(`/profile/${encodeURIComponent(intent.username)}`);
						return;
					}
					if (intent.draft) store.set(vividDmDraftAtom, { conversationId: id, text: intent.draft });
					router.push(`/messages/${id}`);
					return;
				}
				case "navigate": {
					if (SAFE_ROUTE.test(intent.to)) router.push(intent.to);
					return;
				}
				case "appearance": {
					const undo: (() => void)[] = [];
					if (intent.theme && intent.theme !== resolvedTheme) {
						const was = resolvedTheme === "light" ? "light" : "dark";
						const next = intent.theme;
						withThemeTransition(() => setTheme(next));
						undo.push(() => withThemeTransition(() => setTheme(was)));
					}
					if (intent.palette && (PALETTE_IDS as readonly string[]).includes(intent.palette) && intent.palette !== "custom") {
						const was = prefs.appearance.palette;
						const next = intent.palette as PaletteId;
						withThemeTransition(() => setPrefs({ appearance: { palette: next } }));
						undo.push(() => withThemeTransition(() => setPrefs({ appearance: { palette: was } })));
					}
					if (intent.textScale !== undefined && TEXT_SCALES.includes(intent.textScale as TextScale)) {
						const was = prefs.a11y.textScale;
						setPrefs({ a11y: { textScale: intent.textScale as TextScale } });
						undo.push(() => setPrefs({ a11y: { textScale: was } }));
					}
					if (intent.dataSaver) {
						const was = prefs.data.saver;
						setPrefs({ data: { saver: intent.dataSaver } });
						undo.push(() => setPrefs({ data: { saver: was } }));
					}
					return undo.length ? () => undo.reverse().forEach((u) => u()) : undefined;
				}
			}
		},
		[router, setTheme, resolvedTheme, prefs, setPrefs],
	);
}
