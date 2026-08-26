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
	return document.getElementById("ws-main-scroll") ?? window;
}

/** Current scroll offset of the main scroller, window or element alike. */
export function mainScrollTop(): number {
	const s = mainScroller();
	return s instanceof Window ? s.scrollY : s.scrollTop;
}
