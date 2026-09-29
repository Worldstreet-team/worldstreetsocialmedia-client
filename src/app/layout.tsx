import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import {
    ClerkProvider,
    // SignInButton,
    // SignUpButton,
    // SignedOut,
} from "@clerk/nextjs";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { PreferencesProvider } from "@/components/providers/PreferencesProvider";
import { PREPAINT_PREFS } from "@/lib/preferences-prepaint";
import { ToastProvider } from "@/components/ui/Toast/ToastContext";
import NextTopLoader from "nextjs-toploader";
import JotaiHydrator from "./JotaiHydrator";
import { DeferredChrome } from "@/components/providers/DeferredChrome";
import { LocaleProvider } from "@/i18n/client";
import { LOCALE_HEADER, isLocale } from "@/i18n/config";
import { headers } from "next/headers";
import RealtimeProvider from "@/components/providers/RealtimeProvider";
import AnalyticsProvider from "@/components/providers/AnalyticsProvider";
import { CallProvider } from "@/providers/CallProvider";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import GlobalMessageListener from "@/components/providers/GlobalMessageListener";
import { MediaGuard } from "@/components/providers/MediaGuard";
import { PresenceSync } from "@/components/providers/PresenceSync";
import { PremiumSheet } from "@/components/premium/PremiumSheet";
import { ComposeSheet } from "@/components/ui/ComposeSheet";
import { CreateFab } from "@/components/ui/CreateFab";
import VoiceRoomHost from "@/components/voice/VoiceRoomHost";
import { LiveDock } from "@/components/live/LiveDock";
import { NotificationCountSync } from "@/components/providers/NotificationCountSync";
import { PwaSync } from "@/components/providers/PwaSync";
import { ThemeColorSync } from "@/components/providers/ThemeColorSync";
import { NavHistoryTracker } from "@/lib/nav";
import { DeploymentSkewRecovery } from "@/components/providers/DeploymentSkewRecovery";
import { HistorySpy } from "@/components/providers/HistorySpy";
import { SpacesLiveSync } from "@/components/providers/SpacesLiveSync";
import { MessageCountSync } from "@/components/providers/MessageCountSync";
import { BmCountSync } from "@/components/providers/BmCountSync";
import { EngagementSync } from "@/components/providers/EngagementSync";

import {
    Instrument_Sans,
    Instrument_Serif,
    JetBrains_Mono,
    Poppins,
    Public_Sans,
} from "next/font/google";

// Design system type pairing for platform apps: Poppins for display, Public
// Sans for UI. These feed --ws-font-display / --ws-font-ui in ws-tokens.css.
// Weights per design-system/02-typography.md:
// Poppins 600/700/800 (Display/H2, H1, Display) · Public Sans 400/500/600/700.
const publicSans = Public_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-public-sans",
});

// The app's reading face (owner 2026-09-22). It was named nowhere and
// shipped nowhere: the UI token fell through to Public Sans, and on a phone
// where that failed to apply people saw their handset's own font. Loaded
// through next/font so the files are SELF-HOSTED with the build, which is
// what makes it the same face on every device instead of "whatever the
// phone has". A variable font, so one file covers 400 to 700.
const instrumentSans = Instrument_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-instrument-sans",
    display: "swap",
});

const poppins = Poppins({
    subsets: ["latin"],
    weight: ["600", "700", "800"],
    variable: "--font-poppins",
});

// The editorial voice. It is a story face, but the feed's stories rail
// draws it too (the text lane's "Aa" in StoryCreateSheet), so it stays here.
// The poster, condensed and script faces load with the Story Studio instead
// (components/story/story-fonts.ts, audit 2026-09-25): they were on every
// page for a picker almost nobody opens.
const instrumentSerif = Instrument_Serif({
    subsets: ["latin"],
    weight: ["400"],
    style: ["normal", "italic"],
    variable: "--font-instrument-serif",
});

// A real ticker face. The mono voice used to fall back to the system stack,
// which meant the canvas export and the DOM preview could resolve different
// fonts on different machines. It is also `font-mono` in app chrome (trend
// ranks, the countdown, the stream key), so it stays in the layout.
const jetbrainsMono = JetBrains_Mono({
    subsets: ["latin"],
    weight: ["700"],
    variable: "--font-jetbrains-mono",
});

// Never block pinch-zoom (06-motion-accessibility bans `user-scalable=no`).
// maximumScale/userScalable are deliberately absent — do not reintroduce them.
export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    // Browser chrome (mobile address bar, PWA title bar) matches the page.
    themeColor: "#000000",
    // The on-screen keyboard RESIZES the layout viewport instead of floating
    // over it. Without this, a chat composer pinned to 100dvh sits underneath
    // the keyboard on Android — you type into a field you cannot see.
    interactiveWidget: "resizes-content",
};

/** Local dev runs on a pk_test_ key; prod is the hub satellite. */
const isLocalDev =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_");

/**
 * The hub's own sign-in and sign-up pages, declared in CODE. Without them
 * the provider builds sign-in links to Clerk's hosted `*.accounts.dev`
 * portal, a domain that is not ours (owner 2026-09-03).
 *
 * NOT a satellite since 2026-09-29 (see the clerkMiddleware options in
 * proxy.ts): this app is a subdomain of the hub's domain and shares its
 * session through the Frontend API directly; satellite mode made every
 * page load a round trip through Clerk and was the redirect loop.
 *
 * Cast because Clerk types `domain`/`isSatellite`/`proxyUrl` as a
 * discriminated union that a conditional spread cannot narrow.
 */
