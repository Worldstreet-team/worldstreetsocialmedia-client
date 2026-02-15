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
		],
	},
};

export default nextConfig;
