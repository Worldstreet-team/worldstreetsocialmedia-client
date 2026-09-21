import type { Metadata } from "next";
import { SettingsFeatureTour } from "@/components/settings/SettingsFeatureTour";

/* The page itself is a client component, so its title lives here. */
export const metadata: Metadata = { title: "Settings" };

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <SettingsFeatureTour />
    </>
  );
}
