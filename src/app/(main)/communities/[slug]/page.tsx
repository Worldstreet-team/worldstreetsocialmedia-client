import type { Metadata } from "next";
import CommunityScreen from "@/components/community/CommunityScreen";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	return { title: slug.replace(/-/g, " ") };
}

export default async function CommunityPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	return <CommunityScreen slug={slug} />;
}
