"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import {
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { staggerItem, staggerParentFast } from "@/lib/motion-presets";

export interface ThreadMoreItem {
	icon: ReactNode;
	label: string;
	hint?: string;
	onClick: () => void;
	tone?: "danger";
}

/**
 * The thread's "more" menu on a phone (owner 2026-09-25): the header kept
 * call, video, search and theme side by side and read as a toolbar. On a
 * phone the header shows one call button and this, a bottom sheet with
 * the rest; on a desktop the icons stay in the header.
 */
export function ThreadMoreSheet({
	open,
	onClose,
	title,
	items,
}: {
	open: boolean;
	onClose: () => void;
	title: string;
	items: ThreadMoreItem[];
}) {
	useOverlayDismiss(open, onClose);
	return (
		<AnimatePresence>
			{open && (
				<>
					<OverlayScrim onClose={onClose} />
					<OverlayPanel dragClose={onClose} variant="anchored" label={`More for ${title}`}>
						<motion.div
							variants={staggerParentFast}
							initial="hidden"
							animate="show"
							className="py-2 pb-[calc(8px+var(--ws-safe-bottom))]"
						>
							{items.map((it) => (
								<motion.button
									key={it.label}
									variants={staggerItem}
									type="button"
									onClick={() => {
										onClose();
										it.onClick();
									}}
									className="flex min-h-[48px] w-full cursor-pointer items-center gap-3 px-4 text-left transition-colors hover:bg-primary/5"
								>
									<span
										className={
											it.tone === "danger"
												? "flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-primary/5 text-danger"
												: "flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-primary/5 text-primary"
										}
									>
										{it.icon}
									</span>
									<span className="min-w-0 flex-1">
										<span
											className={
												it.tone === "danger"
													? "block truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium text-danger"
													: "block truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary"
											}
										>
											{it.label}
										</span>
										{it.hint && (
											<span className="block truncate font-sans text-[calc(12px*var(--ws-fs))] text-muted">
												{it.hint}
											</span>
										)}
									</span>
								</motion.button>
							))}
						</motion.div>
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}
