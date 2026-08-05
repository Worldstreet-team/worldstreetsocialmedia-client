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
import GlobalMessageListener from "@/components/providers/GlobalMessageListener";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { WelcomeTour } from "@/components/ui/WelcomeTour";
import { NotificationCountSync } from "@/components/providers/NotificationCountSync";

import { Poppins, Public_Sans } from "next/font/google";

// Design system type pairing for platform apps: Poppins for display, Public
// Sans for UI. These feed --ws-font-display / --ws-font-ui in ws-tokens.css.
// Weights per design-system/02-typography.md:
// Poppins 600/700/800 (Display/H2, H1, Display) · Public Sans 400/500/600/700.
const publicSans = Public_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-public-sans",
});

const poppins = Poppins({
    subsets: ["latin"],
    weight: ["600", "700", "800"],
    variable: "--font-poppins",
});

// Never block pinch-zoom (06-motion-accessibility bans `user-scalable=no`).
// maximumScale/userScalable are deliberately absent — do not reintroduce them.
export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    // Browser chrome (mobile address bar, PWA title bar) matches the page.
    themeColor: "#0C0A09",
};

export const metadata: Metadata = {
    title: {
        default: "WorldStreet Social",
        template: "%s · WorldStreet Social",
    },
    description:
        "WorldStreet Social — share ideas, follow traders and creators, and talk markets across the WorldStreet ecosystem.",
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const headersList = await headers();
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
            <html lang="en" data-ws-theme="platform" suppressHydrationWarning>
                <body
                    className={`${publicSans.variable} ${poppins.variable} antialiased`}
                >
                    {/* Keyboard users jump the nav rails straight to the timeline. */}
                    <a
                        href="#main-content"
                        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-toast focus:rounded-pill focus:bg-surface focus:border focus:border-hairline focus:px-4 focus:py-2 focus:font-sans focus:text-[13px] focus:text-primary"
                    >
                        Skip to content
                    </a>
                    {/* Route-progress bar in brand gold (default blue is
                        off-palette). var() so a theme switch re-resolves it. */}
                <NextTopLoader
                    color="var(--ws-brand-primary)"
                    height={2}
                    showSpinner={false}
                />

                    {/* Platform theme is dark-first; light is an explicit opt-in
                        via the sidebar toggle. next-themes drives data-ws-theme
                        directly ("dark" -> platform, "light" -> the canonical
                        platform-light block in ws-tokens.css). */}
                    <ThemeProvider
                        attribute="data-ws-theme"
                        defaultTheme="dark"
                        enableSystem={false}
                        value={{ dark: "platform", light: "platform-light" }}
                    >
                        <JotaiHydrator user={parsedUser}>
                            <RealtimeProvider>
                                <CallProvider>
                                    <ToastProvider>
                                        <GlobalMessageListener />
                                        <NotificationCountSync />
                                        <CommandPalette />
                                        <WelcomeTour />
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
