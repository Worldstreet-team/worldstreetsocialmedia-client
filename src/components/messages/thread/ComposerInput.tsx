"use client";

import {
	RiAddLine,
	RiEmotionLine,
	RiMoneyDollarCircleLine,
	RiSendPlane2Fill,
	RiVoiceprintFill,
} from "@remixicon/react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";
import {
	forwardRef,
	useImperativeHandle,
	useRef,
	useState,
} from "react";

export interface ComposerInputHandle {
	focus: () => void;
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
		onStartRecording: () => void;
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
		onStartRecording,
	},
	ref,
) {
	const [value, setValue] = useState("");
	const [showEmoji, setShowEmoji] = useState(false);
	const inputRef = useRef<HTMLTextAreaElement | null>(null);
	const { resolvedTheme } = useTheme();

	useImperativeHandle(ref, () => ({
		focus: () => inputRef.current?.focus(),
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
		<div className="flex min-w-0 flex-1 items-end gap-1 rounded-2xl bg-raised/70 py-1.5 pl-1.5 pr-2 transition-colors focus-within:bg-raised sm:gap-2">
			<button
				type="button"
				onClick={onAttach}
				aria-label="Attach a file"
				className="mb-0.5 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-chip hover:text-primary"
			>
				<RiAddLine size={20} />
			</button>
			<textarea
				ref={inputRef}
				value={value}
				onChange={(e) => {
					setValue(e.target.value);
					if (e.target.value) onTyping();
					else onStopTyping();
				}}
				onKeyDown={(e) =>
					e.key === "Enter" && !e.shiftKey && (e.preventDefault(), void send())
				}
				placeholder="Type a message..."
				className="flex-1 min-w-0 bg-transparent border-none outline-none text-base text-primary placeholder:text-subtle resize-none max-h-[100px] py-2.5"
				rows={1}
				style={{ minHeight: "24px" }}
			/>
			<div className="flex items-center shrink-0">
				<button
					type="button"
					onClick={onMoney}
					aria-label="Send money"
					title="Send money"
					className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-raised hover:text-primary"
				>
					<RiMoneyDollarCircleLine size={20} />
				</button>
				{gifEnabled && (
					<button
						type="button"
						onClick={onGif}
						aria-label="Send a GIF"
						className="flex h-10 cursor-pointer items-center justify-center rounded-pill px-1.5 font-sans text-[11px] font-bold tracking-wide text-muted transition-colors hover:bg-chip hover:text-primary"
					>
						GIF
					</button>
				)}
				<div className="relative">
					<button
						type="button"
						onClick={() => setShowEmoji((v) => !v)}
						aria-label="Insert emoji"
						className="flex h-10 w-10 items-center justify-center rounded-pill text-muted hover:text-primary hover:bg-raised transition-colors cursor-pointer"
					>
						<RiEmotionLine size={22} />
					</button>
					{showEmoji && (
						<div className="fixed left-1/2 bottom-24 -translate-x-1/2 sm:absolute sm:left-auto sm:bottom-12 sm:right-0 sm:translate-x-0 w-[min(320px,calc(100vw-1.5rem))] z-dropdown animate-rise ws-emoji-picker">
							<EmojiPicker
								theme={resolvedTheme === "light" ? Theme.LIGHT : Theme.DARK}
								width="100%"
								height={360}
								lazyLoadEmojis={true}
								onEmojiClick={(e) => setValue((p) => p + e.emoji)}
							/>
						</div>
					)}
				</div>
				{value.trim() || hasAttachment ? (
					<button
						type="button"
						onClick={() => void send()}
						disabled={disabled}
						aria-label="Send message"
						className="flex h-9 w-9 items-center justify-center bg-brand text-brand-on rounded-pill hover:bg-brand-active transition-colors disabled:opacity-50 cursor-pointer"
					>
						<RiSendPlane2Fill size={16} />
					</button>
				) : (
					<button
						type="button"
						onClick={onStartRecording}
						aria-label="Record a voice message"
						className="flex h-10 w-10 items-center justify-center rounded-pill text-muted hover:text-primary hover:bg-raised transition-colors cursor-pointer"
					>
						<RiVoiceprintFill size={22} />
					</button>
				)}
			</div>
		</div>
	);
});
