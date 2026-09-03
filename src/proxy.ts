import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { syncUser } from "./lib/auth.actions";

// Per-isolate profile cache: userId → last good sync result. Best-effort —
// a new isolate just re-syncs. Five minutes is safe because the one thing
// that actually changes this payload, a profile edit, busts the entry
// explicitly through the profile_stale cookie below; everything else about
// it is stable for hours. This removes the gateway round trip from almost
// every navigation.
const profileCache = new Map<string, { profile: unknown; at: number }>();
const PROFILE_CACHE_TTL_MS = 300_000;
import {
	LOCALE_COOKIE,
	LOCALE_HEADER,
	isLocale,
	negotiateLocale,
	splitLocalePath,
	type Locale,
} from "./i18n/config";

const isProtectedRoute = createRouteMatcher(["/(.*)"]);

/**
 * Auth belongs to the WorldStreet hub, not to us.
 *
 * This app is a Clerk SATELLITE of worldstreetgold.com, exactly like the
 * dashboard, academy and arcade. Two things make that real, and this app had
 * NEITHER — so every signed-out visitor was dumped on Clerk's hosted
 * `*.accounts.dev` portal, a domain that is not ours and that users read as a
 * phishing page (owner 2026-09-03).
 *
 * 1. The satellite config below, in CODE not env: with
 *    NEXT_PUBLIC_CLERK_IS_SATELLITE/_DOMAIN unset, `auth.protect()` cannot
 *    build the primary-domain sign-in redirect. (Vision hit exactly this in
 *    prod and rewrote signed-out visitors to a 404.)
 * 2. `signInUrl` pointing at the hub's own /login, so an unauthenticated
 *    visitor is sent there rather than to Clerk's portal.
 *
 * Do NOT replace `auth.protect()` with a hand-rolled redirect to the hub: it
 * skips the satellite handshake and loops (see the call site).
 */
const isLocalDev =
	process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_");
const HUB_LOGIN_URL = "https://www.worldstreetgold.com/login";
const HUB_REGISTER_URL = "https://www.worldstreetgold.com/register";

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
		// `auth.protect()`, NOT a hand-rolled redirect to the hub.
		//
		// The satellite handshake is the thing that copies an existing hub
		// session onto this domain, and protect() is what performs it. A
		// manual redirect skips it, so a signed-in visitor arrives with no
		// session, gets sent to the hub, is bounced straight back because the
		// hub knows them, still has no session — ERR_TOO_MANY_REDIRECTS
		// (production, 2026-09-03).
		//
		// Academy and arcade CAN hand-roll it because they protect a handful
		// of routes and the handshake lands on a public one. Here
		// `isProtectedRoute` is /(.*) — every path — so there is nowhere for
		// it to land and the loop is unavoidable. The satellite config passed
		// to clerkMiddleware below is what makes protect() send genuinely
		// signed-out people to the hub's /login instead of Clerk's hosted
		// portal, which was the original complaint.
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
/**
 * A speculative request: a Link prefetch, or an RSC payload fetch. Redirecting
 * either one poisons the router (see the call sites).
 */
function isSpeculative(req: NextRequest): boolean {
	const h = req.headers;
	return (
		h.get("Next-Router-Prefetch") === "1" ||
		h.get("purpose") === "prefetch" ||
		h.get("Purpose") === "prefetch" ||
		h.get("x-middleware-prefetch") === "1"
	);
}

/**
 * Build a redirect target that KEEPS the original query string — Next attaches
 * `_rsc` to client navigations, and a redirect that drops it returns a payload
 * the router rejects, falling back to a hard navigation.
 */
function redirectTarget(path: string, req: NextRequest): URL {
	const url = new URL(path, req.url);
	const from = new URL(req.url);
	from.searchParams.forEach((value, key) => {
		if (!url.searchParams.has(key)) url.searchParams.set(key, value);
	});
	return url;
}

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
			// Redirect to onboarding if they don't exist in your DB.
			//
			// Never redirect a PREFETCH: Next caches the redirect from the
			// speculative request and applies it to the later real click, and
			// the rebuilt URL drops the `_rsc` cache-buster, which makes the
			// router abandon the navigation and hard-load somewhere else —
			// a documented route to "I tapped B and landed on A"
			// (investigation 2026-09-01). Let the prefetch pass; the real
			// navigation that follows redirects honestly.
			if (isSpeculative(req)) return respond();
			return NextResponse.redirect(
				redirectTarget(withLocale("/onboarding"), req),
			);
		}

		// 2. Prevent users who ALREADY have a profile from re-onboarding.
		// Decided from the sync result, not the cookie — a cleared cookie must
		// not reopen onboarding for an existing profile.
		if (isOnboardingPath && userExistsInDb?.profile) {
			if (isSpeculative(req)) return respond();
			return NextResponse.redirect(
				redirectTarget(withLocale("/") || "/", req),
			);
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
},
	// Satellite config lives in CODE, mirroring dashboard/academy/arcade.
	isLocalDev
		? {}
		: {
				domain: "worldstreetgold.com",
				isSatellite: true,
				signInUrl: HUB_LOGIN_URL,
				signUpUrl: HUB_REGISTER_URL,
			},
);

export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};
