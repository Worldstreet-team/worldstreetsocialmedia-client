import type { Metadata, Viewport } from "next";
import {
	ClerkProvider,
	// SignInButton,
	// SignUpButton,
	// SignedOut,
} from "@clerk/nextjs";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/Toast/ToastContext";
import NextTopLoader from "nextjs-toploader";
import JotaiHydrator from "./JotaiHydrator";
import { headers } from "next/headers";
import RealtimeProvider from "@/components/providers/RealtimeProvider";
import { CallProvider } from "@/providers/CallProvider";
import { MobileBottomNav } from "@/components/MobileBottomNav";

import localFont from "next/font/local";

const satoshi = localFont({
	src: [
		{ path: "../assets/fonts/satoshi/Satoshi-Light.otf", weight: "300" },
		{ path: "../assets/fonts/satoshi/Satoshi-Regular.otf", weight: "400" },
		{ path: "../assets/fonts/satoshi/Satoshi-Medium.otf", weight: "500" },
		{ path: "../assets/fonts/satoshi/Satoshi-Bold.otf", weight: "700" },
		{ path: "../assets/fonts/satoshi/Satoshi-Black.otf", weight: "900" },
	],
	variable: "--font-satoshi",
});

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
};

export const metadata: Metadata = {
	title: "WorldStreet - Social Media",
	description: "This is world street media platform",
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const headersList = await headers(); // ✅ now valid
	const userData = headersList.get("x-user-data");

	const parsedUser = userData ? JSON.parse(userData) : null;

	return (
		<ClerkProvider
			appearance={{
				captcha: {
					theme: "dark",
					size: "flexible",
				},
			}}
		>
			<html lang="en" suppressHydrationWarning>
				<body className={`${satoshi.variable} antialiased`}>
					<NextTopLoader />

					<ThemeProvider
						attribute="class"
						defaultTheme="system"
						enableSystem
						disableTransitionOnChange
					>
						<JotaiHydrator user={parsedUser}>
							<RealtimeProvider>
								<CallProvider>
									<ToastProvider>
										{children}
										<MobileBottomNav />
									</ToastProvider>
								</CallProvider>
							</RealtimeProvider>
						</JotaiHydrator>
					</ThemeProvider>
				</body>
			</html>
		</ClerkProvider>
	);
}
