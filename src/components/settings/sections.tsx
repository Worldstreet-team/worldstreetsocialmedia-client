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

/**
 * Ordered by how often a section is the REASON someone opened settings
 * (owner 2026-09-20): stop the pings, then who can reach me, then how it
 * reads, then what it costs in data, then what I see. Identity and billing
 * are last: rare, and the destructive things live behind them.
 */
export const SECTIONS: SectionDef[] = [
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
	{
		id: "topics",
		labelKey: "settings.tab.topics",
		hint: "What you want more and less of",
		icon: SlidersHorizontal,
	},
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
 * The master search index (owner 2026-09-20: "master search"): EVERY
 * setting, by the name on its row, with the group it lives in, so a result
 * opens the right section, scrolls to the right block and lights it. A
 * reader typing "dark", "block" or "read receipts" never has to know which
 * drawer a thing lives behind. A new row gets a line here.
 */
export interface SearchItem {
	label: string;
	terms: string;
	section: SectionId;
	/** A GROUPS id inside that section. */
	group: string;
}

const I = (label: string, terms: string, section: SectionId, group: string): SearchItem => ({
	label,
	terms,
	section,
	group,
});

export const SEARCH_INDEX: SearchItem[] = [
	I("Username", "username handle name at", "account", "account"),
	I("Email address", "email mail", "account", "account"),
	I("Download your data", "download export data archive copy", "account", "danger"),
	I("Deactivate account", "deactivate disable pause hide", "account", "danger"),
	I("Delete account", "delete remove close erase", "account", "danger"),
	I("Verification", "verified tick gold badge", "premium", "plan"),
	I("Subscription and billing", "premium subscribe billing plan renew cancel", "premium", "plan"),
	I("Interests", "topics interests feed for you categories", "topics", "interests"),
	I("Likes, replies and mentions", "notifications push alerts mentions likes replies reposts follows", "notifications", "alerts"),
	I("Only from people I follow", "notifications following only filter", "notifications", "alerts"),
	I("Pop-ups for new messages", "popups pop-ups toast new message behaviour", "notifications", "behaviour"),
	I("Open notifications on", "notifications default tab open on behaviour", "notifications", "behaviour"),
	I("Who can start a chat with you", "who can message me privacy dm messages everyone allies requests", "safety", "privacy"),
	I("Send read receipts", "read receipts seen privacy", "safety", "privacy"),
	I("Show when I'm online", "status online presence last seen active privacy", "safety", "privacy"),
	I("Show when I'm typing", "typing indicator privacy", "safety", "privacy"),
	I("Show my likes on my profile", "likes profile privacy hide", "safety", "privacy"),
	I("Blocked accounts", "blocked block unblock", "safety", "blocked"),
	I("Text size", "text size font bigger larger smaller", "display", "accessibility"),
	I("Message text size", "chat message text size font", "display", "accessibility"),
	I("Colour vision", "colour color vision blind deuteran protan tritan", "display", "accessibility"),
	I("Contrast", "contrast high", "display", "accessibility"),
	I("Motion", "motion animation reduce reduced", "display", "accessibility"),
	I("Show symbols, not just colour", "symbols cues colour color", "display", "accessibility"),
	I("Bold text", "bold text heavier", "display", "accessibility"),
	I("Underline links", "underline links", "display", "accessibility"),
	I("Reduce transparency", "transparency frosted glass solid blur", "display", "accessibility"),
	I("Theme", "theme dark light mode appearance", "display", "appearance"),
	I("Colour", "colour color palette accent brand tide cobalt iris orchid sunset heritage mono", "display", "appearance"),
	I("Language", "language locale english spanish french portuguese german", "display", "appearance"),
	I("Install the app", "install app pwa home screen", "display", "appearance"),
	I("Data saver", "data saver mobile data", "data", "usage"),
	I("Autoplay videos", "autoplay video play", "data", "usage"),
	I("Photo upload quality", "upload quality photo compress", "data", "usage"),
	I("Load posts before you reach them", "preload posts prefetch", "data", "usage"),
	I("Show long posts in full", "long posts see more expand", "data", "timeline"),
	I("Reposts in my timeline", "reposts reshares timeline", "data", "timeline"),
	I("Keep loading as I scroll", "infinite scroll load more", "data", "timeline"),
	I("What the Enter key does", "enter send newline keyboard", "data", "messaging"),
	I("Voice note speed", "voice note speed playback", "data", "messaging"),
	I("Play voice notes back to back", "voice autoplay next", "data", "messaging"),
	I("Open a chat where you left off", "first unread open chat", "data", "messaging"),
	I("Stories above your chats", "stories inbox bar", "data", "messaging"),
];

/** Label matches rank above keyword matches; a prefix above a mid-word hit. */
export function searchSettings(query: string): SearchItem[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	const words = q.split(/\s+/);
	return SEARCH_INDEX.map((item) => {
		const label = item.label.toLowerCase();
		const hay = `${label} ${item.terms}`;
		if (!words.every((w) => hay.includes(w))) return null;
		const score = label.startsWith(q) ? 0 : label.includes(q) ? 1 : 2;
		return { item, score };
	})
		.filter((x): x is { item: SearchItem; score: number } => x !== null)
		.sort((a, b) => a.score - b.score)
		.slice(0, 10)
		.map((x) => x.item);
}
