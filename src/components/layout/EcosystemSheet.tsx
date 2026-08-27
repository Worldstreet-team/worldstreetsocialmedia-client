"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, X } from "@phosphor-icons/react";
import Image from "next/image";
import { ECOSYSTEM } from "@/data/ecosystem";

/**
 * The ecosystem sheet behind the mobile nav's brand mark.
 *
 * Glass on purpose, and one of the few places it is sanctioned: it rises out
 * of the glass bottom bar and reads as that bar opening up, so a solid panel
 * would look like a different object arriving from somewhere else.
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
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = previous;
		};
	}, [open, onClose]);

	return (
		<AnimatePresence>
			{open && (
				<>
					<motion.button
						type="button"
						aria-label="Close"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
						onClick={onClose}
						className="fixed inset-0 z-modal bg-scrim md:hidden cursor-default"
					/>

					<motion.div
						role="dialog"
						aria-modal="true"
						aria-label="More from WorldStreet"
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 16 }}
						transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
						// Sits ABOVE the bar it grew out of, and clears the home
						// indicator via the same clearance token the bar uses.
						className="fixed inset-x-2 z-modal md:hidden glass-panel backdrop-blur-xl backdrop-saturate-150 rounded-xl overflow-hidden"
						style={{ bottom: "var(--ws-nav-clearance)" }}
					>
						<div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
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
							<button
								type="button"
								onClick={onClose}
								aria-label="Close"
								className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-muted transition-colors hover:bg-raised hover:text-primary"
							>
								<X size={18} />
							</button>
						</div>

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
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
