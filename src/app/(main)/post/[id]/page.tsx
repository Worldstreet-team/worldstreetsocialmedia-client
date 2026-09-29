import type { Metadata } from "next";
import PostPageScreen from "./PostPageScreen";

export const metadata: Metadata = { title: "Post" };

/**
 * A post reached by its URL (a shared link, a notification, a refresh).
 * Opened from a card, the same view is drawn by PostLayer over the column
 * instead (owner 2026-09-29). Both sit in the same frame: the header, the
 * thread's own scroller, the reply box as the foot.
 */
export default async function PostPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	return (
		<div className="absolute inset-0 flex flex-col bg-page">
			<PostPageScreen postId={id} />
		</div>
	);
}
