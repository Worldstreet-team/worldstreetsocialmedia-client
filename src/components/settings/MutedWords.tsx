"use client";

import { Plus, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { getMutedWordsAction, setMutedWordsAction } from "@/lib/mute.actions";
import { pop } from "@/lib/motion-presets";

const MAX_WORDS = 100;
const MAX_LENGTH = 60;

/**
 * Muted words. Posts containing one leave your feed, and replies or
 * mentions containing one stop notifying you (gateway utils/muted-words.ts:
 * whole words, any case, so "eth" never hides "method").
 *
 * Optimistic like every other setting: a word lands as a chip the moment
 * Enter is pressed, the whole list is saved behind it, and a failed save
 * puts the list back and says so.
 */
export function MutedWords() {
	const { toast } = useToast();
	const [words, setWords] = useState<string[] | null>(null);
	const [draft, setDraft] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		let cancelled = false;
		void getMutedWordsAction().then((res) => {
			if (cancelled) return;
			setWords(res.data);
			if (!res.success) toast(res.message ?? "Could not load muted words", { type: "error" });
		});
		return () => {
			cancelled = true;
		};
	}, [toast]);

	const save = async (next: string[], before: string[]) => {
		setWords(next);
		const res = await setMutedWordsAction(next);
		if (!res.success) {
			setWords(before);
			toast(res.message ?? "Could not save muted words", { type: "error" });
			return;
		}
		setWords(res.data);
	};

	const add = () => {
		if (!words) return;
		const w = draft.trim().replace(/\s+/g, " ").toLowerCase();
		if (!w) return;
		if (w.length > MAX_LENGTH) {
			toast(`Keep it under ${MAX_LENGTH} characters`, { type: "error" });
			return;
		}
		setDraft("");
		if (words.includes(w)) return;
		if (words.length >= MAX_WORDS) {
			toast(`You can mute up to ${MAX_WORDS} words`, { type: "error" });
			return;
		}
		void save([...words, w], words);
	};

	const remove = (w: string) => {
		if (!words) return;
		void save(
			words.filter((x) => x !== w),
			words,
		);
		inputRef.current?.focus();
	};

	return (
		<div className="flex flex-col gap-3 border-t border-hairline py-3">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					add();
				}}
				className="flex items-center gap-2"
			>
				<input
					ref={inputRef}
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					maxLength={MAX_LENGTH + 10}
					disabled={words === null}
					placeholder="Add a word, phrase or #hashtag"
					aria-label="Add a muted word"
					className="h-10 min-w-0 flex-1 rounded-pill bg-primary/5 px-4 font-sans text-[calc(14px*var(--ws-fs))] text-primary transition-colors placeholder:text-subtle focus:bg-primary/10 focus:outline-none"
				/>
				<button
					type="submit"
					disabled={!draft.trim() || words === null}
					className="flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-pill bg-brand px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-brand-on transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-40"
				>
					<Plus size={14} weight="bold" aria-hidden />
					Mute
				</button>
			</form>

			{words === null ? (
				<div className="flex gap-2">
					<Skeleton className="h-8 w-20 rounded-pill" />
					<Skeleton className="h-8 w-28 rounded-pill" />
					<Skeleton className="h-8 w-16 rounded-pill" />
				</div>
			) : words.length === 0 ? (
				<p className="font-sans text-[calc(13px*var(--ws-fs))] text-subtle">
					Nothing muted yet. Whole words only, in any case: muting “eth” leaves “method”
					alone.
				</p>
			) : (
				<ul aria-label="Muted words" className="flex flex-wrap gap-2">
					<AnimatePresence initial={false}>
						{words.map((w) => (
							<motion.li key={w} layout {...pop}>
								<span className="flex h-8 items-center gap-1 rounded-pill bg-primary/5 pl-3 pr-1 font-sans text-[calc(13px*var(--ws-fs))] font-medium text-primary">
									{w}
									<button
										type="button"
										onClick={() => remove(w)}
										aria-label={`Unmute “${w}”`}
										className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-pill text-subtle transition-colors hover:bg-primary/10 hover:text-primary"
									>
										<X size={12} weight="bold" aria-hidden />
									</button>
								</span>
							</motion.li>
						))}
					</AnimatePresence>
				</ul>
			)}
			{words && words.length > 0 && (
				<span className="font-sans text-[calc(12px*var(--ws-fs))] tabular-nums text-subtle">
					{words.length} of {MAX_WORDS}
				</span>
			)}
		</div>
	);
}
