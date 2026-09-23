import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// The WorldSpace app's universal links. Apple fetches the AASA with no
	// extension and wants JSON back; Next would otherwise serve it as an
	// octet stream. Both files carry placeholders (TEAMID, the Android
	// signing cert) until the first EAS build mints the credentials.
	async headers() {
		return [
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
