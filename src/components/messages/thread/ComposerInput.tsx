"use client";

import {
	RiAddLine,
	RiArrowUpLine,
	RiEmotionLine,
	RiMoneyDollarCircleLine,
	RiVoiceprintFill,
} from "@remixicon/react";
import clsx from "clsx";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";
import {
	forwardRef,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

export interface MentionCandidate {
	id: string;
	username?: string;
	name: string;
	avatar?: string;
}

/** The @token under the caret, if the caret sits inside one. */
function mentionTokenAt(text: string, caret: number) {
	const upto = text.slice(0, caret);
	const m = upto.match(/(^|\s)@([A-Za-z0-9_.]{0,32})$/);
	if (!m) return null;
	return { query: m[2], start: caret - m[2].length - 1 };
}

export interface ComposerInputHandle {
	focus: () => void;
	/** Where the text sits, so a send can animate FROM the field. */
	getRect: () => DOMRect | null;
}

/**
 * The composer pill, with its OWN input state — register item 6.
 *
 * Typing used to set state on the 2,293-line parent, re-rendering every
 * bubble in the thread per keystroke; with long threads the input lagged
 * the finger. Now a keystroke re-renders this pill and nothing else. The
 * parent only hears about a send (and gets the text back if the send
 * fails, so drafts survive errors).
 */
export const ComposerInput = forwardRef<
	ComposerInputHandle,
	{
		disabled: boolean;
		hasAttachment: boolean;
		gifEnabled: boolean;
		onSend: (text: string) => Promise<boolean>;
		onTyping: () => void;
		onStopTyping: () => void;
		onAttach: () => void;
		onMoney: () => void;
		onGif: () => void;
		/** Paste-to-attach (register 75): files from the clipboard. */
		onFiles: (files: File[]) => void;
		/** Mic pressed — carries the pointer so the recorder can track the
		 *  hold gesture (slide to cancel / lock) from where it began. */
		onRecordStart: (start: {
			x: number;
			y: number;
			pointerType: string;
		}) => void;
		/** Group rosters only (register 136): typing @ offers the room. */
		mentionCandidates?: MentionCandidate[];
	}
>(function ComposerInput(
	{
		disabled,
		hasAttachment,
		gifEnabled,
		onSend,
		onTyping,
		onStopTyping,
		onAttach,
		onMoney,
		onGif,
		onFiles,
		onRecordStart,
		mentionCandidates,
	},
	ref,
) {
	const [value, setValue] = useState("");
	const [showEmoji, setShowEmoji] = useState(false);
	const [mentionQuery, setMentionQuery] = useState<{
		query: string;
		start: number;
	} | null>(null);
	const inputRef = useRef<HTMLTextAreaElement | null>(null);
	const { resolvedTheme } = useTheme();

	const mentionMatches = useMemo(() => {
		if (!mentionQuery || !mentionCandidates?.length) return [];
		const q = mentionQuery.query.toLowerCase();
		return mentionCandidates
			.filter(
				(c) =>
					!q ||
					(c.username ?? "").toLowerCase().startsWith(q) ||
					c.name.toLowerCase().includes(q),
			)
			.slice(0, 6);
	}, [mentionQuery, mentionCandidates]);

	const insertMention = (c: MentionCandidate) => {
		if (!mentionQuery || !c.username) return;
		const el = inputRef.current;
		const caret = el?.selectionStart ?? value.length;
		const next = `${value.slice(0, mentionQuery.start)}@${c.username} ${value.slice(caret)}`;
		setValue(next);
		setMentionQuery(null);
		requestAnimationFrame(() => {
			const pos = mentionQuery.start + (c.username?.length ?? 0) + 2;
			el?.focus();
			el?.setSelectionRange(pos, pos);
		});
	};

	const refreshMention = (text: string, caret: number) => {
		if (!mentionCandidates?.length) return;
		setMentionQuery(mentionTokenAt(text, caret));
	};

	useImperativeHandle(ref, () => ({
		focus: () => inputRef.current?.focus(),
		getRect: () => inputRef.current?.getBoundingClientRect() ?? null,
	}));

	const send = async () => {
		const text = value.trim();
		if (!text && !hasAttachment) return;
		setValue("");
		setShowEmoji(false);
		onStopTyping();
		const ok = await onSend(text);
		// A failed send must not eat the draft.
		if (!ok && text) setValue((v) => v || text);
	};

	return (
		<div className="flex min-w-0 flex-1 flex-col gap-2">
		{/* @mention rail (owner pick: horizontal chips, not a dropdown) —
		    avatar chips above the pill, one tap each. */}
		{mentionQuery && mentionMatches.length > 0 && (
			<div className="flex gap-1.5 overflow-x-auto scrollbar-none animate-pop">
				{mentionMatches.map((c) => (
					<button
						key={c.id}
						type="button"
						onMouseDown={(e) => {
							e.preventDefault();
							insertMention(c);
						}}
						className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-pill bg-raised py-1 pl-1 pr-3 font-sans text-[12.5px] font-medium text-primary transition-colors hover:bg-chip"
					>
						<span className="relative h-5 w-5 overflow-hidden rounded-pill bg-chip">
							<SafeAvatar src={c.avatar} eager />
						</span>
						{c.name}
					</button>
				))}
			</div>
		)}
		<div className="relative flex min-w-0 items-end gap-1 rounded-pill border border-hairline bg-transparent py-1 pl-1.5 pr-1.5 transition-colors focus-within:border-muted/60 sm:gap-1.5">
			<button
				type="button"
				onClick={onAttach}
				aria-label="Attach a file"
				className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-chip hover:text-primary"
			>
				<RiAddLine size={20} />
			</button>
			<textarea
				ref={inputRef}
				value={value}
				onChange={(e) => {
					setValue(e.target.value);
					refreshMention(
						e.target.value,
						e.target.selectionStart ?? e.target.value.length,
					);
					if (e.target.value) onTyping();
					else onStopTyping();
				}}
				onKeyDown={(e) => {
					// While the @ picker is open, Enter takes the top match
					// and Escape dismisses — sending waits its turn.
					if (mentionQuery && mentionMatches.length > 0) {
						if (e.key === "Enter" || e.key === "Tab") {
							e.preventDefault();
							insertMention(mentionMatches[0]);
							return;
						}
						if (e.key === "Escape") {
							e.preventDefault();
							setMentionQuery(null);
							return;
						}
					}
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						void send();
					}
				}}
				onPaste={(e) => {
					const files = Array.from(e.clipboardData?.files ?? []);
					if (files.length > 0) {
						e.preventDefault();
						onFiles(files);
					}
				}}
				placeholder="Message..."
				className="flex-1 min-w-0 bg-transparent border-none outline-none text-[15px] leading-[1.35] text-primary placeholder:text-subtle resize-none max-h-[100px] py-[9px]"
				rows={1}
				style={{ minHeight: "24px" }}
			/>
			<div className="flex items-center shrink-0">
				<button
					type="button"
					onClick={onMoney}
					aria-label="Send money"
					title="Send money"
					className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-raised hover:text-primary"
				>
					<RiMoneyDollarCircleLine size={20} />
				</button>
				{gifEnabled && (
					<button
						type="button"
						onClick={onGif}
						aria-label="Send a GIF"
						className="flex h-9 cursor-pointer items-center justify-center rounded-pill px-1.5 font-sans text-[11px] font-bold tracking-wide text-muted transition-colors hover:bg-chip hover:text-primary"
					>
						GIF
					</button>
				)}
				<button
					type="button"
					onClick={() => setShowEmoji((v) => !v)}
					aria-label="Insert emoji"
					aria-expanded={showEmoji}
					className={clsx(
						"flex h-9 w-9 items-center justify-center rounded-pill transition-colors cursor-pointer",
						showEmoji
							? "bg-raised text-primary"
							: "text-muted hover:text-primary hover:bg-raised",
					)}
				>
					<RiEmotionLine size={21} />
				</button>
				{value.trim() || hasAttachment ? (
					// iMessage grammar (owner pick): the up-arrow lives inside the
					// pill's right edge, in the mic's cell, so nothing jumps.
					<span className="flex h-9 w-9 items-center justify-center">
						<button
							type="button"
							onClick={() => void send()}
							disabled={disabled}
							aria-label="Send message"
							className="flex h-7 w-7 items-center justify-center bg-brand text-brand-on rounded-pill hover:bg-brand-active transition-colors disabled:opacity-50 cursor-pointer animate-pop"
						>
							<RiArrowUpLine size={17} />
						</button>
					</span>
				) : (
					<button
						type="button"
						onPointerDown={(e) => {
							// Touch holds to record (slide left cancels, up
							// locks); a mouse click starts locked. The recorder
							// tracks the rest on window listeners.
							e.preventDefault();
							onRecordStart({
								x: e.clientX,
								y: e.clientY,
								pointerType: e.pointerType,
							});
						}}
						aria-label="Record a voice message"
						className="flex h-9 w-9 touch-none items-center justify-center rounded-pill text-muted hover:text-primary hover:bg-raised transition-colors cursor-pointer animate-pop"
					>
						<RiVoiceprintFill size={21} />
					</button>
				)}
			</div>
		</div>
		{/* Keyboard-slot emoji panel (owner pick): opens BELOW the pill in the
		    keyboard's place, native-app style, instead of a floating popover. */}
		{showEmoji && (
			<div className="overflow-hidden rounded-xl bg-surface animate-pop ws-emoji-picker">
				<EmojiPicker
					theme={resolvedTheme === "light" ? Theme.LIGHT : Theme.DARK}
					width="100%"
					height={300}
					lazyLoadEmojis={true}
					onEmojiClick={(e) => setValue((p) => p + e.emoji)}
				/>
			</div>
		)}
		</div>
	);
});
