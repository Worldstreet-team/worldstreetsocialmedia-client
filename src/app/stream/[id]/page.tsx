import { redirect } from "next/navigation";

/**
 * Streams are not a separate destination: they live inside the vertical
 * surface. Old links land in the feed positioned on that stream, with the
 * whole feed scrollable above and below it.
 */
export default async function StreamRedirect({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	redirect(`/live?tab=live&s=${id}`);
}
