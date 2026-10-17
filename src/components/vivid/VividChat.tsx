"use client";

import clsx from "clsx";
import { AnimatePresence } from "framer-motion";
import { getDefaultStore } from "jotai";
import { ArrowLeft } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { VividIntro } from "@/components/vivid/VividHello";
import { VividOrb } from "@/components/vivid/VividOrb";
import {
	Composer,
	HistorySheet,
	IconButton,
	PlanBar,
	type QuickStart,
	QuickStarts,
	VividTurns,
	VoiceMode,
	useGreeting,
	useVividChat,
} from "@/components/vivid/VividWindow";
import * as I from "@/components/vivid/vivid-icons";
import { formatTimeAgo } from "@/lib/utils";
import { type VividThreadRow, vividApi } from "@/lib/vivid.client";
import { vividAskPostAtom } from "@/store/ui.atom";

/**
 * Vivid in Messages (plan P3, owner 2026-10-16: "how do i even see vivid in
 * the messages ... start wiring"). A chat pinned at the top of the inbox;
 * opening it puts Vivid in the chat pane, at /messages/vivid, with the same
 * answers, cards and quick actions as the window, on the same harness and
 * the same history. Like any chat it opens on the latest conversation; New
 * chat and the clock are in its header.
 *
 * It is a pane, not a thread: no Ably channel, no bubbles. Vivid's answers
 * are documents (lists, tables, cards, drafts), which a bubble would cramp.
 */

/** Business, no deal open: the deals as a whole (owner 2026-10-16, "the business part too"). */
const BUSINESS_STARTS: QuickStart[] = [
	{ icon: I.IconBriefcase, label: "What needs my move?", ask: "Which of my deals need my move, and what would you do with each?" },
	{ icon: I.IconTrending, label: "How are my deals doing?", ask: "How are my live and finished deals doing? Impressions, clicks and money." },
	{ icon: I.IconSearch, label: "Check a creator's rates", fill: "What are the ad rates for @" },
	{ icon: I.IconWallet, label: "How escrow works", ask: "How do escrow and payouts work on my deals?" },
];

/** Business, about one deal. */
const DEAL_STARTS: QuickStart[] = [
	{ icon: I.IconBriefcase, label: "Sum up this deal", ask: "Sum up this deal: where it stands, whose move it is, and what to watch." },
	{ icon: I.IconTrending, label: "Is the price fair?", ask: "Is the price on this deal fair? Compare it with the rate card and my past deals." },
	{ icon: I.IconPen, label: "Draft a counter", fill: "Draft a counter-offer: " },
	{ icon: I.IconMessage, label: "Reply to them", fill: "Write a reply to them in the deal room: " },
];

/** The newest Vivid conversation, shared by the inbox row and the pane. */
let latestCache: { row: VividThreadRow | null; at: number } | null = null;
async function latestThread(fresh = false): Promise<VividThreadRow | null> {
	if (!fresh && latestCache && Date.now() - latestCache.at < 30_000) return latestCache.row;
	const r = await vividApi.threads();
	const row = r.ok && Array.isArray(r.data) ? (r.data[0] ?? null) : null;
	if (r.ok) latestCache = { row, at: Date.now() };
	return row;
}

