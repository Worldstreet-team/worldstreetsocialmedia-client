import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Safe detail to log from a caught request error.
 *
 * Never log a raw axios error: it carries `config.headers`, which holds the
 * user's `Authorization: Bearer <clerk jwt>`. Logging the object verbatim
 * writes live session tokens into the server logs. Narrow to the server's
 * message or the status instead.
 */
export const errorDetail = (error: unknown): unknown => {
	const e = error as {
		response?: { data?: unknown; status?: number };
		message?: string;
	};
	return e?.response?.data ?? e?.response?.status ?? e?.message ?? "unknown error";
};

/**
 * X-style compact timestamps, used everywhere a post shows its age:
 * seconds/minutes/hours/days ("42s", "7m", "22h", "3d"), then "Aug 2"
 * past a week, then "Aug 2, 2025" past a year. Falls back to "now".
 */
export const formatTimeAgo = (dateString: string) => {
	try {
		const date = new Date(dateString);
		const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

		if (diffInSeconds < 60) return `${Math.max(0, diffInSeconds)}s`;

		const diffInMinutes = Math.floor(diffInSeconds / 60);
		if (diffInMinutes < 60) return `${diffInMinutes}m`;

		const diffInHours = Math.floor(diffInMinutes / 60);
		if (diffInHours < 24) return `${diffInHours}h`;

		const diffInDays = Math.floor(diffInHours / 24);
		if (diffInDays < 7) return `${diffInDays}d`;

		const sameYear = date.getFullYear() === new Date().getFullYear();
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			...(sameYear ? {} : { year: "numeric" }),
		});
	} catch {
		return "now";
	}
};

export const handleSignOut = async (
	signOut: (callback?: () => void) => Promise<void>,
) => {
	// 1. Clear Clerk session
	await signOut();

	// 2. LCD Clear Cookies
	// Try to clear cookies on main domain and subdomains
	if (typeof window !== "undefined") {
		const cookies = document.cookie.split(";");
		const domainParts = window.location.hostname.split(".");
		// Assuming format is sub.domain.com or domain.com
		// We want to clear on .domain.com and domain.com
		const rootDomain = domainParts.slice(-2).join(".");

		for (let i = 0; i < cookies.length; i++) {
			const cookie = cookies[i];
			const eqPos = cookie.indexOf("=");
			const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();

			// Clear on current path
			document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";

			// Clear on root domain
			document.cookie =
				name +
				"=;expires=Thu, 01 Jan 1970 00:00:00 GMT;domain=." +
				rootDomain +
				";path=/";
			document.cookie =
				name +
				"=;expires=Thu, 01 Jan 1970 00:00:00 GMT;domain=" +
				rootDomain +
				";path=/";
		}

		// 3. Redirect to external login
		window.location.href = "https://www.worldstreetgold.com/login";
	}
};

/**
 * The middle column's scroll container.
 *
 * The story rail is fixed by making the column scroll inside its own
 * element instead of the window, so every "scroll to top" and scroll listener
 * has to target that element. Falls back to the document scroller on pages
 * that still scroll the window (messages, live).
 */
export function mainScroller(): HTMLElement | (Window & typeof globalThis) {
	if (typeof document === "undefined") return window;
	// getElementById returns the FIRST match — and a hydration hiccup can
	// strand a hidden streamed copy of the page in the DOM, whose scroller
	// has zero height. Talking to that ghost is why scroll save/restore and
	// back-to-top silently did nothing (found 2026-09-01: two
	// #ws-main-scroll nodes, the first invisible). Prefer the one that can
	// actually scroll.
	const candidates = document.querySelectorAll<HTMLElement>(
		"#ws-main-scroll",
	);
	for (const el of candidates) {
		if (el.clientHeight > 0) return el;
	}
	return candidates[0] ?? window;
}

/** Current scroll offset of the main scroller, window or element alike. */
export function mainScrollTop(): number {
	const s = mainScroller();
	return s instanceof Window ? s.scrollY : s.scrollTop;
}

/** THE count format, app-wide (owner ruling 2026-09-02, superseding the old
 *  hold-full-figures-to-10k typography carve-out): 843 -> "843",
 *  1234 -> "1.2k", 2_400_000 -> "2.4m". Lowercase k and m, compaction from
 *  one thousand, everywhere a count renders. Money stays exact — never
 *  compact a currency amount. */
export const formatCompact = (n: number): string => {
	if (!Number.isFinite(n)) return "0";
	if (n < 1000) return String(n);
	if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
};

/** The gateway sends trend volume as a finished string ("1066 posts");
 *  compact the figure, keep whatever suffix it chose. */
export const compactTrendPosts = (t: {
	posts?: string;
	postsCount?: number;
}): string => {
	const n =
		t.postsCount ??
		Number.parseInt(String(t.posts ?? "").replace(/[^0-9]/g, ""), 10);
	if (!Number.isFinite(n) || n <= 0) return t.posts ?? "";
	const suffix = String(t.posts ?? "").replace(/^[0-9.,\s]+/, "") || "posts";
	return `${formatCompact(n)} ${suffix}`;
};
