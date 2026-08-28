import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { syncUser } from "./lib/auth.actions";

// Per-isolate profile cache: userId → last good sync result. Best-effort —
// a new isolate just re-syncs. 30s staleness is invisible in practice and
// removes the biggest per-request latency in the whole app.
const profileCache = new Map<string, { profile: unknown; at: number }>();
const PROFILE_CACHE_TTL_MS = 30_000;
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
	// Exact match (plus real subroutes) — a bare startsWith also swallowed any
	// future sibling like /onboarding-complete, silently redirecting it to the
	// feed for anyone who already has a profile.
	const isOnboardingPath =
		pathname === "/onboarding" || pathname.startsWith("/onboarding/");
/**
 * Serialize a profile for the `x-user-data` request header.
 *
 * Two ways the raw profile breaks this header, both of which surfaced as the
 * app's "Something went wrong" digest error (layout.tsx JSON.parse throwing
 * during SSR, which is unrecoverable):
 *
 * 1. SIZE. Node caps request headers at 16KB. The profile embeds the full
 *    followers/following/blocked id arrays, so the header grew with every new
 *    follower — @GregWS reached 18KB and @Protek 21KB, i.e. already broken,
 *    and every account was on the same path. The client never reads those
 *    arrays off userAtom (it uses followersCount/followingCount), so dropping
 *    them takes 21KB down to under 1KB and removes the growth entirely.
 *
 * 2. NON-ASCII. Headers are ByteStrings; an emoji or accent anywhere in a
 *    name or bio throws "Cannot convert argument to a ByteString" when the
 *    header is set. JSON.stringify leaves those characters raw, so they are
 *    escaped to \uXXXX here — still valid JSON, restored intact by JSON.parse.
 */
const HEADER_BUDGET = 8000;

/**
 * Exactly the fields `User` (store/user.atom.ts) declares, and nothing else.
 *
 * An allow-list rather than stripping known-bad keys: the profile document
 * grows over time, and the next array added to it must not be able to break
 * every request before anyone notices.
 */
const CLIENT_PROFILE_FIELDS = [
	"_id",
	"userId",
	"username",
	"email",
	"firstName",
	"lastName",
	"role",
	"avatar",
	"banner",
	"bio",
	"location",
	"website",
	"interests",
	"bookmarks",
	"followersCount",
	"followingCount",
	"postsCount",
	"isVerified",
	"verification",
	"badges",
	"notificationPrefs",
	"onboardingCompleted",
	"createdAt",
] as const;

function userDataHeader(profile: unknown): string {
	const source = (profile ?? {}) as Record<string, unknown>;
	const slim: Record<string, unknown> = {};
	for (const key of CLIENT_PROFILE_FIELDS) {
		if (source[key] !== undefined) slim[key] = source[key];
	}

	let json = JSON.stringify(slim);
	// bookmarks is the only unbounded array the client still reads. If a heavy
	// bookmarker ever approaches the cap, ship the profile without it and let
	// the bookmarks page fetch its own data — a refetch is cheap, a header
	// that breaks every request is not.
	if (json.length > HEADER_BUDGET) {
		json = JSON.stringify({ ...slim, bookmarks: [] });
	}
	return json.replace(
		/[\u0080-\uFFFF]/g,
		(ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`,
	);
}

	const hasProfile = req.cookies.get("has_profile")?.value === "true";

	if (isOnboardingPath && !hasProfile) return respond();

	// 1. If user is logged in and trying to access a protected area
	if (userId && isProtectedRoute(req)) {
		// The sync round-trip (gateway → Atlas) used to run on EVERY request —
		// pages, server actions, prefetches — adding ~0.5-1s each. A profile
		// changes rarely; cache it per user for a short window and skip the
		// trip entirely. Onboarding paths always re-check (fresh accounts).
		//
		// A profile edit has to beat this cache immediately. Server actions run
		// in a different runtime and cannot reach this Map, so
		// `updateMyProfileAction` drops a `profile_stale` cookie and we treat it
		// as a one-shot bust: skip the cache, refetch, clear the flag. Without
		// it the next navigation re-hydrates the client atom from a stale header
		// and the avatar someone just changed silently reverts to the old one
		// for up to the TTL — which is exactly what it looked like when a new
		// profile picture "did not save".
		const profileStale = req.cookies.get("profile_stale")?.value === "1";
		if (profileStale) profileCache.delete(userId);

		const cached = profileCache.get(userId);
		if (
			cached &&
			Date.now() - cached.at < PROFILE_CACHE_TTL_MS &&
			!isOnboardingPath &&
			!profileStale
		) {
			requestHeaders.set("x-user-data", userDataHeader(cached.profile));
			const response = respond();
			response.cookies.set("has_profile", "true", {
				path: "/",
				httpOnly: false,
			});
			return response;
		}

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

		// 2. Prevent users who ALREADY have a profile from re-onboarding.
		// Decided from the sync result, not the cookie — a cleared cookie must
		// not reopen onboarding for an existing profile.
		if (isOnboardingPath && userExistsInDb?.profile) {
			return NextResponse.redirect(new URL(withLocale("/") || "/", req.url));
		}

		// 3. They exist: set the cookie, forward the profile, continue
		if (userExistsInDb?.profile) {
			requestHeaders.set("x-user-data", userDataHeader(userExistsInDb.profile));
			profileCache.set(userId, {
				profile: userExistsInDb.profile,
				at: Date.now(),
			});
		} else if (cached) {
			// Tell the page not to bother asking the gateway again this request.
			// Without this the middleware waits out its timeout and THEN the
			// server component waits out its own, stacking two failures into one
			// very long page. The render skips its optimistic fetch and lets the
			// client try later, when the gateway may be awake.
			requestHeaders.set("x-gateway-degraded", "1");
			// The sync did not answer — timeout, 500, network — and `syncUser`
			// returns null for all three. Serving no `x-user-data` at all was
			// treating "we could not ask" as "this person has no account": the
			// app booted signed-out, the profile page said the account does not
			// exist, and every action that needs a profile failed. One slow
			// response from the gateway should not do that to someone.
			//
			// A stale profile past its TTL is a far better answer than none. It
			// is only ever used when a fresh read failed, and the next request
			// that succeeds replaces it.
			requestHeaders.set("x-user-data", userDataHeader(cached.profile));
		}
		const response = respond();
		response.cookies.set("has_profile", "true", {
			path: "/",
			httpOnly: false,
		});
		// The refetch above is the fresh copy the flag was asking for.
		if (profileStale) response.cookies.delete("profile_stale");
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
