"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import {
	RiBarChartHorizontalLine,
	RiContactsBookLine,
	RiImageLine,
	RiMusic2Line,
	RiUserSharedLine,
	RiWallet3Line,
} from "@remixicon/react";
import {
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { HaloChip, HaloChips } from "@/components/ui/Halo";
import { staggerItem, staggerParent } from "@/lib/motion-presets";

/** Where the + button is, so the sheet grows from it on a desktop. */
export interface AttachAnchor {
	left: number;
	top: number;
}

/** True when the browser can hand us a contact from the phone's address book
 *  (Android Chrome today). Anywhere else the row simply does not exist. */
export function phoneContactsSupported(): boolean {
	const nav = typeof navigator === "undefined" ? null : (navigator as any);
	return !!nav?.contacts && typeof nav.contacts.select === "function";
}

/**
 * The + sheet (owner 2026-09-15): one place for everything a message can
 * carry besides text. A bottom sheet on a phone; on a desktop it is a small
 * card growing from the + itself, because a menu that opens at the far
 * corner of the screen from a button at the other corner reads as broken.
 */
export function AttachSheet({
	open,
	anchor,
	onClose,
	onPhoto,
	onAudio,
	onMoney,
	onContact,
	onPhoneContact,
	onPoll,
}: {
	open: boolean;
	anchor: AttachAnchor | null;
	onClose: () => void;
	onPhoto: () => void;
	onAudio: () => void;
	onMoney: () => void;
	onContact: () => void;
	onPhoneContact: () => void;
	onPoll?: () => void;
}) {
	useOverlayDismiss(open, onClose);
	const desktop =
		!!anchor &&
		typeof window !== "undefined" &&
		window.matchMedia("(min-width: 640px)").matches;
	const pick = (fn: () => void) => () => {
		onClose();
		fn();
	};
	// Halo layout (owner pick, round 3): the everyday picks as round chips,
	// the rest as rows, money last and lit.
	const chips: { icon: ReactNode; label: string; go: () => void }[] = [
		{ icon: <RiImageLine size={20} />, label: "Photo & video", go: pick(onPhoto) },
		{ icon: <RiMusic2Line size={20} />, label: "Audio", go: pick(onAudio) },
		{ icon: <RiUserSharedLine size={20} />, label: "Contact", go: pick(onContact) },
	];
	const rows: { icon: ReactNode; label: string; hint: string; go: () => void; lit?: boolean }[] = [
		...(onPoll ? [{ icon: <RiBarChartHorizontalLine size={18} />, label: "Poll", hint: "Ask the room", go: pick(onPoll) }] : []),
	];
	if (phoneContactsSupported())
		rows.push({ icon: <RiContactsBookLine size={18} />, label: "Contact from your phone", hint: "Name and number", go: pick(onPhoneContact) });
	rows.push({ icon: <RiWallet3Line size={18} />, label: "Send money", hint: "From your WorldStreet wallet", go: pick(onMoney), lit: true });

	return (
		<AnimatePresence>
			{open && (
				<>
					<OverlayScrim key="attach-scrim" onClose={onClose} dim={!desktop} label="Close" />
					<OverlayPanel
						key="attach-panel"
						variant="anchored"
						label="Attach"
						ground="solid"
						dragClose={onClose}
						className={clsx(desktop && "sm:w-[280px]")}
						style={
							desktop && anchor
								? {
										left: anchor.left,
										right: "auto",
										bottom: window.innerHeight - anchor.top + 10,
										transformOrigin: "bottom left",
									}
								: undefined
						}
					>
						{/* The rows rise in one after another as the sheet opens. They
						    carry no exit: the panel leaves as one piece, and each row
						    is tappable from its first frame. */}
						<motion.div
							variants={staggerParent}
							initial="hidden"
							animate="show"
							className="flex flex-col gap-3 p-3 pb-[calc(12px+var(--ws-safe-bottom))]"
						>
							<motion.div variants={staggerItem}>
								<HaloChips>
									{chips.map((c) => (
										<HaloChip key={c.label} icon={c.icon} label={c.label} onClick={c.go} />
									))}
								</HaloChips>
							</motion.div>
							<div className="flex flex-col gap-1.5">
								{rows.map((r) => (
									<motion.button
										key={r.label}
										variants={staggerItem}
										type="button"
										onClick={r.go}
										className={clsx(
											"flex w-full cursor-pointer items-center gap-3 rounded-[18px] px-3 py-2.5 text-left transition-colors",
											r.lit ? "bg-brand/12 hover:bg-brand/20" : "hover:bg-primary/[0.06]",
										)}
									>
										<span
											className={clsx(
												"flex h-9 w-9 shrink-0 items-center justify-center rounded-pill",
												r.lit ? "bg-brand text-brand-on" : "bg-primary/[0.07] text-primary",
											)}
										>
											{r.icon}
										</span>
										<span className="min-w-0">
											<span className="block font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary">
												{r.label}
											</span>
											<span className="block font-sans text-[calc(12px*var(--ws-fs))] text-muted">
												{r.hint}
											</span>
										</span>
									</motion.button>
								))}
							</div>
						</motion.div>
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}
