"use client";

import clsx from "clsx";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { memo, useRef } from "react";
import { RiErrorWarningFill, RiReplyLine } from "@remixicon/react";
import { haptic } from "@/lib/haptics";
import {
	EmbeddedPost,
	firstPlatformPostId,
} from "@/components/feed/EmbeddedPost";
import { MessageTicks, tickStateFor } from "@/components/messages/MessageTicks";
import { VoiceMessage } from "@/components/messages/VoiceMessage";
import { PaymentBubble } from "@/components/messages/PaymentBubble";
import { CallLogRow } from "@/components/messages/CallLogRow";
import { Attachment } from "./Attachment";
import {
	senderColor,
	systemEventCopy,
	type SystemEvent,
} from "./groupSystem";

/** Structural shape only — MessageBox's richer interfaces satisfy it. */
export interface BubbleMessage {
	_id: string;
	clientKey?: string;
	content: string;
	type: string;
	mediaUrl?: string;
	amountMinor?: number;
	durationSec?: number;
	width?: number;
	height?: number;
	thumbhash?: string;
	peaks?: number[];
	groupKey?: string;
	/** Transient, this tab only: 0..1 while the media uploads. */
	uploadPct?: number;
	/** Transient, this tab only: the upload or send failed; offer retry. */
	failed?: boolean;
	/** Voice-note transcript, when a speech service produced one. */
	transcript?: string;
	reactions?: { profile: string; emoji: string }[];
	payTo?: string;
	payToName?: string;
	systemEvent?: SystemEvent;
	storyRef?: { story: string; thumbnail: string; authorUsername: string };
	replyTo?: {
		_id: string;
		content?: string;
		type?: string;
		durationSec?: number;
		sender?: { username?: string };
	} | null;
	sender: { _id: string } & Record<string, unknown>;
	createdAt: string;
}

function quotedPreview(r: {
	content?: string;
	type?: string;
	durationSec?: number;
}): string {
	if (r.content?.trim()) return r.content.trim();
	switch (r.type) {
		case "image":
			return "Photo";
		case "video":
			return "Video";
		case "audio":
			return r.durationSec
				? `Voice note · ${Math.floor(r.durationSec / 60)}:${String(
						Math.round(r.durationSec % 60),
					).padStart(2, "0")}`
				: "Voice note";
		case "payment":
			return "Payment";
		default:
			return "Message";
	}
}

const URL_RE = /(https?:\/\/[^\s<]+)/;
const TOKEN_RE = /(https?:\/\/[^\s<]+|@[A-Za-z0-9_.]{2,32})/g;
function linkify(text: string, mine: boolean) {
	return text.split(TOKEN_RE).map((part, i) => {
		if (URL_RE.test(part) && part.startsWith("http")) {
			// Accent, no underline on theirs (owner pick); on the gradient
			// bubble the accent is the ground, so mine keeps a white underline.
			return (
				<a
					// biome-ignore lint/suspicious/noArrayIndexKey: static split of one string
					key={i}
					href={part}
					target="_blank"
					rel="noopener noreferrer"
					className={clsx(
						"break-all",
						mine
							? "underline underline-offset-2 opacity-95 hover:opacity-100"
							: "font-medium text-brand hover:underline",
					)}
					onClick={(e) => e.stopPropagation()}
				>
					{part}
				</a>
			);
		}
		if (part.startsWith("@") && part.length > 2) {
			// A mention is a CHIP (owner pick): a tinted pill around the handle
			// that reads on both fills. Handles that resolve to nobody still
			// render — the gateway only ever NOTIFIES real roster members.
			return (
				<a
					// biome-ignore lint/suspicious/noArrayIndexKey: static split of one string
					key={i}
					href={`/profile/${part.slice(1)}`}
					className={clsx(
						"rounded-md px-1.5 py-[1px] font-semibold",
						mine ? "bg-black/20 text-white" : "bg-brand/18 text-brand",
					)}
					onClick={(e) => e.stopPropagation()}
				>
					{part}
				</a>
			);
		}
		return part;
	});
}

/**
 * The centred stamp between message groups — Instagram's grammar: a time
 * today, weekday + time this week, date + time beyond. Shown only across a
 * real gap (ThreadList decides), so per-message timestamps are gone.
 */
