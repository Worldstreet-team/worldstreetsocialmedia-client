import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import NextTopLoader from "nextjs-toploader";

const sfPro = localFont({
	src: [
		{
			path: "../../public/fonts/san-francisco/sfregular.otf",
			weight: "400",
			style: "normal",
		},
		{
			path: "../../public/fonts/san-francisco/sfbold.otf",
			weight: "700",
			style: "normal",
		},
		{
			path: "../../public/fonts/san-francisco/sflight.otf",
			weight: "300",
			style: "normal",
		},
	],
	variable: "--font-sf",
});

const cuturila = localFont({
	src: "../assets/fonts/cuturila/cuturilla.ttf",
	variable: "--font-cuturila",
});

export const metadata: Metadata = {
	title: "WorldStreet - Social Media",
	description: "This is world street media platform",
};

import { Suspense } from "react";
import { TokenVerifier } from "@/components/auth/TokenVerifier";
import { GlobalLoader } from "@/components/ui/GlobalLoader";
import { Providers } from "@/components/providers/Providers";

import { headers } from "next/headers";

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const headersList = await headers();
	const userDataStr = headersList.get("x-user-data");
	let initialUser = null;

	if (userDataStr) {
		try {
			initialUser = JSON.parse(userDataStr);
		} catch (e) {
			console.error("Layout: Failed to parse user data", e);
		}
	}

	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<link
					rel="stylesheet"
					href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
				/>
			</head>
			{/* ADD suppressHydrationWarning HERE */}
			<body
				className={`${sfPro.variable} ${cuturila.variable} antialiased font-sans`}
				suppressHydrationWarning
			>
				<NextTopLoader />
				<Suspense fallback={<GlobalLoader />}>
					<TokenVerifier initialUser={initialUser} />
				</Suspense>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
