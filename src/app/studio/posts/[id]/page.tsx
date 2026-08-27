"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";
import { PostStats } from "@/components/studio/PostStats";

/** Deep-link route for one post's stats; the posts list opens the same view
 *  as a modal instead of navigating here. */
export default function StudioPostDrilldown({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const t = useT();
	const [title, setTitle] = useState("");

	return (
		<div>
			<div className="mb-4 flex items-center gap-2">
				<Link
					href="/studio/posts"
					aria-label={t("studio.back")}
					className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-[#fafaf9]/[0.06] glass-ink-dim transition-colors hover:glass-ink hover:bg-[#fafaf9]/[0.1]"
				>
					<ArrowLeft size={16} />
				</Link>
				<h1 className="max-w-[48ch] truncate font-sans text-[15px] font-semibold glass-ink">
					{title || t("studio.mediaPost")}
				</h1>
			</div>
			<PostStats id={id} onTitle={setTitle} />
		</div>
	);
}
