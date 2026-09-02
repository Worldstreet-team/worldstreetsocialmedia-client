"use client";

import { forwardRef, useCallback, useMemo, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { ArrowDown } from "@phosphor-icons/react";
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
	deliveredAt: number | null;
	readAt: number | null;
	peerReadUpTo?: string | null;
	pendingNew: number;
	onLoadOlder: () => void;
	onAtBottomChange: (atBottom: boolean) => void;
	onShowNew: () => void;
	handlers: Pick<
		BubbleProps,
		"onReply" | "onMenu" | "onJump" | "onMediaClick" | "onStory" | "onCallBack"
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

		const Footer = useCallback(
			() => (
				<div className="flex h-9 items-end px-4 pb-1">
					{peerTyping && <TypingIndicator />}
				</div>
			),
			[peerTyping],
		);

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
						showDay={showDay}
						sameRunAsPrev={sameRunAsPrev}
						endsRun={endsRun}
						flashed={flashedId === m._id}
						peerName={peerName}
						deliveredAt={deliveredAt}
						readAt={readAt}
						peerReadUpTo={peerReadUpTo}
						{...handlers}
					/>
				);
			},
			[
				messages,
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
				{messages.length > 0 && (
				<Virtuoso<BubbleMessage>
					key={threadId}
					ref={ref}
					className="h-full"
					data={messages}
					computeItemKey={(_i, m) => m.clientKey ?? m._id}
					firstItemIndex={firstItemIndex}
					initialTopMostItemIndex={firstItemIndex + messages.length - 1}
					// Synchronous first paint (the SSR path): the newest page
					// renders before any animation frame is granted — cold
					// opens paint instantly, and background tabs (frozen rAF)
					// still show the thread instead of a hidden shell.
					initialItemCount={Math.min(messages.length, 30)}
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
						<ArrowDown size={13} weight="bold" />
						{pendingNew === 1 ? "1 new message" : `${pendingNew} new messages`}
					</button>
				)}
			</div>
		);
	},
);
