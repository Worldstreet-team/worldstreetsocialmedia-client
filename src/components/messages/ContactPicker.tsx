"use client";

import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useGatewayRead } from "@/hooks/useGateway";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";

export interface PickedUser {
	_id: string;
	username?: string;
	firstName?: string;
	lastName?: string;
	avatar?: string;
}

/**
 * Pick a WorldSpace account to share into a thread. Same search as the
 * new-conversation modal (everyone, not only mutuals); what gets sent is
 * the name and the @handle, which the bubble already renders as a chip
 * that opens the profile. A card of its own waits on a gateway message
 * type.
 */
export function ContactPicker({
	open,
	onClose,
	onPick,
}: {
	open: boolean;
	onClose: () => void;
	onPick: (u: PickedUser) => void;
}) {
	const read = useGatewayRead();
	const [q, setQ] = useState("");
	const [results, setResults] = useState<PickedUser[]>([]);
	const [busy, setBusy] = useState(false);
	useOverlayDismiss(open, onClose);

	useEffect(() => {
		if (!open) {
			setQ("");
			setResults([]);
		}
	}, [open]);

	useEffect(() => {
		const term = q.trim();
		if (!open || term.length < 2) {
			setResults([]);
			return;
		}
		setBusy(true);
		const id = window.setTimeout(async () => {
			const res = await read(
				`/api/users/search?q=${encodeURIComponent(term)}`,
				(b) => b.data,
			);
			if (res.success && Array.isArray(res.data)) setResults(res.data as PickedUser[]);
			setBusy(false);
		}, 300);
		return () => window.clearTimeout(id);
	}, [open, q, read]);

	const name = (u: PickedUser) =>
		[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "";

	return (
		<AnimatePresence>
			{open && (
				<>
					<OverlayScrim key="contact-scrim" onClose={onClose} label="Close" />
					<OverlayPanel
						key="contact-panel"
						variant="sheet"
						label="Share a contact"
						ground="none"
						dragClose={onClose}
						className="bg-surface sm:w-[min(480px,94vw)]"
					>
						<OverlayHeader title="Share a contact" onClose={onClose} />
						<div className="px-4 pb-2">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
								<input
									autoFocus
									value={q}
									onChange={(e) => setQ(e.target.value)}
									placeholder="Search people"
									className="h-10 w-full rounded-pill bg-primary/5 pl-10 pr-4 text-base text-primary outline-none transition-colors placeholder:text-subtle focus:bg-primary/10 sm:text-sm"
								/>
							</div>
						</div>
						<div className="flex min-h-[160px] flex-col overflow-y-auto pb-[calc(12px+var(--ws-safe-bottom))]">
							{results.map((u) => (
								<button
									key={u._id}
									type="button"
									onClick={() => {
										onPick(u);
										onClose();
									}}
									className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-primary/5"
								>
									<span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-raised">
										<SafeAvatar src={u.avatar} />
									</span>
									<span className="min-w-0">
										<span className="block truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary">
											{name(u)}
										</span>
										{u.username && (
											<span className="block truncate font-sans text-[calc(12px*var(--ws-fs))] text-muted">
												@{u.username}
											</span>
										)}
									</span>
								</button>
							))}
							{!busy && q.trim().length >= 2 && results.length === 0 && (
								<p className="px-6 py-8 text-center font-sans text-[calc(13px*var(--ws-fs))] text-subtle">
									Nobody by that name.
								</p>
							)}
							{q.trim().length < 2 && (
								<p className="px-6 py-8 text-center font-sans text-[calc(13px*var(--ws-fs))] text-subtle">
									Type a name or a handle.
								</p>
							)}
						</div>
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}