export function VividChat({
	onBack,
	surface = "messages",
	dealId = null,
	dealWith = null,
}: {
	onBack?: () => void;
	/** Messages, or Business (owner 2026-10-16: "the business part too"). */
	surface?: "messages" | "business";
	/** A Business deal this chat is about ("Ask Vivid" on a deal). */
	dealId?: string | null;
	dealWith?: string | null;
}) {
	const greeting = useGreeting();
	const listRef = useRef<HTMLDivElement>(null);
	const chat = useVividChat({ surface, scroller: () => listRef.current, context: dealId ? { dealId } : null });
	const business = surface === "business";
	const [loading, setLoading] = useState(true);
	const [historyOpen, setHistoryOpen] = useState(false);
	const [voiceOpen, setVoiceOpen] = useState(false);
	const empty = chat.turns.length === 0;

	// Like any chat, it opens where the conversation left off, unless a post
	// was just sent to Vivid ("Ask Vivid"): that starts a conversation of its
	// own and goes straight off, scanning while Vivid reads it.
	// biome-ignore lint/correctness/useExhaustiveDependencies: once, on open
	useEffect(() => {
		let alive = true;
		// Business starts fresh: a chat about deals, not the last one from Messages.
		if (business) {
			setLoading(false);
			return;
		}
		const store = getDefaultStore();
		const asked = store.get(vividAskPostAtom);
		if (asked) {
			store.set(vividAskPostAtom, null);
			setLoading(false);
			void chat.send("", { post: asked });
			return;
		}
		void latestThread(true).then(async (row) => {
			if (row && alive) await chat.openThread(row._id);
			if (alive) setLoading(false);
		});
		return () => {
			alive = false;
		};
	}, []);

	// A new conversation shows in the inbox row the next time it reads.
	useEffect(() => {
		if (chat.threadId) latestCache = null;
	}, [chat.threadId]);

	return (
		// Solid, never see-through (owner 2026-10-16, "color riot" on a
		// phone): the pane covers the inbox there, and a frost let the
		// avatars behind it bleed through as coloured blobs. Glass is for
		// popups and sheets only.
		<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-none bg-page md:rounded-2xl md:bg-surface">
			<header className="flex h-16 shrink-0 items-center gap-1 px-2 md:px-3">
				{onBack && (
					<IconButton label="Back" onClick={onBack} className="md:hidden">
						<ArrowLeft size={20} />
					</IconButton>
				)}
				<span className="ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-raised">
					<VividOrb size={32} speed={chat.busy ? 1.6 : 0.4} />
				</span>
				<span className="ml-2 flex min-w-0 flex-1 flex-col">
					<span className="truncate font-sans text-[calc(15px*var(--ws-fs))] font-semibold text-primary">Vivid</span>
					<span className="truncate font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">
						{chat.busy ? "Working on it" : dealWith ? `About your deal with ${dealWith}` : business ? "Your deals assistant" : "Your assistant"}
					</span>
				</span>
				<IconButton label="Your chats" onClick={() => setHistoryOpen(true)}>
					<I.IconHistory size={20} />
				</IconButton>
				<IconButton label="New chat" onClick={chat.newChat} disabled={empty}>
					<I.IconCompose size={20} />
				</IconButton>
			</header>

			<div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
				{loading ? (
					// The shape of a conversation while the last one loads.
					<div className="mx-auto flex w-full max-w-[44rem] flex-col gap-8 px-4 pt-6" aria-hidden="true">
						<span className="skeleton ml-auto h-10 w-[46%] rounded-[22px]" />
						<span className="flex flex-col gap-2.5">
							<span className="skeleton h-3.5 w-[86%] rounded-[4px]" />
							<span className="skeleton h-3.5 w-[72%] rounded-[4px]" />
							<span className="skeleton h-3.5 w-[54%] rounded-[4px]" />
						</span>
					</div>
				) : empty ? (
					<div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-10 text-center">
						<VividIntro className="h-[96px] w-[144px]" />
						<h2 className="font-display text-[calc(22px*var(--ws-fs))] font-medium tracking-[-0.01em] text-balance text-primary">
							{dealWith ? `Your deal with ${dealWith}` : greeting}
						</h2>
					</div>
				) : (
					<VividTurns chat={chat} className="mx-auto flex w-full max-w-[44rem] flex-col gap-9 px-4 pt-5 pb-6" />
				)}
			</div>

			<div className="mx-auto w-full max-w-[44rem] shrink-0 px-3 pt-1 pb-[max(12px,var(--ws-safe-bottom))]">
				{empty && !loading && (
					<QuickStarts
						chat={chat}
						starts={business ? (dealId ? DEAL_STARTS : BUSINESS_STARTS) : undefined}
						className="-mx-3 mb-2.5 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
					/>
				)}
				<AnimatePresence initial={false}>
					{chat.plan.entitled === false && <PlanBar key="plan" url={chat.plan.url} />}
				</AnimatePresence>
				<Composer
					inputRef={chat.inputRef}
					value={chat.input}
					onChange={chat.setInput}
					onSend={() => void chat.send(chat.input)}
					onStop={chat.stop}
					onVoice={() => setVoiceOpen(true)}
					busy={chat.busy}
					web={chat.web}
					onWeb={() => chat.setWeb((w) => !w)}
					hero={false}
					files={chat.files}
					onAddFiles={chat.addFiles}
					onRemoveFile={chat.removeFile}
					canAttach={chat.plan.entitled !== false}
				/>
			</div>

			<HistorySheet
				open={historyOpen}
				current={chat.threadId}
				onClose={() => setHistoryOpen(false)}
				onOpen={(row) => {
					setHistoryOpen(false);
					void chat.openThread(row._id);
				}}
			/>
			<AnimatePresence>{voiceOpen && <VoiceMode key="voice" onClose={() => setVoiceOpen(false)} send={chat.send} />}</AnimatePresence>
		</div>
	);
}

/** Vivid, pinned first in the inbox: the orb, the name, the last conversation. */
export function VividInboxRow({ active, onOpen }: { active: boolean; onOpen: () => void }) {
	const [last, setLast] = useState<VividThreadRow | null | undefined>(latestCache?.row);
	useEffect(() => {
		let alive = true;
		void latestThread().then((row) => alive && setLast(row));
		return () => {
			alive = false;
		};
	}, []);
	const when = last?.lastMessageAt || last?.createdAt;
	return (
		<button
			type="button"
			onClick={onOpen}
			aria-current={active ? "true" : undefined}
			className={clsx(
				"group relative mb-1 flex w-full cursor-pointer items-center gap-3.5 rounded-[18px] px-3 py-2.5 text-left transition-colors",
				active ? "bg-primary/[0.09]" : "hover:bg-primary/[0.05]",
			)}
		>
			<span className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-pill bg-raised">
				<VividOrb size={40} speed={0.35} />
			</span>
			<span className="min-w-0 flex-1">
				<span className="flex items-center gap-1.5">
					<span className="truncate font-sans text-[calc(15px*var(--ws-fs))] font-medium text-primary">Vivid</span>
					<span className="shrink-0 rounded-pill bg-primary/5 px-1.5 py-px font-sans text-[calc(11px*var(--ws-fs))] font-medium text-muted">
						Assistant
					</span>
				</span>
				<span className="mt-0.5 flex items-center gap-1 font-sans text-[calc(13px*var(--ws-fs))] text-muted">
					<span className="truncate">{last?.title || "Ask anything, or tell it what to do"}</span>
					{when && <span className="shrink-0 tabular-nums text-subtle">{"· "}{formatTimeAgo(when)}</span>}
				</span>
			</span>
		</button>
	);
}

/** Vivid's face in the folded chat rail, first above the chats. */
export function VividRailFace({ active, onOpen }: { active: boolean; onOpen: () => void }) {
	return (
		<button
			type="button"
			onClick={onOpen}
			aria-label="Vivid"
			title="Vivid"
			aria-current={active ? "true" : undefined}
			className={clsx(
				"relative flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-[18px] transition-colors",
				active ? "bg-primary/10" : "hover:bg-primary/5",
			)}
		>
			<span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-pill bg-raised">
				<VividOrb size={34} speed={0.35} />
			</span>
		</button>
	);
}
