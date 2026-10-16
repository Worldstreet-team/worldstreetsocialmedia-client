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
import { PostScanCard, ScanOverlay } from "@/components/vivid/PostScanCard";
import {
	MAX_FILES,
	VIVID_FILE_ACCEPT,
	audioDuration,
	clock,
	type FileFamily,
	familyOf,
	shrinkImage,
} from "@/components/vivid/vivid-files";
import { VividOrb } from "@/components/vivid/VividOrb";
import { intentKind, useVividIntent } from "@/components/vivid/vivid-actions";
import * as I from "@/components/vivid/vivid-icons";
import { DUR, EASE, EASE_OUT_EXPO, press, staggerItem, staggerParent, swap } from "@/lib/motion-presets";
import { formatTimeAgo } from "@/lib/utils";
import {
	deleteVividFile,
	settleVividAction,
	streamVividTurn,
	uploadVividFile,
	vividApi,
	type VividCard,
	type VividEvent,
	type VividStoredMessage,
	type VividFile,
	type VividPostRef,
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
	/** A post the person sent with this message ("Ask Vivid" on a post). */
	post?: VividPostRef;
	/** On an answer: the post its question carried, so Ask again resends it. */
	askPost?: VividPostRef;
	/** Files sent with this message; pictures keep a local preview while the page is open. */
	files?: (VividFile & { preview?: string })[];
}

/** What Vivid is asked when files arrive with nothing typed. */
const FILE_ASK = "Read what I attached and give me the key points.";

/** A file on its way into the composer (owner 2026-10-16: "uploading of files, latex files, audio"). */
export interface PendingFile {
	key: string;
	name: string;
	family: FileFamily;
	status: "uploading" | "reading" | "ready" | "failed";
	progress: number;
	preview?: string;
	file?: VividFile;
	error?: string;
	abort?: AbortController;
}

/** What Vivid is asked when a post arrives with nothing typed. */
const POST_ASK = "What's this post about? Give me the key points and anything worth knowing.";

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
	my_meetings: I.IconVideo,
	meeting_details: I.IconVideo,
	start_meeting: I.IconVideo,
	my_deals: I.IconBriefcase,
	deal_details: I.IconBriefcase,
	rate_card: I.IconBriefcase,
	counter_offer: I.IconBriefcase,
	decline_deal: I.IconBriefcase,
	deal_message: I.IconMessage,
	open_deal: I.IconBriefcase,
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
	start_meeting: "WorldMeet",
	counter_offer: "Counter-offer",
	decline_deal: "Decline",
	deal_message: "Deal message",
};

export type QuickStart = { icon: Icon; label: string; fill?: string; ask?: string };

