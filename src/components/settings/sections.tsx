import {
	BadgeCheck,
	Bell,
	Eye,
	Gauge,
	Lock,
	SlidersHorizontal,
	UserCircle,
} from "lucide-react";

/**
 * The settings map, read by both faces of the surface: the desktop section
 * list and the mobile hub. One registry so a new section shows up in both
 * places and in search at once, and so the URL segment, the nav and the
 * detail can never drift out of step.
 */
export type SectionId =
	| "account"
	| "premium"
	| "topics"
	| "notifications"
	| "safety"
	| "display"
	| "data";

export interface SectionDef {
	id: SectionId;
	/** i18n key for the label, so translations still apply. */
	labelKey: string;
	/** One line under the label in the mobile hub. */
	hint: string;
	icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

export const SECTIONS: SectionDef[] = [
	{
		id: "account",
		labelKey: "settings.tab.account",
		hint: "Username, email and account controls",
		icon: UserCircle,
	},
	{
		id: "premium",
		labelKey: "settings.tab.premium",
		hint: "Your subscription and verification",
		icon: BadgeCheck,
	},
	{
		id: "topics",
		labelKey: "settings.tab.topics",
		hint: "What you want more and less of",
		icon: SlidersHorizontal,
	},
	{
		id: "notifications",
		labelKey: "settings.tab.notifications",
		hint: "What reaches you, and how",
		icon: Bell,
	},
	{
		id: "safety",
		labelKey: "settings.tab.safety",
		hint: "Who can see you, and blocked accounts",
		icon: Lock,
	},
	{
		id: "display",
		labelKey: "settings.tab.display",
		hint: "Theme, text size, motion and language",
		icon: Eye,
	},
	{
		id: "data",
		labelKey: "settings.tab.data",
		hint: "Data saver, timeline and messaging",
		icon: Gauge,
	},
];

export const SECTION_IDS = SECTIONS.map((s) => s.id) as SectionId[];

/**
 * The groups inside each section, in the order they render. This is what
 * the sub-nav is built from (owner 2026-09-15: "sub navs, tap to scroll"),
 * so the nav never has to render the detail to know what is in it. A
 * section renders `<Section id>` for each of its groups; the id here and
 * there must match, and the observer in the page lights the one in view.
 */
export interface GroupDef {
	id: string;
	label: string;
}
export const GROUPS: Record<SectionId, GroupDef[]> = {
	account: [
		{ id: "account", label: "Account" },
		{ id: "danger", label: "Danger zone" },
	],
	premium: [{ id: "plan", label: "Your plan" }],
	topics: [{ id: "interests", label: "Interests" }],
	notifications: [
		{ id: "alerts", label: "What reaches you" },
		{ id: "behaviour", label: "Behaviour" },
	],
	safety: [
		{ id: "privacy", label: "Privacy" },
		{ id: "blocked", label: "Blocked accounts" },
	],
	display: [
		{ id: "accessibility", label: "Accessibility" },
		{ id: "appearance", label: "Appearance" },
	],
	data: [
		{ id: "usage", label: "Data usage" },
		{ id: "timeline", label: "Timeline" },
		{ id: "messaging", label: "Messaging" },
	],
};

export function isSectionId(v: unknown): v is SectionId {
	return typeof v === "string" && (SECTION_IDS as string[]).includes(v);
}

/**
 * The searchable index: individual settings, not just section names, so a
 * reader typing "dark", "block" or "text size" lands on the right section
 * instead of having to know which drawer it lives behind.
 */
export interface SearchItem {
	label: string;
	terms: string;
	section: SectionId;
}

export const SEARCH_INDEX: SearchItem[] = [
	{ label: "Username", terms: "username handle name", section: "account" },
	{ label: "Email address", terms: "email mail", section: "account" },
	{ label: "Deactivate account", terms: "deactivate disable pause", section: "account" },
	{ label: "Delete account", terms: "delete remove close", section: "account" },
	{ label: "Verification", terms: "verified tick gold badge", section: "premium" },
	{ label: "Subscription", terms: "premium subscribe billing plan", section: "premium" },
	{ label: "Interests", terms: "topics interests feed for you", section: "topics" },
	{ label: "Notifications", terms: "notifications push alerts mentions likes", section: "notifications" },
	{ label: "Privacy", terms: "privacy who can see allies private", section: "safety" },
	{ label: "Blocked accounts", terms: "blocked block mute", section: "safety" },
	{ label: "Theme", terms: "theme dark light appearance", section: "display" },
	{ label: "Text size", terms: "text size font bigger accessibility", section: "display" },
	{ label: "Motion", terms: "motion animation reduced accessibility", section: "display" },
	{ label: "Colour vision", terms: "colour color vision contrast accessibility", section: "display" },
	{ label: "Language", terms: "language locale english", section: "display" },
	{ label: "Install app", terms: "install app pwa home screen", section: "display" },
	{ label: "Data saver", terms: "data saver autoplay video downloads", section: "data" },
	{ label: "Timeline", terms: "timeline reposts long posts scroll", section: "data" },
	{ label: "Messaging", terms: "messaging chat read receipts typing", section: "data" },
];

export function searchSettings(query: string): SearchItem[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	const words = q.split(/\s+/);
	return SEARCH_INDEX.filter((item) => {
		const hay = `${item.label} ${item.terms}`.toLowerCase();
		return words.every((w) => hay.includes(w));
	}).slice(0, 8);
}
