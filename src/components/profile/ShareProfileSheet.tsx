"use client";

import { AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { RiLinkM, RiShareForwardFill } from "@remixicon/react";
import clsx from "clsx";
import { toast } from "sonner";
import { useGatewayRead } from "@/hooks/useGateway";
import { postJsonDirect } from "@/lib/upload-direct";
import { startConversationAction } from "@/lib/conversation.actions";
import { conversationIdentity } from "@/lib/conversation-identity";
import { SHARE_TARGETS, sharePost } from "@/components/feed/ShareMenu";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { useT } from "@/i18n/client";

/** A thread the sheet can send into: DMs and groups alike. */
interface ChatRow {
	id: string;
	title: string;
	avatar: string;
	/** DM peer id, so a people search does not list someone twice. */
	peerId: string | null;
}

interface Person {
	_id: string;
	username?: string;
	firstName?: string;
	lastName?: string;
	avatar?: string;
}

const personName = (u: Person) =>
	[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "";

/**
 * Share a profile (owner 2026-09-16): into a chat, as a link, or off the
 * platform.
 *
 * Into a chat is the WhatsApp move: the thread receives the contact CARD
 * (`type: "contact"`), which renders with a Message button, not a pasted
 * URL. One tap on a face in the rail sends it; a search reaches anyone,
 * starting the thread if there is none. Off-platform reuses the post share
 * targets, so the two share surfaces cannot drift apart.
 */
export function ShareProfileSheet({
	open,
	onClose,
	profileId,
	username,
	fullName,
	avatar,
}: {
	open: boolean;
	onClose: () => void;
	profileId: string;
	username: string;
	fullName: string;
	avatar?: string;
}) {
	const t = useT();
	const read = useGatewayRead();
	useOverlayDismiss(open, onClose);

	const [chats, setChats] = useState<ChatRow[] | null>(null);
	const [q, setQ] = useState("");
	const [people, setPeople] = useState<Person[]>([]);
	const [searching, setSearching] = useState(false);
	const [sent, setSent] = useState<Set<string>>(() => new Set());
	const [busy, setBusy] = useState<Set<string>>(() => new Set());
	const [copied, setCopied] = useState(false);
	const [canSystemShare, setCanSystemShare] = useState(false);

	const url =
		typeof window === "undefined"
			? `/profile/${username}`
			: `${window.location.origin}/profile/${username}`;
	const shareText = `${fullName} (@${username}) on WorldSpace`;

	useEffect(() => {
		setCanSystemShare(typeof navigator !== "undefined" && "share" in navigator);
	}, []);

	// Fresh state per opening: what was sent last time is not sent now.
	useEffect(() => {
		if (!open) return;
		setQ("");
		setPeople([]);
		setSent(new Set());
		setBusy(new Set());
		setCopied(false);
		let alive = true;
		(async () => {
			const res = await read("/api/messages/conversations", (b) =>
				Array.isArray(b) ? b : (b?.data ?? []),
			);
			if (!alive) return;
			const list = Array.isArray(res.data) ? res.data : [];
			setChats(
				list
					// A request shelf thread is not a chat yet; and sharing someone
					// with themself is noise.
					.filter((c: any) => !c.isRequestForMe && c.status !== "request")
					.map((c: any) => {
						const id = conversationIdentity(c);
						return {
							id: String(c._id),
							title: id.title,
							avatar: id.avatar,
							peerId: id.peer?._id ?? null,
						};
					})
					.filter((c: ChatRow) => c.peerId !== profileId),
			);
		})();
		return () => {
			alive = false;
		};
	}, [open, read, profileId]);

	useEffect(() => {
		const term = q.trim();
		if (!open || term.length < 2) {
			setPeople([]);
			return;
		}
		setSearching(true);
		const id = window.setTimeout(async () => {
			const res = await read(
				`/api/users/search?q=${encodeURIComponent(term)}`,
				(b) => b.data,
			);
			if (res.success && Array.isArray(res.data))
				setPeople(res.data as Person[]);
			setSearching(false);
		}, 300);
		return () => window.clearTimeout(id);
	}, [open, q, read]);

	const term = q.trim().toLowerCase();
	const matchingChats = useMemo(
		() =>
			term
				? (chats ?? []).filter((c) => c.title.toLowerCase().includes(term))
				: (chats ?? []),
		[chats, term],
	);
	const knownPeers = useMemo(
		() => new Set((chats ?? []).map((c) => c.peerId).filter(Boolean)),
		[chats],
	);
	const newPeople = people.filter(
		(u) => u._id !== profileId && !knownPeers.has(u._id),
	);

	const mark = (
		setter: React.Dispatch<React.SetStateAction<Set<string>>>,
		key: string,
		on: boolean,
	) =>
		setter((prev) => {
			const next = new Set(prev);
			if (on) next.add(key);
			else next.delete(key);
			return next;
		});

	/** The gateway looks the profile up and writes the card from the record. */
	const sendInto = async (conversationId: string, key: string) => {
		if (sent.has(key) || busy.has(key)) return;
		mark(setBusy, key, true);
		const res = await postJsonDirect("/api/messages", {
			conversationId,
			content: "",
			type: "contact",
			contact: { profile: profileId },
			clientKey: `share-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
		});
		mark(setBusy, key, false);
		if (!res.success) {
			toast.error(res.message || t("share.failed"));
			return;
		}
		mark(setSent, key, true);
	};

	const sendToPerson = async (u: Person) => {
		const key = `p:${u._id}`;
		if (sent.has(key) || busy.has(key)) return;
		mark(setBusy, key, true);
		const r: any = await startConversationAction(u._id);
		const id = r?.data?._id ?? r?.data?.conversation?._id;
		if (!r?.success || !id) {
			mark(setBusy, key, false);
			toast.error(r?.error || r?.message || t("share.failed"));
			return;
		}
		mark(setBusy, key, false);
		await sendInto(String(id), key);
	};

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			toast.success(t("share.linkCopied"));
			window.setTimeout(() => setCopied(false), 1600);
		} catch {
			toast.error(t("share.failed"));
		}
	};

	const label13 =
		"font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary";
	const sendPill = (key: string) =>
		clsx(
			"flex h-8 shrink-0 items-center gap-1 rounded-pill px-3 font-sans text-[calc(13px*var(--ws-fs))] font-semibold transition-colors",
			sent.has(key)
				? "bg-primary/5 text-muted"
				: "cursor-pointer bg-primary/10 text-primary hover:bg-primary/15",
			busy.has(key) && "opacity-60",
		);
	const sendPillCopy = (key: string) =>
		sent.has(key) ? (
			<>
				<Check className="h-3.5 w-3.5" />
				{t("share.sent")}
			</>
		) : (
			t("share.send")
		);

	return (
		<AnimatePresence>
			{open && (
				<>
					<OverlayScrim key="share-scrim" onClose={onClose} label={t("common.close")} />
					<OverlayPanel
						key="share-panel"
						variant="sheet"
						label={t("profile.share")}
						ground="none"
						dragClose={onClose}
						className="bg-surface sm:w-[min(480px,94vw)]"
					>
						<OverlayHeader title={t("profile.share")} onClose={onClose} closeLabel={t("common.close")} />

						<div className="flex flex-col gap-5 overflow-y-auto px-4 pb-[calc(16px+var(--ws-safe-bottom))] pt-1">
							{/* Who, and the link. */}
							<div className="flex items-center gap-3 rounded-xl bg-primary/5 p-3">
								<span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-raised">
									<SafeAvatar src={avatar} />
								</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary">
										{fullName}
									</span>
									<span className="block truncate font-sans text-[calc(12px*var(--ws-fs))] text-muted">
										{url.replace(/^https?:\/\//, "")}
									</span>
								</span>
								<button
									type="button"
									onClick={copy}
									className={clsx(
										"flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-pill px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold transition-colors",
										copied
											? "bg-primary/10 text-primary"
											: "bg-primary text-page hover:bg-muted",
									)}
								>
									{copied ? (
										<Check className="h-4 w-4" />
									) : (
										<RiLinkM size={16} />
									)}
									{copied ? t("share.copied") : t("share.copyLink")}
								</button>
							</div>

							{/* Into a chat. */}
							<section>
								<h3 className={label13}>{t("share.sendTo")}</h3>
								<div className="relative mt-2">
									<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
									<input
										value={q}
										onChange={(e) => setQ(e.target.value)}
										placeholder={t("share.searchPeople")}
										className="h-10 w-full rounded-pill bg-primary/5 pl-10 pr-4 text-base text-primary outline-none transition-colors placeholder:text-subtle focus:bg-primary/10 sm:text-[calc(14px*var(--ws-fs))]"
									/>
								</div>

								{term ? (
									<div className="-mx-2 mt-2 flex flex-col">
										{matchingChats.map((c) => (
											<div
												key={c.id}
												className="flex items-center gap-3 rounded-lg px-2 py-2"
											>
												<span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-raised">
													<SafeAvatar src={c.avatar} />
												</span>
												<span className="min-w-0 flex-1 truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary">
													{c.title}
												</span>
												<button
													type="button"
													onClick={() => sendInto(c.id, c.id)}
													disabled={sent.has(c.id) || busy.has(c.id)}
													className={sendPill(c.id)}
												>
													{sendPillCopy(c.id)}
												</button>
											</div>
										))}
										{newPeople.map((u) => {
											const key = `p:${u._id}`;
											return (
												<div
													key={u._id}
													className="flex items-center gap-3 rounded-lg px-2 py-2"
												>
													<span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-raised">
														<SafeAvatar src={u.avatar} />
													</span>
													<span className="min-w-0 flex-1">
														<span className="block truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary">
															{personName(u)}
														</span>
														{u.username && (
															<span className="block truncate font-sans text-[calc(12px*var(--ws-fs))] text-muted">
																@{u.username}
															</span>
														)}
													</span>
													<button
														type="button"
														onClick={() => sendToPerson(u)}
														disabled={sent.has(key) || busy.has(key)}
														className={sendPill(key)}
													>
														{sendPillCopy(key)}
													</button>
												</div>
											);
										})}
										{!searching &&
											matchingChats.length === 0 &&
											newPeople.length === 0 && (
												<p className="px-2 py-6 text-center font-sans text-[calc(13px*var(--ws-fs))] text-subtle">
													{term.length < 2 ? t("share.keepTyping") : t("share.nobody")}
												</p>
											)}
									</div>
								) : chats === null ? (
									<div className="-mx-4 mt-3 flex gap-3 overflow-hidden px-4">
										{Array.from({ length: 6 }, (_, i) => (
											<span
												key={i}
												className="skeleton h-14 w-14 shrink-0 rounded-pill"
											/>
										))}
									</div>
								) : chats.length === 0 ? (
									<p className="py-6 text-center font-sans text-[calc(13px*var(--ws-fs))] text-subtle">
										{t("share.noChats")}
									</p>
								) : (
									<div className="-mx-4 mt-3 flex gap-1 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
										{chats.slice(0, 16).map((c) => (
											<button
												key={c.id}
												type="button"
												aria-label={`${t("share.send")}: ${c.title}`}
												onClick={() => sendInto(c.id, c.id)}
												disabled={sent.has(c.id) || busy.has(c.id)}
												className={clsx(
													"flex w-[68px] shrink-0 cursor-pointer flex-col items-center gap-1.5 rounded-lg px-1 py-1.5 transition-colors",
													!sent.has(c.id) && "hover:bg-primary/5",
													busy.has(c.id) && "opacity-60",
												)}
											>
												<span className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-pill bg-raised">
													<SafeAvatar src={c.avatar} />
													{sent.has(c.id) && (
														<span className="absolute inset-0 flex items-center justify-center bg-page/70 text-primary">
															<Check className="h-6 w-6" />
														</span>
													)}
												</span>
												<span
													className={clsx(
														"w-full truncate text-center font-sans text-[calc(12px*var(--ws-fs))]",
														sent.has(c.id) ? "text-muted" : "text-primary",
													)}
												>
													{sent.has(c.id) ? t("share.sent") : c.title}
												</span>
											</button>
										))}
									</div>
								)}
							</section>

							{/* Off the platform. */}
							<section>
								<h3 className={label13}>{t("share.moreWays")}</h3>
								<div className="-mx-4 mt-3 flex gap-1 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
									{canSystemShare && (
										<button
											type="button"
											onClick={() => void sharePost({ url, text: shareText })}
											className="flex w-[68px] shrink-0 cursor-pointer flex-col items-center gap-1.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-primary/5"
										>
											<span className="flex h-12 w-12 items-center justify-center rounded-pill bg-primary/5 text-primary">
												<RiShareForwardFill size={20} />
											</span>
											<span className="w-full truncate text-center font-sans text-[calc(12px*var(--ws-fs))] text-primary">
												{t("share.otherApps")}
											</span>
										</button>
									)}
									{SHARE_TARGETS.map((tgt) => (
										<a
											key={tgt.key}
											href={tgt.href(url, shareText)}
											target="_blank"
											rel="noopener noreferrer"
											className="flex w-[68px] shrink-0 cursor-pointer flex-col items-center gap-1.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-primary/5"
										>
											<span className="flex h-12 w-12 items-center justify-center rounded-pill bg-primary/5 text-primary">
												<tgt.Icon size={20} />
											</span>
											<span className="w-full truncate text-center font-sans text-[calc(12px*var(--ws-fs))] text-primary">
												{tgt.label}
											</span>
										</a>
									))}
								</div>
							</section>
						</div>
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}
