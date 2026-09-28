"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { useGatewayRead } from "@/hooks/useGateway";
import { displayNameOf } from "@/lib/conversation-identity";
import { staggerParentFast } from "@/lib/motion-presets";
import { formatTimeAgo } from "@/lib/utils";
import { CascadeRow } from "./ConversationList";

interface Receipt {
	profile: { _id: string; firstName?: string; lastName?: string; username?: string; avatar?: string };
	readAt: string;
}

/**
 * Seen by (audit G85, G178): for a message of yours in a group, who has
 * read past it, from the members' read marks, on demand. People who
 * turned receipts off are not listed, and the count says so.
 */
export function SeenBySheet({
	open,
	onClose,
	messageId,
}: {
	open: boolean;
	onClose: () => void;
	messageId: string | null;
}) {
	const read = useGatewayRead();
	const [data, setData] = useState<{ readBy: Receipt[]; total: number } | null>(null);
	useOverlayDismiss(open, onClose);

	useEffect(() => {
		if (!open || !messageId) {
			setData(null);
			return;
		}
		let cancelled = false;
		void (async () => {
			const res = await read(`/api/messages/message/${messageId}/receipts`, (b) => b);
			if (cancelled) return;
			setData(res.success ? { readBy: res.data?.readBy ?? [], total: res.data?.total ?? 0 } : { readBy: [], total: 0 });
		})();
		return () => {
			cancelled = true;
		};
	}, [open, messageId, read]);

	return (
		<AnimatePresence>
			{open && (
				<>
					<OverlayScrim onClose={onClose} />
					<OverlayPanel
						dragClose={onClose}
						variant="sheet"
						ground="none"
						className="bg-surface sm:w-[min(440px,94vw)] sm:max-h-[70vh]"
						label="Seen by"
					>
						<OverlayHeader
							title="Seen by"
							count={data ? `${data.readBy.length} of ${data.total}` : undefined}
							onClose={onClose}
						/>
						<div className="min-h-0 flex-1 overflow-y-auto pb-[calc(12px+var(--ws-safe-bottom))]">
							{!data ? (
								<div className="flex justify-center py-10 text-muted">
									<Loader2 className="h-6 w-6 animate-spin" />
								</div>
							) : data.readBy.length === 0 ? (
								<p className="px-6 py-10 text-center font-sans text-[calc(13px*var(--ws-fs))] text-subtle">
									Nobody yet. People who keep read receipts off never show here.
								</p>
							) : (
								<motion.div variants={staggerParentFast} initial="hidden" animate="show">
									{data.readBy.map((r, i) => (
										<CascadeRow key={r.profile._id} index={i}>
											<div className="flex items-center gap-3 px-4 py-2.5">
												<span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-pill bg-raised">
													<SafeAvatar src={r.profile.avatar} eager />
												</span>
												<span className="min-w-0 flex-1">
													<span className="block truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary">
														{displayNameOf(r.profile)}
													</span>
													<span className="block font-sans text-[calc(12px*var(--ws-fs))] text-muted">
														{formatTimeAgo(r.readAt)}
													</span>
												</span>
											</div>
										</CascadeRow>
									))}
								</motion.div>
							)}
						</div>
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}
