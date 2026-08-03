import type { Metadata } from "next";

/* The page itself is a client component, so its title lives here. */
export const metadata: Metadata = { title: "Bookmarks" };

export default function BookmarksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
