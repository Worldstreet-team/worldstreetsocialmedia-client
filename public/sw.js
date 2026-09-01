/**
 * WorldSpace service worker — hand-rolled on purpose (the PWA build plugins
 * assume webpack; this repo builds with Turbopack).
 *
 * Scope is deliberately narrow:
 *   - /_next/static and /icons: cache-first. Content-hashed, immutable —
 *     this is what makes a warm open paint instantly.
 *   - media (R2, avatars, /_next/image, /images): stale-while-revalidate
 *     with an LRU cap, so faces stop re-downloading on every scroll.
 *   - HTML, RSC payloads, server actions, gateway API: NEVER touched. They
 *     are authed and personal, and DeploymentSkewRecovery depends on fresh
 *     action ids — a cached RSC body would fight it.
 *   - navigations only get a fallback when the network itself fails: the
 *     branded offline page.
 */
const VERSION = "ws-v1";
const STATIC_CACHE = `${VERSION}-static`;
const MEDIA_CACHE = `${VERSION}-media`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/images/worldspace-mark.png"];
const MEDIA_HOSTS = new Set([
	"pub-d4a7c1ef37d040829c8bb6d8b855705b.r2.dev",
	"img.clerk.com",
	"lh3.googleusercontent.com",
	"api.dicebear.com",
	"image2url.com",
]);
const MEDIA_MAX_ENTRIES = 260;
const STATIC_MAX_ENTRIES = 400;

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(STATIC_CACHE)
			.then((c) => c.addAll(PRECACHE))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const names = await caches.keys();
			await Promise.all(
				names
					.filter((n) => n.startsWith("ws-") && !n.startsWith(VERSION))
					.map((n) => caches.delete(n)),
			);
			await self.clients.claim();
		})(),
	);
});

async function trim(cacheName, max) {
	const cache = await caches.open(cacheName);
	const keys = await cache.keys();
	if (keys.length <= max) return;
	// Oldest first: Cache keys iterate in insertion order.
	await Promise.all(
		keys.slice(0, keys.length - max).map((k) => cache.delete(k)),
	);
}

async function cacheFirst(request) {
	const cache = await caches.open(STATIC_CACHE);
	const hit = await cache.match(request);
	if (hit) return hit;
	const res = await fetch(request);
	if (res && res.ok) {
		cache.put(request, res.clone());
		trim(STATIC_CACHE, STATIC_MAX_ENTRIES);
	}
	return res;
}

async function staleWhileRevalidate(request) {
	const cache = await caches.open(MEDIA_CACHE);
	const hit = await cache.match(request);
	const refresh = fetch(request)
		.then((res) => {
			// Opaque responses (no-cors <img>) are cacheable and worth keeping.
			if (res && (res.ok || res.type === "opaque")) {
				cache.put(request, res.clone());
				trim(MEDIA_CACHE, MEDIA_MAX_ENTRIES);
			}
			return res;
		})
		.catch(() => undefined);
	return hit || (await refresh) || Response.error();
}

self.addEventListener("fetch", (event) => {
	const request = event.request;
	if (request.method !== "GET") return;
	// The Cache API mangles Range responses — video seeking goes straight out.
	if (request.headers.has("range")) return;

	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request).catch(() => caches.match(OFFLINE_URL)),
		);
		return;
	}

	const url = new URL(request.url);
	const sameOrigin = url.origin === self.location.origin;

	if (
		sameOrigin &&
		(url.pathname.startsWith("/_next/static/") ||
			url.pathname.startsWith("/icons/"))
	) {
		event.respondWith(cacheFirst(request));
		return;
	}

	if (
		MEDIA_HOSTS.has(url.hostname) ||
		(sameOrigin &&
			(url.pathname.startsWith("/_next/image") ||
				url.pathname.startsWith("/images/")))
	) {
		event.respondWith(staleWhileRevalidate(request));
		return;
	}
	// Everything else — HTML, RSC, actions, the gateway — is untouched.
});
