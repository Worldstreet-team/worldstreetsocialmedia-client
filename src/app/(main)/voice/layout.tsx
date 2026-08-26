import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Street Voice",
};

export default function VoiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
