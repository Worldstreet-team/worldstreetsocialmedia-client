import Profile from "@/components/profile/Profile";
import type { Metadata } from "next";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ username: string }>;
}): Promise<Metadata> {
	const { username } = await params;
	return { title: `@${username}` };
}

export default async function UserProfilePage({
	params,
}: {
	params: Promise<{ username: string }>;
}) {
	const { username } = await params;
	return <Profile username={username} />;
}
