import type { ReactNode, SVGProps } from "react";

/**
 * Vivid's own icon set (owner 2026-10-16: "the icons we're even using is
 * not ui nice at all"). Drawn for this surface on a 24 grid: 1.75 strokes
 * with round ends and joins, every glyph inside the same 18px live area so
 * they sit at one optical size, and fills only where a shape is the point
 * (stop, the live dot). They take `currentColor`, like the rest of the app's
 * icons, and `size` in px.
 *
 * The house set elsewhere stays Phosphor; this set is only for Vivid.
 */

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number; strokeWidth?: number };

function icon(paths: (sw: number) => ReactNode, displayName: string) {
	const Icon = ({ size = 20, strokeWidth = 1.75, ...rest }: IconProps) => (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
			{...rest}
		>
			{paths(strokeWidth)}
		</svg>
	);
	Icon.displayName = displayName;
	return Icon;
}

/* ── the window ─────────────────────────────────────────────────────────── */

/** New chat: a page with a pen lifting off its corner. */
export const IconCompose = icon(
	() => (
		<>
			<path d="M11.5 4.5H7.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3v-4" />
			<path d="M17.4 3.9a1.9 1.9 0 0 1 2.7 2.7l-7.3 7.3-3.4.7.7-3.4z" />
		</>
	),
	"IconCompose",
);

/** History: a clock running back. */
export const IconHistory = icon(
	() => (
		<>
			<path d="M3.6 13.2A8.5 8.5 0 1 0 5.9 6" />
			<path d="M3.6 4.4v4.2h4.2" />
			<path d="M12 8v4.3l2.8 1.7" />
		</>
	),
	"IconHistory",
);

/** Talk: a voice, five bars. */
export const IconVoice = icon(
	() => (
		<>
			<path d="M4.5 10.5v3" />
			<path d="M8.25 7.5v9" />
			<path d="M12 4.5v15" />
			<path d="M15.75 7.5v9" />
			<path d="M19.5 10.5v3" />
		</>
	),
	"IconVoice",
);

/** Send: straight up. */
export const IconSend = icon(
	() => (
		<>
			<path d="M12 19V5.5" />
			<path d="M6.5 11 12 5.5 17.5 11" />
		</>
	),
	"IconSend",
);

/** Stop: the one filled square. */
export const IconStop = icon(
	() => <rect x="7" y="7" width="10" height="10" rx="2.6" fill="currentColor" stroke="none" />,
	"IconStop",
);

/** The web: a globe with one meridian. */
export const IconGlobe = icon(
	() => (
		<>
			<circle cx="12" cy="12" r="8.5" />
			<path d="M3.5 12h17" />
			<path d="M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5S9.7 5.9 12 3.5z" />
		</>
	),
	"IconGlobe",
);

export const IconCopy = icon(
	() => (
		<>
			<rect x="8.5" y="8.5" width="11" height="11" rx="2.6" />
			<path d="M15.5 8.5V7a2.5 2.5 0 0 0-2.5-2.5H7A2.5 2.5 0 0 0 4.5 7v6A2.5 2.5 0 0 0 7 15.5h1.5" />
		</>
	),
	"IconCopy",
);

/** Read aloud. */
export const IconSpeaker = icon(
	() => (
		<>
			<path d="M4.5 9.8h2.8l4.2-3.8v12l-4.2-3.8H4.5a1 1 0 0 1-1-1v-2.4a1 1 0 0 1 1-1z" />
			<path d="M15.3 9.2a4 4 0 0 1 0 5.6" />
			<path d="M18.1 6.6a7.6 7.6 0 0 1 0 10.8" />
		</>
	),
	"IconSpeaker",
);

/** Try again. */
export const IconRetry = icon(
	() => (
		<>
			<path d="M19.6 13.3A7.8 7.8 0 1 1 17.4 6.4" />
			<path d="M19.8 3.8v3.9h-3.9" />
		</>
	),
	"IconRetry",
);

export const IconThumbUp = icon(
	() => (
		<>
			<path d="M7.5 10.5v9H5.5a1.5 1.5 0 0 1-1.5-1.5v-6a1.5 1.5 0 0 1 1.5-1.5z" />
			<path d="M7.5 10.5 11 4.6a1.6 1.6 0 0 1 2.9 1.1l-.6 3.8h4.6a2 2 0 0 1 2 2.3l-1.1 6.1a2 2 0 0 1-2 1.6H7.5" />
		</>
	),
	"IconThumbUp",
);

export const IconThumbDown = icon(
	() => (
		<g transform="rotate(180 12 12)">
			<path d="M7.5 10.5v9H5.5a1.5 1.5 0 0 1-1.5-1.5v-6a1.5 1.5 0 0 1 1.5-1.5z" />
			<path d="M7.5 10.5 11 4.6a1.6 1.6 0 0 1 2.9 1.1l-.6 3.8h4.6a2 2 0 0 1 2 2.3l-1.1 6.1a2 2 0 0 1-2 1.6H7.5" />
		</g>
	),
	"IconThumbDown",
);

