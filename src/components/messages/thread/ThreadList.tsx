"use client";

import clsx from "clsx";
import {
	forwardRef,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import Link from "next/link";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { RiArrowDownLine } from "@remixicon/react";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { TypingIndicator } from "@/components/messages/TypingIndicator";
import {
	MessageBubble,
	type BubbleMessage,
	type BubbleProps,
} from "./MessageBubble";

/**
 * The virtualized thread — react-virtuoso because Safari still has no CSS
 * scroll anchoring in 2026, and virtuoso's firstItemIndex pattern is the one
 * maintained answer to prepend-without-jump + dynamic heights + bottom pin
 * at once.
 *
 * - followOutput: new messages auto-scroll ONLY when the reader is already
 *   at the bottom; otherwise the pill offers them (never yank the viewport).
 * - startReached: older pages prepend, position preserved.
 * - Footer reserves the typing indicator's height PERMANENTLY, so its
 *   appearance never pulses the layout.
 */
export interface ThreadListProps {
	threadId: string;
	messages: BubbleMessage[];
	firstItemIndex: number;
	myProfileId: string;
	flashedId: string | null;
	peerName: string;
	peerTyping: boolean;
	peerRecording?: boolean;
	isGroup?: boolean;
	deliveredAt: number | null;
	readAt: number | null;
	peerReadUpTo?: string | null;
	pendingNew: number;
	/** First fetch of an uncached thread — the ground stays clean; neither
	 *  the empty note nor a skeleton flashes (owner no-skeleton rule). */
	loading?: boolean;
	/** The peer's face, for the seen-avatar receipt (owner pick). */
	peerAvatar?: string;
	/** Who this thread is with — the empty state is their profile card. */
	peer?: { name: string; username?: string; avatar?: string };
	/** Unread count when the thread was opened: the accent divider sits
	 *  above the first unread row and the thread opens scrolled to it. */
	unreadAtOpen?: number;
	onLoadOlder: () => void;
	onAtBottomChange: (atBottom: boolean) => void;
	onShowNew: () => void;
	handlers: Pick<
		BubbleProps,
		| "onReply"
		| "onMenu"
		| "onJump"
		| "onMediaClick"
		| "onStory"
		| "onCallBack"
		| "onRetryUpload"
		| "onCancelUpload"
		| "onReact"
	>;
}

export const ThreadList = forwardRef<VirtuosoHandle, ThreadListProps>(
	function ThreadList(
		{
			threadId,
			messages,
			firstItemIndex,
			myProfileId,
			flashedId,
			peerName,
			peerTyping,
			peerRecording,
			isGroup,
			deliveredAt,
			readAt,
			peerReadUpTo,
			pendingNew,
			loading,
			peerAvatar,
			peer,
			unreadAtOpen,
			onLoadOlder,
			onAtBottomChange,
			onShowNew,
			handlers,
		},
		ref,
	) {
		const [atBottom, setAtBottom] = useState(true);
		// One beat of invisibility per thread: virtuoso paints at estimated
		// heights, measures, then snaps to the true bottom — visible as a
		// flicker. Two frames cover the correction without reading as a load.
		const [settled, setSettled] = useState(false);
		// biome-ignore lint/correctness/useExhaustiveDependencies: per-thread reset
		useEffect(() => {
			setSettled(false);
			const raf = requestAnimationFrame(() =>
				requestAnimationFrame(() => setSettled(true)),
			);
			return () => cancelAnimationFrame(raf);
		}, [threadId, messages.length > 0]);
		// Live-arrival gate: only messages born after this mount animate in.
		// biome-ignore lint/correctness/useExhaustiveDependencies: per-thread stamp
		const mountTs = useMemo(() => Date.now(), [threadId]);

		const Footer = useCallback(
			() => (
				<div className="mx-auto flex h-11 w-full max-w-[52rem] items-end px-4 pb-1 sm:px-6">
					{(peerTyping || peerRecording) && (
						<div className="pl-[34px] animate-pop">
							<TypingIndicator
								mode={peerRecording ? "recording" : "typing"}
							/>
						</div>
					)}
				</div>
			),
			[peerTyping, peerRecording],
		);

		// Voice-run chaining (register 87): each audio message knows the id of
		// the NEXT audio message downthread, so a finished note plays it.
		const nextAudioId = useMemo(() => {
			const map = new Map<string, string>();
			let prevAudio: string | null = null;
			for (const m of messages) {
				if (m.type !== "audio") continue;
				if (prevAudio) map.set(prevAudio, m._id);
				prevAudio = m._id;
			}
			return map;
		}, [messages]);

		// Photos sent together (same groupKey, same sender, consecutive) are
		// ONE row wearing the whole album (owner pick: tight grid). `rows` is
		// what virtuoso renders; `messages` stays the source of truth.
		const { rows, albums } = useMemo(() => {
			const rows: BubbleMessage[] = [];
			const albums = new Map<string, BubbleMessage[]>();
			for (const m of messages) {
				const prev = rows[rows.length - 1];
				const photo = m.type === "image" && !!m.groupKey;
				if (
					photo &&
					prev &&
					prev.type === "image" &&
					prev.groupKey === m.groupKey &&
					prev.sender._id === m.sender._id
				) {
					albums.get(prev._id)?.push(m);
					continue;
				}
				if (photo) albums.set(m._id, [m]);
				rows.push(m);
			}
			return { rows, albums };
		}, [messages]);

		// The newest message of mine is the one that wears the delivery word.
		const lastMineIndex = useMemo(() => {
			for (let i = rows.length - 1; i >= 0; i--) {
				const m = rows[i];
				if (m.sender._id === myProfileId || m._id.startsWith("temp-"))
					return i;
			}
			return -1;
		}, [rows, myProfileId]);

		// The first unread row, fixed at open (owner pick: accent divider +
		// the thread opens there). Remembered by id so arrivals don't move it.
		const unreadAnchorRef = useRef<{ thread: string; id: string | null } | null>(null);
		if (unreadAnchorRef.current?.thread !== threadId) {
			unreadAnchorRef.current = { thread: threadId, id: null };
		}
		if (
			unreadAnchorRef.current.id === null &&
			rows.length > 0 &&
			unreadAtOpen &&
			unreadAtOpen > 0 &&
			unreadAtOpen < rows.length
		) {
			unreadAnchorRef.current.id = rows[rows.length - unreadAtOpen]._id;
		}
		const unreadAnchorId = unreadAnchorRef.current.id;
		const unreadAnchorIndex = unreadAnchorId
			? rows.findIndex((r) => r._id === unreadAnchorId)
			: -1;

		// iMessage grammar (owner pick): drag the thread left and every
		// message's time rides in from the right edge. Direct style writes,
		// no React renders — the rows read --reveal from this element.
		const trackRef = useRef<HTMLDivElement | null>(null);
		const dragRef = useRef<{ x: number; y: number; on: boolean } | null>(null);
		const onRevealStart = (e: React.TouchEvent) => {
			const t = e.touches[0];
			dragRef.current = { x: t.clientX, y: t.clientY, on: false };
		};
		const onRevealMove = (e: React.TouchEvent) => {
			const d = dragRef.current;
			const el = trackRef.current;
			if (!d || !el) return;
			const t = e.touches[0];
			const dx = t.clientX - d.x;
			const dy = t.clientY - d.y;
			if (!d.on) {
				if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
					dragRef.current = null;
					return;
				}
				if (dx < -10) d.on = true;
				else return;
			}
			const pull = Math.max(0, Math.min(72, -dx * 0.6));
			el.style.transition = "none";
			el.style.transform = `translateX(${-pull}px)`;
			el.style.setProperty("--reveal", String(Math.min(1, pull / 56)));
		};
		const onRevealEnd = () => {
			const el = trackRef.current;
			dragRef.current = null;
			if (!el) return;
			el.style.transition = "transform 220ms var(--ws-ease)";
			el.style.transform = "";
			el.style.setProperty("--reveal", "0");
		};

		const itemContent = useCallback(
			(index: number, m: BubbleMessage) => {
				const i = index - firstItemIndex;
				const prev = rows[i - 1];
				const next = rows[i + 1];
				const isMe =
					m.sender._id === myProfileId || m._id.startsWith("temp-");
				// A centred stamp across a real gap (new day, or > 30 minutes
				// of silence) — the only time the thread shows, Instagram-style.
				const showDay =
					!prev ||
					new Date(prev.createdAt).toDateString() !==
						new Date(m.createdAt).toDateString() ||
					new Date(m.createdAt).getTime() -
						new Date(prev.createdAt).getTime() >
						30 * 60 * 1000;
				const sameRunAsPrev =
					!!prev &&
					prev.type !== "call" &&
					(prev.sender._id === m.sender._id ||
						(isMe && prev._id.startsWith("temp-"))) &&
					!showDay &&
					new Date(m.createdAt).getTime() -
						new Date(prev.createdAt).getTime() <
						5 * 60 * 1000;
				const endsRun =
					!next ||
					next.type === "call" ||
					next.sender._id !== m.sender._id ||
					new Date(next.createdAt).getTime() -
						new Date(m.createdAt).getTime() >=
						5 * 60 * 1000 ||
					new Date(next.createdAt).toDateString() !==
						new Date(m.createdAt).toDateString();
				return (
					<MessageBubble
						m={m}
						isMe={isMe}
						showAvatar={!isMe && endsRun}
						showTicks={isMe && i === lastMineIndex}
						peerAvatar={peerAvatar}
						album={albums.get(m._id)}
						showUnreadDivider={!!unreadAnchorId && m._id === unreadAnchorId}
						unreadLabel={unreadAtOpen}
						avatarUrl={(m.sender as { avatar?: string })?.avatar}
						fresh={new Date(m.createdAt).getTime() > mountTs}
						showDay={showDay}
						sameRunAsPrev={sameRunAsPrev}
						endsRun={endsRun}
						flashed={flashedId === m._id}
						peerName={peerName}
						deliveredAt={deliveredAt}
						readAt={readAt}
						peerReadUpTo={peerReadUpTo}
						autoplayNextId={nextAudioId.get(m._id)}
						myProfileId={myProfileId}
						isGroup={isGroup}
						{...handlers}
					/>
				);
			},
			[
				rows,
				albums,
				mountTs,
				nextAudioId,
				firstItemIndex,
				myProfileId,
				lastMineIndex,
				peerAvatar,
				unreadAnchorId,
				unreadAtOpen,
				flashedId,
				peerName,
				deliveredAt,
				readAt,
				peerReadUpTo,
				handlers,
			],
		);

		return (
			<div className="relative min-h-0 flex-1">
				{/* Virtuoso only mounts WITH data: mounted empty under a shifted
				    firstItemIndex, its initial-position pass never resolves and
				    the item wrapper sits visibility:hidden forever. Keyed per
				    thread so each conversation gets a fresh initial layout. */}
				{messages.length === 0 && !loading && (
					// The empty area has a purpose (owner pick, Instagram): who
					// this is, with a way to their profile.
					<div className="flex h-full flex-col items-center justify-start gap-1 px-8 pt-10 text-center animate-pop">
						<span className="relative mb-2 h-16 w-16 overflow-hidden rounded-pill bg-raised">
							<SafeAvatar src={peer?.avatar} eager />
						</span>
						<span className="font-sans text-[16px] font-semibold text-primary">
							{peer?.name || peerName}
						</span>
						{peer?.username && (
							<span className="font-sans text-[12.5px] text-muted">
								@{peer.username}
							</span>
						)}
						{peer?.username && !isGroup && (
							<Link
								href={`/profile/${peer.username}`}
								className="mt-3 rounded-pill bg-raised px-4 py-1.5 font-sans text-[12.5px] font-semibold text-primary transition-colors hover:bg-chip"
							>
								View profile
							</Link>
						)}
						<span className="mt-6 font-sans text-[12.5px] text-subtle">
							Say the first thing.
						</span>
					</div>
				)}
				{messages.length > 0 && (
				<div
					ref={trackRef}
					className="h-full"
					onTouchStart={onRevealStart}
					onTouchMove={onRevealMove}
					onTouchEnd={onRevealEnd}
					onTouchCancel={onRevealEnd}
				>
				<Virtuoso<BubbleMessage>
					key={threadId}
					ref={ref}
					// overflow-x-hidden: swipe-to-reply translates rows sideways,
					// and without this the scroller grew a horizontal scrollbar
					// mid-gesture (owner, 2026-09-02). The settle veil hides the
					// one frame where virtuoso corrects its estimated offsets —
					// threads opened looking like they were still arriving.
					className={clsx(
						"h-full overflow-x-hidden transition-opacity duration-100",
						settled ? "opacity-100" : "opacity-0",
					)}
					data={rows}
					// Defensive: virtuoso can probe an index past the data for
					// one frame while the initial window settles under a
					// shifted firstItemIndex — a bare m.clientKey crashed the
					// whole route there (found 2026-09-02).
					computeItemKey={(i, m) => m?.clientKey ?? m?._id ?? `i${i}`}
					firstItemIndex={firstItemIndex}
					// NOTE: no initialItemCount here. It is an SSR knob that
					// assumes data starts at index 0; combined with
					// firstItemIndex=100000 it built a window past the array
					// and threw before first paint.
					initialTopMostItemIndex={
						unreadAnchorIndex >= 0
							? { index: firstItemIndex + unreadAnchorIndex, align: "start" }
							: firstItemIndex + rows.length - 1
					}
					followOutput={(bottom) => (bottom ? "smooth" : false)}
					atBottomThreshold={80}
					atBottomStateChange={(bottom) => {
						setAtBottom(bottom);
						onAtBottomChange(bottom);
					}}
					startReached={onLoadOlder}
					increaseViewportBy={{ top: 600, bottom: 200 }}
					components={{ Footer }}
					itemContent={itemContent}
				/>
				</div>
				)}
				{/* Telegram's disc (owner pick): there whenever you're scrolled
				    up, the count riding as a badge when there is one. */}
				{!atBottom && (
					<button
						type="button"
						onClick={onShowNew}
						aria-label={
							pendingNew > 0 ? `${pendingNew} new messages` : "Jump to latest"
						}
						className="absolute bottom-3 right-4 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill bg-surface text-primary shadow-nav transition-colors hover:bg-raised animate-pop"
					>
						<RiArrowDownLine size={17} />
						{pendingNew > 0 && (
							<span className="absolute -right-1 -top-1 rounded-pill bg-brand px-1.5 font-sans text-[10px] font-bold tabular-nums text-brand-on">
								{pendingNew}
							</span>
						)}
					</button>
				)}
			</div>
		);
	},
);
