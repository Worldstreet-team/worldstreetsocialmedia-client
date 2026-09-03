"use client";

import { AnimatePresence } from "framer-motion";
import { useAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";

import { PostComposer } from "@/components/feed/PostComposer";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { useT } from "@/i18n/client";
import { composeOpenAtom } from "@/store/ui.atom";

/**
 * The compose window (owner ruling 2026-09-03): posting must never require
 * going back home. The sidebar Post button and the create FAB open THIS —
 * the real PostComposer in an overlay — from any route.
 *
 * Shape is the ratified composer decision: phones get the near-full sheet
 * (grab handle, drag-dismiss), desktop the centred plate, blur on the panel
 * per the one-blur grammar. All of that is the Overlay `sheet` variant, so
 * nothing here is hand-rolled.
 *
 * Mounted in the root layout OUTSIDE app/template.tsx — a fixed panel inside
 * the template's transient transform gets trapped by it (same rule as the
 * FAB and the palette).
 */
export function ComposeSheet() {
	const t = useT();
	const [open, setOpen] = useAtom(composeOpenAtom);
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

	return (
		<AnimatePresence>
			{open && (
				<div key="compose-sheet" ref={panelRef}>
					<OverlayScrim onClose={close} label={t("common.close")} />
					<OverlayPanel
						variant="sheet"
						label={t("fab.post")}
						dragClose={close}
						className="max-h-[92dvh]"
					>
						<OverlayHeader title={t("fab.post")} onClose={close} />
						<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
							<PostComposer onPostSuccess={close} />
						</div>
					</OverlayPanel>
				</div>
			)}
		</AnimatePresence>
	);
}