export const IconCheck = icon(() => <path d="M5.5 12.5 10 17l8.5-9.5" />, "IconCheck");

export const IconClose = icon(
	() => (
		<>
			<path d="M6.5 6.5l11 11" />
			<path d="M17.5 6.5l-11 11" />
		</>
	),
	"IconClose",
);

/** Opens somewhere else. */
export const IconArrowOut = icon(
	() => (
		<>
			<path d="M8 16 16.5 7.5" />
			<path d="M9.5 7.5h7v7" />
		</>
	),
	"IconArrowOut",
);

export const IconChevronDown = icon(() => <path d="M7 10l5 5 5-5" />, "IconChevronDown");

export const IconTrash = icon(
	() => (
		<>
			<path d="M4.5 7h15" />
			<path d="M9.5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7" />
			<path d="M6.5 7l.8 11a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8l.8-11" />
		</>
	),
	"IconTrash",
);

export const IconMic = icon(
	() => (
		<>
			<rect x="9" y="3.5" width="6" height="11" rx="3" />
			<path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
			<path d="M12 18v2.5" />
		</>
	),
	"IconMic",
);

export const IconMicOff = icon(
	() => (
		<>
			<path d="M15 10V6.5a3 3 0 0 0-5.6-1.5" />
			<path d="M9 9.5v2a3 3 0 0 0 4.6 2.5" />
			<path d="M5.5 11.5a6.5 6.5 0 0 0 10.6 5" />
			<path d="M18.5 11.5a6.4 6.4 0 0 1-.4 2.2" />
			<path d="M12 18v2.5" />
			<path d="M4 4l16 16" />
		</>
	),
	"IconMicOff",
);

/** Vivid's spark: four points, filled, for the brand moments only. */
export const IconSpark = icon(
	() => <path d="M12 3.2Q12.9 11.1 20.8 12 12.9 12.9 12 20.8 11.1 12.9 3.2 12 11.1 11.1 12 3.2z" fill="currentColor" stroke="none" />,
	"IconSpark",
);

/* ── quick actions and the steps Vivid takes ────────────────────────────── */

/** Go live: a dot broadcasting. */
export const IconLive = icon(
	() => (
		<>
			<circle cx="12" cy="12" r="2.1" fill="currentColor" stroke="none" />
			<path d="M8.7 8.7a4.7 4.7 0 0 0 0 6.6" />
			<path d="M15.3 8.7a4.7 4.7 0 0 1 0 6.6" />
			<path d="M5.9 5.9a8.6 8.6 0 0 0 0 12.2" />
			<path d="M18.1 5.9a8.6 8.6 0 0 1 0 12.2" />
		</>
	),
	"IconLive",
);

export const IconMessage = icon(
	() => <path d="M20 11.6a7.6 7.6 0 0 1-11 6.8l-4.6 1.2 1.3-4.3A7.6 7.6 0 1 1 20 11.6z" />,
	"IconMessage",
);

/** A Space: someone speaking to a room. */
export const IconSpace = icon(
	() => (
		<>
			<circle cx="12" cy="9.6" r="2.7" />
			<path d="M7.4 18.6a4.6 4.6 0 0 1 9.2 0" />
			<path d="M5 6.2a8.4 8.4 0 0 0 0 9.6" />
			<path d="M19 6.2a8.4 8.4 0 0 1 0 9.6" />
		</>
	),
	"IconSpace",
);

/** Write a post: a pen. */
export const IconPen = icon(
	() => (
		<>
			<path d="M4.5 19.5 5.6 15 15.8 4.8a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L9 18.4z" />
			<path d="M14 6.6l3.4 3.4" />
		</>
	),
	"IconPen",
);

export const IconTrending = icon(
	() => (
		<>
			<path d="M3.5 16.5 9 11l4 4 7.5-7.5" />
			<path d="M15 7.5h5.5V13" />
		</>
	),
	"IconTrending",
);

/** Catch me up: the feed, newest first. */
export const IconFeed = icon(
	() => (
		<>
			<path d="M4.5 6.5h15" />
			<path d="M4.5 12h15" />
			<path d="M4.5 17.5h9" />
		</>
	),
	"IconFeed",
);

export const IconVote = icon(
	() => (
		<>
			<path d="M4.5 12.5h15v5.5a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z" />
			<path d="M8 12.5v-7a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v7" />
			<path d="M10.2 8.6l1.4 1.4 2.3-2.4" />
		</>
	),
	"IconVote",
);

export const IconWallet = icon(
	() => (
		<>
			<path d="M4.5 7.5v10a2.5 2.5 0 0 0 2.5 2.5h11.5a1 1 0 0 0 1-1v-8.5a1 1 0 0 0-1-1H7a2.5 2.5 0 0 1-2.5-2.5z" />
			<path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h10.5v3.5" />
			<circle cx="15.8" cy="14.3" r="1.1" fill="currentColor" stroke="none" />
		</>
	),
	"IconWallet",
);

