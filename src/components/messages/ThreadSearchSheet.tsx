"use client";

import { useEffect, useState } from "react";
import { Link2, Loader2, Play, Search } from "@/components/ui/icons";
import { AnimatePresence, motion } from "framer-motion";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { Tabs } from "@/components/ui/Tabs";
import { useGatewayRead } from "@/hooks/useGateway";
import { displayNameOf } from "@/lib/conversation-identity";
import { staggerParentFast } from "@/lib/motion-presets";
import { formatTimeAgo } from "@/lib/utils";
import { CascadeRow } from "./ConversationList";

type Shelf = "messages" | "photos" | "voice" | "links";

interface Row {
	_id: string;
	type?: string;
	content?: string;
	mediaUrl?: string;
	width?: number;
	height?: number;
	durationSec?: number;
	createdAt: string;
	sender?: { _id: string; firstName?: string; lastName?: string; username?: string; avatar?: string } | string;
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/i;

/**
 * Search inside a thread, and its gallery (audit G93, G94): messages by
 * text, then photos and clips, voice notes, and links. Every row jumps to
 * its message. Same read clamps as the thread, so a newcomer's gallery
 * starts where their history does.
 */
export function ThreadSearchSheet({
	open,
	onClose,
	conversationId,
	onJump,
	initial = "messages",
}: {
	open: boolean;
	onClose: () => void;
	conversationId: string;
	onJump: (messageId: string) => void;
	initial?: Shelf;
}) {
	const read = useGatewayRead();
	const [shelf, setShelf] = useState<Shelf>(initial);
	const [q, setQ] = useState("");
	const [rows, setRows] = useState<Row[] | null>(null);
	useOverlayDismiss(open, onClose);

	useEffect(() => {
		if (!open) {
			setQ("");
			setRows(null);
			setShelf(initial);
		}
	}, [open, initial]);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		const run = async () => {
			if (shelf === "messages") {
				const term = q.trim();
				if (term.length < 2) {
					setRows(null);
					return;
				}
				const res = await read(
					`/api/messages/${conversationId}/search?q=${encodeURIComponent(term)}&limit=50`,
					(b) => b,
				);
				if (!cancelled) setRows(res.success && Array.isArray(res.data) ? res.data : []);
				return;
			}
			setRows(null);
			const kind = shelf === "photos" ? "image" : shelf === "voice" ? "audio" : "link";
			const res = await read(`/api/messages/${conversationId}/media?kind=${kind}&limit=60`, (b) => b);
			if (!cancelled) setRows(res.success && Array.isArray(res.data) ? res.data : []);
		};
		const id = window.setTimeout(() => void run(), shelf === "messages" ? 300 : 0);
		return () => {
			cancelled = true;
			window.clearTimeout(id);
		};
	}, [open, shelf, q, conversationId, read]);

	const who = (r: Row) => (typeof r.sender === "object" && r.sender ? displayNameOf(r.sender) : "");
	const go = (id: string) => {
		onJump(id);
		onClose();
	};

	return (
		<AnimatePresence>
			{open && (
				<>
					<OverlayScrim onClose={onClose} />
					<OverlayPanel
						dragClose={onClose}
						variant="sheet"
						ground="none"
						className="bg-surface sm:w-[min(560px,94vw)] sm:max-h-[86vh]"
						label="Search this chat"
					>
						<OverlayHeader title="In this chat" onClose={onClose} />
						<div className="shrink-0 px-4 pb-2">
							<Tabs
								ariaLabel="What to look through"
								value={shelf}
								onChange={setShelf}
								items={[
									{ key: "messages", label: "Messages" },
									{ key: "photos", label: "Photos" },
									{ key: "voice", label: "Voice" },
									{ key: "links", label: "Links" },
								]}
							/>
							{shelf === "messages" && (
								<div className="relative mt-2">
									<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
									<input
										value={q}
										onChange={(e) => setQ(e.target.value)}
										autoFocus
										placeholder="Search messages"
										className="w-full rounded-pill bg-primary/5 py-2.5 pl-10 pr-4 text-base text-primary outline-none transition-colors placeholder:text-subtle focus:bg-primary/10 sm:text-sm"
									/>
								</div>
							)}
						</div>
						<div className="min-h-[200px] flex-1 overflow-y-auto overscroll-contain pb-[calc(12px+var(--ws-safe-bottom))]">
							{shelf === "messages" && q.trim().length < 2 ? (
								<p className="px-6 py-10 text-center font-sans text-[calc(13px*var(--ws-fs))] text-subtle">
									Type a couple of letters.
								</p>
							) : rows === null ? (
								<div className="flex justify-center py-10 text-muted">
									<Loader2 className="h-6 w-6 animate-spin" />
								</div>
							) : rows.length === 0 ? (
								<p className="px-6 py-10 text-center font-sans text-[calc(13px*var(--ws-fs))] text-subtle">
									{shelf === "messages" ? "Nothing matches." : "Nothing here yet."}
								</p>
							) : shelf === "photos" ? (
								<div className="grid grid-cols-3 gap-[2px] px-2">
									{rows.map((r) => (
										<button
											key={r._id}
											type="button"
											onClick={() => go(r._id)}
											className="relative aspect-square cursor-zoom-in overflow-hidden rounded-[4px] bg-sunken"
										>
											{/* eslint-disable-next-line @next/next/no-img-element */}
											<img src={r.mediaUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
											{r.type === "video" && (
												<span className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-pill bg-scrim text-primary">
													<Play className="h-3 w-3" />
												</span>
											)}
										</button>
									))}
								</div>
							) : (
								<motion.div variants={staggerParentFast} initial="hidden" animate="show">
									{rows.map((r, i) => {
										const link = shelf === "links" ? (r.content ?? "").match(URL_RE)?.[0] : undefined;
										return (
											<CascadeRow key={r._id} index={i}>
												<button
													type="button"
													onClick={() => go(r._id)}
													className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-primary/5"
												>
													{shelf === "links" ? (
														<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-primary/5 text-muted">
															<Link2 className="h-4 w-4" />
														</span>
													) : (
														<span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-pill bg-raised">
															<SafeAvatar
																src={typeof r.sender === "object" ? r.sender?.avatar : undefined}
																eager
															/>
														</span>
													)}
													<span className="min-w-0 flex-1">
														<span className="block truncate font-sans text-[calc(14px*var(--ws-fs))] text-primary">
															{shelf === "links"
																? link
																: shelf === "voice"
																	? `Voice note${r.durationSec ? ` · ${Math.round(r.durationSec)}s` : ""}`
																	: r.content}
														</span>
														<span className="block truncate font-sans text-[calc(12px*var(--ws-fs))] text-muted">
															{who(r)}
															{who(r) ? " · " : ""}
															{formatTimeAgo(r.createdAt)}
														</span>
													</span>
												</button>
											</CascadeRow>
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
