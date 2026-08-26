import { redirect } from "next/navigation";

/**
 * Shareable room links. A room is not a separate destination — it opens as
 * an overlay over the directory (and can minimise into the dock), so the
 * link lands on /voice with the room requested.
 */
export default async function VoiceRoomRedirect({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	redirect(`/voice?s=${id}`);
}
