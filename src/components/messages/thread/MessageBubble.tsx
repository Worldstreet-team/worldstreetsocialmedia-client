"use client";

import clsx from "clsx";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { memo, useRef } from "react";
import { RiReplyLine } from "@remixicon/react";
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
function linkify(text: string) {
	return text.split(TOKEN_RE).map((part, i) => {
		if (URL_RE.test(part) && part.startsWith("http")) {
			return (
				<a
					// biome-ignore lint/suspicious/noArrayIndexKey: static split of one string
					key={i}
					href={part}
					target="_blank"
					rel="noopener noreferrer"
					className="break-all underline underline-offset-2 opacity-90 hover:opacity-100"
					onClick={(e) => e.stopPropagation()}
				>
					{part}
				</a>
			);
		}
		if (part.startsWith("@") && part.length > 2) {
			// A tag reads gold and opens the profile (register 136). Handles
			// that resolve to nobody still render — the gateway only ever
			// NOTIFIES real roster members, styling is just styling.
			return (
				<a
					// biome-ignore lint/suspicious/noArrayIndexKey: static split of one string
					key={i}
					href={`/profile/${part.slice(1)}`}
					className="font-medium text-gold hover:underline"
					onClick={(e) => e.stopPropagation()}
				>
					{part}
				</a>
			);
		}
		return part;
	});
}

export function dayLabel(iso: string) {
	const d = new Date(iso);
	const today = new Date();
	const yday = new Date();
	yday.setDate(today.getDate() - 1);
	if (d.toDateString() === today.toDateString()) return "Today";
	if (d.toDateString() === yday.toDateString()) return "Yesterday";
	return format(
		d,
		d.getFullYear() === today.getFullYear() ? "MMM d" : "MMM d, yyyy",
	);
}

export interface BubbleProps {
	m: BubbleMessage;
	isMe: boolean;
	/** First-in-run inbound messages carry the sender's face. */
	showAvatar?: boolean;
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
		return (
			<div className="mx-auto flex w-full max-w-[52rem] justify-center px-4 py-1.5">
				<span className="rounded-pill bg-page/70 px-3 py-1 text-center font-sans text-[11.5px] font-medium text-muted">
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
		return <CallLogRow content={m.content} at={m.createdAt} onCallBack={onCallBack} />;
	}

	return (
		<>
			{showDay && (
				<div className="flex justify-center py-2">
					<span className="rounded-pill bg-page/70 px-3 py-1 font-sans text-[11px] font-semibold text-muted">
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
					"group/msg mx-auto flex w-full max-w-[52rem] flex-col scroll-mt-24 touch-pan-y px-4 sm:px-6",
					sameRunAsPrev ? "mt-[2px]" : "mt-4",
					isMe ? "items-end" : "items-start",
					flashed && "rounded-xl bg-brand/10",
				)}
			>
				<div
					className={clsx(
						// w-full, not max-w-full: the row was shrink-to-fit, so the
						// bubble's 85% cap resolved against its own content and text
						// wrapped at a dozen characters (owner: "totally trash",
						// 2026-09-02). A real row width makes 85% mean 85%.
						"flex w-full items-center justify-end gap-1",
						isMe ? "flex-row" : "flex-row-reverse",
					)}
				>
					{!isTemp && (
						<button
							type="button"
							onClick={() => onReply(m)}
							aria-label="Reply to this message"
							className={clsx(
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
						<span className="mb-0.5 w-[26px] shrink-0 self-end">
							{showAvatar && avatarUrl && (
								// eslint-disable-next-line @next/next/no-img-element
								<img
									src={avatarUrl}
									alt=""
									className="h-[22px] w-[22px] rounded-pill object-cover"
								/>
							)}
						</span>
					)}
					<div
						className={clsx(
							"max-w-[85%] sm:max-w-[70%] min-w-0 overflow-hidden",
							(m.type === "image" || m.type === "video") && !m.content
								? "p-0"
								: isMe
									? "px-3.5 py-2 sm:px-4"
									: "py-0.5",
							// The locked skin: MINE wears frosted gold glass over the
							// wallpaper; THEIRS is bare ink — no bubble at all.
							isMe
								? [
										"rounded-[22px]",
										(m.type === "image" || m.type === "video") && !m.content
											? "text-primary"
											: "bg-[rgba(234,179,8,0.16)] text-primary",
										sameRunAsPrev && "rounded-tr-[8px]",
										!endsRun && "rounded-br-[8px]",
									]
								: "text-primary",
						)}
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
						{m.replyTo && (
							/* The quote is a soft inset chip now — no border bar.
							   The gold NAME carries the "this is a reference"
							   signal; the wash does the separation (owner ruling
							   2026-09-02: side borders are dated). */
							<button
								type="button"
								onClick={() => onJump(m.replyTo!._id)}
								className={clsx(
									"mb-1.5 flex w-full cursor-pointer flex-col gap-0.5 rounded-[10px] px-2.5 py-1.5 text-left transition-opacity hover:opacity-80",
									isMe ? "bg-page/25" : "bg-raised/70",
								)}
							>
								<span className="truncate font-sans text-[11.5px] font-semibold text-gold">
									{m.replyTo.sender?.username
										? `@${m.replyTo.sender.username}`
										: "Message"}
								</span>
								<span className="truncate font-sans text-[12.5px] opacity-70">
									{quotedPreview(m.replyTo)}
								</span>
							</button>
						)}
						{(m.type === "image" || m.type === "video") && m.mediaUrl && (
							<Attachment
								src={m.mediaUrl}
								type={m.type}
								isTemp={isTemp}
								width={m.width}
								height={m.height}
								thumbhash={m.thumbhash}
								uploadPct={m.uploadPct}
								failed={m.failed}
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
								{linkify(m.content)}
							</p>
						)}
					</div>
				</div>
				{m.reactions && m.reactions.length > 0 && (
					<div
						className={clsx(
							"mt-1 flex flex-wrap gap-1",
							!isMe && "pl-[26px]",
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
									"flex cursor-pointer items-center gap-1 rounded-pill px-1.5 py-0.5 font-sans text-[12px] transition-colors",
									info.mine
										? "bg-brand/20 ring-1 ring-brand/60"
										: "bg-raised/90 hover:bg-chip",
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
				{endsRun && (
					<span
						className={clsx(
							"mt-1 flex items-center gap-1 font-sans text-[11px] tabular-nums text-subtle",
							!isMe && "pl-[26px]",
						)}
					>
						{format(new Date(m.createdAt), "h:mm a")}
						{isMe && (
							<MessageTicks
								state={tickStateFor({
									id: m._id,
									createdAt: m.createdAt,
									deliveredAt,
									readAt,
									peerReadUpTo,
								})}
							/>
						)}
					</span>
				)}
			</motion.div>
		</>
	);
});
