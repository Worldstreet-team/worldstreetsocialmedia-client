"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "framer-motion";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { useGatewayRead } from "@/hooks/useGateway";

interface Liker {
	_id: string;
	username?: string;
	firstName?: string;
	lastName?: string;
	avatar?: string;
	isVerified?: boolean;
	verification?: any;
	badges?: any;
}

/**
 * Who liked a post — general information by owner ruling: the count was
 * always public and each like already names itself in the author's
 * notifications; this just lists them. Opens from the like COUNT (the
 * heart itself stays the toggle). Paged 50 at a time.
 */
export function LikersModal({
	postId,
	onClose,
}: {
	postId: string;
	onClose: () => void;
}) {
	const read = useGatewayRead();
	useOverlayDismiss(true, onClose);
	const [rows, setRows] = useState<Liker[]>([]);
	const [loading, setLoading] = useState(true);
	const [hasMore, setHasMore] = useState(false);

	const load = async (skip: number) => {
		const res = await read(
			`/api/posts/${postId}/likers?limit=50&skip=${skip}`,
			(b) => b,
		);
		if (res.success) {
			const page = (res.data as any)?.data ?? [];
			setRows((prev) => (skip === 0 ? page : [...prev, ...page]));
			setHasMore(Boolean((res.data as any)?.hasMore));
		}
		setLoading(false);
	};

	useEffect(() => {
		void load(0);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [postId]);

	// Portaled to <body>: rendered in place it sat inside the card's
	// transformed route template (so `fixed` anchored to the card, not the
	// viewport) and under the card's overlay link (so the scrim click
	// navigated instead of closing). The stopPropagation shield keeps
	// clicks inside the modal from reaching the card's React handlers.
	if (typeof document === "undefined") return null;
	return createPortal(
		<div
			onClick={(e) => e.stopPropagation()}
			onPointerDown={(e) => e.stopPropagation()}
		>
		<AnimatePresence>
			<OverlayScrim key="s" onClose={onClose} />
			<OverlayPanel key="p" dragClose={onClose} variant="anchored" label="Liked by">
				<OverlayHeader title="Liked by" onClose={onClose} />
				<div className="max-h-[60dvh] overflow-y-auto pb-3">
					{loading ? (
						<div className="flex flex-col gap-3 px-4 py-3">
							{[0, 1, 2].map((i) => (
								<div key={i} className="flex items-center gap-3">
									<span className="skeleton h-10 w-10 rounded-pill" />
									<span className="skeleton h-3.5 w-1/3 rounded-[4px]" />
								</div>
							))}
						</div>
					) : rows.length === 0 ? (
						<p className="px-6 py-8 text-center font-sans text-[13px] text-subtle">
							No likes yet.
						</p>
					) : (
						rows.map((u) => (
							<Link
								key={u._id}
								href={`/profile/${u.username}`}
								onClick={onClose}
								className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-raised/50"
							>
								<span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-pill bg-raised">
									<SafeAvatar src={u.avatar} eager />
								</span>
								<span className="min-w-0 flex-1">
									<span className="flex items-center gap-1.5">
										<span className="truncate font-sans text-[14px] font-semibold text-primary">
											{[u.firstName, u.lastName]
												.filter(Boolean)
												.join(" ") || u.username}
										</span>
										<UserBadges
											isVerified={u.isVerified}
											verification={u.verification}
											badges={u.badges}
											size={13}
										/>
									</span>
									<span className="block truncate font-sans text-[12.5px] text-subtle">
										@{u.username}
									</span>
								</span>
							</Link>
						))
					)}
					{hasMore && (
						<button
							type="button"
							onClick={() => void load(rows.length)}
							className="mx-auto my-2 flex h-9 cursor-pointer items-center rounded-pill bg-raised px-4 font-sans text-[13px] font-medium text-primary transition-colors hover:bg-chip"
						>
							Show more
						</button>
					)}
				</div>
			</OverlayPanel>
		</AnimatePresence>
		</div>,
		document.body,
	);
}
