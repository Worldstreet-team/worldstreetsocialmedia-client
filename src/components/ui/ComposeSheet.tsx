"use client";

import { X } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { PostComposer } from "@/components/feed/PostComposer";
import {
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { useT } from "@/i18n/client";
import { press } from "@/lib/motion-presets";
import { draftsAtom, draftsOpenAtom } from "@/store/drafts.atom";
import { composeOpenAtom, goLiveOpenAtom } from "@/store/ui.atom";

/**
 * The compose window (owner ruling 2026-09-03): posting must never require
 * going back home. The sidebar Post button and the create FAB open THIS —
 * the real PostComposer in an overlay — from any route.
 *
 * Shape is the ratified composer decision: phones get the near-full sheet
 * (grab handle, drag-dismiss), desktop the centred plate. Since 2026-10-11
 * it is a Halo glass window in the user's theme, and its header
 * is the one switch between the three things you can start here: a post,
 * a live stream or a Space (post flow, states 01, 09 and 10).
 *
 * Mounted in the root layout OUTSIDE app/template.tsx — a fixed panel inside
 * the template's transient transform gets trapped by it (same rule as the
 * FAB and the palette).
 */
export function ComposeSheet() {
	const t = useT();
	const router = useRouter();
	const [open, setOpen] = useAtom(composeOpenAtom);
	const setGoLive = useSetAtom(goLiveOpenAtom);
	const setDraftsOpen = useSetAtom(draftsOpenAtom);
	const drafts = useAtomValue(draftsAtom);
	const close = useCallback(() => setOpen(false), [setOpen]);
	const panelRef = useRef<HTMLDivElement | null>(null);

	useOverlayDismiss(open, close);

	// Focus the sheet's OWN composer input — never a #post-composer-input
	// query, which would find the feed's composer first on the home route.
	useEffect(() => {
		if (!open) return;
		const id = window.setTimeout(() => {
			panelRef.current
				?.querySelector<HTMLElement>("[contenteditable], textarea")
				?.focus();
		}, 120);
		return () => window.clearTimeout(id);
	}, [open]);

	// Go live and Space keep their own setup surfaces; the switch hands over
	// to them so all three start from the same window.
	const modes = [
		{ key: "post", label: t("composer.post"), run: () => {} },
		{
			key: "live",
			label: t("fab.live"),
			run: () => {
				close();
				setGoLive(true);
			},
		},
		{
			key: "space",
			label: t("fab.space"),
			run: () => {
				close();
				router.push("/voice?create=1");
			},
		},
	];

	return (
		<AnimatePresence>
			{open && (
				<div key="compose-sheet" ref={panelRef}>
					<OverlayScrim blur onClose={close} label={t("common.close")} />
					<OverlayPanel
						variant="sheet"
						ground="solid"
						label={t("fab.post")}
						dragClose={close}
						className="max-h-[92dvh] sm:!w-[min(600px,94vw)]"
					>
						<div className="flex shrink-0 items-center gap-2 px-4 pb-1 pt-3">
							<div className="flex w-[96px] shrink-0">
								<motion.button
									type="button"
									onClick={close}
									aria-label={t("common.close")}
									{...press}
									className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill bg-raised text-muted transition-colors hover:text-primary"
								>
									<X size={16} weight="bold" />
								</motion.button>
							</div>
							<div className="flex flex-1 justify-center">
								<div className="flex items-center gap-0.5 rounded-pill bg-page p-1">
									{modes.map((m) => (
										<button
											key={m.key}
											type="button"
											onClick={m.run}
											aria-pressed={m.key === "post"}
											className={clsx(
												"flex h-8 cursor-pointer items-center gap-1.5 rounded-pill px-3.5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold transition-colors",
												m.key === "post"
													? "bg-raised text-primary"
													: "text-muted hover:text-primary",
											)}
										>
											{m.key === "live" && (
												<span aria-hidden className="h-1.5 w-1.5 rounded-pill bg-danger" />
											)}
											{m.label}
										</button>
									))}
								</div>
							</div>
							<div className="flex w-[96px] shrink-0 justify-end">
								{drafts.length > 0 && (
									<button
										type="button"
										onClick={() => setDraftsOpen(true)}
										className="flex h-9 cursor-pointer items-center gap-2 rounded-pill pl-3 pr-1.5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-muted transition-colors hover:bg-raised hover:text-primary"
									>
										{t("fab.drafts")}
										<span className="flex h-6 min-w-6 items-center justify-center rounded-pill bg-raised px-1.5 text-[calc(11.5px*var(--ws-fs))] font-bold tabular-nums">
											{drafts.length}
										</span>
									</button>
								)}
							</div>
						</div>
						<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
							<PostComposer onPostSuccess={close} />
						</div>
					</OverlayPanel>
				</div>
			)}
		</AnimatePresence>
	);
}
