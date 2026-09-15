import { MainShell } from "@/components/layout/MainShell";

export default function MainLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	// Same width tokens as app/page.tsx (--ws-container-max 1280 /
	// --ws-feed-width 620). The shell is route-aware (see MainShell): Settings
	// takes the full canvas, every other route keeps the fixed feed column.
	return <MainShell>{children}</MainShell>;
}
