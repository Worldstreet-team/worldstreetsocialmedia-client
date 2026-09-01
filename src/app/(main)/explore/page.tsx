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
	// No /sign-in route exists in this app — Clerk's middleware owns
	// authentication for every path (proxy.ts protects "/(.*)"). Redirecting
	// here only dumped a signed-in user whose currentUser() read blipped onto
	// the 404 page (investigation 2026-09-01). Send them home instead; if they
	// genuinely are not signed in, the middleware never let them get here.
	if (!user) redirect("/");

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
