import type { Metadata } from "next";
import {
	ClerkProvider,
	// SignInButton,
	// SignUpButton,
	// SignedOut,
} from "@clerk/nextjs";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/Toast/ToastContext";
import NextTopLoader from "nextjs-toploader";
import JotaiHydrator from "./JotaiHydrator";
import { headers } from "next/headers";
import RealtimeProvider from "@/components/providers/RealtimeProvider";
import { CallProvider } from "@/providers/CallProvider";

const googleSans = localFont({
	src: [
		{
			path: "../assets/fonts/google-sans/GoogleSansFlex_24pt-Thin.ttf",
			weight: "100",
			style: "normal",
		},
		{
			path: "../assets/fonts/google-sans/GoogleSansFlex_24pt-ExtraLight.ttf",
			weight: "200",
			style: "normal",
		},
		{
			path: "../assets/fonts/google-sans/GoogleSansFlex_24pt-Light.ttf",
			weight: "300",
			style: "normal",
		},
		{
			path: "../assets/fonts/google-sans/GoogleSansFlex_24pt-Regular.ttf",
			weight: "400",
			style: "normal",
		},
		{
			path: "../assets/fonts/google-sans/GoogleSansFlex_24pt-Medium.ttf",
			weight: "500",
			style: "normal",
		},
		{
			path: "../assets/fonts/google-sans/GoogleSansFlex_24pt-SemiBold.ttf",
			weight: "600",
			style: "normal",
		},
		{
			path: "../assets/fonts/google-sans/GoogleSansFlex_24pt-Bold.ttf",
			weight: "700",
			style: "normal",
		},
		{
			path: "../assets/fonts/google-sans/GoogleSansFlex_24pt-ExtraBold.ttf",
			weight: "800",
			style: "normal",
		},
		{
			path: "../assets/fonts/google-sans/GoogleSansFlex_24pt-Black.ttf",
			weight: "900",
			style: "normal",
		},
	],
	variable: "--font-google-sans",
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

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
				<body
					className={`${googleSans.variable} ${geistMono.variable} antialiased`}
				>
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
									<ToastProvider>{children}</ToastProvider>
								</CallProvider>
							</RealtimeProvider>
						</JotaiHydrator>
					</ThemeProvider>
				</body>
			</html>
		</ClerkProvider>
	);
}