const satelliteProps = (
    isLocalDev
        ? {}
        : {
              signInUrl: "https://www.worldstreetgold.com/login",
              signUpUrl: "https://www.worldstreetgold.com/register",
              signInFallbackRedirectUrl: "https://social.worldstreetgold.com/",
              signUpFallbackRedirectUrl:
                  "https://social.worldstreetgold.com/onboarding",
          }
) as React.ComponentProps<typeof ClerkProvider>;

export const metadata: Metadata = {
    title: {
        default: "WorldSpace",
        template: "%s · WorldSpace",
    },
    description:
 "WorldSpace share ideas, follow traders and creators, and talk markets across the WorldStreet ecosystem.",
    manifest: "/manifest.webmanifest",
    icons: {
        icon: [
            { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
        apple: "/icons/apple-touch-icon.png",
    },
    // Installed-mode identity on iOS: its own window, dark status bar area,
    // the app's name under the icon.
    appleWebApp: {
        capable: true,
        title: "WorldSpace",
        statusBarStyle: "black-translucent",
    },
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const headersList = await headers();
    const userData = headersList.get("x-user-data");

    // A malformed header must not take the whole app down. This parse used to
    // throw straight through the root layout — an unrecoverable server error,
    // which is what the "Something went wrong" screen with a digest was.
    // Degrading to null costs one client-side profile fetch; throwing costs
    // the entire page.
    let parsedUser: unknown = null;
    if (userData) {
        try {
            parsedUser = JSON.parse(userData);
        } catch (error) {
            console.error("Malformed x-user-data header, ignoring:", error);
        }
    }

    const headerLocale = headersList.get(LOCALE_HEADER);
    const locale = isLocale(headerLocale) ? headerLocale : "en";

    return (
        <ClerkProvider
            // Satellite of the worldstreetgold.com hub, declared in CODE the
            // way the dashboard, academy and arcade declare it. Without this
            // the provider builds sign-in links to Clerk's hosted
            // `*.accounts.dev` portal instead of the hub's own login page.
            {...satelliteProps}
            appearance={{
                captcha: {
                    theme: "dark",
                    size: "flexible",
                },
            }}
        >
            {/* The next/font variables live on <html>, NOT <body> (found
                2026-09-22). The font TOKENS (--ws-font-ui, --ws-font-display)
                are declared on [data-ws-theme], which is this element, and a
                custom property is resolved where it is declared: with the
                variables one level down on <body>, every var(--font-*) inside
                the tokens was undefined, the tokens computed to nothing, and
                the whole app rendered in the device's own system font. That
                is San Francisco on a Mac, which hid it, and whatever the
                handset ships on a phone, which did not. */}
            <html
                lang={locale}
                data-ws-theme="platform"
                suppressHydrationWarning
                className={`${instrumentSans.variable} ${publicSans.variable} ${poppins.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
            >
                <body
                    className={`antialiased`}
                >
                    {/* The intro cascade plays once per browser session.
                        Inline + synchronous so the ws-intro-done stamp lands
                        before first paint — a useEffect would flash one frame
                        of replayed animation on every load. After the first
                        visit's intro finishes (1.6s), the flag is set and the
                        class applied live, so later navigations and reloads
                        render settled (globals.css: html.ws-intro-done). */}
                    <script
                        dangerouslySetInnerHTML={{
                            __html: PREPAINT_PREFS + `try{var k="ws-intro-played",h=document.documentElement;if(sessionStorage.getItem(k)){h.classList.add("ws-intro-done")}else{setTimeout(function(){try{sessionStorage.setItem(k,"1")}catch(e){}h.classList.add("ws-intro-done")},1600)}}catch(e){}`,
                        }}
                    />
                    {/* Keyboard users jump the nav rails straight to the timeline. */}
                    <a
                        href="#main-content"
                        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-toast focus:rounded-pill focus:bg-surface focus:border focus:border-hairline focus:px-4 focus:py-2 focus:font-sans focus:text-[calc(13px*var(--ws-fs))] focus:text-primary"
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
                        <LocaleProvider locale={locale}>
                        <JotaiHydrator user={parsedUser}>
                            <RealtimeProvider>
                                <PreferencesProvider>
                                <CallProvider>
                                    <ToastProvider>
                                    <Suspense fallback={null}>
                                      <AnalyticsProvider />
                                    </Suspense>
                                        <GlobalMessageListener />
                                        <NotificationCountSync />
                                        <PwaSync />
                                        <ThemeColorSync />
                                        <NavHistoryTracker />
                                        <DeploymentSkewRecovery />
                                        {process.env.NODE_ENV !== "production" && <HistorySpy />}
                                        <SpacesLiveSync />
										<MessageCountSync />
										<BmCountSync />
										<EngagementSync />
                                        {/* palette, search, tour: own chunks,
                                            loaded after hydration — see
                                            DeferredChrome for the reasoning */}
                                        <DeferredChrome />
                                        <MediaGuard />
                                        <PresenceSync />
                                        <PremiumSheet />
                                        <ComposeSheet />
                                        <CreateFab />
                                        <LiveDock />
                                        <VoiceRoomHost />
                                        {children}
                                        <MobileBottomNav />
                                    </ToastProvider>
                                </CallProvider>
                                </PreferencesProvider>
                            </RealtimeProvider>
                        </JotaiHydrator>
                        </LocaleProvider>
                    </ThemeProvider>
                </body>
            </html>
        </ClerkProvider>
    );
}