export function dayLabel(iso: string) {
	const d = new Date(iso);
	const today = new Date();
	if (d.toDateString() === today.toDateString()) return format(d, "h:mm a");
	const age = today.getTime() - d.getTime();
	if (age < 6 * 24 * 3600_000) return format(d, "EEE h:mm a");
	return format(
		d,
		d.getFullYear() === today.getFullYear()
			? "MMM d, h:mm a"
			: "MMM d, yyyy, h:mm a",
	);
}

export interface BubbleProps {
	m: BubbleMessage;
	isMe: boolean;
	/** Last-in-run inbound messages carry the sender's face (Instagram). */
	showAvatar?: boolean;
	/** Only the newest of MY messages shows delivery state, as text. */
	showTicks?: boolean;
	/** The peer's face: a read receipt is their 14px avatar (owner pick). */
	peerAvatar?: string;
	/** Consecutive photos sent together render as ONE tight grid (owner
	 *  pick); the first of the batch carries the whole album. */
	album?: BubbleMessage[];
	/** The accent rule + label sits above this row (owner pick). */
	showUnreadDivider?: boolean;
	unreadLabel?: number;
	avatarUrl?: string;
	/** Live arrival — the only bubbles that animate in (register 152). */
	fresh?: boolean;
	showDay: boolean;
	sameRunAsPrev: boolean;
	endsRun: boolean;
	flashed: boolean;
	peerName: string;
	deliveredAt: number | null;
	readAt: number | null;
	peerReadUpTo?: string | null;
	/** Next voice note downthread — finished notes chain (register 87). */
	autoplayNextId?: string;
	myProfileId?: string;
	/** Group threads name their senders and colour them (register 105). */
	isGroup?: boolean;
	onReply: (m: BubbleMessage) => void;
	onMenu: (x: number, y: number, m: BubbleMessage) => void;
	onJump: (id: string) => void;
	onMediaClick: (id: string) => void;
	onStory: (ref: NonNullable<BubbleMessage["storyRef"]>) => void;
	onCallBack: (video: boolean) => void;
	onRetryUpload?: (clientKey: string) => void;
	onCancelUpload?: (clientKey: string) => void;
	/** Toggle MY reaction on this message (register 132/134). */
	onReact?: (m: BubbleMessage, emoji: string) => void;
}

/**
 * One message, memoized — the fix for the thread's signature jank.
 *
 * Every keystroke, receipt and presence tick used to re-render EVERY bubble
 * because they all rendered inline in a 2,293-line component. Now a bubble
 * re-renders only when its own props move. The swipe-to-reply gesture lives
 * HERE, on refs and direct style writes: dragging a bubble costs zero React
 * renders anywhere.
 */
