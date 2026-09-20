"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Search, Users } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { useGatewayRead } from "@/hooks/useGateway";
import { collapse, pop, staggerParentFast, swap } from "@/lib/motion-presets";
import { postJsonDirect } from "@/lib/upload-direct";
import { CascadeRow } from "./ConversationList";

interface UserItem {
	_id: string;
	username: string;
	firstName: string;
	lastName: string;
	avatar: string;
	isVerified?: boolean;
}

/**
 * Create a group (register 109). Reuses the follows-modal pattern: pick from
 * the people you're aligned to, name it, create. The gateway keeps only
 * mutual follows, so if any selection isn't mutual it's silently dropped and
 * we say so rather than pretend it worked.
 */
export function GroupCreateModal({
	isOpen,
	onClose,
	currentUserId,
	onCreated,
}: {
	isOpen: boolean;
	onClose: () => void;
	/** Clerk userId, for the relations endpoint. */
	currentUserId: string;
	onCreated: (conversationId: string) => void;
}) {
	const read = useGatewayRead();
	const [people, setPeople] = useState<UserItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<Record<string, UserItem>>({});
	const [name, setName] = useState("");
	const [creating, setCreating] = useState(false);

	useEffect(() => {
		if (!isOpen) {
			setQuery("");
			setSelected({});
			setName("");
			return;
		}
		if (!currentUserId) return;
		void (async () => {
			setLoading(true);
			try {
				// People I'm aligned to; the gateway enforces the mutual half.
				const res = await read(
					`/api/users/${currentUserId}/following?limit=100`,
					(b) => b,
				);
				const rows = (res.data as any)?.data ?? [];
				setPeople(Array.isArray(rows) ? rows : []);
			} finally {
				setLoading(false);
			}
		})();
	}, [isOpen, currentUserId, read]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return people;
		return people.filter(
			(u) =>
				u.username?.toLowerCase().includes(q) ||
				`${u.firstName} ${u.lastName}`.toLowerCase().includes(q),
		);
	}, [people, query]);

	const selectedList = Object.values(selected);
	const canCreate = name.trim().length > 0 && selectedList.length >= 1;

	const toggle = (u: UserItem) =>
		setSelected((prev) => {
			const next = { ...prev };
			if (next[u._id]) delete next[u._id];
			else next[u._id] = u;
			return next;
		});

	const create = async () => {
		if (!canCreate || creating) return;
		setCreating(true);
		try {
			const res = await postJsonDirect("/api/messages/groups", {
				name: name.trim(),
				memberIds: selectedList.map((u) => u._id),
			});
			if (res.success && res.data?._id) {
				onCreated(res.data._id);
				onClose();
			} else {
				toast.error(res.message || "Couldn't create the group");
			}
		} finally {
			setCreating(false);
		}
	};

	useOverlayDismiss(isOpen, onClose);

	// The people cascade once per open; a search remounts rows and must cut.
	// The delay lets the stale list a reopen paints for one frame pass
	// without spending the cascade.
	const cascadePlayed = useRef(false);
	useEffect(() => {
		if (!isOpen) {
			cascadePlayed.current = false;
			return;
		}
		if (loading || filtered.length === 0) return;
		const id = window.setTimeout(() => {
			cascadePlayed.current = true;
		}, 400);
		return () => window.clearTimeout(id);
	}, [isOpen, loading, filtered.length]);

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					<OverlayScrim onClose={onClose} />
					<OverlayPanel dragClose={onClose} variant="sheet" label="New group">
						<OverlayHeader title="New group" onClose={onClose} />

						<div className="shrink-0 space-y-3 p-4">
							<div className="flex items-center gap-3">
								<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-raised">
									<Users className="h-5 w-5 text-muted" />
								</span>
								<input
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="Group name"
									maxLength={80}
									autoFocus
									className="min-w-0 flex-1 rounded-pill bg-primary/5 px-4 py-2.5 text-base text-primary outline-none transition-colors placeholder:text-subtle focus:bg-primary/10 sm:text-sm"
								/>
							</div>

							{/* The shelf opens for the first pick and folds for the
							    last; each pick after that lands as a chip. The
							    spacing moves inside (!mb-0 + pb-3) so the fold
							    closes to nothing instead of leaving a gap. */}
							<AnimatePresence initial={false}>
								{selectedList.length > 0 && (
									<motion.div
										key="picked"
										{...collapse}
										className="!mb-0 overflow-hidden"
									>
										<div className="flex flex-wrap gap-1.5 pb-3">
											<AnimatePresence initial={false}>
												{selectedList.map((u) => (
													<motion.button
														key={u._id}
														{...pop}
														type="button"
														onClick={() => toggle(u)}
														className="flex cursor-pointer items-center gap-1.5 rounded-pill bg-primary/5 py-1 pl-1 pr-2.5 font-sans text-[calc(12.5px*var(--ws-fs))] text-primary transition-colors hover:bg-primary/5"
													>
														<span className="relative h-6 w-6 overflow-hidden rounded-pill bg-raised">
															<SafeAvatar src={u.avatar} eager />
														</span>
														{u.firstName || u.username}
														<span className="text-subtle">×</span>
													</motion.button>
												))}
											</AnimatePresence>
										</div>
									</motion.div>
								)}
							</AnimatePresence>

							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
								<input
									value={query}
									onChange={(e) => setQuery(e.target.value)}
									placeholder="Add people you're aligned to"
									className="w-full rounded-pill bg-primary/5 py-2.5 pl-10 pr-4 text-base text-primary outline-none transition-colors placeholder:text-subtle focus:bg-primary/10 sm:text-sm"
								/>
							</div>
						</div>

						<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
							{loading ? (
								<div className="flex flex-col items-center justify-center py-12 text-muted">
									<Loader2 className="mb-3 h-6 w-6 animate-spin" />
									<span className="text-sm">Loading people…</span>
								</div>
							) : filtered.length === 0 ? (
								<p className="px-6 py-12 text-center text-sm text-muted">
									{query.trim()
										? `No one matches "${query}"`
										: "People you follow show up here"}
								</p>
							) : (
								<motion.div
									variants={staggerParentFast}
									initial={cascadePlayed.current ? false : "hidden"}
									animate="show"
								>
								{filtered.map((u, i) => {
									const on = !!selected[u._id];
									return (
										<CascadeRow key={u._id} index={i}>
										<button
											type="button"
											onClick={() => toggle(u)}
											className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/5"
										>
											<span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-pill bg-raised">
												<SafeAvatar src={u.avatar} eager />
											</span>
											<span className="min-w-0 flex-1">
												<span className="flex items-center gap-1">
													<span className="truncate font-semibold text-[calc(15px*var(--ws-fs))] text-primary">
														{u.firstName} {u.lastName}
													</span>
													<UserBadges
														isVerified={u.isVerified}
														verification={(u as any).verification}
														badges={(u as any).badges}
														size={15}
													/>
												</span>
												<span className="block truncate text-[calc(13px*var(--ws-fs))] text-muted">
													@{u.username}
												</span>
											</span>
											{/* The ring is always there; the filled disc
											    lands over it (own action, so it may pop). */}
											<span className="relative h-6 w-6 shrink-0 rounded-pill border border-hairline">
												<AnimatePresence initial={false}>
													{on && (
														<motion.span
															key="on"
															{...pop}
															className="absolute -inset-px flex items-center justify-center rounded-pill bg-brand text-brand-on"
														>
															<Check className="h-4 w-4" />
														</motion.span>
													)}
												</AnimatePresence>
											</span>
										</button>
										</CascadeRow>
									);
								})}
								</motion.div>
							)}
						</div>

						<div className="shrink-0 border-t border-hairline p-3">
							<button
								type="button"
								onClick={create}
								disabled={!canCreate || creating}
								className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-brand font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-brand-on transition-colors hover:bg-brand-active disabled:opacity-50"
							>
								{creating && <Loader2 className="h-4 w-4 animate-spin" />}
								{selectedList.length > 0 ? (
									// One flex item, so the label keeps its own spacing;
									// only the number rolls as people are picked.
									<span className="relative">
										{"Create group · "}
										<AnimatePresence mode="popLayout" initial={false}>
											<motion.span
												key={selectedList.length}
												{...swap}
												className="inline-block tabular-nums"
											>
												{selectedList.length}
											</motion.span>
										</AnimatePresence>
									</span>
								) : (
									"Create group"
								)}
							</button>
						</div>
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}
