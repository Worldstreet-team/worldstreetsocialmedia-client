import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// The WorldSpace app's universal links. Apple fetches the AASA with no
	// extension and wants JSON back; Next would otherwise serve it as an
	// octet stream. assetlinks carries the EAS preview keystore's SHA-256
	// (2026-09-23); the AASA still says TEAMID until the first device build
	// mints the Apple credentials.
	//
	// Cache tiers for public/ (audit 2026-09-25: only _next/static was
	// immutable, every other static file shipped max-age=0 and was
	// re-validated on every open):
	//   - /wallpapers: a year, immutable. A wallpaper's name never changes;
	//     a new picture is a new file.
	//   - /images and /icons: a week, then a month of stale-while-revalidate,
	//     because an asset here can be replaced under the same name (the
	//     doodle mask, the feature collages) and a week is the longest we
	//     want a stale one to live.
	//   - /manifest.webmanifest: an hour, like the .well-known files.
	//   - /sw.js and /offline.html are deliberately NOT listed: the browser
	//     must re-check the worker on every load, or a kill switch (see the
	//     header of public/sw.js) could never land.
	// HSTS rides every response. Gzip on images is not set here: the
	// origin's compression is Traefik on the box and Next's own compress.
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{
						key: "Strict-Transport-Security",
						value: "max-age=31536000; includeSubDomains",
					},
				],
			},
			{
				source: "/wallpapers/:path*",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=31536000, immutable",
					},
				],
			},
			{
				source: "/images/:path*",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=604800, stale-while-revalidate=2592000",
					},
				],
			},
			{
				source: "/icons/:path*",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=604800, stale-while-revalidate=2592000",
					},
				],
			},
			{
				source: "/manifest.webmanifest",
				headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
			},
			{
				source: "/.well-known/apple-app-site-association",
				headers: [
					{ key: "Content-Type", value: "application/json" },
					{ key: "Cache-Control", value: "public, max-age=3600" },
				],
			},
			{
				source: "/.well-known/assetlinks.json",
				headers: [
					{ key: "Content-Type", value: "application/json" },
					{ key: "Cache-Control", value: "public, max-age=3600" },
				],
			},
		];
	},
	experimental: {
		serverActions: {
			bodySizeLimit: "20mb",
		},
		// Every route is dynamic (proxy.ts matches everything), and Next 16's
		// default of 0 makes the router cache reuse NOTHING: each navigation
		// re-renders RSC on the server. Five minutes of reuse makes tab hops
		// paint in one frame. The RSC payload here is chrome; everything the
		// reader actually watches (posts, counts, presence) arrives through
		// client fetches with their own freshness, so a reused page render is
		// not stale data, it is a stale frame around live data.
		staleTimes: { dynamic: 300 },
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "pub-d4a7c1ef37d040829c8bb6d8b855705b.r2.dev",
				pathname: "**",
			},
			{
				// Our own origin. Brand accounts point their avatar at a static
				// asset here rather than at an uploaded R2 blob, and the URL is
				// absolute — not relative — so the native clients resolve it too.
				// Without this entry next/image REJECTS the host and the whole
				// profile route falls into the error boundary.
				protocol: "https",
				hostname: "social.worldstreetgold.com",
				pathname: "**",
			},
			{
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
				pathname: "**",
			},
			{
				protocol: "https",
				hostname: "img.clerk.com",
				pathname: "**",
			},
			{
				protocol: "https",
				hostname: "api.dicebear.com",
				pathname: "**",
			},
			{
				protocol: "https",
				hostname: "image2url.com",
				pathname: "**",
			},
		],
	},
};

export default nextConfig;
