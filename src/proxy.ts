import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse, type NextFetchEvent } from "next/server";
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
 * Keep `auth.protect()` for the signed-out redirect. (Its old justification
 * here, that protect() runs the satellite handshake, was wrong: Clerk's
 * middleware issues every handshake redirect BEFORE this handler runs,
 * clerkMiddleware.js, and protect() only sends a signed-out visitor to
 * signInUrl. The 2026-09-03 loop blamed on a hand-rolled redirect was the
 * satellite handshake loop described at the clerkMiddleware options.)
 */
const isLocalDev =
	process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_");
const HUB_ORIGIN = "https://www.worldstreetgold.com";
const HUB_LOGIN_URL = `${HUB_ORIGIN}/login`;
const HUB_REGISTER_URL = "https://www.worldstreetgold.com/register";

/**
 * The address the visitor actually typed, for every redirect and link this
 * file builds.
 *
 * Behind Coolify, `req.url` and `req.nextUrl` carry the CONTAINER's origin,
 * https://localhost:3000. Every URL built from them sent people to
 * localhost: the "Signing you in" page refreshed to
 * https://localhost:3000/?__ws_retry=1, and a visitor coming back from the
 * hub's sign-in was redirected to localhost when the __ws_hs marker was
 * stripped (production, 2026-09-28, reproduced by curl). In production the
 * origin is fixed, never read from a request header, so nothing a request
 * says can point a redirect somewhere else. Local dev keeps its own origin.
 */
const PUBLIC_ORIGIN = "https://social.worldstreetgold.com";
function publicUrl(req: NextRequest, path?: string): URL {
	const origin = isLocalDev ? req.nextUrl.origin : PUBLIC_ORIGIN;
	return new URL(path ?? req.nextUrl.pathname + req.nextUrl.search, origin);
}

/**
 * The sign-in bridge, for when the server-side handshake could not bring
 * the hub's session over (owner 2026-10-07: "it says connecting your
 * worldstreet session to worldspace and nothing happens it goes back").
 *
 * The old page waited two seconds and asked the server to try again, which
 * failed the same way, and its sibling cleared the shared __client_uat,
 * which signed the hub out and bounced the person between the two. This
 * one does the handover in the BROWSER instead: it loads Clerk's own
 * script from the instance's Frontend API, which reads the session the hub
 * holds through the browser's own Clerk cookies, writes this site's session
 * cookie, and continues to the page that was asked for. Only when the
 * browser has no session either does it offer the hub's login, as a link,
 * never a redirect, so it cannot loop. One automatic attempt per visit
 * (`__ws_retry`); after that, the link.
 */
const CLERK_JS_URL =
	"https://clerk.worldstreetgold.com/npm/@clerk/clerk-js@5/dist/clerk.browser.js";

