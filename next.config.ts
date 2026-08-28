import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	experimental: {
		serverActions: {
			bodySizeLimit: "20mb",
		},
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