/** Quick starts under the empty composer: some fill it in, one just asks. Five, so they sit on one row. */
const STARTS: QuickStart[] = [
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
	if (m.role === "user") {
		const post = m.blocks?.find((b) => b.kind === "post")?.data as VividPostRef | undefined;
		const files = (m.blocks ?? []).filter((b) => b.kind === "file").map((b) => b.data as unknown as VividFile);
		const stock = (post && m.content === POST_ASK) || (files.length > 0 && m.content === FILE_ASK);
		return { id: m._id, role: "user", text: stock ? "" : m.content, post, files: files.length ? files : undefined };
	}
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

/** "Good afternoon, Ada", by the clock on this device. */
export function useGreeting() {
	const user = useAtomValue(userAtom);
	const h = new Date().getHours();
	const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
	return user?.firstName ? `${part}, ${user.firstName}` : part;
}

/**
 * One Vivid conversation: the turns, the composer's text, streaming, history
 * and the plan. The window (/vivid) and the Vivid chat in Messages both run
 * on it, so a thread started in one carries on in the other.
 * `scroller` is the element the conversation scrolls in.
 */
export function useVividChat(opts: {
	surface: "window" | "messages" | "business";
	scroller: () => HTMLElement | null;
	/** Sent with every turn: the Business deal the chat is about. */
	context?: { dealId?: string } | null;
}) {
	const [turns, setTurns] = useState<Turn[]>([]);
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);
	const [threadId, setThreadId] = useState<string | null>(null);
	const [web, setWeb] = useState(false);
	/** The WorldStreet Vivid plan: false shows Subscribe; null is unknown. */
	const [plan, setPlan] = useState<{ entitled: boolean | null; url: string }>({
		entitled: null,
		url: "https://worldstreetgold.com/vivid",
	});
	const abortRef = useRef<AbortController | null>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	/** Follow the answer down only while the reader is at the bottom. */
	const stickRef = useRef(true);
	const [files, setFiles] = useState<PendingFile[]>([]);
	const filesRef = useRef(files);
	filesRef.current = files;
	const scrollerRef = useRef(opts.scroller);
	scrollerRef.current = opts.scroller;

	useEffect(() => {
		void vividApi.usage().then((r) => {
			if (r.ok) setPlan({ entitled: r.data.entitled, url: r.data.subscribeUrl });
		});
	}, []);

	useEffect(() => {
		const el = scrollerRef.current();
		if (!el) return;
		const onScroll = () => {
			stickRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 96;
		};
		el.addEventListener("scroll", onScroll, { passive: true });
		return () => el.removeEventListener("scroll", onScroll);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: follow the thread as it grows
	useLayoutEffect(() => {
		const el = scrollerRef.current();
		if (el && stickRef.current) el.scrollTop = el.scrollHeight;
	}, [turns]);

	/** Send one turn; resolves with Vivid's final text (Talk mode speaks it). */
	const send = useCallback(
		async (text: string, extra: { post?: VividPostRef } = {}): Promise<string> => {
			const typed = text.trim();
			// Files still on their way hold the send; failed ones are left behind.
			if (filesRef.current.some((f) => f.status === "uploading" || f.status === "reading")) return "";
			const ready = filesRef.current.filter((f) => f.status === "ready" && f.file);
			const q = typed || (extra.post ? POST_ASK : ready.length ? FILE_ASK : "");
			if (!q || busy) return "";
			const sent = ready.map((f) => ({ ...(f.file as VividFile), preview: f.preview }));
			if (filesRef.current.length) setFiles([]);
			setInput("");
			setBusy(true);
			stickRef.current = true;
			const vid = uid();
			setTurns((t) => [
				...t,
				{ id: uid(), role: "user", text: typed, post: extra.post, files: sent.length ? sent : undefined },
				{ id: vid, role: "vivid", text: "", steps: [], cards: [], streaming: true, ask: q, askPost: extra.post },
			]);
			const patch = (fn: (t: Turn) => Turn) => setTurns((all) => all.map((x) => (x.id === vid ? fn(x) : x)));
			let answer = "";
			const ac = new AbortController();
			abortRef.current = ac;
			await streamVividTurn({
				text: q,
				threadId,
				surface: opts.surface,
				attachments: sent.map((f) => f.id),
				context:
					web || extra.post || opts.context?.dealId
						? {
								...(web ? { web: true } : {}),
								...(extra.post ? { postId: extra.post.id } : {}),
								...(opts.context?.dealId ? { dealId: opts.context.dealId } : {}),
							}
						: null,
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
		[busy, threadId, web, opts.surface, opts.context?.dealId],
	);

	const stop = useCallback(() => abortRef.current?.abort(), []);
	const newChat = useCallback(() => {
		abortRef.current?.abort();
		for (const f of filesRef.current) {
			f.abort?.abort();
			if (f.file?.id) void deleteVividFile(f.file.id);
		}
		setFiles([]);
		setTurns([]);
		setThreadId(null);
		setInput("");
		inputRef.current?.focus();
	}, []);

	/** Load a past conversation; false when it couldn't be read. */
	const openThread = useCallback(
		async (id: string): Promise<boolean> => {
			if (id === threadId) return true;
			abortRef.current?.abort();
			const r = await vividApi.thread(id);
			if (!r.ok) return false;
			let ask: string | undefined;
			const mapped: Turn[] = [];
			for (const m of r.data.messages) {
				if (m.role === "user") ask = m.content;
				mapped.push(fromStored(m, ask));
			}
			stickRef.current = true;
			setThreadId(id);
			setTurns(mapped);
			return true;
		},
		[threadId],
	);

	/** Upload files for the next message: pictures shrunk first, audio measured. */
	const addFiles = useCallback((list: File[]) => {
		const room = Math.max(0, MAX_FILES - filesRef.current.length);
		for (const raw of list.slice(0, room)) {
			const key = uid();
			const family = familyOf(raw);
			const abort = new AbortController();
			const preview = family === "image" ? URL.createObjectURL(raw) : undefined;
			setFiles((all) => [...all, { key, name: raw.name, family, status: "uploading", progress: 0, preview, abort }]);
			const update = (fn: (f: PendingFile) => PendingFile) =>
				setFiles((all) => all.map((f) => (f.key === key ? fn(f) : f)));
			void (async () => {
				const file = family === "image" ? await shrinkImage(raw) : raw;
				const durationSec = family === "audio" ? await audioDuration(raw) : null;
				const r = await uploadVividFile(file, {
					durationSec,
					signal: abort.signal,
					onProgress: (frac) => update((f) => ({ ...f, progress: frac, status: frac >= 1 ? "reading" : "uploading" })),
				});
				if (!r.ok) {
					if (!r.aborted) update((f) => ({ ...f, status: "failed", error: r.message }));
					return;
				}
				update((f) => ({ ...f, status: "ready", file: r.file, progress: 1 }));
			})();
		}
	}, []);

	const removeFile = useCallback((key: string) => {
		const f = filesRef.current.find((x) => x.key === key);
		f?.abort?.abort();
		if (f?.file?.id) void deleteVividFile(f.file.id);
		if (f?.preview) URL.revokeObjectURL(f.preview);
		setFiles((all) => all.filter((x) => x.key !== key));
	}, []);

	const fillComposer = useCallback((text: string) => {
		setInput(text);
		requestAnimationFrame(() => {
			const el = inputRef.current;
			if (!el) return;
			el.focus();
			el.setSelectionRange(text.length, text.length);
		});
	}, []);

	const rate = useCallback((t: Turn, v: "up" | "down" | null) => {
		setTurns((all) => all.map((x) => (x.id === t.id ? { ...x, feedback: v } : x)));
		if (t.messageId) void vividApi.feedback(t.messageId, v);
	}, []);

	return {
		turns,
		input,
		setInput,
		busy,
		threadId,
		web,
		setWeb,
		plan,
		inputRef,
		send,
		stop,
		newChat,
		openThread,
		fillComposer,
		rate,
		files,
		addFiles,
		removeFile,
	};
}

export type VividChatState = ReturnType<typeof useVividChat>;

/** Vivid is still reading what it was sent: no words or cards yet. */
const isReading = (next?: Turn) => !!next && next.role === "vivid" && !!next.streaming && !next.text && !next.cards?.length;

/** The conversation itself: questions and Vivid's answers, as a column. */
export function VividTurns({ chat, className }: { chat: VividChatState; className?: string }) {
	return (
		<div className={className}>
			{chat.turns.map((t, i) =>
				t.role === "user" ? (
					<UserTurn key={t.id} turn={t} scanning={isReading(chat.turns[i + 1])} />
				) : (
					<VividAnswer
						key={t.id}
						turn={t}
						subscribeUrl={chat.plan.entitled === false ? chat.plan.url : undefined}
						onRetry={t.ask && !chat.busy ? () => void chat.send(t.ask as string, { post: t.askPost }) : undefined}
						onFeedback={(v) => chat.rate(t, v)}
					/>
				),
			)}
		</div>
	);
}

/** The quick starts under an empty composer: some fill it in, one just asks. */
export function QuickStarts({
	chat,
	className,
	starts = STARTS,
}: {
	chat: VividChatState;
	className?: string;
	starts?: QuickStart[];
}) {
	return (
		<motion.div variants={staggerParent} initial="hidden" animate="show" className={className}>
			{starts.map((s) => (
				<motion.button
					key={s.label}
					type="button"
					variants={staggerItem}
					onClick={() => (s.ask ? void chat.send(s.ask) : chat.fillComposer(s.fill ?? ""))}
					className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-pill bg-primary/5 px-4 font-sans text-[calc(13.5px*var(--ws-fs))] font-medium text-primary transition-colors hover:bg-primary/10"
				>
					<s.icon size={17} className="text-muted" />
					{s.label}
				</motion.button>
			))}
		</motion.div>
	);
}

export function VividWindow() {
	const greeting = useGreeting();
	const chat = useVividChat({ surface: "window", scroller });
	const [voiceOpen, setVoiceOpen] = useState(false);
	const [historyOpen, setHistoryOpen] = useState(false);
	const empty = chat.turns.length === 0;

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
					<VividOrb size={22} speed={chat.busy ? 1.6 : 0.6} />
					<h1 className="font-display text-[calc(16px*var(--ws-fs))] font-semibold text-primary">Vivid</h1>
				</div>
				<span className="flex-1" />
				<IconButton label="New chat" onClick={chat.newChat} disabled={empty}>
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
				<VividTurns chat={chat} className="flex flex-1 flex-col gap-9 px-4 pt-3 pb-8 sm:px-6" />
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
					hero={empty}
					files={chat.files}
					onAddFiles={chat.addFiles}
					onRemoveFile={chat.removeFile}
					canAttach={chat.plan.entitled !== false}
				/>
				{empty && (
					<QuickStarts
						chat={chat}
						className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:flex-wrap sm:justify-center sm:overflow-visible [&::-webkit-scrollbar]:hidden"
					/>
				)}
			</motion.div>
			{/* Below the composer, so it sits in the middle while empty. */}
			{empty && <div className="flex-[1.2]" />}

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

/* ── pieces ─────────────────────────────────────────────────────────────── */

/**
 * The preview's one line (owner 2026-10-16: Vivid is the WorldStreet $100
 * plan). Without it Vivid still talks, the way the hub's locked chat does;
 * this says what the plan adds and where to get it, once, above the composer.
 */
export function PlanBar({ url }: { url: string }) {
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

export function IconButton({
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

export function Composer({
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
	files = [],
	onAddFiles,
	onRemoveFile,
	canAttach = true,
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
	files?: PendingFile[];
	onAddFiles?: (files: File[]) => void;
	onRemoveFile?: (key: string) => void;
	/** False on the preview: files come with the plan. */
	canAttach?: boolean;
}) {
	const pickRef = useRef<HTMLInputElement>(null);
	const [dragging, setDragging] = useState(false);
	const attach = canAttach && !!onAddFiles;
	const waiting = files.some((f) => f.status === "uploading" || f.status === "reading");
	const hasReady = files.some((f) => f.status === "ready");
	// Grows with the text, up to about eight lines.
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the text or the size changes
	useLayoutEffect(() => {
		const el = inputRef.current;
		if (!el) return;
		el.style.height = "0px";
		el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
	}, [value, hero]);

	const action = busy ? "stop" : value.trim() || hasReady ? "send" : "talk";
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				if (!busy && !waiting) onSend();
			}}
			onDragOver={(e) => {
				if (!attach || !e.dataTransfer.types.includes("Files")) return;
				e.preventDefault();
				setDragging(true);
			}}
			onDragLeave={() => setDragging(false)}
			onDrop={(e) => {
				if (!attach) return;
				e.preventDefault();
				setDragging(false);
				const dropped = Array.from(e.dataTransfer.files ?? []);
				if (dropped.length) onAddFiles?.(dropped);
			}}
			className={clsx(
				"flex flex-col rounded-[26px] bg-surface ring-1 transition-shadow focus-within:ring-primary/[0.16]",
				dragging ? "ring-2 ring-[color:var(--ws-brand-primary)]" : "ring-primary/[0.08]",
				hero ? "px-5 pt-4 pb-3" : "px-4 pt-3 pb-2.5",
			)}
		>
			{files.length > 0 && (
				<div className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
					{files.map((f) => (
						<FileChip key={f.key} file={f} onRemove={() => onRemoveFile?.(f.key)} />
					))}
				</div>
			)}
			<textarea
				ref={inputRef}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					// Enter sends on a keyboard; on a phone it is a new line.
					if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !matchMedia("(pointer: coarse)").matches) {
						e.preventDefault();
						if (!busy && !waiting) onSend();
					}
				}}
				onPaste={(e) => {
					if (!attach) return;
					const pasted = Array.from(e.clipboardData?.files ?? []);
					if (!pasted.length) return;
					e.preventDefault();
					onAddFiles?.(pasted);
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
				{attach && (
					<>
						<button
							type="button"
							onClick={() => pickRef.current?.click()}
							aria-label="Attach files"
							title="Attach files: PDF, Word, text, LaTeX, CSV, pictures, audio"
							className="-ml-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-primary/5 hover:text-primary"
						>
							<I.IconPaperclip size={18} />
						</button>
						<input
							ref={pickRef}
							type="file"
							multiple
							accept={VIVID_FILE_ACCEPT}
							className="hidden"
							onChange={(e) => {
								const picked = Array.from(e.target.files ?? []);
								e.target.value = "";
								if (picked.length) onAddFiles?.(picked);
							}}
						/>
					</>
				)}
				<button
					type="button"
					onClick={onWeb}
					aria-pressed={web}
					className={clsx(
						"flex h-9 cursor-pointer items-center gap-1.5 rounded-pill px-3 font-sans text-[calc(13px*var(--ws-fs))] font-medium transition-colors",
						!attach && "-ml-2",
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
							disabled={action === "send" && waiting}
							aria-label={action === "stop" ? "Stop" : waiting ? "Waiting for files" : "Send"}
							className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill bg-primary text-page disabled:cursor-default disabled:opacity-40"
						>
							{action === "stop" ? <I.IconStop size={20} /> : <I.IconSend size={19} strokeWidth={2.2} />}
						</motion.button>
					)}
				</AnimatePresence>
			</div>
		</form>
	);
}

const fileLabel = (f: { kind: string; name: string; pages: number | null; durationSec: number | null }) => {
	if (f.kind === "audio") return f.durationSec ? `Voice note · ${clock(f.durationSec)}` : "Voice note";
	if (f.kind === "pdf") return f.pages ? `PDF · ${f.pages} page${f.pages === 1 ? "" : "s"}` : "PDF";
	if (f.kind === "docx") return "Word document";
	if (f.kind === "image") return "Picture";
	const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
	return ext === "tex" ? "LaTeX" : ext === "csv" || ext === "tsv" ? "Spreadsheet data" : ext === "md" || ext === "markdown" ? "Markdown" : "Text";
};

/** A file in the composer: what it is and how far along, with a way out. */
function FileChip({ file: f, onRemove }: { file: PendingFile; onRemove: () => void }) {
	const working = f.status === "uploading" || f.status === "reading";
	const line =
		f.status === "uploading"
			? `Uploading ${Math.round(f.progress * 100)}%`
			: f.status === "reading"
				? f.family === "audio"
					? "Transcribing"
					: f.family === "image"
						? "Preparing"
						: "Reading"
				: f.status === "failed"
					? f.error || "Couldn't read it"
					: f.file
						? fileLabel(f.file)
						: "Ready";
	return (
		<div className="relative flex h-14 w-[220px] shrink-0 items-center gap-2.5 rounded-[14px] bg-primary/5 pr-10 pl-1.5">
			<span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-raised text-muted">
				{f.preview ? (
					// biome-ignore lint/performance/noImgElement: a local object URL
					<img src={f.preview} alt="" className="h-full w-full object-cover" />
				) : f.family === "audio" ? (
					<I.IconWave size={18} />
				) : (
					<I.IconFile size={18} />
				)}
				{working && (
					<span className="absolute inset-0 flex items-center justify-center bg-page/55 text-primary">
						<Spinner />
					</span>
				)}
			</span>
			<span className="flex min-w-0 flex-col">
				<span className="truncate font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">{f.name}</span>
				<span
					className={clsx(
						"truncate font-sans text-[calc(12px*var(--ws-fs))] tabular-nums",
						f.status === "failed" ? "text-danger" : "text-muted",
					)}
				>
					{line}
				</span>
			</span>
			<button
				type="button"
				onClick={onRemove}
				aria-label={`Remove ${f.name}`}
				className="absolute top-1/2 right-0.5 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-pill text-muted hover:bg-primary/10 hover:text-primary"
			>
				<I.IconClose size={14} />
			</button>
		</div>
	);
}

/** Files sent to Vivid, as the person's message, scanned while Vivid reads them. */
function FileScanCard({ files, scanning }: { files: (VividFile & { preview?: string })[]; scanning: boolean }) {
	const pics = files.filter((f) => f.kind === "image");
	const docs = files.filter((f) => f.kind !== "image");
	return (
		<div className="relative w-[min(320px,84%)] overflow-hidden rounded-[20px] bg-surface ring-1 ring-primary/[0.08]">
			{pics.length > 0 && (
				<div className={clsx("grid gap-0.5", pics.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
					{pics.slice(0, 4).map((p) =>
						p.preview ? (
							// biome-ignore lint/performance/noImgElement: a local object URL
							<img key={p.id} src={p.preview} alt="" className={clsx("w-full object-cover", pics.length > 1 ? "aspect-square" : "aspect-[4/3]")} />
						) : (
							<span key={p.id} className="flex aspect-[4/3] items-center justify-center bg-raised text-muted">
								<I.IconImage size={22} />
							</span>
						),
					)}
				</div>
			)}
			{docs.length > 0 && (
				<div className="flex flex-col divide-y divide-hairline">
					{docs.map((d) => (
						<div key={d.id} className="flex items-center gap-3 px-3.5 py-3">
							<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-primary/[0.07] text-primary">
								{d.kind === "audio" ? <I.IconWave size={19} /> : <I.IconFile size={19} />}
							</span>
							<span className="flex min-w-0 flex-col">
								<span className="truncate font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary">{d.name}</span>
								<span className="font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">{fileLabel(d)}</span>
							</span>
						</div>
					))}
				</div>
			)}
			<ScanOverlay scanning={scanning} label="Vivid is reading your files" />
		</div>
	);
}

export function UserTurn({ turn, scanning = false }: { turn: Turn; scanning?: boolean }) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0, transition: { duration: 0.26, ease: EASE_OUT_EXPO } }}
			className="flex flex-col items-end gap-2"
		>
			{turn.post && <PostScanCard post={turn.post} scanning={scanning} />}
			{turn.files && turn.files.length > 0 && <FileScanCard files={turn.files} scanning={scanning && !turn.post} />}
			{turn.text && (
				<p className="max-w-[82%] whitespace-pre-wrap break-words rounded-[22px] bg-raised px-4 py-2.5 font-sans text-[calc(15.5px*var(--ws-fs))] leading-relaxed text-primary">
					{turn.text}
				</p>
			)}
		</motion.div>
	);
}

export function VividAnswer({
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
	if (card.kind === "meeting") return <MeetingCard meeting={card.meeting} />;
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
		typeof result?.link === "string"
			? (result.link as string)
			: typeof result?.postId === "string"
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
				{card.tool === "start_meeting" && pv.group && (
					<div className="flex items-center gap-3">
						<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/[0.07] text-primary">
							<I.IconVideo size={19} />
						</span>
						<span className="flex min-w-0 flex-col">
							<span className="truncate font-sans text-[calc(15px*var(--ws-fs))] font-semibold text-primary">{pv.title || pv.group}</span>
							<span className="font-sans text-[calc(13px*var(--ws-fs))] text-muted">
								Starts now · the link goes to {pv.group}
								{pv.members ? ` (${pv.members} people)` : ""}
							</span>
						</span>
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
				{!pv.person && !pv.text && !pv.post && !pv.title && !pv.group && (
					<p className="font-sans text-[calc(14.5px*var(--ws-fs))] text-primary">{card.summary}</p>
				)}
			</div>
			<div className="flex min-h-[56px] items-center gap-2 border-hairline border-t px-3 py-2.5">
				{state === "done" ? (
					<span className="flex items-center gap-1.5 px-1 font-sans text-[calc(13.5px*var(--ws-fs))] font-semibold text-success">
						<I.IconCheck size={16} strokeWidth={2.2} /> Done
						{resultHref &&
							(resultHref.startsWith("http") ? (
								<a
									href={resultHref}
									target="_blank"
									rel="noopener noreferrer"
									className="ml-2 font-medium text-primary underline decoration-primary/30 underline-offset-[3px]"
								>
									Join
								</a>
							) : (
								<Link href={resultHref} className="ml-2 font-medium text-primary underline decoration-primary/30 underline-offset-[3px]">
									View
								</Link>
							))}
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

/** A WorldMeet recap: what was said, what was agreed, who is doing what. */
function MeetingCard({ meeting: m }: { meeting: import("@/lib/vivid.client").VividMeeting }) {
	const when = m.recordedAt
		? new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(new Date(m.recordedAt))
		: null;
	const meta = [when, m.durationMin ? `${m.durationMin} min` : null, m.people.length ? `${m.people.length} people` : null]
		.filter(Boolean)
		.join(" · ");
	return (
		<div className={clsx(cardBox, "flex flex-col gap-3 px-4 py-3.5")}>
			<div className="flex items-center gap-2 font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold text-muted">
				<I.IconVideo size={15} strokeWidth={2} />
				WorldMeet
				{meta && <span className="font-normal text-subtle">· {meta}</span>}
			</div>
			<p className="font-sans text-[calc(15.5px*var(--ws-fs))] font-semibold text-primary">{m.title}</p>
			{m.status !== "ready" && !m.summary ? (
				<p className="font-sans text-[calc(14px*var(--ws-fs))] text-muted">The notes are still being written. They usually land a minute after the call ends.</p>
			) : (
				m.summary && <p className="font-sans text-[calc(14px*var(--ws-fs))] leading-relaxed text-muted">{m.summary}</p>
			)}
			{m.actions.length > 0 && (
				<ul className="flex flex-col gap-1.5">
					{m.actions.map((a, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: action items have no identity beyond their place
						<li key={i} className="flex items-start gap-2.5 font-sans text-[calc(14px*var(--ws-fs))] text-primary">
							<span
								className={clsx(
									"mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] ring-1",
									a.done ? "bg-primary text-page ring-primary" : "ring-primary/30",
								)}
							>
								{a.done && <I.IconCheck size={12} strokeWidth={2.6} />}
							</span>
							<span className={clsx("min-w-0", a.done && "text-muted line-through decoration-primary/30")}>
								{a.text}
								{a.owner && <span className="text-subtle"> · {a.owner}</span>}
							</span>
						</li>
					))}
				</ul>
			)}
			<div className="flex items-center gap-3 pt-0.5">
				<span className="flex -space-x-2">
					{m.people.slice(0, 5).map((p) => (
						<span key={p.name} title={p.name} className="relative h-7 w-7 overflow-hidden rounded-full bg-raised ring-2 ring-surface">
							<SafeAvatar src={p.avatar} className="object-cover" eager />
						</span>
					))}
				</span>
				<span className="flex-1" />
				<a
					href={m.url}
					target="_blank"
					rel="noopener noreferrer"
					className="flex h-9 items-center gap-1.5 rounded-pill bg-primary/[0.07] px-3.5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary hover:bg-primary/[0.12]"
				>
					Open notes
					<I.IconArrowOut size={14} strokeWidth={2} />
				</a>
			</div>
		</div>
	);
}

/* ── history ────────────────────────────────────────────────────────────── */

export function HistorySheet({
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
export function VoiceMode({ onClose, send }: { onClose: () => void; send: (t: string) => Promise<string> }) {
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
