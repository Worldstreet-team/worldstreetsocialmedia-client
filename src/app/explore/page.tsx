import { searchUsersAction } from "@/lib/user.actions";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ExploreClient from "./ExploreClient";

export default async function ExplorePage({
	searchParams,
}: {
	searchParams: { q?: string };
}) {
	const user = await currentUser();
	if (!user) redirect("/sign-in");

	const query = searchParams.q || "";
	let results = [];

	if (query) {
		const res = await searchUsersAction(query);
		if (res.success) {
			results = res.data;
		}
	}

	return (
		<ExploreClient
			initialResults={results}
			initialQuery={query}
			currentUserId={user.id}
		/>
	);
}
