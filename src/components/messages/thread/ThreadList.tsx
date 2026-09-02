"use client";

import { forwardRef, useCallback, useMemo, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { RiArrowDownLine } from "@remixicon/react";
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
	deliveredAt: number | null;
	readAt: number | null;
	peerReadUpTo?: string | null;
	pendingNew: number;
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
			deliveredAt,
			readAt,
			peerReadUpTo,
			pendingNew,
			onLoadOlder,
			onAtBottomChange,
			onShowNew,
			handlers,
		},
		ref,
	) {
		const [atBottom, setAtBottom] = useState(true);
		// Live-arrival gate: only messages born after this mount animate in.
		// biome-ignore lint/correctness/useExhaustiveDependencies: per-thread stamp
		const mountTs = useMemo(() => Date.now(), [threadId]);

		const Footer = useCallback(
			() => (
				<div className="flex h-9 items-end px-4 pb-1">
					{(peerTyping || peerRecording) && (
						<TypingIndicator
							mode={peerRecording ? "recording" : "typing"}
						/>
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

		const itemContent = useCallback(
			(index: number, m: BubbleMessage) => {
				const i = index - firstItemIndex;
				const prev = messages[i - 1];
				const next = messages[i + 1];
				const isMe =
					m.sender._id === myProfileId || m._id.startsWith("temp-");
				const showDay =
					!prev ||
					new Date(prev.createdAt).toDateString() !==
						new Date(m.createdAt).toDateString();
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
						showAvatar={!isMe && !sameRunAsPrev}
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
						{...handlers}
					/>
				);
			},
			[
				messages,
				mountTs,
				nextAudioId,
				firstItemIndex,
				myProfileId,
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
				{messages.length === 0 && (
					<div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
						<span className="font-sans text-[14px] font-semibold text-primary">
							Say the first thing
						</span>
						<span className="font-sans text-[12.5px] text-muted">
							Messages here are between the two of you.
						</span>
					</div>
				)}
				{messages.length > 0 && (
				<Virtuoso<BubbleMessage>
					key={threadId}
					ref={ref}
					className="h-full"
					data={messages}
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
					initialTopMostItemIndex={firstItemIndex + messages.length - 1}
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
				)}
				{!atBottom && pendingNew > 0 && (
					<button
						type="button"
						onClick={onShowNew}
						className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-pill bg-raised px-3.5 py-1.5 font-sans text-[12.5px] font-semibold text-primary shadow-nav transition-colors hover:bg-chip"
					>
						<RiArrowDownLine size={13} />
						{pendingNew === 1 ? "1 new message" : `${pendingNew} new messages`}
					</button>
				)}
			</div>
		);
	},
);
