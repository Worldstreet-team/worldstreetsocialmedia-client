"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Gift, HandWaving, Heart, PaperPlaneTilt } from "@phosphor-icons/react";
import type { Room } from "livekit-client";
import { BACKEND_URL, XSTREAM_API_URL } from "@/const";
import { useT } from "@/i18n/client";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

/** The cross-platform chat wire shape (matches Xstream's LiveChat). */
export interface ChatMsg {
	id: string;
	username: string;
	avatar: string;
	isMod?: boolean;
	platform?: "xstream" | "worldspace";
	content: string;
	/** "join" and "like" are display-only system rows, never sent. */
	type: "text" | "tip" | "reaction" | "join" | "like";
	tipAmount?: string;
	tipCurrency?: string;
	emoji?: string;
	timestamp: string;
}

/** Same catalogue as Xstream's chat — one gift economy, two storefronts. */
const GIFT_OPTIONS = [
	{ emoji: "\u{1F44F}", name: "Clap", usdMinor: 50 },
	{ emoji: "\u{1F525}", name: "Fire", usdMinor: 100 },
	{ emoji: "\u{1F680}", name: "Rocket", usdMinor: 500 },
	{ emoji: "\u{1F48E}", name: "Diamond", usdMinor: 1000 },
	{ emoji: "\u{1F451}", name: "Crown", usdMinor: 5000 },
] as const;

const centsToDollars = (minor: number) =>
	minor % 100 === 0 ? `$${minor / 100}` : `$${(minor / 100).toFixed(2)}`;

const timeLabel = () =>
	new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * One chat surface for every live context in socials: the in-app stream
 * viewer and the broadcaster dock. Messages ride the same LiveKit room and
 * the same persistence endpoint Xstream uses, so both audiences share a
 * single conversation. Messages sent from Xstream carry an Xstream badge
 * here; ours carry a Social badge there. Gifts arrive as tip rows.
 */
