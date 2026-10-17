"use client";

import clsx from "clsx";
import {
	ArrowLeft,
	ArrowRight,
	ArrowsClockwise,
	ArrowsDownUp,
	BookOpenText,
	Calculator,
	CardsThree,
	CaretDown,
	Check,
	Code,
	Exam,
	Function as FunctionIcon,
	ListNumbers,
	Quotes,
	SpeakerHigh,
	Sparkle,
	Translate,
	X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { collapse, snappySpring, swap } from "@/lib/motion-presets";
import {
	AskChip,
	arr,
	Btn,
	CopyBtn,
	css,
	Display,
	Frame,
	fmt,
	num,
	type Props,
	rec,
	str,
	T,
	Tag,
	Txt,
	useStill,
	well,
} from "./parts";

/* Learning and words: steps, formula, definition, glossary, quiz,
   flashcards, tldr, quote, calc, convert, translation, code. */

type R = Record<string, unknown>;

/** Steps past this fold behind "Show all": the widget answers at a glance first. */
const STEP_FOLD = 4;

function say(text: string) {
	if (!("speechSynthesis" in window)) return;
	window.speechSynthesis.cancel();
	window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

/** The "Show more" row under a fold. */
export function More({ open, onClick, children }: { open: boolean; onClick: () => void; children: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-expanded={open}
			className="flex h-10 cursor-pointer items-center gap-1.5 font-sans text-[calc(13.5px*var(--ws-fs))] font-medium text-muted transition-colors hover:text-primary"
		>
			{children}
			<CaretDown weight="bold" className={clsx("size-3.5 transition-transform", open && "rotate-180")} />
		</button>
	);
}

export function StepsWidget({ data, title, live }: Props<R>) {
	const steps = arr<R>(data.steps);
	const result = str(data.result);
	const [all, setAll] = useState(steps.length <= STEP_FOLD + 1);
	const shown = all ? steps : steps.slice(0, STEP_FOLD);
	return (
		<Frame title={title || "Step by step"} icon={<ListNumbers />} live={live}>
			<ol className="flex flex-col">
				{shown.map((st, i) => {
					const last = i === shown.length - 1;
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: steps are ordered and never reorder
						<li key={i} className="relative flex gap-3.5 pb-5 last:pb-0">
							{!last && <span aria-hidden className="absolute top-8 bottom-1.5 left-[13.5px] w-px bg-hairline" />}
							<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--vivid-well)] font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold text-primary tabular-nums">
								{i + 1}
							</span>
							<div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-[3px]">
								<p className={T.strong}>
									<Txt text={st.title} />
								</p>
								{str(st.body) && (
									<p className={clsx(T.body, "text-muted")}>
										<Txt text={st.body} />
									</p>
								)}
								{str(st.tex) && <Display tex={st.tex} className={clsx(well, "mt-1 px-4 py-2")} />}
							</div>
						</li>
					);
				})}
			</ol>
			{steps.length > shown.length || (all && steps.length > STEP_FOLD + 1) ? (
				<div className="mt-2 pl-[42px]">
					<More open={all} onClick={() => setAll((a) => !a)}>
						{all ? "Show fewer" : `Show all ${steps.length} steps`}
					</More>
				</div>
			) : null}
			{result && (
				<div className="mt-4 flex items-start gap-3 rounded-[13px] bg-[var(--vivid-brand-wash)] px-4 py-3.5">
					<span className="mt-[3px] flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-brand-on">
						<Check weight="bold" className="size-3" />
					</span>
					<p className={clsx(T.strong, "min-w-0")}>
						<Txt text={result} />
					</p>
				</div>
			)}
		</Frame>
	);
}

