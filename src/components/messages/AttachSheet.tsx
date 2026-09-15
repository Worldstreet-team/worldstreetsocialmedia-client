"use client";

import clsx from "clsx";
import { AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";
import {
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
}: {
	open: boolean;
	anchor: AttachAnchor | null;
	onClose: () => void;
	onPhoto: () => void;
	onAudio: () => void;
	onMoney: () => void;
	onContact: () => void;
	onPhoneContact: () => void;
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
	const rows: { icon: ReactNode; label: string; hint: string; go: () => void }[] = [
		{ icon: <RiImageLine size={19} />, label: "Photo or video", hint: "From your library", go: pick(onPhoto) },
		{ icon: <RiMusic2Line size={19} />, label: "Audio", hint: "A song or an audio file", go: pick(onAudio) },
		{ icon: <RiWallet3Line size={19} />, label: "Send money", hint: "From your WorldStreet wallet", go: pick(onMoney) },
		{ icon: <RiUserSharedLine size={19} />, label: "WorldSpace contact", hint: "Share someone's profile", go: pick(onContact) },
	];
	if (phoneContactsSupported())
		rows.push({ icon: <RiContactsBookLine size={19} />, label: "Contact from your phone", hint: "Name and number", go: pick(onPhoneContact) });

	return (
		<AnimatePresence>
			{open && (
				<>
					<OverlayScrim key="attach-scrim" onClose={onClose} dim={!desktop} label="Close" />
					<OverlayPanel
						key="attach-panel"
						variant="anchored"
						label="Attach"
						ground="none"
						dragClose={onClose}
						className={clsx("bg-surface", desktop && "sm:w-[280px]")}
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
						<div className="flex flex-col py-2 pb-[calc(8px+var(--ws-safe-bottom))]">
							{rows.map((r) => (
								<button
									key={r.label}
									type="button"
									onClick={r.go}
									className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-primary/5"
								>
									<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-primary/5 text-primary">
										{r.icon}
									</span>
									<span className="min-w-0">
										<span className="block font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary">
											{r.label}
										</span>
										<span className="block font-sans text-[calc(12px*var(--ws-fs))] text-muted">
											{r.hint}
										</span>
									</span>
								</button>
							))}
						</div>
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}