export function LiveChatPanel({
	streamId,
	room,
	me,
	glass = false,
	className,
}: {
	streamId: string;
	room: Room | null;
	me: { username: string; avatar: string } | null;
	glass?: boolean;
	className?: string;
}) {
	const t = useT();
	const [messages, setMessages] = useState<ChatMsg[]>([]);
	const [input, setInput] = useState("");
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [giftOpen, setGiftOpen] = useState(false);
	const [giftBusy, setGiftBusy] = useState(false);
	const [wallet, setWallet] = useState<number | null>(null);
	const [walletError, setWalletError] = useState<string | null>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const seenRef = useRef<Set<string>>(new Set());

	const append = useCallback((msg: ChatMsg) => {
		if (seenRef.current.has(msg.id)) return;
		seenRef.current.add(msg.id);
		setMessages((prev) => [...prev.slice(-149), msg]);
	}, []);

	// History from the shared persistence endpoint.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch(
					`${XSTREAM_API_URL}/v1/streams/${streamId}/chat?limit=50`,
				);
				const data = await res.json();
				if (cancelled) return;
				const rows = (data?.data?.messages ?? []).map((m: any) => ({
					id: String(m._id),
					username: String(m.username ?? ""),
					avatar: String(m.avatar ?? ""),
					isMod: Boolean(m.isMod),
					platform:
						m.platform === "socials" || m.platform === "worldspace"
							? "worldspace"
							: "xstream",
					content: String(m.content ?? ""),
					type: (m.type ?? "text") as ChatMsg["type"],
					tipAmount: m.tipAmount ?? undefined,
					tipCurrency: m.tipCurrency ?? undefined,
					emoji: m.emoji ?? undefined,
					timestamp: m.createdAt
						? new Date(m.createdAt).toLocaleTimeString([], {
								hour: "2-digit",
								minute: "2-digit",
							})
						: "",
				})) as ChatMsg[];
				for (const row of rows) seenRef.current.add(row.id);
				setMessages(rows);
			} catch {
				// History is best-effort; live messages still flow.
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [streamId]);

	// Live messages off the room's data channel.
	useEffect(() => {
		if (!room) return;
		let disposed = false;
		let detach: (() => void) | null = null;
		(async () => {
			const { RoomEvent } = await import("livekit-client");
			if (disposed) return;
			const handler = (payload: Uint8Array) => {
				try {
					const data = JSON.parse(new TextDecoder().decode(payload));
					// Engagement events render as quiet system rows — the
					// "X joined" / "X liked" handshake both platforms share.
					if (data.__evt === "join" && data.username) {
						append({
							id: `join-${data.username}-${Date.now()}`,
							username: String(data.username),
							avatar: "",
							platform:
								data.platform === "socials" || data.platform === "worldspace"
									? "worldspace"
									: "xstream",
							content: "",
							type: "join",
							timestamp: timeLabel(),
						} as ChatMsg);
						return;
					}
					if (data.__evt === "like" && data.username) {
						append({
							id: `like-${data.username}-${Date.now()}`,
							username: String(data.username),
							avatar: "",
							content: "",
							type: "like",
							timestamp: timeLabel(),
						} as ChatMsg);
						return;
					}
					if (data.__evt || !data.type || !data.username) return;
					append({
						...data,
						id: String(data.id ?? crypto.randomUUID()),
						platform:
							data.platform === "socials" || data.platform === "worldspace"
								? "worldspace"
								: "xstream",
					} as ChatMsg);
				} catch {
					// Not a chat payload.
				}
			};
			room.on(RoomEvent.DataReceived, handler);
			detach = () => room.off(RoomEvent.DataReceived, handler);
		})();
		return () => {
			disposed = true;
			detach?.();
		};
	}, [room, append]);

	useEffect(() => {
		const el = listRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [messages.length]);

	const send = async () => {
		const content = input.trim();
		if (!content || sending || !me) return;
		setSending(true);
		setError(null);
		setInput("");
		try {
			const clerk = (window as any).Clerk;
			const token = await clerk?.session?.getToken();
			if (!token) throw new Error("unauthorized");
			// Persist first so moderation rules are authoritative, then fan out.
			const res = await fetch(
				`${XSTREAM_API_URL}/v1/streams/${streamId}/chat`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						content,
						type: "text",
						platform: "worldspace",
					}),
				},
			);
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(body?.message ?? "rejected");
			}
			const saved = await res.json().catch(() => null);
			const msg: ChatMsg = {
				id: String(saved?.data?.message?._id ?? crypto.randomUUID()),
				username: me.username,
				avatar: me.avatar,
				platform: "worldspace",
				content,
				type: "text",
				timestamp: timeLabel(),
			};
			// Local echo only — the API broadcasts the persisted message into
			// the room itself, and append() dedupes it by id when it echoes
			// back. Publishing from here was the old delivery path, and it
			// silently delivered nothing when this token couldn't publish data.
			append(msg);
		} catch (err) {
			setInput(content);
			setError(err instanceof Error ? err.message : t("chat.failed"));
		} finally {
			setSending(false);
		}
	};

	/**
	 * Wallet balance, read from OUR OWN gateway — not Xstream's.
	 *
	 * Every platform holds its own wallet-service branch token (socials is
	 * registered wallet-side as `social:<token>`, the same way academy has
	 * its own). Reading the balance through Xstream's API borrowed a
	 * different platform's credentials for a question about this user's
	 * money, and made a simple balance read fail whenever the live service
	 * was unreachable. It is a read against our own branch; it belongs here.
	 */
	const loadWallet = useCallback(async () => {
		setWalletError(null);
		try {
			const token = await (window as any).Clerk?.session?.getToken();
			if (!token) {
				setWalletError(t("chat.walletSignedOut"));
				return;
			}
			const res = await fetch(`${BACKEND_URL}/api/wallet/balance`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			const body = await res.json().catch(() => null);
			// The gateway answers 200 with available:false on a wallet outage
			// rather than failing the request — treat that as "unreadable",
			// never as a zero balance.
			if (res.ok && body?.available && body.balances?.USD) {
				setWallet(Number(body.balances.USD.availableMinor ?? 0));
				return;
			}
			setWallet(null);
			setWalletError(t("chat.walletUnavailable"));
		} catch {
			setWallet(null);
			setWalletError(t("chat.walletUnreachable"));
		}
	}, [t]);

	useEffect(() => {
		if (giftOpen) void loadWallet();
	}, [giftOpen, loadWallet]);

	/**
	 * Gifts ride the same wallet-charged Xstream endpoint the Xtreme app
	 * uses: the charge, the split, and the tip announcement are identical —
	 * WorldSpace is just a second storefront for the same economy.
	 */
	const sendGift = async (option: (typeof GIFT_OPTIONS)[number]) => {
		if (!me || giftBusy) return;
		setGiftBusy(true);
		setError(null);
		try {
			const token = await (window as any).Clerk?.session?.getToken();
			if (!token) throw new Error("unauthorized");
			const res = await fetch(
				`${XSTREAM_API_URL}/v1/streams/${streamId}/gifts`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
						"Idempotency-Key": crypto.randomUUID(),
					},
					body: JSON.stringify({
						amountUsdMinor: option.usdMinor,
						giftName: option.name,
						emoji: option.emoji,
						platform: "worldspace",
					}),
				},
			);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				throw new Error(body?.message ?? t("chat.giftFailed"));
			}
			const announcement = body?.data?.chatMessage;
			append({
				id: String(announcement?._id ?? crypto.randomUUID()),
				username: me.username,
				avatar: me.avatar,
				platform: "worldspace",
				content: announcement?.content ?? `sent a ${option.name}`,
				type: "tip",
				tipAmount: announcement?.tipAmount ?? centsToDollars(option.usdMinor).slice(1),
				tipCurrency: "USD",
				emoji: option.emoji,
				timestamp: timeLabel(),
			});
			setGiftOpen(false);
			// Show the spend immediately, then reconcile against the wallet.
			// The charge books through Xstream's branch while we read our own,
			// but both address /v1/wallet/<clerkUserId>/… — one balance per
			// user, so the authoritative figure reflects the gift. Without the
			// re-read the optimistic number would drift from it.
			setWallet((prev) =>
				prev === null ? prev : Math.max(0, prev - option.usdMinor),
			);
			void loadWallet();
		} catch (err) {
			setError(err instanceof Error ? err.message : t("chat.giftFailed"));
		} finally {
			setGiftBusy(false);
		}
	};

	const ink = glass ? "glass-ink" : "text-primary";
	const inkDim = glass ? "glass-ink-dim" : "text-muted";
	const inkFaint = glass ? "glass-ink-faint" : "text-subtle";

	return (
		<div className={clsx("flex flex-col min-h-0", className)}>
			<div
				ref={listRef}
				className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col gap-1.5"
			>
				{messages.length === 0 && (
					<p className={clsx("m-auto font-sans text-[12.5px]", inkFaint)}>
						{t("chat.empty")}
					</p>
				)}
				{messages.map((msg) =>
					msg.type === "join" || msg.type === "like" ? (
						// System rows: one quiet line, no bubble — the room's
						// pulse, not someone speaking.
						<div
							key={msg.id}
							className="flex items-center gap-1.5 px-1 py-0.5"
						>
							{msg.type === "like" ? (
								<Heart size={11} weight="fill" className="shrink-0 text-danger" />
							) : (
								<HandWaving
									size={11}
									weight="fill"
									className={clsx("shrink-0", inkFaint)}
								/>
							)}
							<span
								className={clsx("font-sans text-[11.5px] truncate", inkFaint)}
							>
								<span className={clsx("font-semibold", inkDim)}>
									{msg.username}
								</span>{" "}
								{msg.type === "like"
									? t("chat.likedRow")
									: t("chat.joinedRow")}
							</span>
						</div>
					) : msg.type === "tip" ? (
						<div
							key={msg.id}
							className="flex items-center gap-2 rounded-lg bg-gold/10 px-2.5 py-2"
						>
							<Gift size={15} weight="fill" className="text-gold shrink-0" />
							<span className="font-sans text-[12.5px] font-semibold text-gold truncate">
								{msg.username}
							</span>
							<span className="font-sans text-[12.5px] text-gold/80 truncate">
								{msg.content || t("chat.gifted")}
							</span>
							{msg.tipAmount && (
								<span className="ml-auto font-sans text-[12.5px] font-bold text-gold tabular-nums shrink-0">
									{msg.tipAmount}
								</span>
							)}
						</div>
					) : msg.type === "reaction" ? (
						<div key={msg.id} className="flex items-center gap-2 px-1">
							<span className={clsx("font-sans text-[12px]", inkDim)}>
								{msg.username}
							</span>
							<span className="text-[15px] leading-none">{msg.emoji}</span>
						</div>
					) : (
						<div key={msg.id} className="flex gap-2 px-1 py-0.5">
							<span className="relative h-5 w-5 rounded-pill overflow-hidden shrink-0 mt-0.5 bg-white/10">
								<SafeAvatar src={msg.avatar} className="object-cover" />
							</span>
							<div className="min-w-0 flex-1">
								<span className="flex items-center gap-1.5 min-w-0">
									<span
										className={clsx(
											"font-sans text-[12px] font-semibold truncate",
											msg.isMod ? "text-success" : inkDim,
										)}
									>
										{msg.username}
									</span>
									{msg.platform !== "worldspace" && (
										<span className="shrink-0 rounded-[4px] bg-danger/15 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-danger">
											Xstream
										</span>
									)}
									<span className={clsx("text-[10px] shrink-0", inkFaint)}>
										{msg.timestamp}
									</span>
								</span>
								<p
									className={clsx(
										"font-sans text-[13px] leading-snug break-words",
										ink,
									)}
								>
									{msg.content}
								</p>
							</div>
						</div>
					),
				)}
			</div>

			{error && (
				<p className="px-3 pb-1 font-sans text-[11.5px] text-danger truncate">
					{error}
				</p>
			)}

			{giftOpen && (
				<div
					className={clsx(
						"border-t p-3",
						glass ? "border-white/10" : "border-hairline",
					)}
				>
					<div className="mb-2 flex items-center justify-between">
						<span
							className={clsx(
								"font-sans text-[11px] font-semibold uppercase tracking-[0.1em]",
								glass ? "glass-ink-faint" : "text-subtle",
							)}
						>
							{t("chat.gift")}
						</span>
						{wallet !== null ? (
							<span
								className={clsx(
									"font-sans text-[11px] tabular-nums",
									glass ? "glass-ink-dim" : "text-muted",
								)}
							>
								{t("chat.wallet")} {centsToDollars(wallet)}
							</span>
						) : walletError ? (
							<span className="font-sans text-[11px] text-danger">
								{walletError}
							</span>
						) : null}
					</div>
					<div className="flex flex-wrap gap-1.5">
						{GIFT_OPTIONS.map((g) => (
							<button
								key={g.name}
								type="button"
								disabled={giftBusy || !me}
								onClick={() => void sendGift(g)}
								className={clsx(
									"flex items-center gap-1.5 rounded-pill px-3 py-1.5 font-sans text-[12px] font-semibold transition-colors cursor-pointer disabled:opacity-40",
									glass
										? "bg-white/[0.08] glass-ink hover:bg-white/[0.14]"
										: "bg-raised text-primary hover:bg-hairline",
								)}
							>
								<span className="text-[14px] leading-none">{g.emoji}</span>
								{g.name}
								<span
									className={clsx(
										"tabular-nums",
										glass ? "glass-ink-faint" : "text-subtle",
									)}
								>
									{centsToDollars(g.usdMinor)}
								</span>
							</button>
						))}
					</div>
				</div>
			)}

			<div
				className={clsx(
					"flex items-center gap-2 p-2.5 border-t",
					glass ? "border-white/10" : "border-hairline",
				)}
			>
				<button
					type="button"
					onClick={() => setGiftOpen((v) => !v)}
					disabled={!me}
					aria-label={t("chat.gift")}
					aria-pressed={giftOpen}
					className={clsx(
						"flex h-9 w-9 shrink-0 items-center justify-center rounded-pill transition-colors cursor-pointer disabled:opacity-40",
						giftOpen
							? "bg-gold/20 text-gold"
							: glass
								? "bg-white/[0.08] glass-ink-dim hover:glass-ink"
								: "bg-raised text-muted hover:text-primary",
					)}
				>
					<Gift size={15} weight={giftOpen ? "fill" : "bold"} />
				</button>
				<input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") void send();
					}}
					placeholder={me ? t("chat.placeholder") : t("chat.signedOut")}
					disabled={!me}
					maxLength={500}
					className={clsx(
						"flex-1 min-w-0 h-9 rounded-pill px-3.5 font-sans text-[13px] outline-none border-0",
						glass
							? "bg-white/[0.08] glass-ink placeholder:text-white/35"
							: "bg-raised text-primary placeholder:text-subtle",
					)}
				/>
				<button
					type="button"
					onClick={() => void send()}
					disabled={!input.trim() || sending || !me}
					aria-label={t("chat.send")}
					className={clsx(
						"flex h-9 w-9 shrink-0 items-center justify-center rounded-pill transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
						glass
							? "glass-cta"
							: "bg-brand text-brand-on hover:bg-brand-active",
					)}
				>
					<PaperPlaneTilt size={15} weight="fill" />
				</button>
			</div>
		</div>
	);
}
