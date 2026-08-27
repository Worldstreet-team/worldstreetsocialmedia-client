import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Space Voice",
};

export default function VoiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
