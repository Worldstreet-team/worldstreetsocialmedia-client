"use client";

import clsx from "clsx";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
	ArrowUp,
	ArrowUpRight,
	Check,
	CircleNotch,
	Copy,
	Microphone,
	MicrophoneSlash,
	NotePencil,
	SpeakerHigh,
	Stop,
	Waveform,
	X,
} from "@phosphor-icons/react";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { VividOrb } from "@/components/vivid/VividOrb";
import { VividIntro, VividThinking } from "@/components/vivid/VividHello";
import { settleVividAction, streamVividTurn, type VividCard, type VividEvent } from "@/lib/vivid.client";
import { userAtom } from "@/store/user.atom";

/**
 * The Vivid window (owner 2026-10-16, "how Grok is"): the turning orb, one
 * input, answers built from what is actually on WorldSpace, and a Talk mode
 * where Vivid listens and speaks back. Streams turns from the gateway's
 * harness; cards (posts, people, trends, sources) render under the answer,
 * and actions Vivid prepares wait for a Confirm.
 */

interface Step {
	id: string;
	label: string;
	status: "start" | "done" | "error";
}
interface Turn {
	id: string;
	role: "user" | "vivid";
	text: string;
	steps?: Step[];
	cards?: VividCard[];
	error?: string;
	streaming?: boolean;
}

const SUGGESTIONS: [string, string][] = [
	["Catch me up", "on my feed"],
	["What's trending", "on WorldSpace today"],
	["Draft a post", "for me"],
	["The weekly vote", "who's leading?"],
	["Find people", "worth following"],
];

const uid = () => Math.random().toString(36).slice(2, 10);

