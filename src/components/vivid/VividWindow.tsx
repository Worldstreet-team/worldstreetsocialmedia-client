"use client";

import clsx from "clsx";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
import { OverlayHeader, OverlayPanel, OverlayScrim, useOverlayDismiss } from "@/components/ui/Overlay";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { VividIntro, VividThinking } from "@/components/vivid/VividHello";
import { VividMarkdown } from "@/components/vivid/VividMarkdown";
import { VividOrb } from "@/components/vivid/VividOrb";
import { intentKind, useVividIntent } from "@/components/vivid/vivid-actions";
import * as I from "@/components/vivid/vivid-icons";
import { DUR, EASE, EASE_OUT_EXPO, press, staggerItem, staggerParent, swap } from "@/lib/motion-presets";
import { formatTimeAgo } from "@/lib/utils";
import {
	settleVividAction,
	streamVividTurn,
	vividApi,
	type VividCard,
	type VividEvent,
	type VividStoredMessage,
	type VividThreadRow,
} from "@/lib/vivid.client";
import { userAtom } from "@/store/user.atom";

/**
 * The Vivid window (owner 2026-10-16: "how Grok is", then "i need this ai
 * mode high tier"). One column in the middle of the page with the rails
 * folded away (MainShell fullCanvas). Empty, it is a greeting with the
 * composer in the middle of the screen and a row of quick starts; the first
 * message sends the composer gliding down to the foot, where it stays.
 *
 * Answers stream from the gateway's harness as formatted text, with the
 * steps Vivid took folded into one line above them and cards under them:
 * posts, people, trends, sources, a draft waiting for Confirm, or a screen
 * Vivid opened for you (a quick action). Every answer can be copied, read
 * aloud, asked again and rated. Past chats live behind the clock.
 *
 * Icons are Vivid's own set (vivid-icons.tsx), not the house Phosphor.
 * Billing is the WorldStreet $100 subscription (owner 2026-10-16), so the
 * window carries no credits meter.
 */

type Icon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

interface Step {
	id: string;
	name: string;
	label: string;
	status: "start" | "done" | "error";
}

/** A card plus whether it arrived live (a live quick action runs itself once). */
type LiveCard = VividCard & { live?: boolean };

interface Turn {
	id: string;
	role: "user" | "vivid";
	text: string;
	steps?: Step[];
	cards?: LiveCard[];
	error?: { message: string; code?: string };
	streaming?: boolean;
	/** The stored answer, for feedback. */
	messageId?: string | null;
	feedback?: "up" | "down" | null;
	/** The question this answer is for, so Ask again can resend it. */
	ask?: string;
	/** Loaded from history: drafts in it are shown, not confirmable. */
	past?: boolean;
}

const TOOL_ICON: Record<string, Icon> = {
	search_posts: I.IconSearch,
	search_people: I.IconPeople,
	trends: I.IconTrending,
	get_post: I.IconPost,
	get_profile: I.IconPerson,
	my_notifications: I.IconBell,
	spaces: I.IconSpace,
	weekly_vote: I.IconVote,
	wallet_balance: I.IconWallet,
	web_search: I.IconGlobe,
	post: I.IconPen,
	reply: I.IconMessage,
	quote: I.IconPen,
	align: I.IconPeople,
	unalign: I.IconPeople,
	bookmark: I.IconBookmark,
	schedule_space: I.IconCalendar,
	message_someone: I.IconMessage,
	open_go_live: I.IconLive,
	open_composer: I.IconPen,
	open_chat: I.IconMessage,
	open_pay: I.IconWallet,
	open_space: I.IconSpace,
	open_page: I.IconArrowOut,
	set_appearance: I.IconContrast,
	open_linked_app: I.IconApps,
};
const toolIcon = (name: string): Icon => TOOL_ICON[name] ?? I.IconSpark;

/** What a draft card is, in two words, by tool. */
const DRAFT_LABEL: Record<string, string> = {
	post: "Draft post",
	reply: "Draft reply",
	quote: "Draft quote",
	align: "Align",
	unalign: "Unalign",
	bookmark: "Bookmark",
	schedule_space: "Space",
	message_someone: "Message",
};

/** Quick starts under the empty composer: some fill it in, one just asks. Five, so they sit on one row. */
const STARTS: { icon: Icon; label: string; fill?: string; ask?: string }[] = [
	{ icon: I.IconLive, label: "Go live", fill: "I want to go live about " },
	{ icon: I.IconMessage, label: "Message someone", fill: "Message @" },
	{ icon: I.IconSpace, label: "Start a Space", fill: "Start a Space about " },
	{ icon: I.IconPen, label: "Draft a post", fill: "Draft a post about " },
	{ icon: I.IconFeed, label: "Catch me up", ask: "Catch me up on my feed" },
];

const uid = () => Math.random().toString(36).slice(2, 10);

