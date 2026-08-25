import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { syncUser } from "./lib/auth.actions";
import {
	LOCALE_COOKIE,
	LOCALE_HEADER,
	isLocale,
	negotiateLocale,
	splitLocalePath,
	type Locale,
} from "./i18n/config";

const isProtectedRoute = createRouteMatcher(["/(.*)"]);

export default clerkMiddleware(async (auth, req) => {
	// ── i18n: /es/foo serves the same app as /foo ─────────────────────────
	// The locale prefix is stripped via rewrite so app/ keeps its structure;
	// the choice persists in the ws_locale cookie and reaches server
	// components on the x-ws-locale request header. Bare URLs fall back to
	// cookie, then Accept-Language, then English.
	const { locale: prefixLocale, pathname } = splitLocalePath(
		req.nextUrl.pathname,
	);
	const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value;
	const locale: Locale =
		prefixLocale ??
		(isLocale(cookieLocale)
			? cookieLocale
			: negotiateLocale(req.headers.get("accept-language")));

	const withLocale = (path: string) =>
		prefixLocale ? `/${prefixLocale}${path === "/" ? "" : path}` || "/" : path;

	const requestHeaders = new Headers(req.headers);
	requestHeaders.set(LOCALE_HEADER, locale);

	// Every response goes through here so the rewrite (when a prefix is
	// present), the locale header and the locale cookie are never forgotten.
	const respond = () => {
		const res = prefixLocale
			? NextResponse.rewrite(
					new URL(pathname + req.nextUrl.search, req.url),
					{ request: { headers: requestHeaders } },
				)
			: NextResponse.next({ request: { headers: requestHeaders } });
		res.cookies.set(LOCALE_COOKIE, locale, { path: "/", httpOnly: false });
		return res;
	};

	// ── auth ──────────────────────────────────────────────────────────────
	const { userId, getToken } = await auth();

	if (isProtectedRoute(req)) {
		await auth.protect();
	}

	// Route checks run against the locale-stripped path so /es/onboarding
	// behaves exactly like /onboarding.
	const isOnboardingPath = pathname.startsWith("/onboarding");
	const hasProfile = req.cookies.get("has_profile")?.value === "true";

	if (isOnboardingPath && !hasProfile) return respond();

	// 1. If user is logged in and trying to access a protected area
	if (userId && isProtectedRoute(req)) {
		const token = await getToken();
		const userExistsInDb = await syncUser(token);

		if (userExistsInDb?.status === "not_found") {
			// Already on onboarding: let it render. Redirecting here loops
			// forever whenever a stale has_profile=true cookie outlives the
			// profile it stood for (e.g. after switching Clerk instances),
			// because that cookie skips the early return above.
			if (isOnboardingPath) {
				const response = respond();
				response.cookies.delete("has_profile");
				return response;
			}
			// Redirect to onboarding if they don't exist in your DB
			return NextResponse.redirect(
				new URL(withLocale("/onboarding"), req.url),
			);
		}

		// 2. Prevent users who ALREADY have a profile from re-onboarding
		if (isOnboardingPath && hasProfile) {
			return NextResponse.redirect(new URL(withLocale("/") || "/", req.url));
		}

		// 3. They exist: set the cookie, forward the profile, continue
		if (userExistsInDb?.profile) {
			requestHeaders.set("x-user-data", JSON.stringify(userExistsInDb.profile));
		}
		const response = respond();
		response.cookies.set("has_profile", "true", {
			path: "/",
			httpOnly: false,
		});
		return response;
	}

	return respond();
});

export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};