const escHtml = (v: string) =>
	v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * Where the person was going, in words ("we'll take you straight to your
 * messages"). A fixed map, so nothing from the URL is echoed into the page.
 */
function destinationWords(path: string): string {
	const p = splitLocalePath(path).pathname;
	const at = (base: string) => p === base || p.startsWith(`${base}/`);
	if (p === "/") return "your feed";
	if (at("/messages")) return "your messages";
	if (at("/notifications")) return "your notifications";
	if (at("/bookmarks")) return "your bookmarks";
	if (at("/explore")) return "Explore";
	if (at("/communities")) return "Communities";
	if (p.startsWith("/voice/")) return "the space you opened";
	if (at("/voice")) return "Space Voice";
	if (at("/post")) return "the post you opened";
	if (p.startsWith("/profile/")) return "that profile";
	if (at("/profile")) return "your profile";
	if (at("/settings")) return "your settings";
	if (at("/studio")) return "Creator Studio";
	if (at("/live") || at("/live-now") || at("/stream"))
		return "the live stream";
	if (at("/join")) return "the group invite";
	if (at("/votes")) return "the weekly vote";
	return "the page you opened";
}

/*
 * The two pages proxy.ts serves itself (the sign-in bridge and the
 * cookies-off page), drawn in the house look (owner 2026-10-15: "more
 * creative and better ... use our own images").
 *
 * The picture is the handover itself, in our own marks: the WorldStreet W
 * (wsa-mark.png) on the left, the WorldSpace W (BrandMark's polygons) on the
 * right, one wire between. While the browser bridges the session a packet of
 * brand colour runs along the wire; when it lands the wire lights and the W
 * fills; when it fails the wire parts in the middle and the way forward sits
 * under the gap. The house doodle (the brand-painted mask) is the ground,
 * cleared from the middle so it frames the picture instead of crowding it.
 *
 * Plain HTML from middleware, before the app or its CSS: everything is
 * inline, static files are reachable signed out (the matcher skips them),
 * and nothing loads from another host except Clerk's script on the bridge.
 * The head script reads the same caches the app's pre-paint does (next-themes
 * `theme`, `ws-prefs-v1`) so the page wears the person's mode, palette and
 * reduced-motion choice. The palette map mirrors ws-palettes.css: change
 * both together.
 */
const AUTH_PAGE_HEAD = `<script>try{var h=document.documentElement,c=JSON.parse(localStorage.getItem("ws-prefs-v1")||"{}"),ap=c.appearance||{},a=c.a11y||{},L=localStorage.getItem("theme")==="light",x=/^#[0-9a-fA-F]{6}$/;
if(L){h.dataset.mode="light";var tc=document.querySelector('meta[name="theme-color"]');if(tc)tc.content="#FFFFFF"}
var P={cobalt:["#60A5FA","#60A5FA"],iris:["#A78BFA","#A78BFA"],orchid:["#E879F9","#E879F9"],sunset:["#FB923C","#FB923C"],heritage:["#EAB308","#EAB308"],mono:["#FAFAFA","#18181B"],citrus:["#BEF264","#A3E635"],steel:["#B4C2D2","#475569"],parchment:["#EBDDBA","#4A3B28"]},pl=ap.palette,b=Object.prototype.hasOwnProperty.call(P,pl)?P[pl]:null,cu=ap.custom;
if(pl==="custom"&&cu&&x.test(cu.dPrimary)&&x.test(cu.lPrimary))b=[cu.dPrimary,cu.lPrimary];
if(b){var v=b[L?1:0],n=parseInt(v.slice(1),16),f=function(k){k/=255;return k<=.03928?k/12.92:Math.pow((k+.055)/1.055,2.4)},y=.2126*f(n>>16&255)+.7152*f(n>>8&255)+.0722*f(n&255);
h.style.setProperty("--brand",v);h.style.setProperty("--brand-ink",y>.179?"#0C0A09":"#FFFFFF")}
var r=a.reduceMotion;if(r==="on"||((r==null||r==="auto")&&window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches))h.dataset.motion="reduce";}catch(e){}</script>
<style>
:root{--page:#000000;--ink:#FFFFFF;--muted:rgba(255,255,255,.62);--subtle:rgba(255,255,255,.42);--line:rgba(255,255,255,.16);--wash:rgba(255,255,255,.05);--brand:#22B8D6;--brand-ink:#0C0A09;--focus:#EAB308;--doodle:.2;color-scheme:dark}
html[data-mode="light"]{--page:#FFFFFF;--ink:#0C0A09;--muted:#6F6862;--subtle:#7A736D;--line:#E2DFDD;--wash:rgba(0,0,0,.04);--focus:#CA8A04;--doodle:.14;color-scheme:light}
html{background:var(--page);color:var(--ink);font:15px/1.6 "Instrument Sans","Public Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
[hidden]{display:none!important}
body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:32px 20px;box-sizing:border-box}
body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:var(--brand);opacity:var(--doodle);--clear:radial-gradient(ellipse 320px 300px at 50% 50%,transparent 60%,#000 100%);--art:url("/images/backgrounds/worldspace-doodle-mask.webp");-webkit-mask-image:var(--clear),var(--art);-webkit-mask-size:100% 100%,cover;-webkit-mask-position:center;-webkit-mask-repeat:no-repeat;-webkit-mask-composite:source-in;mask-image:var(--clear),var(--art);mask-size:100% 100%,cover;mask-position:center;mask-repeat:no-repeat;mask-composite:intersect}
main{width:100%;max-width:380px;text-align:center;display:grid;justify-items:center;animation:rise .32s cubic-bezier(.16,1,.3,1) backwards}
@keyframes rise{from{opacity:0;transform:translateY(8px)}}
.stage{width:min(100%,300px);display:grid;grid-template-columns:56px 1fr 56px;column-gap:14px;align-items:start;margin-bottom:36px}
figure{margin:0;display:grid;justify-items:center;gap:10px}
figure img,figure svg{display:block;width:56px;height:32px}
figcaption{font-size:13px;line-height:1;color:var(--subtle);white-space:nowrap}
.ws{overflow:visible;transition:opacity .32s}
.ws polygon{fill:var(--brand);fill-opacity:0;stroke:var(--brand);stroke-width:16;stroke-linejoin:miter;transition:fill-opacity .2s}
.wire{position:relative;height:2px;margin-top:15px}
.wire>span{position:absolute;top:0;height:2px;border-radius:2px}
.half{width:50%;background:var(--line);transition:transform .32s cubic-bezier(.2,0,0,1)}
.h1{left:0;transform-origin:left}.h2{right:0;transform-origin:right}
.lit{inset:0;background:var(--brand);opacity:0;transition:opacity .2s}
.run{inset:0;overflow:hidden;transition:opacity .2s}
.run b{position:absolute;inset:0;transform:translateX(-100%);animation:run 1.5s cubic-bezier(.65,0,.35,1) infinite}
.run b::after{content:"";position:absolute;right:0;top:0;width:28px;height:2px;border-radius:2px;background:var(--brand)}
@keyframes run{80%{transform:translateX(0);opacity:1}to{transform:translateX(0);opacity:0}}
.ok .run,.broken .run{opacity:0}
.ok .lit{opacity:1}
.ok .ws polygon{fill-opacity:1}
.broken .h1,.broken .h2{transform:scaleX(.8)}
.broken .ws{opacity:.45}
h1{font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-.01em;margin:0 0 8px;text-wrap:balance}
#p{margin:0;color:var(--muted);text-wrap:pretty}
.act{display:grid;justify-items:center;gap:6px;margin-top:24px;width:100%}
.cta{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 24px;border-radius:9999px;background:var(--brand);color:var(--brand-ink);font-weight:600;text-decoration:none}
.alt{margin:6px 0 0;font-size:14px;color:var(--muted)}
.alt a{color:var(--ink);font-weight:600;text-decoration:none;display:inline-block;padding:10px 4px}
.alt a:hover{text-decoration:underline}
details{width:100%;max-width:320px;font-size:14px;color:var(--muted)}
summary{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 12px;border-radius:9999px;cursor:pointer;list-style:none;color:var(--muted)}
summary::-webkit-details-marker{display:none}
summary:hover{background:var(--wash);color:var(--ink)}
summary svg{width:14px;height:14px;transition:transform .2s}
details[open] summary svg{transform:rotate(180deg)}
details ul{margin:8px 0 0;padding:14px 16px 14px 32px;text-align:left;border-top:1px solid var(--line)}
details li+li{margin-top:4px}
details p{margin:10px 0 0;text-align:left;padding-left:16px}
small{display:block;margin-top:16px;font-size:13px;color:var(--subtle);word-break:break-all}
a:focus-visible,summary:focus-visible{outline:2px solid var(--focus);outline-offset:3px}
html[data-motion="reduce"] main{animation:none}
html[data-motion="reduce"] .run b{animation:none;transform:translateX(-40%)}
html[data-motion="reduce"] *{transition:none!important}
@media (prefers-reduced-motion: reduce){main{animation:none}.run b{animation:none;transform:translateX(-40%)}*{transition:none!important}}
</style>`;

/** The handover picture. `state`: "" (bridging), "ok" or "broken". */
function handoverStage(state: "" | "ok" | "broken"): string {
	return `<div class="stage ${state}" id="s" aria-hidden="true">
<figure><img src="/images/wsa-mark.png" alt="" width="56" height="32"><figcaption>WorldStreet</figcaption></figure>
<div class="wire"><span class="half h1"></span><span class="half h2"></span><span class="lit"></span><span class="run"><b></b></span></div>
<figure><svg class="ws" viewBox="0 0 435.32 245.73"><polygon points="0,0 159.68,0 217.66,102.5 139.01,245.73"/><polygon points="435.32,0 275.64,0 217.66,102.5 296.32,245.73"/></svg><figcaption>WorldSpace</figcaption></figure>
</div>`;
}

function authPage(title: string, body: string): string {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#000000">
<title>${title} · WorldSpace</title>
${AUTH_PAGE_HEAD}
</head><body><main>
${body}
</main></body></html>`;
}

const CARET = `<svg viewBox="0 0 256 256" aria-hidden="true"><path d="M208 96l-80 80-80-80" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function handshakeLoopPage(req: NextRequest, retry: number): string {
	const again = publicUrl(req);
	again.searchParams.set("__ws_retry", String(retry + 1));
	const clean = publicUrl(req);
	clean.searchParams.delete("__ws_retry");
	const login = new URL(HUB_LOGIN_URL);
	login.searchParams.set("redirect_url", clean.href);
	const register = new URL(HUB_REGISTER_URL);
	register.searchParams.set("redirect_url", clean.href);
	const bridging = retry < 1 && !isLocalDev;
	const failHeading = "One more step";
	const failBody = `Sign in with your WorldStreet account and we'll take you straight to ${destinationWords(req.nextUrl.pathname)}.`;
	const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
	const bridge = bridging
		? `<script>
window.__wsBridge=function(){var C=window.Clerk;if(!C){return fail();}
C.load().then(function(){if(!C.session){return fail();}
return C.session.getToken().then(function(){document.getElementById("s").className="stage ok";location.replace(${JSON.stringify(again.href)});});
}).catch(fail);};
function fail(){if(window.__wsFailed)return;window.__wsFailed=1;
document.getElementById("s").className="stage broken";
document.getElementById("t").textContent=${JSON.stringify(failHeading)};
document.getElementById("p").textContent=${JSON.stringify(failBody)};
document.getElementById("a").hidden=false;}
setTimeout(function(){if(!window.Clerk||!window.Clerk.loaded)fail();},12000);
</script>
<script async crossorigin="anonymous" data-clerk-publishable-key="${escHtml(pk)}" src="${CLERK_JS_URL}" onload="window.__wsBridge()" onerror="fail()"></script>`
		: "";
	return authPage(
		bridging ? "Signing you in" : "Sign in",
		`${handoverStage(bridging ? "" : "broken")}
<div aria-live="polite">
<h1 id="t">${bridging ? "Signing you in" : failHeading}</h1>
<p id="p">${escHtml(bridging ? "Bringing your WorldStreet account over to WorldSpace." : failBody)}</p>
</div>
<div class="act" id="a"${bridging ? " hidden" : ""}>
<a class="cta" href="${escHtml(login.href)}">Continue with WorldStreet</a>
<p class="alt">New here? <a href="${escHtml(register.href)}">Create an account</a></p>
<details><summary>Why am I seeing this? ${CARET}</summary>
<ul><li>You're in a private or incognito window.</li><li>This browser blocks cookies for worldstreetgold.com.</li><li>You signed in to WorldStreet in a different browser or app.</li></ul>
<p>Signing in once fixes it for this browser.</p>
</details>
</div>
${bridge}`,
	);
}

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

const withClerk = clerkMiddleware(async (auth, req) => {
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

	// The cookie-less loop guard below rides a marker through the handshake;
	// once a session exists the marker has done its job. One redirect to the
	// clean URL, so it never lingers in the address bar or a shared link.
	if (
		userId &&
		(req.nextUrl.searchParams.has(HS_MARK) ||
			req.nextUrl.searchParams.has("__ws_retry"))
	) {
		const clean = publicUrl(req);
		clean.searchParams.delete(HS_MARK);
		clean.searchParams.delete("__ws_retry");
		return NextResponse.redirect(clean, 307);
	}

	if (isProtectedRoute(req)) {
		// `auth.protect()` sends a signed-out visitor to the hub's /login.
		// The handshake that copies a hub session onto this domain is NOT
		// done here: clerkMiddleware does it before this handler runs.
		//
		// `signInUrl` in the options below is what sends them to the hub's
		// /login instead of Clerk's hosted portal (the 2026-09-03 complaint).
		// Since 2026-09-29 this app is no longer a satellite (see there), and
		// breakSignInLoop in front of the middleware caps the sign-in trips,
		// so the two breakers below are a second line, kept as they are.
		//
		// One loop protect() cannot see (owner, 2026-09-11, "always unless I
		// hard reload"): on a production satellite every session-less
		// document request is a handshake, and Clerk counts them in the
		// `__clerk_redirect_count` cookie (Max-Age 2s). At 3 it stops
		// handshaking and reports the visitor signed out. protect() then
		// sends them to the hub's /login, which, when the hub DOES hold a
		// session, bounces straight back here, where the count is still 3,
		// so: signed out, hub, back, signed out... until Chrome gives up with
		// ERR_TOO_MANY_REDIRECTS on the hub's URL. Three failed handshakes in
		// two seconds means the sync itself is failing (the nonce fetch, or
		// the primary's client cookie), and the fix for THAT needs the reason
		// from the log line below. What this does is stop the ping-pong: drop
		// the counter, hold the visitor for one beat on a page of our own,
		// try the handshake once more, and only after a second failure offer
		// the hub's login as a link rather than a redirect.
		//
		// The second loop (owner 2026-09-16, "redirected too many times" on
		// www.worldstreetgold.com/login?redirect_url=social...): the hub
		// believes the visitor is signed in and bounces them back; here a
		// failed handshake has already written `__client_uat=0`, so the
		// satellite does not handshake again, reports them signed out and
		// sends them to the hub, which bounces them back... The counter above
		// never moves because no handshake runs, so that breaker cannot see
		// this one. What can: a signed-out document request whose referer is
		// the hub. A visitor the hub just sent back and we still cannot sign
		// in IS the ping-pong. Clear the shared `__client_uat` so the next hop
		// is a fresh handshake; if the hub's session is real it succeeds, and
		// if it is dead the hub finally shows its form instead of bouncing.
		const referer = req.headers.get("referer") ?? "";
		const fromHub = referer.startsWith(`${HUB_ORIGIN}/`);
		if (
			!userId &&
			!isSpeculative(req) &&
			(req.cookies.get("__clerk_redirect_count")?.value === "3" || fromHub)
		) {
			const retry = Number(req.nextUrl.searchParams.get("__ws_retry")) || 0;
			console.warn(
				fromHub
					? "[auth] hub bounced a signed-out visitor back"
					: "[auth] satellite handshake looped",
				{
					path: pathname,
					retry,
					referer,
					ua: req.headers.get("user-agent"),
					cookies: req.cookies.getAll().map((c) => c.name),
					uat: req.cookies.get("__client_uat")?.value ?? null,
				},
			);
			const res = new NextResponse(handshakeLoopPage(req, retry), {
				status: 200,
				headers: {
					"content-type": "text/html; charset=utf-8",
					"cache-control": "no-store",
				},
			});
			res.cookies.set("__clerk_redirect_count", "", { maxAge: 0, path: "/" });
			// The shared __client_uat is NOT cleared any more: it is the hub's
			// sign-in too, so clearing it signed the hub out and bounced the
			// person back and forth (2026-10-07). The bridge page does the
			// handover in the browser instead.
			return res;
		}
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
 * Build a redirect target that KEEPS the original query string — Next attaches
 * `_rsc` to client navigations, and a redirect that drops it returns a payload
 * the router rejects, falling back to a hard navigation.
 */
function redirectTarget(path: string, req: NextRequest): URL {
	const url = publicUrl(req, path);
	const from = req.nextUrl;
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
	// NOT a satellite (owner 2026-09-29, the loop again). Clerk runs a
	// production satellite's handshake on EVERY document request, even with a
	// valid session (@clerk/backend authenticateRequestWithTokenInCookie:
	// `isSatellite && secFetchDest === "document"` -> SatelliteCookieNeeds
	// Syncing): two extra redirects plus a server call to Clerk's API on each
	// page load, and when that call fails or is slow Clerk simply handshakes
	// again, braked only by a counter cookie that lives 2 seconds. On a slow
	// connection three round trips outlast it and Chrome gives up with
	// ERR_TOO_MANY_REDIRECTS. Satellites are for OTHER domains; this app is a
	// subdomain of the hub's, so it already shares __client_uat and the
	// Frontend API (clerk.worldstreetgold.com). As a plain app the handshake
	// runs once, when there is no session here yet. signInUrl/signUpUrl keep
	// signed-out people on the hub's own pages (the 2026-09-03 complaint was
	// about Clerk's hosted portal, which these alone prevent).
	isLocalDev
		? {}
		: {
				signInUrl: HUB_LOGIN_URL,
				signUpUrl: HUB_REGISTER_URL,
			},
);

const HS_MARK = "__ws_hs";

/**
 * The loop clerkMiddleware cannot stop (production, 2026-09-16, "some users
 * are told redirected too many times"): on a satellite, every session-less
 * document request is answered with a redirect to the primary's handshake,
 * which hands the token back IN A COOKIE (format=nonce) and returns the
 * visitor to the same URL. A browser that is not keeping cookies (an in-app
 * browser, cookies switched off, a locked-down private mode) comes back
 * exactly as it left, so it is sent to the handshake again, forever. Both
 * existing breakers, Clerk's `__clerk_redirect_count` and our page above,
 * are cookies too, so they never fire for exactly the visitor who needs
 * them, and the browser gives up with ERR_TOO_MANY_REDIRECTS. Reproduced
 * with curl by discarding cookies: 10 hops and counting.
 *
 * clerkMiddleware issues the handshake redirect BEFORE the handler runs, so
 * the guard has to sit in front of it. It is cookie-free by construction: a
 * document request with no Cookie header at all and no marker gets one
 * self-redirect that adds `__ws_hs=1`, which Clerk then carries inside the
 * handshake's redirect_url. When the return arrives with the marker and
 * still not a single cookie, this browser is not keeping any, and we say
 * so on a page of our own instead of redirecting again. A browser that
 * keeps cookies always returns with at least `__clerk_redirect_count`, so
 * it never sees the page. Signed-in visitors have the marker stripped in
 * the handler.
 */
export default async function proxy(req: NextRequest, evt: NextFetchEvent) {
	const dest = req.headers.get("sec-fetch-dest");
	const isDocument =
		req.method === "GET" &&
		!isSpeculative(req) &&
		(dest === "document" ||
			(dest === null && (req.headers.get("accept") ?? "").includes("text/html")));
	const noCookies = !req.headers.get("cookie");
	if (isDocument && noCookies && !isLocalDev) {
		const marked = req.nextUrl.searchParams.get(HS_MARK) === "1";
		if (marked) {
			console.warn("[auth] handshake returned with no cookies at all", {
				path: req.nextUrl.pathname,
				ua: req.headers.get("user-agent"),
				referer: req.headers.get("referer"),
			});
			return new NextResponse(cookiesOffPage(req), {
				status: 200,
				headers: {
					"content-type": "text/html; charset=utf-8",
					"cache-control": "no-store",
				},
			});
		}
		const marker = publicUrl(req);
		marker.searchParams.set(HS_MARK, "1");
		const res = NextResponse.redirect(marker, 307);
		// The probe. Without it a first-time visitor whose browser keeps
		// cookies perfectly well ALSO arrives at the marked URL with none,
		// because nothing has set one yet, and was shown the cookies-off page
		// (shipped 19:47 on 2026-09-19, caught by the post-deploy trace and
		// fixed the same hour). With it, "marker and still no cookies" means
		// exactly what the page says.
		res.cookies.set("ws_ck", "1", {
			path: "/",
			maxAge: 600,
			sameSite: "lax",
			secure: true,
		});
		return res;
	}
	const result = await withClerk(req, evt);
	if (!isDocument || isLocalDev || !(result instanceof Response)) return result;
	return breakSignInLoop(req, result);
}

/**
 * The breaker nothing can outrun (owner 2026-09-29: "why is this showing,
 * why are we going back and forth with this").
 *
 * Every earlier guard was either Clerk's `__clerk_redirect_count`, which
 * lives 2 seconds (a slow connection's round trips outlast it, so it never
 * reaches its limit), or keyed on the hub being the Referer, which a
 * browser does not send when the hub bounces with a server redirect. This
 * one counts the sign-in trips themselves: every redirect this app sends a
 * page load on to Clerk's handshake or to the hub's login bumps a counter
 * that lives a minute, and any page that actually renders clears it. Past
 * MAX_AUTH_HOPS in that minute the visitor gets a page with a way out
 * instead of another redirect, so the browser can never reach its own
 * limit of 20 and show "redirected you too many times".
 */
const AUTH_HOPS = "ws_auth_hops";
const MAX_AUTH_HOPS = 4;
const CLERK_FAPI_HOST = "clerk.worldstreetgold.com";

function isSignInTrip(location: string): boolean {
	try {
		const url = new URL(location, PUBLIC_ORIGIN);
		return (
			url.host === CLERK_FAPI_HOST ||
			(url.origin === HUB_ORIGIN &&
				(url.pathname === "/login" || url.pathname === "/register"))
		);
	} catch {
		return false;
	}
}

function breakSignInLoop(req: NextRequest, res: Response): Response {
	const hops = Number(req.cookies.get(AUTH_HOPS)?.value) || 0;
	const location = res.headers.get("location");
	if (!location || !isSignInTrip(location)) {
		// A page rendered (or an in-app redirect): the trip is over.
		if (hops > 0) {
			res.headers.append(
				"Set-Cookie",
				`${AUTH_HOPS}=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly`,
			);
		}
		return res;
	}
	if (hops >= MAX_AUTH_HOPS) {
		console.warn("[auth] sign-in redirect loop broken", {
			path: req.nextUrl.pathname,
			hops,
			to: location.split("?")[0],
			ua: req.headers.get("user-agent"),
			cookies: req.cookies.getAll().map((c) => c.name),
			uat: req.cookies.get("__client_uat")?.value ?? null,
		});
		// One browser-side attempt (the bridge), then the link.
		const retry = Number(req.nextUrl.searchParams.get("__ws_retry")) || 0;
		const page = new NextResponse(handshakeLoopPage(req, retry), {
			status: 200,
			headers: {
				"content-type": "text/html; charset=utf-8",
				"cache-control": "no-store",
			},
		});
		// Cleared, so the page's own "Sign in" link gets a fresh set of
		// trips; if those fail too, this page again, never a loop.
		page.cookies.set(AUTH_HOPS, "", { maxAge: 0, path: "/" });
		return page;
	}
	res.headers.append(
		"Set-Cookie",
		`${AUTH_HOPS}=${hops + 1}; Path=/; Max-Age=60; SameSite=Lax; Secure; HttpOnly`,
	);
	return res;
}

/** The page for a browser that keeps no cookies: no redirect, a way out. */
function cookiesOffPage(req: NextRequest): string {
	const clean = publicUrl(req);
	clean.searchParams.delete(HS_MARK);
	return authPage(
		"Open in your browser",
		`${handoverStage("broken")}
<h1 id="t">Open this in your browser</h1>
<p id="p">WorldSpace needs cookies to keep you signed in, and this browser isn't saving them. If you opened this link inside another app, use its menu to open the page in Safari or Chrome.</p>
<div class="act">
<a class="cta" href="${escHtml(clean.href)}">Try again</a>
<small>${escHtml(clean.href)}</small>
</div>`,
	);
}

export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		// .well-known is public by construction: Apple and Google fetch the
		// app-link files anonymously, and a Clerk redirect there breaks
		// universal links for the WorldSpace app.
		"/((?!_next|\\.well-known|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};
