import type { Metadata } from "next";

export const metadata: Metadata = { title: "Communities" };

export default function CommunitiesLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
