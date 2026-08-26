import type { Metadata } from "next";
import { StudioShell } from "@/components/studio/StudioShell";

export const metadata: Metadata = { title: "Studio" };

/**
 * The studio is a hub of its own: no social sidebars, its own header with
 * one back button to the socials app, and a tab rail for its sections.
 * Living OUTSIDE the (main) route group is what drops the 3-column shell.
 */
export default function StudioLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <StudioShell>{children}</StudioShell>;
}
