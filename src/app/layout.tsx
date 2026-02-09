import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

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

export const metadata: Metadata = {
    title: "World Street - Social Media",
    description: "This is world street media platform",
};

import { Suspense } from "react";
import { TokenVerifier } from "@/components/auth/TokenVerifier";
import { GlobalLoader } from "@/components/ui/GlobalLoader";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
            </head>
            {/* ADD suppressHydrationWarning HERE */}
            <body className={`${sfPro.variable} antialiased font-sans`} suppressHydrationWarning>
                <Suspense fallback={<GlobalLoader />}>
                    <TokenVerifier />
                </Suspense>
                {children}
            </body>
        </html>
    );
}