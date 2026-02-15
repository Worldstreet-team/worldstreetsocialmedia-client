import Profile from "@/components/profile/Profile";

export default async function UserProfilePage({
	params,
}: {
	params: Promise<{ username: string }>;
}) {
	const { username } = await params;
	return <Profile username={username} />;
}
