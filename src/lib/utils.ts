import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

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