export const MessageBubble = memo(function MessageBubble({
	m,
	isMe,
	showAvatar,
	showTicks,
	peerAvatar,
	album,
	showUnreadDivider,
	unreadLabel,
	avatarUrl,
	fresh,
	showDay,
	sameRunAsPrev,
	endsRun,
	flashed,
	peerName,
	deliveredAt,
	readAt,
	peerReadUpTo,
	autoplayNextId,
	myProfileId,
	isGroup,
	onReply,
	onMenu,
	onJump,
	onMediaClick,
	onStory,
	onCallBack,
	onRetryUpload,
	onCancelUpload,
	onReact,
}: BubbleProps) {
	const rowRef = useRef<HTMLDivElement | null>(null);
	const touch = useRef<{ x: number; y: number } | null>(null);
	const dxRef = useRef(0);
	const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hintRef = useRef<HTMLSpanElement | null>(null);
	const armedRef = useRef(false);
	const isTemp = m._id.startsWith("temp-");

	const setDx = (dx: number) => {
		dxRef.current = dx;
		const el = rowRef.current;
		if (!el) return;
		if (dx === 0) {
			el.style.transition = "transform 200ms var(--ws-ease)";
			el.style.transform = "";
		} else {
			el.style.transition = "none";
			el.style.transform = `translateX(${dx}px)`;
		}
		// The reply glyph scales in behind the bubble as you drag and fills
		// at the commit point, with one haptic tick when you cross it (owner
		// pick: "arrow scales in behind").
		const hint = hintRef.current;
		if (hint) {
			const t = Math.min(1, dx / 56);
			hint.style.opacity = String(t);
			hint.style.transform = `translate(${-dx}px, -50%) scale(${0.5 + 0.5 * t})`;
			hint.style.background = t >= 0.86 ? "var(--ws-brand-primary)" : "";
			hint.style.color = t >= 0.86 ? "var(--ws-brand-on-primary)" : "";
		}
		const armed = dx > 48;
		if (armed && !armedRef.current) haptic(8);
		armedRef.current = armed;
	};

	if (m.type === "system") {
		const copy = m.systemEvent
			? systemEventCopy(
					m.systemEvent,
					(m.sender as { firstName?: string; username?: string })
						?.firstName ||
						(m.sender as { username?: string })?.username,
					myProfileId,
				)
			: m.content;
		if (!copy) return null;
		const actorAvatar = (m.sender as { avatar?: string })?.avatar;
		return (
			<div className="mx-auto flex w-full max-w-[52rem] justify-center px-4 py-1.5">
				<span className="inline-flex items-center gap-1.5 rounded-pill bg-page/70 px-3 py-1 text-center font-sans text-[11.5px] font-medium text-muted">
					{/* The actor's face inline (owner pick): a busy group reads
					    as people, not names. */}
					{actorAvatar && (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={actorAvatar} alt="" className="h-4 w-4 rounded-pill object-cover" />
					)}
					{copy}
				</span>
			</div>
		);
	}
	if (m.type === "payment") {
		const senderName =
			(m.sender as { firstName?: string })?.firstName ||
			(m.sender as { username?: string })?.username ||
			undefined;
		return (
			<PaymentBubble
				amountMinor={m.amountMinor ?? 0}
				note={m.content}
				at={m.createdAt}
				mine={isMe}
				peerName={isGroup ? undefined : peerName}
				toName={m.payToName}
				toMe={!!myProfileId && m.payTo === myProfileId}
				senderName={isGroup ? senderName : peerName}
			/>
		);
	}
	if (m.type === "call") {
		return (
			<CallLogRow
				content={m.content}
				at={m.createdAt}
				mine={isMe}
				onCallBack={onCallBack}
			/>
		);
	}

	return (
		<>
			{showUnreadDivider && (
				// Telegram's rule (owner pick): the thread opens here.
				<div className="mx-auto flex w-full max-w-[52rem] items-center gap-3 px-4 py-3 sm:px-6">
					<span className="h-px flex-1 bg-brand/40" />
					<span className="font-sans text-[11px] font-semibold text-brand">
						{unreadLabel && unreadLabel > 1
							? `${unreadLabel} unread messages`
							: "Unread messages"}
					</span>
					<span className="h-px flex-1 bg-brand/40" />
				</div>
			)}
			{showDay && (
				<div className="flex justify-center pb-2 pt-5">
					<span className="font-sans text-[11px] font-medium tabular-nums text-subtle">
						{dayLabel(m.createdAt)}
					</span>
				</div>
			)}
			<motion.div
				ref={rowRef}
				// layout: the row TWEENS between sizes instead of snapping —
				// an optimistic bubble growing into its server twin, a
				// reaction chip appearing, a tail radius changing when the
				// next message joins the run (owner ruling 2026-09-02).
				// Fresh arrivals also spring in from 8px below; history is
				// static, so a scroll never animates a wall of bubbles.
				layout="position"
				initial={fresh ? { opacity: 0, y: 8, scale: 0.98 } : false}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={{
					layout: { type: "spring", stiffness: 420, damping: 34 },
					duration: 0.2,
					ease: [0.2, 0, 0, 1],
				}}
				id={`msg-${m._id}`}
				onContextMenu={(e) => {
					if (isTemp) return;
					e.preventDefault();
					onMenu(e.clientX, e.clientY, m);
				}}
				onTouchStart={(e) => {
					if (isTemp) return;
					const t = e.touches[0];
					touch.current = { x: t.clientX, y: t.clientY };
					holdTimer.current = setTimeout(() => {
						onMenu(t.clientX, t.clientY, m);
						holdTimer.current = null;
					}, 450);
				}}
				onTouchMove={(e) => {
					const start = touch.current;
					if (!start) return;
					const t = e.touches[0];
					const dx = t.clientX - start.x;
					const dy = Math.abs(t.clientY - start.y);
					if (holdTimer.current && (Math.abs(dx) > 8 || dy > 8)) {
						clearTimeout(holdTimer.current);
						holdTimer.current = null;
					}
					// Swipe RIGHT to reply — resistance past the commit point.
					if (dy < 24 && dx > 0) {
						setDx(dx < 56 ? dx : 56 + (dx - 56) * 0.25);
					}
				}}
				onTouchEnd={() => {
					if (holdTimer.current) {
						clearTimeout(holdTimer.current);
						holdTimer.current = null;
					}
					if (dxRef.current > 48) onReply(m);
					setDx(0);
					touch.current = null;
				}}
				className={clsx(
					// A reading column, not a wall: real gutters so bubbles never
					// kiss the viewport edge, and a centered max-width on wide
					// panes — every messenger does this (owner, 2026-09-02).
					"group/msg relative mx-auto flex w-full max-w-[52rem] flex-col scroll-mt-24 touch-pan-y px-4 sm:px-6",
					// Three tiers (audit #5): 2px inside a run, 8px between
					// runs, the centred stamp carries the big gap.
					sameRunAsPrev ? "mt-[2px]" : "mt-2",
					isMe ? "items-end" : "items-start",
					flashed && "rounded-xl bg-brand/10",
				)}
			>
				{/* iMessage grammar (owner pick): every message's time hides off
				    the right edge and rides in when the thread is dragged left.
				    --reveal is set by ThreadList's drag handler. */}
				<span
					aria-hidden
					className="pointer-events-none absolute right-[-64px] top-1/2 w-[56px] -translate-y-1/2 text-right font-sans text-[11px] tabular-nums text-subtle"
					style={{ opacity: "var(--reveal, 0)" }}
				>
					{format(new Date(m.createdAt), "h:mm a")}
				</span>
				{/* The swipe-to-reply glyph, scaled by setDx. */}
				<span
					ref={hintRef}
					aria-hidden
					className="pointer-events-none absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-pill bg-raised text-muted opacity-0"
				>
					<RiReplyLine size={14} />
				</span>
				<div
					className={clsx(
						// w-full, not max-w-full: the row was shrink-to-fit, so the
						// bubble's 85% cap resolved against its own content and text
						// wrapped at a dozen characters (owner: "totally trash",
						// 2026-09-02). A real row width makes 85% mean 85%.
						"flex w-full items-center gap-1",
						isMe ? "justify-end" : "justify-start",
					)}
				>
					{!isTemp && (
						<button
							type="button"
							onClick={() => onReply(m)}
							aria-label="Reply to this message"
							className={clsx(
								// Mine: reply sits before the bubble on the right
								// edge. Theirs: avatar, bubble, THEN reply — the
								// face leads an incoming message (owner 2026-09-02;
								// the old row-reverse painted it backwards).
								isMe ? "order-1" : "order-3",
								"flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-subtle transition hover:bg-raised hover:text-muted",
								"opacity-100 md:opacity-0 md:group-hover/msg:opacity-100 md:focus-visible:opacity-100",
							)}
						>
							<RiReplyLine size={14} />
						</button>
					)}
					{/* Inbound face: only the first message of a run wears it —
					    ink-and-air density (register 43-44). */}
					{!isMe && (
						<span className="order-1 w-[30px] shrink-0 self-end">
							{showAvatar && avatarUrl && (
								// eslint-disable-next-line @next/next/no-img-element
								<img
									src={avatarUrl}
									alt=""
									className="h-7 w-7 rounded-pill object-cover"
								/>
							)}
						</span>
					)}
					<div
						className={clsx(
							"order-2 flex min-w-0 max-w-[85%] flex-col sm:max-w-[70%]",
							isMe ? "items-end" : "items-start",
						)}
					>
						{m.replyTo && (
							/* Stacked quote (owner pick, Instagram): a label, then the
							   quoted message peeking out from BEHIND the reply. */
							<>
								<span className="mb-1 px-1 font-sans text-[11px] text-subtle">
									{(() => {
										// Whose message is being quoted decides the copy:
										// "replied to you" when it was mine.
										const quotedIsMine =
											!!myProfileId &&
											(m.replyTo as { sender?: { _id?: string } })?.sender
												?._id === myProfileId;
										const handle = m.replyTo?.sender?.username;
										if (isMe)
											return quotedIsMine
												? "You replied to yourself"
												: `You replied to @${handle ?? "them"}`;
										return quotedIsMine
											? "Replied to you"
											: `Replied to @${handle ?? "them"}`;
									})()}
								</span>
								<button
									type="button"
									onClick={() => onJump(m.replyTo!._id)}
									className={clsx(
										"-mb-3 max-w-[90%] cursor-pointer truncate rounded-[16px] bg-raised/70 px-3 pb-4 pt-1.5 text-left font-sans text-[12px] text-muted transition-opacity hover:opacity-80",
										isMe ? "mr-2" : "ml-2",
									)}
								>
									{quotedPreview(m.replyTo)}
								</button>
							</>
						)}
					<div
						className={clsx(
							"relative min-w-0 max-w-full overflow-hidden",
							// Owner picks 2026-09-03: gradient accent for mine (B),
							// 22px radius with an 8px inner run corner (D), 14px/1.6
							// body (C). A GIF/photo-only bubble has no fill of its own.
							(m.type === "image" || m.type === "video") && !m.content
								? "p-0"
								: "px-4 py-2.5",
							"rounded-[22px]",
							(m.type === "image" || m.type === "video") && !m.content
								? "text-primary"
								: isMe
									? "text-white"
									: "bg-raised text-primary",
							isMe
								? [
										sameRunAsPrev && "rounded-tr-[8px]",
										!endsRun && "rounded-br-[8px]",
									]
								: [
										sameRunAsPrev && "rounded-tl-[8px]",
										!endsRun && "rounded-bl-[8px]",
									],
						)}
						style={
							isMe &&
							!((m.type === "image" || m.type === "video") && !m.content)
								? {
										backgroundImage:
											"linear-gradient(135deg, var(--ws-brand-primary), #6D5BFF)",
									}
								: undefined
						}
					>
						{isGroup && !isMe && !sameRunAsPrev && (
							<span
								className="mb-0.5 block truncate font-sans text-[12px] font-semibold"
								style={{ color: senderColor(String(m.sender._id)) }}
							>
								{(m.sender as { firstName?: string })?.firstName ||
									(m.sender as { username?: string })?.username ||
									"Member"}
							</span>
						)}
						{album && album.length > 1 && (
							/* Tight grid (owner pick): 2px gutters inside one frame,
							   "+N" on the last tile past four. */
							<div className="grid w-[280px] max-w-full grid-cols-2 gap-[2px] overflow-hidden rounded-[inherit]">
								{album.slice(0, 4).map((a, i) => (
									<button
										key={a._id}
										type="button"
										onClick={() => onMediaClick(a._id)}
										className="relative aspect-square cursor-zoom-in overflow-hidden bg-sunken"
									>
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img
											src={a.mediaUrl}
											alt=""
											className="absolute inset-0 h-full w-full object-cover"
										/>
										{i === 3 && album.length > 4 && (
											<span className="absolute inset-0 flex items-center justify-center bg-black/45 font-sans text-[15px] font-semibold text-white">
												+{album.length - 4}
											</span>
										)}
									</button>
								))}
							</div>
						)}
						{!(album && album.length > 1) && (m.type === "image" || m.type === "video") && m.mediaUrl && (
							<Attachment
								src={m.mediaUrl}
								type={m.type}
								isTemp={isTemp}
								width={m.width}
								height={m.height}
								thumbhash={m.thumbhash}
								uploadPct={m.uploadPct}
								failed={m.failed}
								durationSec={m.type === "video" ? m.durationSec : undefined}
								onClick={() => onMediaClick(m._id)}
								onRetry={
									m.clientKey && onRetryUpload
										? () => onRetryUpload(m.clientKey!)
										: undefined
								}
								onCancelUpload={
									m.clientKey && onCancelUpload
										? () => onCancelUpload(m.clientKey!)
										: undefined
								}
							/>
						)}
						{m.type === "audio" && m.mediaUrl && (
							<div className="relative w-[256px] max-w-full mb-1">
								<VoiceMessage
									src={m.mediaUrl}
									isMe={isMe}
									peaks={m.peaks}
									durationSec={m.durationSec}
									messageId={m._id}
									autoplayNextId={autoplayNextId}
								/>
								{/* A refused voice note stays visible and retryable
								    (register 93) instead of evaporating. */}
								{m.failed && m.clientKey && (
									<span className="flex items-center gap-2 pl-1 pb-1">
										<button
											type="button"
											onClick={() => onRetryUpload?.(m.clientKey!)}
											className="cursor-pointer rounded-pill bg-raised px-2.5 py-0.5 font-sans text-[11.5px] font-semibold text-danger transition-colors hover:bg-chip"
										>
											Failed — retry
										</button>
										<button
											type="button"
											onClick={() => onCancelUpload?.(m.clientKey!)}
											className="cursor-pointer font-sans text-[11px] text-muted transition-colors hover:text-primary"
										>
											Discard
										</button>
									</span>
								)}
								{m.transcript && (
									// The transcript line (owner pick): what was said,
									// readable without playing.
									<p className="mt-1 px-1 font-sans text-[12.5px] leading-snug opacity-75">
										“{m.transcript}”
									</p>
								)}
							</div>
						)}
						{m.storyRef && (
							<button
								type="button"
								onClick={() => m.storyRef && onStory(m.storyRef)}
								className="relative mb-1.5 block h-40 w-28 cursor-pointer overflow-hidden rounded-lg border border-current/15 transition-opacity hover:opacity-90"
								aria-label="View story"
							>
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src={m.storyRef.thumbnail}
									alt=""
									className="h-full w-full object-cover"
								/>
								<span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0c0a09]/85 to-transparent px-2 pb-1.5 pt-5 text-left font-sans text-[10px] font-semibold text-[#fafaf9]/90">
									View story
								</span>
							</button>
						)}
						{m.content && (
							<p
								className={clsx(
									"text-sm leading-relaxed break-words whitespace-pre-wrap",
									m.mediaUrl && "mt-2",
								)}
							>
								{linkify(m.content, isMe)}
							</p>
						)}
						{/* A WorldSpace post link renders as the post (owner pick),
						    the same embed the feed uses. */}
						{m.content && firstPlatformPostId(m.content, "") && (
							<div className="mt-2 w-[260px] max-w-full">
								<EmbeddedPost postId={firstPlatformPostId(m.content, "")!} />
							</div>
						)}
					</div>
					</div>
					{/* A failed TEXT send stays put with a red mark and a retry
					    (owner pick) — it used to vanish into a toast. */}
					{m.failed && m.type === "text" && (
						<button
							type="button"
							onClick={() => m.clientKey && onRetryUpload?.(m.clientKey)}
							aria-label="Not delivered. Tap to retry"
							title="Not delivered. Tap to retry"
							className={clsx(
								"flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-pill text-danger",
								isMe ? "order-1" : "order-3",
							)}
						>
							<RiErrorWarningFill size={18} />
						</button>
					)}
				</div>
				{m.failed && m.type === "text" && (
					<span className={clsx("mt-0.5 font-sans text-[11px] text-danger", isMe ? "self-end" : "pl-[34px]")}>
						Not delivered · tap to retry
					</span>
				)}
				{m.reactions && m.reactions.length > 0 && (
					// Overlapping the bubble's bottom edge (audit #16): the chip
					// reads as attached to the message and costs ~8px, not a row.
					<div
						className={clsx(
							"mt-1 flex flex-wrap gap-1",
							isMe ? "justify-end" : "pl-[34px]",
						)}
					>
						{Object.entries(
							m.reactions.reduce<
								Record<string, { count: number; mine: boolean }>
							>((acc, r) => {
								const slot = acc[r.emoji] ?? {
									count: 0,
									mine: false,
								};
								slot.count += 1;
								if (myProfileId && r.profile === myProfileId)
									slot.mine = true;
								acc[r.emoji] = slot;
								return acc;
							}, {}),
						).map(([emoji, info]) => (
							<button
								key={emoji}
								type="button"
								onClick={() => onReact?.(m, emoji)}
								aria-label={`${emoji} reaction${info.count > 1 ? `, ${info.count}` : ""}${info.mine ? ", including yours" : ""}`}
								className={clsx(
									"flex cursor-pointer items-center gap-1 rounded-pill px-1.5 py-0.5 font-sans text-[12px] ring-2 ring-page transition-colors animate-pop",
									info.mine
										? "bg-brand/25"
										: "bg-surface hover:bg-chip",
								)}
							>
								<span>{emoji}</span>
								{info.count > 1 && (
									<span className="tabular-nums text-[10.5px] font-semibold text-muted">
										{info.count}
									</span>
								)}
							</button>
						))}
					</div>
				)}
				{/* No per-message timestamps (Instagram): the centred stamp
				    carries time. Delivery state is one quiet word under the
				    NEWEST of my messages only. */}
				{isMe && showTicks && (() => {
					const state = tickStateFor({
						id: m._id,
						createdAt: m.createdAt,
						deliveredAt,
						readAt,
						peerReadUpTo,
					});
					// Messenger grammar (owner pick): once seen, the reader's own
					// 14px face marks how far they've read; before that, a word.
					return state === "read" && peerAvatar ? (
						<span className="mt-1 flex items-center justify-end" title="Seen">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img src={peerAvatar} alt="Seen" className="h-3.5 w-3.5 rounded-pill object-cover" />
						</span>
					) : (
						<span className="mt-1 flex items-center gap-1 font-sans text-[11px] text-subtle">
							<MessageTicks state={state} />
						</span>
					);
				})()}
			</motion.div>
		</>
	);
});
