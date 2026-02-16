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

import { Space_Mono } from "next/font/google";

const spaceMono = Space_Mono({
	subsets: ["latin"],
	weight: ["400", "700"],
	variable: "--font-space-mono",
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
				<body className={`${spaceMono.variable} antialiased`}>
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
