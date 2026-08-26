"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { Gift, PaperPlaneTilt } from "@phosphor-icons/react";
import type { Room } from "livekit-client";
import { DEFAULT_AVATAR, XSTREAM_API_URL } from "@/const";
import { useT } from "@/i18n/client";

/** The cross-platform chat wire shape (matches Xstream's LiveChat). */
export interface ChatMsg {
	id: string;
	username: string;
	avatar: string;
	isMod?: boolean;
	platform?: "xstream" | "socials";
	content: string;
	type: "text" | "tip" | "reaction";
	tipAmount?: string;
	tipCurrency?: string;
	emoji?: string;
	timestamp: string;
}

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
					platform: m.platform === "socials" ? "socials" : "xstream",
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
					if (data.__evt || !data.type || !data.username) return;
					append({
						...data,
						id: String(data.id ?? crypto.randomUUID()),
						platform: data.platform === "socials" ? "socials" : "xstream",
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
						platform: "socials",
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
				platform: "socials",
				content,
				type: "text",
				timestamp: timeLabel(),
			};
			append(msg);
			if (room?.localParticipant) {
				room.localParticipant.publishData(
					new TextEncoder().encode(JSON.stringify(msg)),
					{ reliable: true },
				);
			}
		} catch (err) {
			setInput(content);
			setError(err instanceof Error ? err.message : t("chat.failed"));
		} finally {
			setSending(false);
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
					msg.type === "tip" ? (
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
								<Image
									src={msg.avatar || DEFAULT_AVATAR}
									alt=""
									fill
									className="object-cover"
								/>
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
									{msg.platform !== "socials" && (
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

			<div
				className={clsx(
					"flex items-center gap-2 p-2.5 border-t",
					glass ? "border-white/10" : "border-hairline",
				)}
			>
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
