import {
	BadgeCheck,
	Ban,
	Bell,
	Eye,
	Gauge,
	MessageCircle,
	Palette,
	Rss,
	UserCircle,
	VolumeX,
} from "@/components/ui/icons";

/**
 * The settings map, read by both faces of the surface: the desktop section
 * list and the mobile hub. One registry so a new section shows up in both
 * places and in search at once, and so the URL segment, the nav and the
 * detail can never drift out of step.
 *
 * Grouped by what someone came to do (owner 2026-10-07), not by where the
 * code keeps it. Chat used to be split across Safety (who can message you,
 * read receipts, typing), Data & feed (Enter key, voice notes, stories) and
 * Notifications (pop-ups); it is one Messages section now.
 */
export type SectionId =
	| "notifications"
	| "messages"
	| "privacy"
	| "muted"
	| "blocked"
	| "feed"
	| "display"
	| "data"
	| "account"
	| "premium";

export interface SectionDef {
	id: SectionId;
	/** i18n key for the label, so translations still apply. */
	labelKey: string;
	/** One line under the label in the mobile hub. Kept as data, not
	 *  rendered on the desktop rail (owner 2026-09-20: no taglines). */
	hint: string;
	/** The line under the page title when the section is open. */
	caption: string;
	icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

export const SECTIONS: SectionDef[] = [
	{
		id: "notifications",
		labelKey: "settings.tab.notifications",
		hint: "What reaches you, and how",
		caption:
			"Turn off anything you'd rather not hear about. Applies everywhere you're signed in.",
		icon: Bell,
	},
	{
		id: "messages",
		labelKey: "settings.tab.messages",
		hint: "Who can reach you and how chat behaves",
		caption:
			"Who can reach you, what they see from you, and how chat behaves for you. All in one place.",
		icon: MessageCircle,
	},
	{
		id: "privacy",
		labelKey: "settings.tab.privacy",
		hint: "What people can see about you",
		caption:
			"What other people can see about you. Each of these is enforced on the server, not just hidden in the app.",
		icon: Eye,
	},
	{
		id: "muted",
		labelKey: "settings.tab.muted",
		hint: "Accounts and words you've muted",
		caption:
			"Quieter than blocking. Muted accounts and words leave your feed and stop notifying you, and nobody is told.",
		icon: VolumeX,
	},
	{
		id: "blocked",
		labelKey: "settings.tab.blocked",
		hint: "People you've blocked",
		caption:
			"People you've blocked can't see your posts, message you or find your profile.",
		icon: Ban,
	},
	{
		id: "feed",
		labelKey: "settings.tab.feed",
		hint: "Your topics and what Home shows",
		caption: "What you want more and less of, and what shows up when you open Home.",
		icon: Rss,
	},
	{
		id: "display",
		labelKey: "settings.tab.displayA11y",
		hint: "Theme, text size, motion and language",
		caption: "How WorldStreet looks and reads: size, colour, motion and language.",
		icon: Palette,
	},
	{
		id: "data",
		labelKey: "settings.tab.dataUsage",
		hint: "Data saver, autoplay and uploads",
		caption:
			"What the app downloads on its own. Most of these follow one switch, so a phone already saving data gets the lighter app.",
		icon: Gauge,
	},
	{
		id: "account",
		labelKey: "settings.tab.account",
		hint: "Username, email and account controls",
		caption:
			"Your password, email address and sign-in methods are managed by your WorldStreet account.",
		icon: UserCircle,
	},
	{
		id: "premium",
		labelKey: "settings.tab.premium",
		hint: "Your subscription and verification",
		caption: "Your subscription, billing and verified tick.",
		icon: BadgeCheck,
	},
];

export const SECTION_IDS = SECTIONS.map((s) => s.id) as SectionId[];

/**
 * The labels the rail and the hub open above their sections, in order.
 * Activity leads because "stop telling me things" is why people open
 * settings; Account is last because the destructive things live there.
 */
export const CATEGORIES: { label: string; ids: SectionId[] }[] = [
	{ label: "Activity", ids: ["notifications", "messages"] },
	{ label: "Privacy", ids: ["privacy", "muted", "blocked"] },
	{ label: "Content", ids: ["feed"] },
	{ label: "App", ids: ["display", "data"] },
	{ label: "Account", ids: ["account", "premium"] },
];

/**
 * Section ids from before the regroup. Old links and bookmarks land on the
 * section that holds those settings now.
 */
export const LEGACY_SECTIONS: Record<string, SectionId> = {
	safety: "privacy",
	topics: "feed",
};

/** The one-time "chat settings moved here" notice in Messages, seen once
 *  per account (`useTourSeen`). The rail's New badge on Messages shares it. */
export const MESSAGES_MOVED_KEY = "ws-settings-messages-moved-v1";

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
	notifications: [
		{ id: "alerts", label: "What reaches you" },
		{ id: "behaviour", label: "Behaviour" },
		{ id: "spaces", label: "Spaces" },
	],
	messages: [
		{ id: "reach", label: "Who can reach you" },
		{ id: "seen", label: "What they see" },
		{ id: "chat", label: "In a chat" },
		{ id: "voice", label: "Voice notes" },
	],
	privacy: [{ id: "visibility", label: "Visibility" }],
	muted: [
		{ id: "muted-accounts", label: "Muted accounts" },
		{ id: "muted-words", label: "Muted words" },
	],
	blocked: [{ id: "blocked", label: "Blocked accounts" }],
	feed: [
		{ id: "interests", label: "Interests" },
		{ id: "timeline", label: "Timeline" },
	],
	display: [
		{ id: "accessibility", label: "Accessibility" },
		{ id: "appearance", label: "Appearance" },
	],
	data: [{ id: "usage", label: "Data usage" }],
	account: [
		{ id: "account", label: "Account" },
		{ id: "danger", label: "Danger zone" },
	],
	premium: [{ id: "plan", label: "Your plan" }],
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
	I("Interests", "topics interests feed for you categories", "feed", "interests"),
	I("Likes, replies and mentions", "notifications push alerts mentions likes replies reposts follows", "notifications", "alerts"),
	I("Only from people I follow", "notifications following only filter", "notifications", "alerts"),
	I("Open notifications on", "notifications default tab open on behaviour", "notifications", "behaviour"),
	I("Space recaps", "space spaces voice room recap recaps summary listened after ended audio", "notifications", "spaces"),
	I("Send recaps to your listeners", "space spaces voice room recap recaps host hosting listeners send audience", "notifications", "spaces"),
	I("Who can start a chat with you", "who can message me privacy dm messages everyone allies requests", "messages", "reach"),
	I("Who can add you to groups", "group add invite privacy groups following allies nobody", "messages", "reach"),
	I("Send read receipts", "read receipts seen privacy", "messages", "seen"),
	I("Show when I'm typing", "typing indicator recording privacy", "messages", "seen"),
	I("What the Enter key does", "enter send newline keyboard", "messages", "chat"),
	I("Open a chat where you left off", "first unread open chat", "messages", "chat"),
	I("Pop-ups for new messages", "popups pop-ups toast banner new message", "messages", "chat"),
	I("Message text size", "chat message text size font", "messages", "chat"),
	I("Stories above your chats", "stories inbox bar", "messages", "chat"),
	I("Voice note speed", "voice note speed playback", "messages", "voice"),
	I("Play voice notes back to back", "voice autoplay next", "messages", "voice"),
	I("Show when I'm online", "status online presence last seen active privacy", "privacy", "visibility"),
	I("Show my likes on my profile", "likes profile privacy hide", "privacy", "visibility"),
	I("Muted accounts", "mute muted unmute quiet silence accounts people", "muted", "muted-accounts"),
	I("Muted words", "mute muted words phrases hashtags filter keywords spoilers", "muted", "muted-words"),
	I("Blocked accounts", "blocked block unblock", "blocked", "blocked"),
	I("Text size", "text size font bigger larger smaller", "display", "accessibility"),
	I("Colour vision", "colour color vision blind deuteran protan tritan", "display", "accessibility"),
	I("Contrast", "contrast high", "display", "accessibility"),
	I("Motion", "motion animation reduce reduced", "display", "accessibility"),
	I("Show symbols, not just colour", "symbols cues colour color", "display", "accessibility"),
	I("Bold text", "bold text heavier", "display", "accessibility"),
	I("Underline links", "underline links", "display", "accessibility"),
	I("Reduce transparency", "transparency frosted glass solid blur", "display", "accessibility"),
	I("Theme", "theme dark light mode appearance", "display", "appearance"),
	I("Colour", "colour color palette accent brand tide cobalt iris orchid sunset heritage mono", "display", "appearance"),
	I("Ground", "ground background surface lagoon midnight black graphite grey dune warm sand", "display", "appearance"),
	I("Language", "language locale english spanish french portuguese german", "display", "appearance"),
	I("Install the app", "install app pwa home screen", "display", "appearance"),
	I("Data saver", "data saver mobile data", "data", "usage"),
	I("Autoplay videos", "autoplay video play", "data", "usage"),
	I("Photo upload quality", "upload quality photo compress", "data", "usage"),
	I("Load posts before you reach them", "preload posts prefetch", "data", "usage"),
	I("Stories at the top of Home", "stories rail home timeline hide", "feed", "timeline"),
	I("Show long posts in full", "long posts see more expand", "feed", "timeline"),
	I("Reposts in my timeline", "reposts reshares timeline", "feed", "timeline"),
	I("Keep loading as I scroll", "infinite scroll load more", "feed", "timeline"),
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
