import type { Metadata } from "next";
import {
	ClerkProvider,
	// SignInButton,
	// SignUpButton,
	// SignedOut,
} from "@clerk/nextjs";
import { Geist, Geist_Mono, Space_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/Toast/ToastContext";
import NextTopLoader from "nextjs-toploader";
import JotaiHydrator from "./JotaiHydrator";
import { headers } from "next/headers";
import RealtimeProvider from "@/components/providers/RealtimeProvider";
import { CallProvider } from "@/providers/CallProvider";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const spaceMono = Space_Mono({
	variable: "--font-space-mono",
	subsets: ["latin"],
	weight: ["400", "700"],
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
		<ClerkProvider>
			<html lang="en" suppressHydrationWarning>
				<body
					className={`${geistSans.variable} ${geistMono.variable} ${spaceMono.variable} antialiased`}
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
