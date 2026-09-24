"use client";

import clsx from "clsx";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { memo, useEffect, useRef } from "react";
import { RiErrorWarningFill, RiReplyLine } from "@remixicon/react";
import { haptic } from "@/lib/haptics";
import { DUR, EASE, EASE_IN, pop, press, swap } from "@/lib/motion-presets";
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
	/** A shared account, rendered as a card with a Message action. */
	contact?: { profile: string; name: string; username?: string; avatar?: string };
	replyTo?: {
		_id: string;
		content?: string;
		type?: string;
		durationSec?: number;
		sender?: { username?: string };
	} | null;
	sender: { _id: string } & Record<string, unknown>;
	createdAt: string;
	/** Which platform it was sent from (the gateway stamps it). */
	source?: string;
}

/**
 * "via Xstream" under a message that crossed platforms (owner 2026-09-24:
 * "know if someone sends a message from worldspace or xstream ... the same
 * banner for both"). WorldSpace and its app are one home, so nothing is
 * said for those; Xstream shows the mirror image, "via WorldSpace".
 */
const PLATFORM_LABELS: Record<string, string> = {
	dashboard: "Dashboard",
	academy: "Academy",
	shop: "Shop",
	xstream: "Xstream",
};
function viaLabel(source: string | undefined): string | null {
	const name = source ? PLATFORM_LABELS[source] : undefined;
	return name ? `via ${name}` : null;
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
						Math.floor(r.durationSec % 60),
					).padStart(2, "0")}`
				: "Voice note";
		case "payment":
			return "Payment";
		case "contact":
			return "Contact";
		default:
			return "Message";
	}
}

// Washes for chips and rules. themeVars() sets the --chat-* half inside a
// thread; the fallbacks cover a bubble outside a themed pane, and they are
// mixed from the brand token (or the bubble's own ink) so the app palette
// reaches them. They used to be a literal cyan and a fixed black.
const accentWash = (pct: 12 | 18 | 40) =>
	`var(--chat-accent-${pct}, color-mix(in srgb, var(--ws-brand-primary) ${pct}%, transparent))`;
const ACCENT_12 = accentWash(12);
const ACCENT_18 = accentWash(18);
const ACCENT_40 = accentWash(40);
const ON_MINE =
	"var(--chat-on-mine, color-mix(in srgb, currentColor 22%, transparent))";

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
							: "font-medium hover:underline",
					)}
					style={
						mine
							? undefined
							: { color: "var(--chat-accent, var(--ws-brand-primary))" }
					}
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
					className="rounded-md px-1.5 py-[1px] font-semibold"
					style={
						mine
							? { background: ON_MINE }
							: {
								background: ACCENT_18,
								color: "var(--chat-accent, var(--ws-brand-primary))",
							}
					}
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

/**
 * A snapshot of the pressed bubble, captured at long-press so the menu
 * overlay can repaint it SHARP above the blurred scrim — the bubble the
 * gesture is about must never be the thing that goes blurry.
 */
export interface BubbleLift {
	rect: { left: number; top: number; width: number; height: number };
	html: string;
	mine: boolean;
}

const R = "var(--chat-r, 22px)";
const RIN = "var(--chat-r-in, 8px)";
// Exported so the composer's send disc wears the same fill. The fallback is
// the brand token into its own deeper step with the brand's ink: it used to
// end on a literal indigo under white, which no app palette could move.
export const MINE_FILL = "var(--chat-mine, linear-gradient(135deg, var(--ws-brand-primary), var(--ws-brand-dim)))";
export const MINE_INK = "var(--chat-mine-ink, var(--ws-brand-on-primary))";
const THEIRS_FILL = "var(--chat-theirs, var(--ws-bg-raised))";
const THEIRS_INK = "var(--chat-theirs-ink, var(--ws-text-primary))";

/**
 * One reaction under a bubble. `live` is false when the chip is painted with
 * its row (history, scroll-back) and true when it arrives on a row already
 * on screen: only then does it move. Mine pops, because I put it there;
 * someone else's rises in quietly, and a count rolls either way.
 */
function ReactionChip({
	emoji,
	count,
	mine,
	live,
	onToggle,
}: {
	emoji: string;
	count: number;
	mine: boolean;
	live: boolean;
	onToggle: () => void;
}) {
	// Joining a chip that is already there answers the tap: the glyph lands
	// again. Not on the chip's first paint, where the whole chip is arriving.
	const paintedRef = useRef(false);
	useEffect(() => {
		paintedRef.current = true;
	}, []);
	const enter = mine ? pop : swap;
	return (
		<motion.button
			type="button"
			onClick={onToggle}
			aria-label={`${emoji} reaction${count > 1 ? `, ${count}` : ""}${mine ? ", including yours" : ""}`}
			initial={live ? enter.initial : false}
			animate={enter.animate}
			exit={pop.exit}
			{...press}
			className={clsx(
				// relative: the outgoing count is popped out of flow against it.
				"relative flex cursor-pointer items-center gap-1 rounded-pill px-1.5 py-0.5 font-sans text-[calc(13px*var(--ws-fs))] ring-2 ring-page transition-colors",
				!mine && "bg-primary/5 hover:bg-primary/10",
			)}
			style={mine ? { background: ACCENT_40 } : undefined}
		>
			<motion.span
				key={mine ? "mine" : "theirs"}
				className="inline-block"
				initial={paintedRef.current && mine ? pop.initial : false}
				animate={pop.animate}
			>
				{emoji}
			</motion.span>
			<AnimatePresence mode="popLayout" initial={false}>
				{count > 1 && (
					<motion.span
						key={count}
						className="inline-block tabular-nums text-[calc(12px*var(--ws-fs))] font-semibold text-muted"
						{...swap}
					>
						{count}
					</motion.span>
				)}
			</AnimatePresence>
		</motion.button>
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
	/** The viewer's face — the money card overlaps payer and payee. */
	myAvatar?: string;
	/** Group threads name their senders and colour them (register 105). */
	isGroup?: boolean;
	onReply: (m: BubbleMessage) => void;
	onMenu: (x: number, y: number, m: BubbleMessage, lift?: BubbleLift) => void;
	onJump: (id: string) => void;
	onMediaClick: (id: string) => void;
	onStory: (ref: NonNullable<BubbleMessage["storyRef"]>) => void;
	onCallBack: (video: boolean) => void;
	onRetryUpload?: (clientKey: string) => void;
	onCancelUpload?: (clientKey: string) => void;
	/** Toggle MY reaction on this message (register 132/134). */
	onReact?: (m: BubbleMessage, emoji: string) => void;
	/** The Message action on a shared contact card. */
	onMessageContact?: (profileId: string) => void;
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
	myAvatar,
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
	onMessageContact,
}: BubbleProps) {
	const rowRef = useRef<HTMLDivElement | null>(null);
	// Snapshot the bubble node itself (not the row — no avatar, no reply
	// affordance) so the menu overlay can repaint it above the scrim.
	const liftBubble = (): BubbleLift | undefined => {
		const el = rowRef.current?.querySelector(
			"[data-bubble]",
		) as HTMLElement | null;
		if (!el) return undefined;
		const r = el.getBoundingClientRect();
		return {
			rect: { left: r.left, top: r.top, width: r.width, height: r.height },
			html: el.outerHTML,
			mine: isMe,
		};
	};
	const touch = useRef<{ x: number; y: number } | null>(null);
	const dxRef = useRef(0);
	const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hintRef = useRef<HTMLSpanElement | null>(null);
	const armedRef = useRef(false);
	// False for the row's first paint, true after. The small things inside
	// (a reaction, the seen face, the failed mark) move only when they arrive
	// on a row already on screen: history and scroll-back remount rows, and
	// those paint at rest.
	const liveRef = useRef(false);
	useEffect(() => {
		liveRef.current = true;
	}, []);
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
				<span className="inline-flex items-center gap-1.5 rounded-pill bg-page/70 px-3 py-1 text-center font-sans text-[calc(12.5px*var(--ws-fs))] font-medium text-muted">
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
		// In a DM the payee is whoever didn't pay — older payments carry no
		// payTo, and the footer read "Thy paid them" on money I received.
		const paidToMe = isGroup
			? !!myProfileId && m.payTo === myProfileId
			: !isMe;
		// The two faces of the transfer. In a DM the pair is always
		// viewer + peer; a group payment falls back to the initial chip
		// when the target's face isn't on the message.
		const fromAvatar = isMe
			? myAvatar
			: (m.sender as { avatar?: string })?.avatar || peerAvatar;
		const toAvatar = paidToMe
			? myAvatar
			: isGroup
				? undefined
				: isMe
					? peerAvatar
					: myAvatar;
		return (
			// The same reading column as every bubble — without it the money
			// card ignored the centred max-width and gutters and sat on the
			// pane's raw edge, visibly outside the bubble grammar.
			<div className="mx-auto w-full max-w-[52rem] px-4 sm:px-6">
				<PaymentBubble
					amountMinor={m.amountMinor ?? 0}
					note={m.content}
					at={m.createdAt}
					mine={isMe}
					peerName={isGroup ? undefined : peerName}
					toName={m.payToName}
					toMe={paidToMe}
					senderName={isGroup ? senderName : peerName}
					fromAvatar={fromAvatar}
					toAvatar={toAvatar}
				/>
			</div>
		);
	}
	if (m.type === "call") {
		return (
			<div className="mx-auto w-full max-w-[52rem]">
				<CallLogRow
					content={m.content}
					at={m.createdAt}
					mine={isMe}
					onCallBack={onCallBack}
				/>
			</div>
		);
	}

	return (
		<>
			{showUnreadDivider && (
				// Telegram's rule (owner pick): the thread opens here.
				<div className="mx-auto flex w-full max-w-[52rem] items-center gap-3 px-4 py-3 sm:px-6">
					<span className="h-px flex-1" style={{ background: ACCENT_40 }} />
					<span className="font-sans text-[calc(12px*var(--ws-fs))] font-semibold" style={{ color: "var(--chat-accent, var(--ws-brand-primary))" }}>
						{unreadLabel && unreadLabel > 1
							? `${unreadLabel} unread messages`
							: "Unread messages"}
					</span>
					<span className="h-px flex-1" style={{ background: ACCENT_40 }} />
				</div>
			)}
			{showDay && (
				<div className="flex justify-center pb-2 pt-5">
					<span
						className="rounded-pill px-2.5 py-0.5 font-sans text-[calc(12px*var(--ws-fs))] font-medium tabular-nums"
						style={{
							background: "var(--chat-stamp-bg, transparent)",
							color: "var(--chat-stamp-ink, var(--ws-text-muted))",
						}}
					>
						{dayLabel(m.createdAt)}
					</span>
				</div>
			)}
			<motion.div
				ref={rowRef}
				// No framer `layout` on a virtualised row (2026-09-15). It was
				// added so a bubble would tween between sizes, but position-only
				// projection never animates size, so it did none of that; what it
				// DID do was snapshot every row on every re-render and, on a
				// prepend, spring each one in from the 50-row margin virtuoso
				// applies synchronously, with reduce-motion turning the spring
				// into a hard snap. Live arrivals still rise in via `initial`.
				initial={fresh ? { opacity: 0, y: 8, scale: 0.98 } : false}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={{ duration: DUR.base, ease: EASE }}
				id={`msg-${m._id}`}
				onContextMenu={(e) => {
					if (isTemp) return;
					e.preventDefault();
					onMenu(e.clientX, e.clientY, m, liftBubble());
				}}
				onTouchStart={(e) => {
					if (isTemp) return;
					const t = e.touches[0];
					touch.current = { x: t.clientX, y: t.clientY };
					holdTimer.current = setTimeout(() => {
						onMenu(t.clientX, t.clientY, m, liftBubble());
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
					// PADDING, never margin (owner 2026-09-21: "if a chat is very
					// long the scroll starts bouncing"). This row is the first
					// child of virtuoso's item wrapper, so a top margin collapses
					// OUT of the wrapper: the list measured every row 2 to 8px
					// short, the error grew with the thread, and scrolling a long
					// one made virtuoso correct its offsets over and over, which
					// is the bounce. Padding is inside the box it measures.
					sameRunAsPrev ? "pt-[2px]" : "pt-2",
					isMe ? "items-end" : "items-start",
				)}
			>
				{/* The jump flash fades in and out instead of snapping. Opacity
				    only; the presets have no plain fade, so it is DUR + EASE. */}
				<AnimatePresence>
					{flashed && (
						<motion.span
							key="flash"
							aria-hidden
							className="pointer-events-none absolute inset-0 rounded-xl"
							style={{ background: ACCENT_12 }}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1, transition: { duration: DUR.base, ease: EASE } }}
							exit={{ opacity: 0, transition: { duration: DUR.fast, ease: EASE_IN } }}
						/>
					)}
				</AnimatePresence>
				{/* iMessage grammar (owner pick): every message's time hides off
				    the right edge and rides in when the thread is dragged left.
				    --reveal is set by ThreadList's drag handler. */}
				<span
					aria-hidden
					className="pointer-events-none absolute right-[-64px] top-1/2 w-[56px] -translate-y-1/2 text-right font-sans text-[calc(12px*var(--ws-fs))] tabular-nums text-muted"
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
								"-mx-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-subtle transition hover:bg-primary/5 hover:text-muted",
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
								<span className="mb-1 px-1 font-sans text-[calc(12.5px*var(--ws-fs))] font-medium text-muted">
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
										"-mb-3 max-w-[90%] cursor-pointer truncate rounded-[16px] px-3 pb-4 pt-1.5 text-left font-sans text-[calc(12.5px*var(--ws-fs))] opacity-90 transition-opacity hover:opacity-100",
										isMe ? "mr-2" : "ml-2",
									)}
									// The quote peeks out from BEHIND the bubble, so it sits
									// on the ground, not on a fill: it takes an opaque chip
									// of its own (theme pack 2026-09-11) rather than a wash
									// of the bubble's ink, which on a pale wallpaper was
									// white text at 16% white.
									style={{
										background: isMe
											? "var(--chat-quote-mine, var(--ws-bg-raised))"
											: "var(--chat-quote-theirs, var(--ws-bg-raised))",
										color: isMe
											? "var(--chat-quote-mine-ink, var(--ws-text-primary))"
											: "var(--chat-quote-theirs-ink, var(--ws-text-primary))",
									}}
								>
									{quotedPreview(m.replyTo)}
								</button>
							</>
						)}
					<div
						data-bubble
						className={clsx(
							"relative min-w-0 max-w-full overflow-hidden",
							// A GIF/photo-only bubble has no fill of its own.
							(m.type === "image" || m.type === "video") && !m.content
								? "p-0 text-primary"
								: "px-4 py-2.5",
						)}
						// Fill, ink and corners come from the thread's theme
						// variables (theme pack 2026-09-10); the fallbacks are
						// the owner's 2026-09-03 picks - gradient mine, raised
						// theirs, 22px with an 8px inner run corner - so a
						// bubble outside a themed pane (the dock) looks as before.
						style={{
							borderRadius: isMe
								? `${R} ${sameRunAsPrev ? RIN : R} ${!endsRun ? RIN : R} ${R}`
								: `${sameRunAsPrev ? RIN : R} ${R} ${R} ${!endsRun ? RIN : R}`,
							...((m.type === "image" || m.type === "video") && !m.content
								? {}
								: isMe
									? { background: MINE_FILL, color: MINE_INK }
									: { background: THEIRS_FILL, color: THEIRS_INK }),
						}}
					>
						{isGroup && !isMe && !sameRunAsPrev && (
							<span
								className="mb-0.5 block truncate font-sans text-[calc(12px*var(--ws-fs))] font-semibold"
								style={{ color: senderColor(String(m.sender._id)) }}
							>
								{(m.sender as { firstName?: string })?.firstName ||
									(m.sender as { username?: string })?.username ||
									"Member"}
							</span>
						)}
						{viaLabel(m.source) && (
							<span className="mb-0.5 block font-sans text-[calc(12px*var(--ws-fs))] opacity-60">
								{viaLabel(m.source)}
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
											<span className="absolute inset-0 flex items-center justify-center bg-black/45 font-sans text-[calc(15px*var(--ws-fs))] font-semibold text-white">
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
											className="cursor-pointer rounded-pill bg-raised px-2.5 py-0.5 font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold text-danger transition-colors hover:bg-primary/5"
										>
											Failed — retry
										</button>
										<button
											type="button"
											onClick={() => onCancelUpload?.(m.clientKey!)}
											className="cursor-pointer font-sans text-[calc(12.5px*var(--ws-fs))] text-muted transition-colors hover:text-primary"
										>
											Discard
										</button>
									</span>
								)}
								{m.transcript && (
									// The transcript line (owner pick): what was said,
									// readable without playing.
									<p className="mt-1 px-1 font-sans text-[calc(12.5px*var(--ws-fs))] leading-snug opacity-75">
										“{m.transcript}”
									</p>
								)}
							</div>
						)}
						{m.type === "contact" && m.contact && (
							/* The shared-account card (owner 2026-09-15): face, name and
							   handle, then one full-width action, the WhatsApp grammar.
							   Inks and the action wash come from the bubble it sits in. */
							<div className="w-[248px] max-w-full">
								<div className="flex items-center gap-3 py-0.5">
									<span
										className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-pill"
										style={{ background: isMe ? ON_MINE : ACCENT_18 }}
									>
										{m.contact.avatar ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img src={m.contact.avatar} alt="" className="h-full w-full object-cover" />
										) : (
											<span className="font-sans text-[calc(15px*var(--ws-fs))] font-semibold">
												{(m.contact.name || "?").slice(0, 1).toUpperCase()}
											</span>
										)}
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate font-sans text-[calc(14px*var(--ws-fs))] font-semibold">
											{m.contact.name}
										</span>
										{m.contact.username && (
											<span className="block truncate font-sans text-[calc(12.5px*var(--ws-fs))] opacity-75">
												@{m.contact.username}
											</span>
										)}
									</span>
								</div>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										onMessageContact?.(m.contact!.profile);
									}}
									className="mt-2.5 flex h-9 w-full cursor-pointer items-center justify-center rounded-pill font-sans text-[calc(13px*var(--ws-fs))] font-semibold transition-opacity hover:opacity-85"
									style={{
										background: isMe ? ON_MINE : ACCENT_18,
										color: isMe ? "inherit" : "var(--chat-accent, var(--ws-brand-primary))",
									}}
								>
									Message
								</button>
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
								<span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0c0a09]/85 to-transparent px-2 pb-1.5 pt-5 text-left font-sans text-[calc(10px*var(--ws-fs))] font-semibold text-[#fafaf9]/90">
									View story
								</span>
							</button>
						)}
						{m.content && (
							<p
								className={clsx(
									"text-[calc(14px*var(--ws-fs))] leading-[1.6] break-words whitespace-pre-wrap",
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
						<motion.button
							type="button"
							// Lands once, when a send fails on a row already on screen.
							initial={liveRef.current ? pop.initial : false}
							animate={pop.animate}
							{...press}
							onClick={() => m.clientKey && onRetryUpload?.(m.clientKey)}
							aria-label="Not delivered. Tap to retry"
							title="Not delivered. Tap to retry"
							className={clsx(
								"flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-pill text-danger",
								isMe ? "order-1" : "order-3",
							)}
						>
							<RiErrorWarningFill size={18} />
						</motion.button>
					)}
				</div>
				{m.failed && m.type === "text" && (
					<span className={clsx("mt-0.5 font-sans text-[calc(11px*var(--ws-fs))] text-danger", isMe ? "self-end" : "pl-[34px]")}>
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
						{/* Presence for the exit only; `live` gates the entrance. */}
						<AnimatePresence>
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
							<ReactionChip
								key={emoji}
								emoji={emoji}
								count={info.count}
								mine={info.mine}
								live={liveRef.current}
								onToggle={() => onReact?.(m, emoji)}
							/>
						))}
						</AnimatePresence>
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
						<motion.span
							className="mt-1 flex items-center justify-end"
							title="Seen"
							// The peer's doing, not mine: it rises in, it does not pop.
							initial={liveRef.current ? swap.initial : false}
							animate={swap.animate}
						>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img src={peerAvatar} alt="Seen" className="h-3.5 w-3.5 rounded-pill object-cover" />
						</motion.span>
					) : (
						<span className="mt-1 flex items-center gap-1 font-sans text-[calc(12px*var(--ws-fs))] text-subtle">
							<MessageTicks state={state} />
						</span>
					);
				})()}
			</motion.div>
		</>
	);
});
