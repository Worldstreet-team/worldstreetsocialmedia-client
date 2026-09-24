"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { useGatewayRead } from "@/hooks/useGateway";
import { deleteDirect, postJsonDirect } from "@/lib/upload-direct";
import { displayNameOf } from "@/lib/conversation-identity";
import { staggerParentFast } from "@/lib/motion-presets";
import { CascadeRow } from "./ConversationList";
import { invitesEndsIn } from "./InviteCard";

interface Person {
	_id: string;
	firstName?: string;
	lastName?: string;
	username?: string;
	avatar?: string;
}
interface Pending {
	profile: Person | string;
	kind: "invite" | "request";
	by?: Person | string;
	at: string;
	expiresAt: string;
}

const idOf = (p: Person | string | undefined) => (typeof p === "string" ? p : (p?._id ?? ""));
const personOf = (p: Person | string | undefined): Person | null =>
	typeof p === "object" && p ? p : null;

/**
 * Who is on the way into a group you run (audit G38, G173): people asking
 * to join, with Approve and Decline, and the invites still out, with
 * Withdraw. Declining is quiet.
 */
export function JoinRequestsSheet({
	open,
	onClose,
	conversationId,
	name,
	onChanged,
}: {
	open: boolean;
	onClose: () => void;
	conversationId: string;
	name: string;
	onChanged: () => void;
}) {
	const read = useGatewayRead();
	const [rows, setRows] = useState<Pending[] | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	useOverlayDismiss(open, onClose);

	useEffect(() => {
		if (!open) {
			setRows(null);
			return;
		}
		let cancelled = false;
		void (async () => {
			const res = await read(`/api/messages/groups/${conversationId}/invites`, (b) => b);
			if (cancelled) return;
			setRows(res.success && Array.isArray(res.data) ? (res.data as Pending[]) : []);
		})();
		return () => {
			cancelled = true;
		};
	}, [open, conversationId, read]);

	const requests = (rows ?? []).filter((r) => r.kind === "request");
	const invites = (rows ?? []).filter((r) => r.kind === "invite");

	const drop = (pid: string) =>
		setRows((prev) => (prev ?? []).filter((r) => idOf(r.profile) !== pid));

	const answer = async (pid: string, approve: boolean) => {
		setBusy(pid);
		const res = await postJsonDirect(
			`/api/messages/groups/${conversationId}/requests/${pid}`,
			{ approve },
		);
		setBusy(null);
		if (!res.success) {
			toast.error(res.message || "Couldn't do that");
			return;
		}
		drop(pid);
		onChanged();
	};

	const withdraw = async (pid: string) => {
		setBusy(pid);
		const res = await deleteDirect(`/api/messages/groups/${conversationId}/invites/${pid}`);
		setBusy(null);
		if (!res.success) {
			toast.error(res.message || "Couldn't withdraw that");
			return;
		}
		drop(pid);
		onChanged();
	};

	const Row = ({ r, i, children }: { r: Pending; i: number; children: React.ReactNode }) => {
		const p = personOf(r.profile);
		const by = personOf(r.by);
		return (
			<CascadeRow index={i}>
				<div className="flex items-center gap-3 px-4 py-2.5">
					<span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-pill bg-raised">
						<SafeAvatar src={p?.avatar} eager />
					</span>
					<span className="min-w-0 flex-1">
						<span className="block truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary">
							{displayNameOf(p)}
						</span>
						<span className="block truncate font-sans text-[calc(12px*var(--ws-fs))] text-muted">
							{r.kind === "invite"
								? `Invited by ${by ? displayNameOf(by) : "someone"} · ${invitesEndsIn(r.expiresAt).replace("Invite ends", "ends")}`
								: p?.username
									? `@${p.username}`
									: "Asking to join"}
						</span>
					</span>
					{children}
				</div>
			</CascadeRow>
		);
	};

	return (
		<AnimatePresence>
			{open && (
				<>
					<OverlayScrim onClose={onClose} />
					<OverlayPanel dragClose={onClose} variant="sheet" label={`Requests for ${name}`}>
						<OverlayHeader title={name} onClose={onClose} />
						<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(12px+var(--ws-safe-bottom))]">
							{rows === null ? (
								<div className="flex flex-col items-center justify-center py-12 text-muted">
									<Loader2 className="mb-3 h-6 w-6 animate-spin" />
									<span className="text-sm">Loading</span>
								</div>
							) : rows.length === 0 ? (
								<p className="px-6 py-12 text-center font-sans text-[calc(13px*var(--ws-fs))] text-muted">
									Nobody is waiting to get in.
								</p>
							) : (
								<motion.div variants={staggerParentFast} initial="hidden" animate="show">
									{requests.length > 0 && (
										<p className="px-4 pb-1 pt-3 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
											Asking to join
										</p>
									)}
									{requests.map((r, i) => {
										const pid = idOf(r.profile);
										return (
											<Row key={`r-${pid}`} r={r} i={i}>
												<div className="flex shrink-0 items-center gap-1">
													<button
														type="button"
														onClick={() => void answer(pid, false)}
														disabled={busy === pid}
														aria-label="Decline"
														className="flex h-10 w-10 items-center justify-center rounded-pill text-muted transition-colors hover:bg-primary/5 hover:text-danger disabled:opacity-50"
													>
														<X className="h-4 w-4" />
													</button>
													<button
														type="button"
														onClick={() => void answer(pid, true)}
														disabled={busy === pid}
														aria-label="Approve"
														className="flex h-10 w-10 items-center justify-center rounded-pill bg-brand text-brand-on transition-colors hover:bg-brand-active disabled:opacity-50"
													>
														{busy === pid ? (
															<Loader2 className="h-4 w-4 animate-spin" />
														) : (
															<Check className="h-4 w-4" />
														)}
													</button>
												</div>
											</Row>
										);
									})}
									{invites.length > 0 && (
										<p className="px-4 pb-1 pt-3 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
											Invited
										</p>
									)}
									{invites.map((r, i) => {
										const pid = idOf(r.profile);
										return (
											<Row key={`i-${pid}`} r={r} i={requests.length + i}>
												<button
													type="button"
													onClick={() => void withdraw(pid)}
													disabled={busy === pid}
													className="h-9 shrink-0 cursor-pointer rounded-pill px-3 font-sans text-[calc(12.5px*var(--ws-fs))] font-medium text-muted transition-colors hover:bg-primary/5 hover:text-primary disabled:opacity-50"
												>
													Withdraw
												</button>
											</Row>
										);
									})}
								</motion.div>
							)}
						</div>
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}
