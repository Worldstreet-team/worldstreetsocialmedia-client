import type { Metadata } from "next";

export const metadata: Metadata = { title: "Business" };

export default function BmLayout({ children }: { children: React.ReactNode }) {
	return children;
}
