"use client";

import { useAtomValue } from "jotai";
import { useParams } from "next/navigation";
import { PostCard } from "@/components/feed/PostCard";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { ArrowLeft } from "@/components/ui/icons";
import { useT } from "@/i18n/client";
import { useBackWithFallback } from "@/lib/nav";
import { singlePostCacheAtom } from "@/store/postCache";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Post-shaped, not feed-shaped: without this file the group-level
 * loading.tsx fronted navigation with a header + four feed cards, the wrong
 * silhouette for a single post, so every cold open looked like the feed
 * reloading. One post, then quiet reply rows.
 */
export default function PostLoading() {
	const t = useT();
	const goBack = useBackWithFallback();
	const params = useParams();
	const cached = useAtomValue(singlePostCacheAtom)[String(params?.id ?? "")];
	// Opened from a card, the post is already in hand (owner 2026-09-28: "no
	// need to load it again, carry on the state and just load the
	// comments"). While Next fetches the route, this boundary paints that
	// post, in the same header and place the page will use, so the swap to
	// the page is invisible and only the replies arrive.
	if (cached) {
		return (
			<div className="flex min-h-full flex-col">
				<header className="sticky top-0 z-sticky flex items-center gap-2 border-b border-hairline bg-page px-2 py-2 sm:gap-6 sm:px-4">
					<button
						type="button"
						aria-label="Go back"
						onClick={() => goBack("/")}
						className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-pill text-primary transition-colors hover:bg-raised sm:h-9 sm:w-9"
					>
						<ArrowLeft className="h-5 w-5" />
					</button>
					<h1 className="font-display text-lg font-semibold leading-5 text-primary">
						{t("post.title")}
					</h1>
				</header>
				<PostCard post={{ ...cached, isDetail: true }} />
			</div>
		);
	}
	return (
		<div className="flex min-h-dvh flex-col">
			<div className="sticky top-0 z-sticky flex items-center gap-4 border-b border-hairline bg-page px-4 py-3">
				<Skeleton className="h-9 w-9 rounded-pill" />
				<Skeleton className="h-5 w-16 rounded-sm" />
			</div>
			<PostSkeleton />
			<div className="border-t border-hairline">
				{[0, 1, 2].map((i) => (
					<div key={i} className="flex gap-3 border-b border-hairline px-4 py-3.5">
						<Skeleton className="h-9 w-9 shrink-0 rounded-pill" />
						<div className="flex w-full flex-col gap-2">
							<Skeleton className="h-3 w-[30%] rounded-sm" />
							<Skeleton className="h-3 w-[80%] rounded-sm" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