/** Text for the voice: no markdown marks, no URLs read aloud. */
const speakable = (s: string) =>
	s
		.replace(/https?:\/\/\S+/g, "")
		.replace(/[*_`#>]/g, "")
		.replace(/\s+/g, " ")
		.trim();

export function VividWindow() {
	const user = useAtomValue(userAtom);
	const [turns, setTurns] = useState<Turn[]>([]);
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);
	const [threadId, setThreadId] = useState<string | null>(null);
	const [voiceOpen, setVoiceOpen] = useState(false);
	const abortRef = useRef<AbortController | null>(null);
	const endRef = useRef<HTMLDivElement>(null);

	const greeting = (() => {
		const h = new Date().getHours();
		const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
		return user?.firstName ? `${part}, ${user.firstName}` : part;
	})();

	// biome-ignore lint/correctness/useExhaustiveDependencies: follow the thread as it grows
	useEffect(() => {
		endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
	}, [turns]);

	/** Send one turn; resolves with Vivid's final text (the voice mode speaks it). */
	const send = useCallback(
		async (text: string): Promise<string> => {
			const q = text.trim();
			if (!q || busy) return "";
			setInput("");
			setBusy(true);
			const vid = uid();
			setTurns((t) => [
				...t,
				{ id: uid(), role: "user", text: q },
				{ id: vid, role: "vivid", text: "", steps: [], cards: [], streaming: true },
			]);
			const patch = (fn: (t: Turn) => Turn) =>
				setTurns((all) => all.map((x) => (x.id === vid ? fn(x) : x)));
			let answer = "";
			const ac = new AbortController();
			abortRef.current = ac;
			await streamVividTurn({
				text: q,
				threadId,
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
							const step = { id: e.id, label: e.label || e.name, status: e.status };
							if (i >= 0) steps[i] = step;
							else steps.push(step);
							return { ...x, steps };
						});
					} else if (e.type === "card") patch((x) => ({ ...x, cards: [...(x.cards ?? []), e.card] }));
					else if (e.type === "error") patch((x) => ({ ...x, error: e.message }));
				},
			});
			patch((x) => ({ ...x, streaming: false }));
			abortRef.current = null;
			setBusy(false);
			return answer;
		},
		[busy, threadId],
	);

	const stop = () => abortRef.current?.abort();
	const newChat = () => {
		stop();
		setTurns([]);
		setThreadId(null);
	};

	const empty = turns.length === 0;

	return (
		// The window takes the right rail's space too (MainShell fullCanvas) and
		// sits in the middle of it (owner 2026-10-16: "take over the side rail,
		// just it in the middle").
		<div className="mx-auto flex min-h-dvh w-full max-w-[760px] flex-col pb-nav md:pb-0">
			{/* Header: the mark, the name, a fresh chat. */}
			<header className="sticky top-0 z-sticky flex h-14 shrink-0 items-center justify-between bg-page/90 px-4 backdrop-blur-xl">
				<div className="flex items-center gap-2.5">
					<VividOrb size={26} speed={busy ? 1.6 : 0.6} />
					<h1 className="font-sans text-[calc(16px*var(--ws-fs))] font-semibold text-primary">Vivid</h1>
				</div>
				<button
					type="button"
					onClick={newChat}
					aria-label="New chat"
					className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill text-primary transition-colors hover:bg-primary/[0.06]"
				>
					<NotePencil size={19} />
				</button>
			</header>

			{empty ? (
				<div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-10 text-center">
					{/* Three dots become Vivid's mark, then the ring she thinks
					    with, then a handwritten hello (owner 2026-10-16). */}
					<VividIntro className="h-[140px] w-[210px]" />
					<div>
						<h2 className="font-display text-[calc(26px*var(--ws-fs))] font-medium tracking-[-0.01em] text-primary">
							{greeting}
						</h2>
						<p className="mt-2 font-sans text-[calc(14.5px*var(--ws-fs))] text-muted">
							Ask about anything on WorldSpace, or just talk.
						</p>
					</div>
				</div>
			) : (
				<div className="flex-1 space-y-6 px-4 py-4">
					{turns.map((t) =>
						t.role === "user" ? (
							<div key={t.id} className="flex justify-end">
								<p className="max-w-[85%] whitespace-pre-wrap rounded-[20px] bg-raised px-4 py-2.5 font-sans text-[calc(15px*var(--ws-fs))] text-primary">
									{t.text}
								</p>
							</div>
						) : (
							<VividAnswer key={t.id} turn={t} />
						),
					)}
					<div ref={endRef} />
				</div>
			)}

			{/* The composer sits on the page, above the phone's bottom bar. */}
			<div className="sticky bottom-[var(--ws-nav-clearance,0px)] z-sticky bg-page/90 px-3 pt-2 pb-3 backdrop-blur-xl md:bottom-0">
				{empty && (
					// One swipeable row of starters (owner 2026-10-16).
					<div className="-mx-3 mb-2 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
						{SUGGESTIONS.map(([a, b]) => (
							<button
								key={a}
								type="button"
								onClick={() => void send(`${a} ${b}`)}
								className="flex w-[160px] shrink-0 cursor-pointer flex-col items-start gap-0.5 rounded-[18px] bg-primary/[0.05] px-3.5 py-3 text-left transition-colors hover:bg-primary/[0.08]"
							>
								<span className="font-sans text-[calc(13.5px*var(--ws-fs))] font-semibold text-primary">{a}</span>
								<span className="font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">{b}</span>
							</button>
						))}
					</div>
				)}
				<form
					onSubmit={(e) => {
						e.preventDefault();
						void send(input);
					}}
					className="flex flex-col gap-2 rounded-[26px] bg-surface px-4 pt-3 pb-2.5 ring-1 ring-primary/[0.06]"
				>
					<textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								void send(input);
							}
						}}
						rows={1}
						placeholder={empty ? "Ask Vivid anything" : "Ask a follow-up"}
						className="max-h-40 w-full resize-none bg-transparent font-sans text-base text-primary outline-none placeholder:text-subtle sm:text-[calc(15.5px*var(--ws-fs))]"
					/>
					<div className="flex items-center gap-2">
						<span className="flex-1" />
						{busy ? (
							<button
								type="button"
								onClick={stop}
								aria-label="Stop"
								className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill bg-primary text-page"
							>
								<Stop size={14} weight="fill" />
							</button>
						) : input.trim() ? (
							<button
								type="submit"
								aria-label="Send"
								className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill bg-primary text-page"
							>
								<ArrowUp size={16} weight="bold" />
							</button>
						) : (
							<button
								type="button"
								onClick={() => setVoiceOpen(true)}
								className="flex h-9 cursor-pointer items-center gap-1.5 rounded-pill bg-primary px-3.5 font-sans text-[calc(13px*var(--ws-fs))] font-bold text-page"
							>
								<Waveform size={16} weight="bold" />
								Talk
							</button>
						)}
					</div>
				</form>
			</div>

			<AnimatePresence>
				{voiceOpen && <VoiceMode key="voice" onClose={() => setVoiceOpen(false)} send={send} />}
			</AnimatePresence>
		</div>
	);
}

function VividAnswer({ turn }: { turn: Turn }) {
	const [copied, setCopied] = useState(false);
	const working = turn.streaming && !turn.text;
	const speak = () => {
		if (!("speechSynthesis" in window)) return;
		window.speechSynthesis.cancel();
		window.speechSynthesis.speak(new SpeechSynthesisUtterance(speakable(turn.text)));
	};
	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center gap-2">
				<VividOrb size={22} speed={turn.streaming ? 1.6 : 0.5} />
				<span className="font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">Vivid</span>
			</div>
			{turn.steps && turn.steps.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{turn.steps.map((s) => (
						<span
							key={s.id}
							className="flex items-center gap-1.5 rounded-pill bg-primary/[0.05] px-2.5 py-1 font-sans text-[calc(12px*var(--ws-fs))] text-muted"
						>
							{s.status === "start" ? (
								<CircleNotch size={11} className="animate-spin" />
							) : (
								<Check size={11} weight="bold" className={s.status === "error" ? "text-danger" : "text-success"} />
							)}
							{s.label}
						</span>
					))}
				</div>
			)}
			{working ? (
				<VividThinking className="h-[42px] w-[54px]" />
			) : (
				turn.text && (
					<p className="whitespace-pre-wrap font-sans text-[calc(15.5px*var(--ws-fs))] leading-relaxed text-primary">
						{turn.text}
					</p>
				)
			)}
			{turn.error && (
				<p className="font-sans text-[calc(13.5px*var(--ws-fs))] text-danger">{turn.error}</p>
			)}
			{turn.cards?.map((c, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: cards arrive in order and never reorder
				<VividCardView key={i} card={c} />
			))}
			{!turn.streaming && turn.text && (
				<div className="flex items-center gap-1 text-muted">
					<button
						type="button"
						onClick={speak}
						aria-label="Read aloud"
						className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-pill hover:bg-primary/[0.06] hover:text-primary"
					>
						<SpeakerHigh size={16} />
					</button>
					<button
						type="button"
						onClick={() => {
							void navigator.clipboard.writeText(turn.text);
							setCopied(true);
							setTimeout(() => setCopied(false), 1400);
						}}
						aria-label="Copy"
						className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-pill hover:bg-primary/[0.06] hover:text-primary"
					>
						{copied ? <Check size={16} /> : <Copy size={16} />}
					</button>
				</div>
			)}
		</div>
	);
}

function VividCardView({ card }: { card: VividCard }) {
	const [state, setState] = useState<"pending" | "busy" | "done" | "cancelled" | "error">(
		card.kind === "confirm" && card.status !== "pending" ? "done" : "pending",
	);
	const [msg, setMsg] = useState("");
	const box = "rounded-[18px] bg-surface p-3 ring-1 ring-primary/[0.05]";

	if (card.kind === "posts")
		return (
			<div className="flex flex-col gap-2">
				{card.posts.map((p) => (
					<Link key={p.id} href={`/post/${p.id}`} className={clsx(box, "flex items-start gap-3 hover:bg-raised")}>
						<span className="flex min-w-0 flex-1 flex-col gap-1">
							<span className="font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
								{p.authorName || p.author}
								{p.author && <span className="ml-1 font-normal text-subtle">@{p.author}</span>}
							</span>
							<span className="line-clamp-2 font-sans text-[calc(13.5px*var(--ws-fs))] text-muted">{p.text}</span>
						</span>
						<ArrowUpRight size={15} className="mt-0.5 shrink-0 text-subtle" />
					</Link>
				))}
			</div>
		);
	if (card.kind === "people")
		return (
			<div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				{card.people.map((u) => (
					<Link key={u.id} href={`/profile/${u.username}`} className={clsx(box, "flex w-[150px] shrink-0 flex-col items-center gap-2 text-center")}>
						<span className="relative h-12 w-12 overflow-hidden rounded-full bg-raised">
							<SafeAvatar src={u.avatar ?? undefined} className="object-cover" />
						</span>
						<span className="w-full truncate font-sans text-[calc(13.5px*var(--ws-fs))] font-semibold text-primary">{u.name}</span>
						<span className="w-full truncate font-sans text-[calc(12px*var(--ws-fs))] text-subtle">@{u.username}</span>
					</Link>
				))}
			</div>
		);
	if (card.kind === "trends")
		return (
			<div className="flex flex-wrap gap-2">
				{card.trends.map((tr) => (
					<Link
						key={tr.title}
						href={`/explore?q=${encodeURIComponent(tr.title)}`}
						className="rounded-pill bg-primary/[0.06] px-3 py-1.5 font-sans text-[calc(13px*var(--ws-fs))] font-medium text-primary hover:bg-primary/[0.1]"
					>
						{tr.title}
						{tr.posts != null && <span className="ml-1.5 text-subtle">{tr.posts}</span>}
					</Link>
				))}
			</div>
		);
	if (card.kind === "sources")
		return (
			<div className="flex flex-wrap gap-2">
				{card.sources.map((s) => (
					<a
						key={s.url}
						href={s.url}
						target="_blank"
						rel="noopener noreferrer"
						className="flex max-w-[260px] items-center gap-1.5 rounded-pill bg-primary/[0.06] px-3 py-1.5 font-sans text-[calc(12.5px*var(--ws-fs))] text-muted hover:text-primary"
					>
						<span className="truncate">{s.title}</span>
						<ArrowUpRight size={12} className="shrink-0" />
					</a>
				))}
			</div>
		);
	if (card.kind === "confirm") {
		const settle = async (verb: "confirm" | "cancel") => {
			setState("busy");
			const r = await settleVividAction(card.actionId, verb);
			if (!r.ok) {
				setMsg(r.message);
				setState("error");
				return;
			}
			setState(verb === "confirm" ? "done" : "cancelled");
		};
		return (
			<div className={clsx(box, "flex flex-col gap-3")}>
				<p className="font-sans text-[calc(14px*var(--ws-fs))] text-primary">{card.summary}</p>
				{state === "done" ? (
					<span className="flex items-center gap-1.5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-success">
						<Check size={14} weight="bold" /> Done
					</span>
				) : state === "cancelled" ? (
					<span className="font-sans text-[calc(13px*var(--ws-fs))] text-muted">Cancelled</span>
				) : (
					<div className="flex items-center gap-2">
						<button
							type="button"
							disabled={state === "busy"}
							onClick={() => void settle("confirm")}
							className="h-9 cursor-pointer rounded-pill bg-brand px-4 font-sans text-[calc(13.5px*var(--ws-fs))] font-semibold text-brand-on disabled:opacity-50"
						>
							{card.verb || "Confirm"}
						</button>
						<button
							type="button"
							disabled={state === "busy"}
							onClick={() => void settle("cancel")}
							className="h-9 cursor-pointer rounded-pill bg-primary/[0.07] px-4 font-sans text-[calc(13.5px*var(--ws-fs))] font-semibold text-primary disabled:opacity-50"
						>
							Cancel
						</button>
						{msg && <span className="font-sans text-[calc(12.5px*var(--ws-fs))] text-danger">{msg}</span>}
					</div>
				)}
			</div>
		);
	}
	return null;
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
					? "Listening…"
					: state === "thinking"
						? "Thinking…"
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
				<button
					type="button"
					onClick={onClose}
					aria-label="Close"
					className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill bg-primary/[0.07] text-primary"
				>
					<X size={18} />
				</button>
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
				<p className="max-w-xl font-display text-[calc(20px*var(--ws-fs))] font-medium leading-snug text-primary">
					{caption}
				</p>
			</div>
			<div className="flex shrink-0 items-start justify-center gap-10 px-8 pb-[calc(40px+var(--ws-safe-bottom))]">
				<button type="button" onClick={() => setMuted((m) => !m)} className="flex cursor-pointer flex-col items-center gap-2">
					<span className="flex h-16 w-16 items-center justify-center rounded-pill bg-primary/[0.08] text-primary">
						{muted ? <MicrophoneSlash size={24} /> : <Microphone size={24} />}
					</span>
					<span className="font-sans text-[calc(12px*var(--ws-fs))] text-muted">{muted ? "Unmute" : "Mute"}</span>
				</button>
				<button type="button" onClick={onClose} className="flex cursor-pointer flex-col items-center gap-2">
					<span className="flex h-16 w-16 items-center justify-center rounded-pill bg-danger text-white">
						<X size={24} weight="bold" />
					</span>
					<span className="font-sans text-[calc(12px*var(--ws-fs))] text-muted">End</span>
				</button>
			</div>
		</motion.div>
	);
}
