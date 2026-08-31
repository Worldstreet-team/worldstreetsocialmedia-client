import type { Metadata } from "next";
import { VotesScreen } from "@/components/votes/VotesScreen";

export const metadata: Metadata = { title: "The Weekly Vote" };

export default function VotesPage() {
	return <VotesScreen />;
}