/** Text for the voice: no markdown marks, no URLs read aloud. */
const speakable = (s: string) =>
	s
		.replace(/https?:\/\/\S+/g, "")
		.replace(/[*_`#>|]/g, "")
		.replace(/\s+/g, " ")
		.trim();

/** The page scrolls inside MainShell's column, not the window. */
const scroller = () => document.getElementById("ws-main-scroll");

/** A stored message back into a turn (history). */
function fromStored(m: VividStoredMessage, ask?: string): Turn {
	if (m.role === "user") return { id: m._id, role: "user", text: m.content };
	return {
		id: m._id,
		role: "vivid",
		text: m.content,
		messageId: m._id,
		feedback: m.feedback ?? null,
		ask,
		past: true,
		cards: (m.blocks ?? []).map((b) => ({ kind: b.kind, ...b.data }) as unknown as LiveCard),
	};
}

export function VividWindow() {
	const user = useAtomValue(userAtom);
	const [turns, setTurns] = useState<Turn[]>([]);
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);
	const [threadId, setThreadId] = useState<string | null>(null);
	const [web, setWeb] = useState(false);
	const [voiceOpen, setVoiceOpen] = useState(false);
	const [historyOpen, setHistoryOpen] = useState(false);
	/** The WorldStreet Vivid plan: false shows Subscribe; null is unknown. */
	const [plan, setPlan] = useState<{ entitled: boolean | null; url: string }>({
		entitled: null,
		url: "https://worldstreetgold.com/vivid",
	});
	const abortRef = useRef<AbortController | null>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	/** Follow the answer down only while the reader is at the bottom. */
	const stickRef = useRef(true);

	const greeting = (() => {
		const h = new Date().getHours();
		const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
		return user?.firstName ? `${part}, ${user.firstName}` : part;
	})();

	useEffect(() => {
		void vividApi.usage().then((r) => {
			if (r.ok) setPlan({ entitled: r.data.entitled, url: r.data.subscribeUrl });
		});
	}, []);

	useEffect(() => {
		const el = scroller();
		if (!el) return;
		const onScroll = () => {
			stickRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 96;
		};
		el.addEventListener("scroll", onScroll, { passive: true });
		return () => el.removeEventListener("scroll", onScroll);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: follow the thread as it grows
	useLayoutEffect(() => {
		const el = scroller();
		if (el && stickRef.current) el.scrollTop = el.scrollHeight;
	}, [turns]);

	/** Send one turn; resolves with Vivid's final text (Talk mode speaks it). */
	const send = useCallback(
		async (text: string): Promise<string> => {
			const q = text.trim();
			if (!q || busy) return "";
			setInput("");
			setBusy(true);
			stickRef.current = true;
			const vid = uid();
			setTurns((t) => [
				...t,
				{ id: uid(), role: "user", text: q },
				{ id: vid, role: "vivid", text: "", steps: [], cards: [], streaming: true, ask: q },
			]);
			const patch = (fn: (t: Turn) => Turn) => setTurns((all) => all.map((x) => (x.id === vid ? fn(x) : x)));
			let answer = "";
			const ac = new AbortController();
			abortRef.current = ac;
			await streamVividTurn({
				text: q,
				threadId,
				context: web ? { web: true } : null,
				signal: ac.signal,
				onEvent: (e: VividEvent) => {
					if (e.type === "thread") setThreadId(e.threadId);
					else if (e.type === "token") {
						answer += e.content;
						patch((x) => ({ ...x, text: x.text + e.content }));
					} else if (e.type === "tool") {
						patch((x) => {
							const steps = [...(x.steps ?? [])];
							const i = steps.findIndex((s) => s.id === e.id);
							const step = { id: e.id, name: e.name, label: e.label || e.name, status: e.status };
							if (i >= 0) steps[i] = step;
							else steps.push(step);
							return { ...x, steps };
						});
					} else if (e.type === "card") patch((x) => ({ ...x, cards: [...(x.cards ?? []), { ...e.card, live: true }] }));
					else if (e.type === "access") setPlan({ entitled: e.entitled, url: e.subscribeUrl });
					else if (e.type === "done") patch((x) => ({ ...x, messageId: e.messageId }));
					else if (e.type === "error") patch((x) => ({ ...x, error: { message: e.message, code: e.code } }));
				},
			});
			patch((x) => ({ ...x, streaming: false }));
			abortRef.current = null;
			setBusy(false);
			return answer;
		},
		[busy, threadId, web],
	);

	const stop = () => abortRef.current?.abort();
	const newChat = () => {
		stop();
		setTurns([]);
		setThreadId(null);
		setInput("");
		inputRef.current?.focus();
	};

	const openThread = async (row: VividThreadRow) => {
		setHistoryOpen(false);
		if (row._id === threadId) return;
		stop();
		const r = await vividApi.thread(row._id);
		if (!r.ok) return;
		let ask: string | undefined;
		const mapped: Turn[] = [];
		for (const m of r.data.messages) {
			if (m.role === "user") ask = m.content;
			mapped.push(fromStored(m, ask));
		}
		stickRef.current = true;
		setThreadId(row._id);
		setTurns(mapped);
	};

	const fillComposer = (text: string) => {
		setInput(text);
		requestAnimationFrame(() => {
			const el = inputRef.current;
			if (!el) return;
			el.focus();
			el.setSelectionRange(text.length, text.length);
		});
	};

	const empty = turns.length === 0;

	return (
		// The window takes the right rail's space too (MainShell fullCanvas) and
		// sits in the middle of it (owner 2026-10-16: "take over the side rail,
		// just it in the middle").
		<div className="relative mx-auto flex min-h-dvh w-full max-w-[780px] flex-col pb-nav md:pb-0">
			<header className="sticky top-0 z-sticky flex h-14 shrink-0 items-center gap-1 bg-page px-2 sm:px-3">
				<IconButton label="Your chats" onClick={() => setHistoryOpen(true)}>
					<I.IconHistory size={20} />
				</IconButton>
				<div className="flex items-center gap-2 pl-1">
					<VividOrb size={22} speed={busy ? 1.6 : 0.6} />
					<h1 className="font-display text-[calc(16px*var(--ws-fs))] font-semibold text-primary">Vivid</h1>
				</div>
				<span className="flex-1" />
				<IconButton label="New chat" onClick={newChat} disabled={empty}>
					<I.IconCompose size={20} />
				</IconButton>
			</header>

			{empty ? (
				<div className="flex flex-1 flex-col items-center justify-end gap-5 px-6 pb-8 text-center">
					{/* Three dots split into Vivid's mark, gather on the ring she
					    thinks with, write a hello, then fold back (owner 2026-10-16). */}
					<VividIntro className="h-[112px] w-[168px]" />
					<h2 className="font-display text-[calc(28px*var(--ws-fs))] font-medium tracking-[-0.015em] text-balance text-primary">
						{greeting}
					</h2>
				</div>
			) : (
				<div className="flex flex-1 flex-col gap-9 px-4 pt-3 pb-8 sm:px-6">
					{turns.map((t) =>
						t.role === "user" ? (
							<UserTurn key={t.id} turn={t} />
						) : (
							<VividAnswer
								key={t.id}
								turn={t}
								subscribeUrl={plan.entitled === false ? plan.url : undefined}
								onRetry={t.ask && !busy ? () => void send(t.ask as string) : undefined}
								onFeedback={(v) => {
									setTurns((all) => all.map((x) => (x.id === t.id ? { ...x, feedback: v } : x)));
									if (t.messageId) void vividApi.feedback(t.messageId, v);
								}}
							/>
						),
					)}
				</div>
			)}

			{/* One composer for the whole life of the window: it sits in the
			    middle while the window is empty and glides to the foot on the
			    first message (position only, so nothing inside it stretches). */}
			<motion.div
				layout="position"
				transition={{ layout: { duration: 0.5, ease: EASE_OUT_EXPO } }}
				className={clsx(
					"z-sticky w-full px-3 sm:px-4",
					empty ? "relative" : "sticky bottom-[var(--ws-nav-clearance,0px)] bg-page pt-1 pb-3 md:bottom-0",
				)}
			>
				<AnimatePresence initial={false}>
					{plan.entitled === false && <PlanBar key="plan" url={plan.url} />}
				</AnimatePresence>
				<Composer
					inputRef={inputRef}
					value={input}
					onChange={setInput}
					onSend={() => void send(input)}
					onStop={stop}
					onVoice={() => setVoiceOpen(true)}
					busy={busy}
					web={web}
					onWeb={() => setWeb((w) => !w)}
					hero={empty}
				/>
				{empty && (
					<motion.div
						variants={staggerParent}
						initial="hidden"
						animate="show"
						className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:flex-wrap sm:justify-center sm:overflow-visible [&::-webkit-scrollbar]:hidden"
					>
						{STARTS.map((s) => (
							<motion.button
								key={s.label}
								type="button"
								variants={staggerItem}
								onClick={() => (s.ask ? void send(s.ask) : fillComposer(s.fill ?? ""))}
								className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-pill bg-primary/5 px-4 font-sans text-[calc(13.5px*var(--ws-fs))] font-medium text-primary transition-colors hover:bg-primary/10"
							>
								<s.icon size={17} className="text-muted" />
								{s.label}
							</motion.button>
						))}
					</motion.div>
				)}
			</motion.div>
			{/* Below the composer, so it sits in the middle while empty. */}
			{empty && <div className="flex-[1.2]" />}

			<HistorySheet open={historyOpen} current={threadId} onClose={() => setHistoryOpen(false)} onOpen={openThread} />
			<AnimatePresence>{voiceOpen && <VoiceMode key="voice" onClose={() => setVoiceOpen(false)} send={send} />}</AnimatePresence>
		</div>
	);
}

/* ── pieces ─────────────────────────────────────────────────────────────── */

/**
 * The preview's one line (owner 2026-10-16: Vivid is the WorldStreet $100
 * plan). Without it Vivid still talks, the way the hub's locked chat does;
 * this says what the plan adds and where to get it, once, above the composer.
 */
function PlanBar({ url }: { url: string }) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 6 }}
			animate={{ opacity: 1, y: 0, transition: { duration: DUR.slow, ease: EASE_OUT_EXPO } }}
			exit={{ opacity: 0, transition: { duration: DUR.fast } }}
			className="mb-2 flex items-center gap-3 rounded-[18px] bg-primary/5 py-2 pr-2 pl-4"
		>
			<I.IconSpark size={16} className="shrink-0 text-primary" />
			<p className="min-w-0 flex-1 font-sans text-[calc(13px*var(--ws-fs))] leading-snug text-muted">
				<span className="font-semibold text-primary">Preview.</span> The WorldStreet Vivid plan lets Vivid look things up and act for you.
			</p>
			<a
				href={url}
				target="_blank"
				rel="noopener noreferrer"
				className="flex h-9 shrink-0 items-center gap-1 rounded-pill bg-primary px-3.5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-page"
			>
				Subscribe
				<I.IconArrowOut size={14} strokeWidth={2} />
			</a>
		</motion.div>
	);
}

function IconButton({
	label,
	onClick,
	disabled,
	children,
	className,
}: {
	label: string;
	onClick: () => void;
	disabled?: boolean;
	children: ReactNode;
	className?: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			title={label}
			disabled={disabled}
			className={clsx(
				"flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-primary/5 hover:text-primary disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent",
				className,
			)}
		>
			{children}
		</button>
	);
}

function Composer({
	inputRef,
	value,
	onChange,
	onSend,
	onStop,
	onVoice,
	busy,
	web,
	onWeb,
	hero,
}: {
	inputRef: React.RefObject<HTMLTextAreaElement | null>;
	value: string;
	onChange: (v: string) => void;
	onSend: () => void;
	onStop: () => void;
	onVoice: () => void;
	busy: boolean;
	web: boolean;
	onWeb: () => void;
	hero: boolean;
}) {
	// Grows with the text, up to about eight lines.
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the text or the size changes
	useLayoutEffect(() => {
		const el = inputRef.current;
		if (!el) return;
		el.style.height = "0px";
		el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
	}, [value, hero]);

	const action = busy ? "stop" : value.trim() ? "send" : "talk";
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				if (!busy) onSend();
			}}
			className={clsx(
				"flex flex-col rounded-[26px] bg-surface ring-1 ring-primary/[0.08] transition-shadow focus-within:ring-primary/[0.16]",
				hero ? "px-5 pt-4 pb-3" : "px-4 pt-3 pb-2.5",
			)}
		>
			<textarea
				ref={inputRef}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					// Enter sends on a keyboard; on a phone it is a new line.
					if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !matchMedia("(pointer: coarse)").matches) {
						e.preventDefault();
						if (!busy) onSend();
					}
				}}
				rows={1}
				aria-label="Message Vivid"
				placeholder={hero ? "Ask Vivid anything" : "Ask a follow-up"}
				className={clsx(
					"w-full resize-none bg-transparent font-sans text-primary outline-none placeholder:text-subtle",
					hero ? "min-h-[48px] text-[calc(17px*var(--ws-fs))] leading-relaxed" : "min-h-[26px] text-base sm:text-[calc(15.5px*var(--ws-fs))]",
				)}
			/>
			<div className="mt-1.5 flex items-center gap-1">
				<button
					type="button"
					onClick={onWeb}
					aria-pressed={web}
					className={clsx(
						"-ml-2 flex h-9 cursor-pointer items-center gap-1.5 rounded-pill px-3 font-sans text-[calc(13px*var(--ws-fs))] font-medium transition-colors",
						web ? "bg-primary/10 text-primary" : "text-muted hover:bg-primary/5 hover:text-primary",
					)}
				>
					<I.IconGlobe size={17} />
					Search the web
				</button>
				<span className="flex-1" />
				<AnimatePresence mode="popLayout" initial={false}>
					{action === "talk" ? (
						<motion.button
							key="talk"
							{...swap}
							type="button"
							onClick={onVoice}
							aria-label="Talk to Vivid"
							className="flex h-10 cursor-pointer items-center gap-1.5 rounded-pill bg-primary pr-4 pl-3.5 font-sans text-[calc(13.5px*var(--ws-fs))] font-semibold text-page"
						>
							<I.IconVoice size={18} strokeWidth={2.1} />
							Talk
						</motion.button>
					) : (
						<motion.button
							key={action}
							{...swap}
							type={action === "send" ? "submit" : "button"}
							onClick={action === "stop" ? onStop : undefined}
							aria-label={action === "stop" ? "Stop" : "Send"}
							className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill bg-primary text-page"
						>
							{action === "stop" ? <I.IconStop size={20} /> : <I.IconSend size={19} strokeWidth={2.2} />}
						</motion.button>
					)}
				</AnimatePresence>
			</div>
		</form>
	);
}

function UserTurn({ turn }: { turn: Turn }) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0, transition: { duration: 0.26, ease: EASE_OUT_EXPO } }}
			className="flex justify-end"
		>
			<p className="max-w-[82%] whitespace-pre-wrap break-words rounded-[22px] bg-raised px-4 py-2.5 font-sans text-[calc(15.5px*var(--ws-fs))] leading-relaxed text-primary">
				{turn.text}
			</p>
		</motion.div>
	);
}

function VividAnswer({
	turn,
	onRetry,
	onFeedback,
	subscribeUrl,
}: {
	turn: Turn;
	onRetry?: () => void;
	onFeedback: (v: "up" | "down" | null) => void;
	/** Set while the person has no plan: a preview limit offers Subscribe. */
	subscribeUrl?: string;
}) {
	const [copied, setCopied] = useState(false);
	const working = turn.streaming && !turn.text && !turn.cards?.length;
	const speak = () => {
		if (!("speechSynthesis" in window)) return;
		window.speechSynthesis.cancel();
		window.speechSynthesis.speak(new SpeechSynthesisUtterance(speakable(turn.text)));
	};
	return (
		<div className="flex flex-col gap-3">
			{turn.steps && turn.steps.length > 0 && <Steps steps={turn.steps} running={!!turn.streaming} />}
			{working ? (
				<VividThinking className="h-[40px] w-[52px]" />
			) : (
				turn.text && (
					<VividMarkdown
						text={turn.text}
						className="flex flex-col gap-3 font-sans text-[calc(15.5px*var(--ws-fs))] leading-[1.7] text-primary"
					/>
				)
			)}
			{turn.cards?.map((c, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: cards arrive in order and never reorder
				<CardView key={i} card={c} past={turn.past} streaming={turn.streaming} />
			))}
			{turn.error && <ErrorNote error={turn.error} onRetry={onRetry} subscribeUrl={subscribeUrl} />}
			{!turn.streaming && turn.text && (
				<div className="-ml-2.5 flex items-center text-muted">
					<IconButton
						label={copied ? "Copied" : "Copy"}
						onClick={() => {
							void navigator.clipboard?.writeText(turn.text).catch(() => {});
							setCopied(true);
							setTimeout(() => setCopied(false), 1400);
						}}
					>
						{copied ? <I.IconCheck size={18} /> : <I.IconCopy size={18} />}
					</IconButton>
					<IconButton label="Read aloud" onClick={speak}>
						<I.IconSpeaker size={18} />
					</IconButton>
					{onRetry && (
						<IconButton label="Ask again" onClick={onRetry}>
							<I.IconRetry size={18} />
						</IconButton>
					)}
					{turn.messageId && (
						<>
							<IconButton
								label="Good answer"
								onClick={() => onFeedback(turn.feedback === "up" ? null : "up")}
								className={turn.feedback === "up" ? "text-primary" : undefined}
							>
								<I.IconThumbUp size={18} strokeWidth={turn.feedback === "up" ? 2.3 : 1.75} />
							</IconButton>
							<IconButton
								label="Bad answer"
								onClick={() => onFeedback(turn.feedback === "down" ? null : "down")}
								className={turn.feedback === "down" ? "text-primary" : undefined}
							>
								<I.IconThumbDown size={18} strokeWidth={turn.feedback === "down" ? 2.3 : 1.75} />
							</IconButton>
						</>
					)}
				</div>
			)}
		</div>
	);
}

/** What Vivid did, folded into one line; open it for each step. */
function Steps({ steps, running }: { steps: Step[]; running: boolean }) {
	const [open, setOpen] = useState(false);
	const current = [...steps].reverse().find((s) => s.status === "start");
	const names = [...new Set(steps.map((s) => s.name))];
	const failed = steps.some((s) => s.status === "error");
	const summary = running && current ? current.label : steps.length === 1 ? steps[0].label : `${steps.length} steps`;
	return (
		<div className="flex flex-col gap-2">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
				className="-ml-1 flex w-fit max-w-full cursor-pointer items-center gap-2 rounded-pill py-1 pr-2.5 pl-1 text-muted transition-colors hover:bg-primary/5 hover:text-primary"
			>
				<span className="flex -space-x-1.5">
					{names.slice(0, 3).map((n) => {
						const Ico = toolIcon(n);
						return (
							<span key={n} className="flex h-6 w-6 items-center justify-center rounded-full bg-page ring-1 ring-primary/10">
								<Ico size={13} strokeWidth={2} />
							</span>
						);
					})}
				</span>
				<span className="truncate font-sans text-[calc(13px*var(--ws-fs))] font-medium">
					{summary}
					{failed && !running && <span className="text-danger"> · one step failed</span>}
				</span>
				{running && current ? <Spinner /> : <I.IconChevronDown size={15} className={clsx("transition-transform", open && "rotate-180")} />}
			</button>
			<AnimatePresence initial={false}>
				{open && (
					<motion.ol
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto", transition: { duration: DUR.slow, ease: EASE } }}
						exit={{ opacity: 0, height: 0, transition: { duration: DUR.fast, ease: EASE } }}
						className="ml-2 flex flex-col overflow-hidden border-hairline border-l pl-4"
					>
						{steps.map((s) => {
							const Ico = toolIcon(s.name);
							return (
								<li key={s.id} className="flex items-center gap-2.5 py-1.5 font-sans text-[calc(13px*var(--ws-fs))] text-muted">
									<Ico size={15} />
									<span className="min-w-0 flex-1 truncate">{s.label}</span>
									{s.status === "start" ? (
										<Spinner />
									) : s.status === "error" ? (
										<I.IconClose size={14} className="text-danger" />
									) : (
										<I.IconCheck size={14} className="text-success" />
									)}
								</li>
							);
						})}
					</motion.ol>
				)}
			</AnimatePresence>
		</div>
	);
}

/** The house spinner, small: a spinning arc (spinners stay under reduced motion). */
function Spinner() {
	return (
		<svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true">
			<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
			<path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
		</svg>
	);
}

function ErrorNote({
	error,
	onRetry,
	subscribeUrl,
}: {
	error: { message: string; code?: string };
	onRetry?: () => void;
	subscribeUrl?: string;
}) {
	const blocked = ["limit", "unavailable"].includes(error.code ?? "");
	return (
		<div className="flex items-center gap-3 rounded-[16px] bg-danger/[0.08] px-4 py-3">
			<p className="min-w-0 flex-1 font-sans text-[calc(14px*var(--ws-fs))] text-primary">{error.message}</p>
			{error.code === "limit" && subscribeUrl && (
				<a
					href={subscribeUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="flex h-9 shrink-0 items-center rounded-pill bg-primary px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-page"
				>
					Subscribe
				</a>
			)}
			{onRetry && !blocked && (
				<button
					type="button"
					onClick={onRetry}
					className="h-9 shrink-0 cursor-pointer rounded-pill bg-primary/[0.08] px-3.5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary hover:bg-primary/[0.12]"
				>
					Try again
				</button>
			)}
		</div>
	);
}

/* ── cards ──────────────────────────────────────────────────────────────── */

const cardBox = "overflow-hidden rounded-[18px] bg-surface ring-1 ring-primary/[0.06]";

function Person({ p, size = 40 }: { p: { username: string; name: string; avatar: string | null; isVerified?: boolean }; size?: number }) {
	return (
		<span className="flex min-w-0 items-center gap-3">
			<span className="relative shrink-0 overflow-hidden rounded-full bg-raised" style={{ width: size, height: size }}>
				<SafeAvatar src={p.avatar} className="object-cover" eager />
			</span>
			<span className="flex min-w-0 flex-col">
				<span className="flex min-w-0 items-center gap-1 font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary">
					<span className="truncate">{p.name}</span>
					{p.isVerified && <VerifiedIcon size={{ width: "14", height: "14" }} />}
				</span>
				<span className="truncate font-sans text-[calc(13px*var(--ws-fs))] text-subtle">@{p.username}</span>
			</span>
		</span>
	);
}

function CardView({ card, past, streaming }: { card: LiveCard; past?: boolean; streaming?: boolean }) {
	if (card.kind === "posts")
		return (
			<div className={clsx(cardBox, "divide-y divide-hairline")}>
				{card.posts.map((p) => (
					<Link key={p.id} href={`/post/${p.id}`} className="flex gap-3 px-4 py-3 transition-colors hover:bg-raised">
						<span className="flex min-w-0 flex-1 flex-col gap-1">
							<span className="flex min-w-0 items-baseline gap-1.5 font-sans text-[calc(13.5px*var(--ws-fs))]">
								<span className="truncate font-semibold text-primary">{p.authorName || p.author}</span>
								{p.author && <span className="shrink-0 text-subtle">@{p.author}</span>}
								{p.createdAt && <span className="shrink-0 text-subtle">· {formatTimeAgo(p.createdAt)}</span>}
							</span>
							<span className="line-clamp-3 font-sans text-[calc(14px*var(--ws-fs))] leading-relaxed text-muted">{p.text}</span>
						</span>
					</Link>
				))}
			</div>
		);
	if (card.kind === "people")
		return (
			<div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
				{card.people.map((u) => (
					<Link
						key={u.id}
						href={`/profile/${u.username}`}
						className={clsx(cardBox, "flex w-[156px] shrink-0 flex-col items-center gap-2.5 px-3 pt-4 pb-3.5 text-center transition-colors hover:bg-raised")}
					>
						<span className="relative h-14 w-14 overflow-hidden rounded-full bg-raised">
							<SafeAvatar src={u.avatar} className="object-cover" eager />
						</span>
						<span className="flex w-full min-w-0 flex-col items-center">
							<span className="flex max-w-full items-center gap-1 font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary">
								<span className="truncate">{u.name}</span>
								{u.isVerified && <VerifiedIcon size={{ width: "14", height: "14" }} />}
							</span>
							<span className="w-full truncate font-sans text-[calc(12.5px*var(--ws-fs))] text-subtle">@{u.username}</span>
						</span>
					</Link>
				))}
			</div>
		);
	if (card.kind === "trends")
		return (
			<div className={clsx(cardBox, "divide-y divide-hairline")}>
				{card.trends.slice(0, 6).map((tr, i) => (
					<Link
						key={tr.title}
						href={`/explore?q=${encodeURIComponent(tr.title)}`}
						className="flex items-center gap-3.5 px-4 py-2.5 transition-colors hover:bg-raised"
					>
						<span className="w-4 text-right font-sans text-[calc(13px*var(--ws-fs))] text-subtle tabular-nums">{i + 1}</span>
						<span className="min-w-0 flex-1 truncate font-sans text-[calc(14.5px*var(--ws-fs))] font-semibold text-primary">{tr.title}</span>
						{tr.posts != null && (
							<span className="shrink-0 font-sans text-[calc(12.5px*var(--ws-fs))] text-subtle tabular-nums">
								{tr.posts.toLocaleString()} posts
							</span>
						)}
					</Link>
				))}
			</div>
		);
	if (card.kind === "sources")
		return (
			<div className="flex flex-wrap gap-2">
				{card.sources.map((s) => {
					let host = "";
					try {
						host = new URL(s.url).hostname.replace(/^www\./, "");
					} catch {
						/* not a URL we can name */
					}
					return (
						<a
							key={s.url}
							href={s.url}
							target="_blank"
							rel="noopener noreferrer"
							className="flex max-w-[280px] items-center gap-2 rounded-pill bg-primary/5 py-1.5 pr-3 pl-1.5 font-sans text-[calc(12.5px*var(--ws-fs))] text-muted transition-colors hover:bg-primary/10 hover:text-primary"
						>
							<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-[10px] text-primary uppercase">
								{host.charAt(0) || "·"}
							</span>
							<span className="truncate">{s.title || host}</span>
							<I.IconArrowOut size={13} className="shrink-0" />
						</a>
					);
				})}
			</div>
		);
	if (card.kind === "confirm") return <DraftCard card={card} past={past} />;
	if (card.kind === "open") return <OpenCard card={card} streaming={!!streaming} />;
	return null;
}

/** A draft Vivid prepared: what will happen, then Confirm or Cancel. */
function DraftCard({ card, past }: { card: Extract<VividCard, { kind: "confirm" }>; past?: boolean }) {
	const [state, setState] = useState<"pending" | "busy" | "done" | "cancelled" | "error">(
		card.status !== "pending" ? "done" : "pending",
	);
	const [msg, setMsg] = useState("");
	const [result, setResult] = useState<Record<string, unknown> | null>(null);
	const Ico = toolIcon(card.tool);
	const pv = card.preview ?? {};

	const settle = async (verb: "confirm" | "cancel") => {
		setState("busy");
		const r = await settleVividAction(card.actionId, verb);
		if (!r.ok) {
			setMsg(r.message);
			setState("error");
			return;
		}
		setResult((r.body?.result as Record<string, unknown>) ?? null);
		setState(verb === "confirm" ? "done" : "cancelled");
	};

	const when = pv.startsAt
		? new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(
				new Date(pv.startsAt),
			)
		: null;
	const resultHref =
		typeof result?.postId === "string"
			? `/post/${result.postId}`
			: typeof result?.spaceId === "string" && result.spaceId
				? `/voice?space=${result.spaceId}`
				: null;

	return (
		<div className={cardBox}>
			<div className="flex items-center gap-2 px-4 pt-3.5 font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold text-muted">
				<Ico size={15} strokeWidth={2} />
				{DRAFT_LABEL[card.tool] ?? "Draft"}
				<span className="font-normal text-subtle">
					·{" "}
					{state === "done"
						? "done"
						: state === "cancelled"
							? "cancelled"
							: past
								? "drafted earlier"
								: "waiting for you"}
				</span>
			</div>
			<div className="flex flex-col gap-3 px-4 pt-2.5 pb-3.5">
				{pv.person && <Person p={pv.person} />}
				{pv.text && (
					<p className="whitespace-pre-wrap break-words font-sans text-[calc(15px*var(--ws-fs))] leading-relaxed text-primary">{pv.text}</p>
				)}
				{pv.poll?.options && pv.poll.options.length > 0 && (
					<div className="flex flex-col gap-1.5">
						{pv.poll.options.map((o) => (
							<span key={o} className="rounded-[10px] px-3 py-2 font-sans text-[calc(14px*var(--ws-fs))] text-primary ring-1 ring-primary/[0.12]">
								{o}
							</span>
						))}
					</div>
				)}
				{pv.post && (
					<div className="rounded-[12px] px-3.5 py-2.5 ring-1 ring-primary/[0.1]">
						{pv.post.author && <p className="font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">@{pv.post.author}</p>}
						<p className="line-clamp-3 font-sans text-[calc(13.5px*var(--ws-fs))] text-muted">{pv.post.text}</p>
					</div>
				)}
				{pv.title && card.tool === "schedule_space" && (
					<div className="flex items-center gap-3">
						<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/[0.07] text-primary">
							<I.IconSpace size={19} />
						</span>
						<span className="flex min-w-0 flex-col">
							<span className="truncate font-sans text-[calc(15px*var(--ws-fs))] font-semibold text-primary">{pv.title}</span>
							<span className="font-sans text-[calc(13px*var(--ws-fs))] text-muted">{when ?? "Starts now"}</span>
						</span>
					</div>
				)}
				{!pv.person && !pv.text && !pv.post && !pv.title && (
					<p className="font-sans text-[calc(14.5px*var(--ws-fs))] text-primary">{card.summary}</p>
				)}
			</div>
			<div className="flex min-h-[56px] items-center gap-2 border-hairline border-t px-3 py-2.5">
				{state === "done" ? (
					<span className="flex items-center gap-1.5 px-1 font-sans text-[calc(13.5px*var(--ws-fs))] font-semibold text-success">
						<I.IconCheck size={16} strokeWidth={2.2} /> Done
						{resultHref && (
							<Link href={resultHref} className="ml-2 font-medium text-primary underline decoration-primary/30 underline-offset-[3px]">
								View
							</Link>
						)}
					</span>
				) : state === "cancelled" ? (
					<span className="px-1 font-sans text-[calc(13.5px*var(--ws-fs))] text-muted">Cancelled</span>
				) : past ? (
					<span className="px-1 font-sans text-[calc(13px*var(--ws-fs))] text-subtle">Ask again to make a new draft.</span>
				) : (
					<>
						<motion.button
							type="button"
							{...press}
							disabled={state === "busy"}
							onClick={() => void settle("confirm")}
							className="flex h-10 cursor-pointer items-center gap-2 rounded-pill bg-primary px-5 font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-page disabled:opacity-60"
						>
							{state === "busy" && <Spinner />}
							{card.verb || "Confirm"}
						</motion.button>
						<button
							type="button"
							disabled={state === "busy"}
							onClick={() => void settle("cancel")}
							className="h-10 cursor-pointer rounded-pill px-4 font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-muted transition-colors hover:bg-primary/5 hover:text-primary disabled:opacity-60"
						>
							Cancel
						</button>
						{msg && <span className="min-w-0 truncate font-sans text-[calc(12.5px*var(--ws-fs))] text-danger">{msg}</span>}
					</>
				)}
			</div>
		</div>
	);
}

/**
 * A screen Vivid opened for you. It runs once on its own: a sheet as soon as
 * it arrives (the answer keeps streaming under it), a page once the answer
 * has finished (leaving mid-sentence would cut it off). Then it waits here
 * to be opened again; an appearance change offers Undo instead.
 */
function OpenCard({ card, streaming }: { card: LiveCard & { kind: "open" }; streaming: boolean }) {
	const run = useVividIntent();
	const ran = useRef(false);
	const [undo, setUndo] = useState<(() => void) | null>(null);
	const [undone, setUndone] = useState(false);
	const Ico = toolIcon(card.tool);
	const kind = intentKind(card.intent);

	const go = useCallback(async () => {
		const back = await run(card.intent);
		if (back) {
			setUndo(() => back);
			setUndone(false);
		}
	}, [run, card.intent]);

	useEffect(() => {
		if (!card.live || ran.current) return;
		if (kind === "route" && streaming) return;
		ran.current = true;
		void go();
	}, [card.live, kind, streaming, go]);

	return (
		<div className={clsx(cardBox, "flex items-center gap-3 px-3.5 py-3")}>
			<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/[0.07] text-primary">
				<Ico size={19} />
			</span>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="truncate font-sans text-[calc(14.5px*var(--ws-fs))] font-semibold text-primary">{card.summary}</span>
				<span className="truncate font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">
					{kind === "instant"
						? !card.live && !undo
							? "Changed earlier."
							: undone
								? "Put back."
								: "Changed. You can undo it."
						: "Filled in for you. Nothing happens until you press go."}
				</span>
			</span>
			{kind === "instant" ? (
				!undo ? (
					!card.live && (
						<motion.button
							type="button"
							{...press}
							onClick={() => void go()}
							className="h-10 shrink-0 cursor-pointer rounded-pill bg-primary/[0.08] px-4 font-sans text-[calc(13.5px*var(--ws-fs))] font-semibold text-primary hover:bg-primary/[0.12]"
						>
							Apply
						</motion.button>
					)
				) : (
					<motion.button
						type="button"
						{...press}
						onClick={() => {
							if (undone) {
								void go();
								return;
							}
							undo();
							setUndone(true);
						}}
						className="h-10 shrink-0 cursor-pointer rounded-pill bg-primary/[0.08] px-4 font-sans text-[calc(13.5px*var(--ws-fs))] font-semibold text-primary hover:bg-primary/[0.12]"
					>
						{undone ? "Redo" : "Undo"}
					</motion.button>
				)
			) : (
				<motion.button
					type="button"
					{...press}
					onClick={() => void go()}
					className="h-10 shrink-0 cursor-pointer rounded-pill bg-primary/[0.08] px-4 font-sans text-[calc(13.5px*var(--ws-fs))] font-semibold text-primary hover:bg-primary/[0.12]"
				>
					Open
				</motion.button>
			)}
		</div>
	);
}

/* ── history ────────────────────────────────────────────────────────────── */

function HistorySheet({
	open,
	current,
	onClose,
	onOpen,
}: {
	open: boolean;
	current: string | null;
	onClose: () => void;
	onOpen: (row: VividThreadRow) => void;
}) {
	useOverlayDismiss(open, onClose);
	const [rows, setRows] = useState<VividThreadRow[] | null>(null);
	const [failed, setFailed] = useState(false);

	const load = useCallback(async () => {
		setFailed(false);
		const r = await vividApi.threads();
		if (r.ok) setRows(Array.isArray(r.data) ? r.data : []);
		else setFailed(true);
	}, []);

	useEffect(() => {
		if (open) void load();
	}, [open, load]);

	const remove = async (id: string) => {
		setRows((all) => all?.filter((r) => r._id !== id) ?? null);
		const r = await vividApi.deleteThread(id);
		if (!r.ok) void load();
	};

	return (
		<AnimatePresence>
			{open && (
				<>
					<OverlayScrim key="scrim" onClose={onClose} />
					<OverlayPanel key="panel" variant="sheet" ground="solid" label="Your chats with Vivid" dragClose={onClose}>
						<OverlayHeader title="Your chats" onClose={onClose} />
						<div className="min-h-[200px] overflow-y-auto px-2 pb-3">
							{failed ? (
								<div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
									<p className="font-sans text-[calc(14px*var(--ws-fs))] text-muted">Your chats didn't load.</p>
									<button
										type="button"
										onClick={() => void load()}
										className="h-9 cursor-pointer rounded-pill bg-primary/[0.08] px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary"
									>
										Try again
									</button>
								</div>
							) : rows === null ? (
								<div className="flex flex-col gap-1 px-2 py-1">
									{[0, 1, 2, 3, 4].map((i) => (
										<div key={i} className="flex h-14 flex-col justify-center gap-2 px-2">
											<span className="skeleton h-3.5 rounded-[4px]" style={{ width: `${62 - i * 7}%` }} />
											<span className="skeleton h-2.5 w-16 rounded-[4px]" />
										</div>
									))}
								</div>
							) : rows.length === 0 ? (
								<p className="px-4 py-10 text-center font-sans text-[calc(14px*var(--ws-fs))] text-muted">No chats yet.</p>
							) : (
								<motion.ul variants={staggerParent} initial="hidden" animate="show" className="flex flex-col">
									{rows.map((r) => (
										<motion.li key={r._id} variants={staggerItem} className="group flex items-center">
											<button
												type="button"
												onClick={() => onOpen(r)}
												className={clsx(
													"flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5 rounded-[12px] px-3 py-2.5 text-left transition-colors hover:bg-primary/5",
													r._id === current && "bg-primary/[0.07]",
												)}
											>
												<span className="w-full truncate font-sans text-[calc(14.5px*var(--ws-fs))] font-medium text-primary">
													{r.title || "Untitled chat"}
												</span>
												{(r.lastMessageAt || r.createdAt) && (
													<span className="font-sans text-[calc(12.5px*var(--ws-fs))] text-subtle">
														{formatTimeAgo((r.lastMessageAt || r.createdAt) as string)}
													</span>
												)}
											</button>
											<IconButton label="Delete chat" onClick={() => void remove(r._id)} className="opacity-60 group-hover:opacity-100">
												<I.IconTrash size={17} />
											</IconButton>
										</motion.li>
									))}
								</motion.ul>
							)}
						</div>
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}

/* ── Talk mode ─────────────────────────────────────────────────────────── */

type VoiceState = "listening" | "thinking" | "speaking" | "idle" | "unsupported";

/**
 * Talk to Vivid. The browser's own speech recognition hears you, the turn
 * goes through the same harness, and the answer is spoken back with speech
 * synthesis, then it listens again. Captions show what's being said.
 */
function VoiceMode({ onClose, send }: { onClose: () => void; send: (t: string) => Promise<string> }) {
	const [state, setState] = useState<VoiceState>("idle");
	const [caption, setCaption] = useState("");
	const [muted, setMuted] = useState(false);
	const recRef = useRef<any>(null);
	const aliveRef = useRef(true);
	const mutedRef = useRef(false);
	mutedRef.current = muted;

	const listen = useCallback(() => {
		if (!aliveRef.current || mutedRef.current) return;
		const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
		if (!SR) {
			setState("unsupported");
			return;
		}
		const rec = new SR();
		recRef.current = rec;
		rec.lang = navigator.language || "en-US";
		rec.interimResults = true;
		rec.continuous = false;
		let finalText = "";
		rec.onresult = (e: any) => {
			let interim = "";
			for (let i = e.resultIndex; i < e.results.length; i++) {
				const r = e.results[i];
				if (r.isFinal) finalText += r[0].transcript;
				else interim += r[0].transcript;
			}
			setCaption(finalText || interim);
		};
		rec.onend = async () => {
			if (!aliveRef.current) return;
			const said = finalText.trim();
			if (!said) {
				setTimeout(listen, 300);
				return;
			}
			setState("thinking");
			const answer = await send(said);
			if (!aliveRef.current) return;
			const words = speakable(answer);
			if (!words || !("speechSynthesis" in window)) {
				listen();
				return;
			}
			setState("speaking");
			setCaption(words);
			const u = new SpeechSynthesisUtterance(words);
			u.onend = () => listen();
			window.speechSynthesis.speak(u);
		};
		setCaption("");
		setState("listening");
		try {
			rec.start();
		} catch {
			/* already started */
		}
	}, [send]);

	useEffect(() => {
		aliveRef.current = true;
		listen();
		return () => {
			aliveRef.current = false;
			recRef.current?.abort?.();
			if ("speechSynthesis" in window) window.speechSynthesis.cancel();
		};
	}, [listen]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: only a mute toggle restarts listening
	useEffect(() => {
		if (muted) recRef.current?.abort?.();
		else if (state === "listening" || state === "idle") listen();
	}, [muted]);

	const label =
		state === "unsupported"
			? "Voice isn't supported in this browser yet. Try Chrome or Safari."
			: muted
				? "Muted"
				: state === "listening"
					? "Listening"
					: state === "thinking"
						? "Thinking"
						: state === "speaking"
							? "Vivid is speaking"
							: "";

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			role="dialog"
			aria-label="Talk to Vivid"
			className="fixed inset-0 z-modal flex flex-col bg-page"
		>
			<div className="flex h-16 shrink-0 items-center justify-between px-4 pt-safe">
				<span className="font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-muted">Talk to Vivid</span>
				<IconButton label="Close" onClick={onClose} className="bg-primary/[0.07] text-primary">
					<I.IconClose size={18} />
				</IconButton>
			</div>
			<div className="flex flex-1 flex-col items-center justify-center gap-8 px-8 text-center">
				<VividOrb
					size={240}
					speed={state === "speaking" ? 1.8 : state === "thinking" ? 1.2 : 0.6}
					level={state === "speaking" ? 0.6 : state === "listening" && !muted ? 0.25 : 0}
				/>
				<span className="flex items-center gap-2 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-muted">
					{state === "listening" && !muted && <span className="h-2 w-2 animate-pulse rounded-pill bg-success" />}
					{label}
				</span>
				<p className="max-w-xl font-display text-[calc(20px*var(--ws-fs))] font-medium leading-snug text-primary">{caption}</p>
			</div>
			<div className="flex shrink-0 items-start justify-center gap-10 px-8 pb-[calc(40px+var(--ws-safe-bottom))]">
				<button type="button" onClick={() => setMuted((m) => !m)} className="flex cursor-pointer flex-col items-center gap-2">
					<span className="flex h-16 w-16 items-center justify-center rounded-pill bg-primary/[0.08] text-primary">
						{muted ? <I.IconMicOff size={24} /> : <I.IconMic size={24} />}
					</span>
					<span className="font-sans text-[calc(12px*var(--ws-fs))] text-muted">{muted ? "Unmute" : "Mute"}</span>
				</button>
				<button type="button" onClick={onClose} className="flex cursor-pointer flex-col items-center gap-2">
					<span className="flex h-16 w-16 items-center justify-center rounded-pill bg-danger text-white">
						<I.IconClose size={24} strokeWidth={2.2} />
					</span>
					<span className="font-sans text-[calc(12px*var(--ws-fs))] text-muted">End</span>
				</button>
			</div>
		</motion.div>
	);
}
