"use client";

import { AnimatePresence } from "framer-motion";
import { ArrowUpRight } from "@phosphor-icons/react";
import Image from "next/image";
import { ECOSYSTEM } from "@/data/ecosystem";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";

/**
 * The ecosystem sheet behind the mobile nav's brand mark.
 *
 * The grammar's `anchored` panel: it rises out of the glass bottom bar and
 * reads as that bar opening up, which is exactly what `anchoredMotion` and the
 * bottom-edge placement describe. `mx-2` + `mb-[--ws-nav-clearance]` float it
 * clear of the bar rather than burying it — margins rather than a competing
 * `bottom-*`, so nothing fights the variant's own positioning.
 *
 * Everything here leaves the app, so every row is an external anchor with the
 * outbound arrow — nothing in this sheet navigates within Social.
 */
export function EcosystemSheet({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	// Escape closes, and the page behind must not scroll under the sheet.
	useOverlayDismiss(open, onClose);

	return (
		<AnimatePresence>
			{open && (
				// The sheet is a phones-and-small-tablets surface; the wrapper
				// carries the `md:hidden` the scrim used to, since OverlayScrim
				// is deliberately class-free.
				<div key="ecosystem-scrim" className="md:hidden">
					<OverlayScrim onClose={onClose} />
				</div>
			)}
			{open && (
				<OverlayPanel
					key="ecosystem-panel"
					variant="anchored"
					label="More from WorldStreet"
					// Sits ABOVE the bar it grew out of, and clears the home
					// indicator via the same clearance token the bar uses.
					className="md:hidden mx-2 mb-[var(--ws-nav-clearance)] rounded-2xl sm:mx-0 sm:mb-0"
				>
					<OverlayHeader onClose={onClose} closeLabel="Close">
						<Image
							src="/images/wsa-mark.png"
							alt=""
							width={22}
							height={22}
							aria-hidden
							className="h-[22px] w-[22px] shrink-0 object-contain"
						/>
						<div className="min-w-0 flex-1">
							<p className="font-display text-[15px] font-semibold leading-tight text-primary">
								More from WorldStreet
							</p>
							<p className="font-sans text-[12px] text-muted">
								One account, every platform
							</p>
						</div>
					</OverlayHeader>

					{/* Capped height: nine products must not become a sheet
					    taller than the phone. */}
					<div className="max-h-[52dvh] overflow-y-auto overscroll-contain px-2 pb-3">
						{ECOSYSTEM.map((app) => (
							<a
								key={app.title}
								href={app.href}
								target="_blank"
								rel="noopener noreferrer"
								onClick={onClose}
								className="group relative flex min-h-14 items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors active:bg-raised"
							>
								<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-raised">
									<Image
										src="/images/wsa-mark.png"
										alt=""
										width={17}
										height={17}
										aria-hidden
										className="h-[17px] w-[17px] object-contain"
									/>
								</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate font-sans text-[14px] font-medium text-primary">
										{app.title}
									</span>
									<span className="block truncate font-sans text-[12px] text-muted">
										{app.description}
									</span>
								</span>
								<ArrowUpRight
									size={14}
									className="shrink-0 text-subtle"
									aria-hidden
								/>
							</a>
						))}
					</div>
				</OverlayPanel>
			)}
		</AnimatePresence>
	);
}
