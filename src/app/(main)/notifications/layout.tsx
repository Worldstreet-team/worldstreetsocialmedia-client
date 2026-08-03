import type { Metadata } from "next";

/* The page itself is a client component, so its title lives here. */
export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