export const IconSearch = icon(
	() => (
		<>
			<circle cx="10.8" cy="10.8" r="6.3" />
			<path d="M15.5 15.5 20 20" />
		</>
	),
	"IconSearch",
);

export const IconPeople = icon(
	() => (
		<>
			<circle cx="9" cy="8.5" r="3" />
			<path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
			<path d="M15.5 5.7a3 3 0 0 1 0 5.6" />
			<path d="M17.5 13.9a5.5 5.5 0 0 1 3 5.1" />
		</>
	),
	"IconPeople",
);

export const IconBell = icon(
	() => (
		<>
			<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z" />
			<path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
		</>
	),
	"IconBell",
);

/** A post read in full. */
export const IconPost = icon(
	() => (
		<>
			<rect x="4.5" y="4.5" width="15" height="15" rx="3" />
			<path d="M8 9.5h8" />
			<path d="M8 13h8" />
			<path d="M8 16.5h4.5" />
		</>
	),
	"IconPost",
);

/** A person's profile. */
export const IconPerson = icon(
	() => (
		<>
			<circle cx="12" cy="8.5" r="3.5" />
			<path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
		</>
	),
	"IconPerson",
);

export const IconBookmark = icon(
	() => <path d="M7 4.5h10a1 1 0 0 1 1 1v14l-6-4-6 4v-14a1 1 0 0 1 1-1z" />,
	"IconBookmark",
);

export const IconCalendar = icon(
	() => (
		<>
			<rect x="4" y="5.5" width="16" height="14.5" rx="2.6" />
			<path d="M4 10h16" />
			<path d="M8.5 3.5v3.5" />
			<path d="M15.5 3.5v3.5" />
		</>
	),
	"IconCalendar",
);

/** Settings: two sliders. */
export const IconSliders = icon(
	() => (
		<>
			<path d="M4.5 8h9" />
			<path d="M18.5 8h1" />
			<circle cx="16" cy="8" r="2.5" />
			<path d="M4.5 16h1" />
			<path d="M10.5 16h9" />
			<circle cx="8" cy="16" r="2.5" />
		</>
	),
	"IconSliders",
);

/** Light and dark. */
export const IconContrast = icon(
	() => (
		<>
			<circle cx="12" cy="12" r="8.5" />
			<path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
		</>
	),
	"IconContrast",
);

/** Another WorldStreet app. */
export const IconApps = icon(
	() => (
		<>
			<rect x="4.5" y="4.5" width="6" height="6" rx="1.8" />
			<rect x="13.5" y="4.5" width="6" height="6" rx="1.8" />
			<rect x="4.5" y="13.5" width="6" height="6" rx="1.8" />
			<rect x="13.5" y="13.5" width="6" height="6" rx="1.8" />
		</>
	),
	"IconApps",
);

/** WorldMeet: a video camera. */
export const IconVideo = icon(
	() => (
		<>
			<rect x="3.5" y="6.5" width="12.5" height="11" rx="2.8" />
			<path d="M16 10.4 20.5 8v8L16 13.6" />
		</>
	),
	"IconVideo",
);

/** Attach a file. */
export const IconPaperclip = icon(
	() => <path d="M19.5 11.6 12.4 18.7a4.7 4.7 0 0 1-6.6-6.6l7.6-7.6a3.1 3.1 0 0 1 4.4 4.4l-7.5 7.5a1.6 1.6 0 0 1-2.2-2.2l6.8-6.8" />,
	"IconPaperclip",
);

/** A document. */
export const IconFile = icon(
	() => (
		<>
			<path d="M13.5 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8.5z" />
			<path d="M13.5 3.5v5h5" />
			<path d="M9 13h6" />
			<path d="M9 16.5h4" />
		</>
	),
	"IconFile",
);

/** A picture. */
export const IconImage = icon(
	() => (
		<>
			<rect x="3.5" y="4.5" width="17" height="15" rx="2.8" />
			<circle cx="9" cy="10" r="1.7" />
			<path d="M20.5 15.5 15.8 11l-8.3 8.5" />
		</>
	),
	"IconImage",
);

/** Audio: a short wave. */
export const IconWave = icon(
	() => (
		<>
			<path d="M3.5 12h1.5" />
			<path d="M7 8.5v7" />
			<path d="M10.5 5.5v13" />
			<path d="M14 8.5v7" />
			<path d="M17.5 10.5v3" />
			<path d="M20.5 12h0" />
		</>
	),
	"IconWave",
);

/** Business: a briefcase. */
export const IconBriefcase = icon(
	() => (
		<>
			<rect x="3.5" y="7.5" width="17" height="12" rx="2.6" />
			<path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" />
			<path d="M3.5 12.5h17" />
		</>
	),
	"IconBriefcase",
);

/** Ask next: a line that turns down and on, the way a follow-up carries on. */
export const IconFollowUp = icon(
	() => (
		<>
			<path d="M6 5v6.5a3 3 0 0 0 3 3h9" />
			<path d="M14.5 11 18 14.5 14.5 18" />
		</>
	),
	"IconFollowUp",
);
