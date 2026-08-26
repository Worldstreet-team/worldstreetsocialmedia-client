import { searchUsersAction } from "@/lib/user.actions";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ExploreClient from "./ExploreClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Explore" };

export default async function ExplorePage({
	searchParams,
}: {
	// Next 15+: searchParams is a Promise and must be awaited.
	searchParams: Promise<{ q?: string }>;
}) {
	const user = await currentUser();
	if (!user) redirect("/sign-in");

	const { q } = await searchParams;
	const query = q || "";
	let results = [];

	if (query) {
		const res = await searchUsersAction(query);
		if (res.success) {
			results = res.data;
		}
	}

	return <ExploreClient initialResults={results} initialQuery={query} />;
}