export function FormulaWidget({ data, title, live }: Props<R>) {
	const where = arr<R>(data.where);
	return (
		<Frame
			title={title || str(data.label) || "Formula"}
			icon={<FunctionIcon />}
			action={<CopyBtn text={str(data.tex)} label="Copy TeX" icon />}
			live={live}
		>
			<Display tex={data.tex} className={clsx(well, "flex justify-center px-4 py-6 text-[calc(21px*var(--ws-fs))]")} />
			{where.length > 0 && (
				<dl className="mt-4 flex flex-col">
					{where.map((w, i) => {
						const sym = str(w.sym);
						const tex = /[\\^_{]/.test(sym) && !/\\\(/.test(sym) ? `\\(${sym}\\)` : sym;
						return (
							// biome-ignore lint/suspicious/noArrayIndexKey: a legend in order
							<div key={i} className="flex items-baseline gap-4 border-hairline border-t py-2.5 first:border-t-0 first:pt-0">
								<dt className={clsx(T.strong, "w-[68px] shrink-0 font-normal")}>
									<Txt text={tex} />
								</dt>
								<dd className={clsx(T.body, "min-w-0 text-muted")}>
									<Txt text={w.meaning} />
								</dd>
							</div>
						);
					})}
				</dl>
			)}
		</Frame>
	);
}

export function DefinitionWidget({ data, title, live }: Props<R>) {
	const senses = arr<R>(data.senses);
	const syn = arr(data.synonyms).map(str).filter(Boolean);
	const term = str(data.term);
	return (
		<Frame
			title={title || "Definition"}
			icon={<BookOpenText />}
			action={
				<Btn label={`Say ${term}`} tone="ghost" icon onClick={() => say(term)}>
					<SpeakerHigh />
				</Btn>
			}
			live={live}
		>
			<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
				<span className="font-display text-[calc(30px*var(--ws-fs))] leading-tight font-semibold text-primary">{term}</span>
				{str(data.phonetic) && <span className={clsx(T.label, "text-[calc(15px*var(--ws-fs))]")}>{str(data.phonetic)}</span>}
				{str(data.pos) && <Tag>{str(data.pos)}</Tag>}
			</div>
			<ol className="mt-4 flex flex-col gap-4">
				{senses.map((m, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: senses in order
					<li key={i} className="flex gap-3">
						{senses.length > 1 && <span className={clsx(T.label, "w-4 shrink-0 pt-px tabular-nums")}>{i + 1}</span>}
						<div className="flex min-w-0 flex-col gap-1.5">
							<p className={T.body}>
								<Txt text={m.meaning} />
							</p>
							{str(m.example) && (
								<p className={clsx(T.body, "border-hairline border-l-2 pl-3 text-muted italic")}>
									<Txt text={m.example} />
								</p>
							)}
						</div>
					</li>
				))}
			</ol>
			{syn.length > 0 && (
				<div className="mt-4 flex flex-col gap-2 border-hairline border-t pt-4">
					<span className={T.label}>Similar words</span>
					<div className="flex flex-wrap gap-1.5">
						{syn.map((w) => (
							<AskChip key={w} text={w} q={`Define "${w}"`} />
						))}
					</div>
				</div>
			)}
		</Frame>
	);
}

export function GlossaryWidget({ data, title, live }: Props<R>) {
	const terms = arr<R>(data.terms);
	return (
		<Frame title={title || "Glossary"} icon={<BookOpenText />} live={live} flush>
			<dl className="flex flex-col px-4 pb-2 sm:px-5">
				{terms.map((t, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: terms in order
					<div key={i} className="flex flex-col gap-1 border-hairline border-t py-3 first:border-t-0 sm:flex-row sm:gap-5">
						<dt className={clsx(T.strong, "sm:w-[34%] sm:shrink-0")}>
							<Txt text={t.term} />
						</dt>
						<dd className={clsx(T.body, "min-w-0 text-muted")}>
							<Txt text={t.meaning} />
						</dd>
					</div>
				))}
			</dl>
		</Frame>
	);
}

export function QuizWidget({ data, title, live }: Props<R>) {
	const qs = arr<R>(data.questions);
	const [at, setAt] = useState(0);
	const [picks, setPicks] = useState<(number | null)[]>(() => qs.map(() => null));
	const done = at >= qs.length;
	const score = picks.reduce<number>((n, p, i) => n + (p !== null && p === num(qs[i]?.answer) ? 1 : 0), 0);
	const q = qs[at];
	const pick = picks[at];
	const answer = q ? num(q.answer) : null;
	return (
		<Frame
			title={title || "Quiz"}
			icon={<Exam />}
			action={
				<span className={clsx(T.label, "pr-2.5 tabular-nums")}>{done ? `${score} of ${qs.length}` : `Question ${at + 1} of ${qs.length}`}</span>
			}
			live={live}
		>
			<div className="mb-4 flex gap-1" aria-hidden>
				{qs.map((_, i) => {
					const p = picks[i];
					const right = p !== null && p === num(qs[i]?.answer);
					return (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: one segment per question
							key={i}
							className={clsx(
								"h-1 flex-1 rounded-pill transition-colors",
								p === null ? (i === at ? "bg-primary/40" : "bg-[var(--vivid-track)]") : right ? "bg-credit" : "bg-debit",
							)}
						/>
					);
				})}
			</div>
			<AnimatePresence mode="wait" initial={false}>
				{done ? (
					<motion.div key="done" {...swap} className="flex flex-col items-center gap-2 py-3 text-center">
						<span className={T.hero}>
							{score}
							<span className="text-muted">/{qs.length}</span>
						</span>
						<p className={clsx(T.body, "text-muted")}>
							{score === qs.length ? "Every one right." : score >= qs.length / 2 ? "Good going. Want to review the misses?" : "Worth another go."}
						</p>
						<div className="mt-2">
							<Btn
								label="Try again"
								onClick={() => {
									setPicks(qs.map(() => null));
									setAt(0);
								}}
							>
								<ArrowsClockwise /> Try again
							</Btn>
						</div>
					</motion.div>
				) : (
					q && (
						<motion.div key={at} {...swap} className="flex flex-col gap-3">
							<p className={clsx(T.strong, "text-[calc(16.5px*var(--ws-fs))]")}>
								<Txt text={q.q} />
							</p>
							<div role="radiogroup" aria-label="Answers" className="flex flex-col gap-2">
								{arr(q.options).map((o, i) => {
									const chosen = pick === i;
									const right = pick !== null && i === answer;
									const wrong = chosen && i !== answer;
									return (
										<button
											// biome-ignore lint/suspicious/noArrayIndexKey: options in order
											key={i}
											type="button"
											role="radio"
											aria-checked={chosen}
											disabled={pick !== null}
											onClick={() => setPicks((p) => p.map((x, j) => (j === at ? i : x)))}
											className={clsx(
												"flex min-h-[48px] items-center gap-3 rounded-[13px] px-3.5 py-2.5 text-left transition-colors",
												T.body,
												right
													? "bg-[var(--vivid-credit-wash)] ring-[1.5px] ring-credit ring-inset"
													: wrong
														? "bg-[var(--vivid-debit-wash)] ring-[1.5px] ring-debit ring-inset"
														: pick === null
															? "cursor-pointer bg-[var(--vivid-well)] hover:bg-[var(--vivid-well-press)]"
															: "bg-[var(--vivid-well)] text-muted",
											)}
										>
											<span
												className={clsx(
													"flex size-6 shrink-0 items-center justify-center rounded-full font-sans text-[12px] font-semibold",
													right ? "bg-credit text-page" : wrong ? "bg-debit text-page" : "bg-[var(--vivid-well-press)] text-muted",
												)}
											>
												{right ? <Check weight="bold" className="size-3.5" /> : wrong ? <X weight="bold" className="size-3.5" /> : String.fromCharCode(65 + i)}
											</span>
											<span className="min-w-0 flex-1">
												<Txt text={o} />
											</span>
										</button>
									);
								})}
							</div>
							<AnimatePresence initial={false}>
								{pick !== null && (
									<motion.div key="after" {...collapse} className="overflow-hidden">
										<div className="flex flex-col gap-3 pt-1">
											{str(q.explain) && (
												<p className={clsx(T.body, "text-muted")}>
													<Txt text={q.explain} />
												</p>
											)}
											<div className="flex justify-end">
												<Btn label={at === qs.length - 1 ? "See score" : "Next question"} tone="primary" onClick={() => setAt((a) => a + 1)}>
													{at === qs.length - 1 ? "See score" : "Next"} <ArrowRight weight="bold" />
												</Btn>
											</div>
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</motion.div>
					)
				)}
			</AnimatePresence>
		</Frame>
	);
}

export function FlashcardsWidget({ data, title, live }: Props<R>) {
	const cards = arr<R>(data.cards);
	const [at, setAt] = useState(0);
	const [flipped, setFlipped] = useState(false);
	const [dir, setDir] = useState(1);
	const still = useStill(true);
	const go = (d: number) => {
		setDir(d);
		setFlipped(false);
		setAt((a) => (a + d + cards.length) % cards.length);
	};
	const c = cards[at];
	if (!c) return null;
	return (
		<Frame
			title={title || "Flashcards"}
			icon={<CardsThree />}
			action={<span className={clsx(T.label, "pr-2.5 tabular-nums")}>{`${at + 1} of ${cards.length}`}</span>}
			live={live}
		>
			<div className="relative pb-2 [perspective:1400px]">
				{/* The next card, peeking under this one: the deck has depth without a shadow. */}
				{cards.length > 1 && <span aria-hidden className="absolute inset-x-4 top-2 bottom-0 rounded-[13px] bg-[var(--vivid-well)]" />}
				<AnimatePresence mode="popLayout" initial={false} custom={dir}>
					<motion.button
						key={at}
						type="button"
						custom={dir}
						variants={{
							enter: (d: number) => ({ x: d * 48, opacity: 0 }),
							center: { x: 0, opacity: 1 },
							exit: (d: number) => ({ x: d * -48, opacity: 0, transition: { duration: 0.12 } }),
						}}
						initial="enter"
						animate="center"
						exit="exit"
						transition={snappySpring}
						drag={cards.length > 1 ? "x" : false}
						dragConstraints={{ left: 0, right: 0 }}
						dragElastic={0.35}
						onDragEnd={(_, i) => {
							if (Math.abs(i.offset.x) > 60) go(i.offset.x < 0 ? 1 : -1);
						}}
						onClick={() => setFlipped((f) => !f)}
						aria-label={flipped ? "Show the front" : "Show the answer"}
						className="relative block h-[196px] w-full cursor-pointer touch-pan-y"
					>
						<motion.div
							animate={{ rotateY: flipped ? 180 : 0 }}
							transition={still ? { duration: 0 } : snappySpring}
							className={clsx(css.flip, "relative h-full w-full")}
						>
							<Face side="front" text={c.front} />
							<Face side="back" text={c.back} />
						</motion.div>
					</motion.button>
				</AnimatePresence>
			</div>
			<div className="mt-3 flex items-center justify-between">
				<Btn label="Previous card" icon onClick={() => go(-1)} disabled={cards.length < 2}>
					<ArrowLeft />
				</Btn>
				<span className={T.label}>{flipped ? "Answer" : "Tap the card to flip"}</span>
				<Btn label="Next card" icon onClick={() => go(1)} disabled={cards.length < 2}>
					<ArrowRight />
				</Btn>
			</div>
		</Frame>
	);
}

function Face({ side, text }: { side: "front" | "back"; text: unknown }) {
	return (
		<div
			className={clsx(
				css.face,
				side === "back" && css.back,
				"absolute inset-0 flex items-center justify-center overflow-y-auto rounded-[13px] px-6 py-5 text-center",
				// The card is opaque so the deck under it never reads through.
				side === "front" ? "bg-raised" : "bg-raised ring-[1.5px] ring-brand ring-inset",
			)}
		>
			<p
				className={clsx(
					side === "front" ? "font-display text-[calc(22px*var(--ws-fs))] leading-snug font-semibold text-primary" : T.body,
					side === "back" && "text-[calc(16.5px*var(--ws-fs))]",
				)}
			>
				<Txt text={text} />
			</p>
		</div>
	);
}

export function TldrWidget({ data, title, live }: Props<R>) {
	const points = arr(data.points);
	return (
		<Frame title={title || "In short"} icon={<Sparkle />} live={live}>
			<p className="font-sans text-[calc(17px*var(--ws-fs))] leading-[1.5] font-medium text-primary">
				<Txt text={data.summary} />
			</p>
			{points.length > 0 && (
				<ul className="mt-4 flex flex-col gap-2.5">
					{points.map((p, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: points in order
						<li key={i} className="flex gap-3">
							<span aria-hidden className="mt-[10px] size-1.5 shrink-0 rounded-full bg-brand" />
							<span className={clsx(T.body, "text-muted")}>
								<Txt text={p} />
							</span>
						</li>
					))}
				</ul>
			)}
		</Frame>
	);
}

export function QuoteWidget({ data, title, live }: Props<R>) {
	const author = str(data.author);
	const source = str(data.source);
	const text = str(data.text);
	return (
		<Frame
			title={title || "Quote"}
			icon={<Quotes />}
			action={<CopyBtn text={`“${text}”${author ? ` (${author}${source ? `, ${source}` : ""})` : ""}`} label="Copy quote" icon />}
			live={live}
		>
			<figure className="flex flex-col gap-3 border-brand border-l-[3px] pl-4">
				<blockquote className="font-display text-[calc(21px*var(--ws-fs))] leading-[1.4] font-medium text-balance text-primary">
					<Txt text={text} />
				</blockquote>
				{(author || source) && (
					<figcaption className={T.label}>
						{author && <span className="font-semibold text-primary">{author}</span>}
						{author && source && <span aria-hidden> · </span>}
						{source && <cite className="not-italic">{source}</cite>}
					</figcaption>
				)}
			</figure>
		</Frame>
	);
}

export function CalcWidget({ data, title, live }: Props<R>) {
	const steps = arr(data.steps);
	const [open, setOpen] = useState(false);
	return (
		<Frame title={title || "Calculation"} icon={<Calculator />} action={<CopyBtn text={str(data.result)} label="Copy result" icon />} live={live}>
			<div className="flex flex-col items-end gap-1 text-right">
				<span className="max-w-full overflow-x-auto font-mono text-[calc(14px*var(--ws-fs))] text-muted">
					<Txt text={data.expression} />
				</span>
				<span className={clsx(T.hero, "max-w-full overflow-x-auto text-[calc(40px*var(--ws-fs))]")}>
					<span className="text-muted">=</span> <Txt text={data.result} />
				</span>
			</div>
			{steps.length > 0 && (
				<div className="mt-2 border-hairline border-t">
					<More open={open} onClick={() => setOpen((o) => !o)}>
						{open ? "Hide working" : "Show working"}
					</More>
					<AnimatePresence initial={false}>
						{open && (
							<motion.ol key="w" {...collapse} className="flex flex-col gap-2 overflow-hidden">
								{steps.map((st, i) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: steps in order
									<li key={i} className={clsx(T.body, "flex gap-3 text-muted")}>
										<span className="w-4 shrink-0 tabular-nums">{i + 1}</span>
										<span className="min-w-0">
											<Txt text={st} />
										</span>
									</li>
								))}
							</motion.ol>
						)}
					</AnimatePresence>
				</div>
			)}
		</Frame>
	);
}

export function ConvertWidget({ data, title, live }: Props<R>) {
	const [flip, setFlip] = useState(false);
	const a = rec(flip ? data.to : data.from);
	const b = rec(flip ? data.from : data.to);
	const value = (x: R) => (num(x.value) !== null ? fmt(num(x.value) as number, 6) : "?");
	return (
		<Frame title={title || "Conversion"} icon={<ArrowsDownUp />} live={live}>
			<div className="relative flex flex-col">
				<AnimatePresence mode="wait" initial={false}>
					<motion.div key={flip ? "b" : "a"} {...swap} className="flex flex-col">
						<div className="flex flex-col gap-0.5 pb-4">
							<span className={T.label}>{str(a.unit)}</span>
							<span className="font-display text-[calc(22px*var(--ws-fs))] leading-tight font-semibold text-muted tabular-nums">{value(a)}</span>
						</div>
						<div className="flex flex-col gap-0.5 border-hairline border-t pt-4">
							<span className={T.label}>{str(b.unit)}</span>
							<span className={T.hero}>{value(b)}</span>
						</div>
					</motion.div>
				</AnimatePresence>
				{/* The swap sits on the rule between the two, where the conversion turns. */}
				<div className="absolute top-[calc(50%-24px)] right-0">
					<Btn label="Swap" icon onClick={() => setFlip((f) => !f)}>
						<ArrowsDownUp weight="bold" />
					</Btn>
				</div>
			</div>
			{str(data.note) && (
				<p className={clsx(T.label, "mt-4")}>
					<Txt text={data.note} />
				</p>
			)}
		</Frame>
	);
}

export function TranslationWidget({ data, title, live }: Props<R>) {
	const text = str(data.text);
	return (
		<Frame title={title || "Translation"} icon={<Translate />} live={live}>
			<div className="flex flex-col gap-1.5">
				<span className={T.label}>{str(data.from)}</span>
				<p className={clsx(T.body, "text-muted")}>{str(data.source)}</p>
			</div>
			<div className="mt-4 flex flex-col gap-1.5 border-hairline border-t pt-4">
				<span className="font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-gold">{str(data.to)}</span>
				<p className="font-display text-[calc(22px*var(--ws-fs))] leading-snug font-semibold text-primary">{text}</p>
				{str(data.pronunciation) && <p className={clsx(T.label, "italic")}>{str(data.pronunciation)}</p>}
			</div>
			<div className="mt-4 flex gap-2">
				<CopyBtn text={text} />
				<Btn label="Listen" onClick={() => say(text)}>
					<SpeakerHigh /> Listen
				</Btn>
			</div>
		</Frame>
	);
}

export function CodeWidget({ data, title, live }: Props<R>) {
	const code = str(data.code);
	const lines = code.split("\n");
	const lang = str(data.language);
	return (
		<Frame
			title={title || str(data.filename) || lang || "Code"}
			icon={<Code />}
			action={
				<>
					{lang && (title || str(data.filename)) && <Tag>{lang}</Tag>}
					<CopyBtn text={code} label="Copy code" icon />
				</>
			}
			live={live}
			flush
		>
			<div className="mx-2 mb-2 overflow-x-auto rounded-[13px] bg-[var(--vivid-well)]">
				<pre className="flex min-w-fit py-3.5 font-mono text-[calc(13px*var(--ws-fs))] leading-[1.7]">
					<span aria-hidden className="select-none pr-4 pl-4 text-right text-muted/70 tabular-nums">
						{lines.map((_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: line numbers
							<span key={i} className="block">
								{i + 1}
							</span>
						))}
					</span>
					<code className="pr-5 text-primary">{code}</code>
				</pre>
			</div>
		</Frame>
	);
}
