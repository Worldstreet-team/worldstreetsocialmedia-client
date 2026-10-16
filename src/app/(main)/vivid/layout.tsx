import type { Metadata } from "next";

/* The page itself is a client component, so its title lives here. */
export const metadata: Metadata = { title: "Vivid" };

export default function VividLayout({ children }: { children: React.ReactNode }) {
	return children;
}
