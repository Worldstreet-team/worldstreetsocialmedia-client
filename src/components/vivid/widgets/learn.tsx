"use client";

import clsx from "clsx";
import {
	ArrowsDownUp,
	ArrowLeft,
	ArrowRight,
	ArrowsClockwise,
	BookOpenText,
	Calculator,
	CardsThree,
	CheckCircle,
	Code,
	Exam,
	Function as FunctionIcon,
	ListNumbers,
	Quotes,
	SpeakerHigh,
	Sparkle,
	Translate,
	XCircle,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { DUR, EASE, EASE_OUT_EXPO, snappySpring, swap } from "@/lib/motion-presets";
import { arr, body, CopyPill, Display, fmt, Frame, label, num, Pill, type Props, rec, small, str, Txt } from "./parts";

/* Learning and words: steps, formula, definition, glossary, quiz,
   flashcards, tldr, quote, calc, convert, translation, code. */

type R = Record<string, unknown>;

export function StepsWidget({ data, title }: Props<R>) {
	const steps = arr<R>(data.steps);
	const result = str(data.result);
	return (
		<Frame title={title || "Step by step"} icon={<ListNumbers />}>
			<ol className="flex flex-col">
				{steps.map((s, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: steps are ordered and never reorder
					<li key={i} className="relative flex gap-3 pb-4 last:pb-0">
						{i < steps.length - 1 && <span aria-hidden className="absolute top-7 bottom-1 left-[13px] w-px bg-hairline" />}
						<span className="flex size-[27px] shrink-0 items-center justify-center rounded-full bg-primary/5 font-sans text-[12px] font-semibold text-primary tabular-nums">
							{i + 1}
						</span>
						<div className="flex min-w-0 flex-1 flex-col gap-1 pt-[3px]">
							<p className={label}>
								<Txt text={s.title} />
							</p>
							{str(s.body) && (
								<p className={small}>
									<Txt text={s.body} />
								</p>
							)}
							{str(s.tex) && <Display tex={s.tex} className="-mx-1 rounded-[10px] bg-primary/[0.03] px-3 py-1.5" />}
						</div>
					</li>
				))}
			</ol>
			{result && (
				<div className="mt-4 flex items-start gap-2.5 rounded-[13px] bg-brand/10 px-3.5 py-3">
					<CheckCircle weight="fill" className="mt-0.5 size-[18px] shrink-0 text-gold" />
					<p className={clsx(body, "font-medium")}>
						<Txt text={result} />
					</p>
				</div>
			)}
		</Frame>
	);
}

export function FormulaWidget({ data, title }: Props<R>) {
	const where = arr<R>(data.where);
	return (
		<Frame title={title || str(data.label) || "Formula"} icon={<FunctionIcon />} action={<CopyPill text={str(data.tex)} label="TeX" />}>
			<Display tex={data.tex} className="flex justify-center rounded-[13px] bg-primary/[0.03] px-3 py-4 text-[calc(20px*var(--ws-fs))]" />
			{where.length > 0 && (
				<dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
					{where.map((w, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: a legend in order
						<div key={i} className="contents">
							<dt className="text-primary">
								<Txt text={/[\\^_{]/.test(str(w.sym)) && !/\\\(/.test(str(w.sym)) ? `\\(${str(w.sym)}\\)` : w.sym} />
							</dt>
							<dd className={small}>
								<Txt text={w.meaning} />
							</dd>
						</div>
					))}
				</dl>
			)}
		</Frame>
	);
}

export function DefinitionWidget({ data, title }: Props<R>) {
	const senses = arr<R>(data.senses);
	const syn = arr<string>(data.synonyms).map(str).filter(Boolean);
	const say = () => {
		if (!("speechSynthesis" in window)) return;
		window.speechSynthesis.cancel();
		window.speechSynthesis.speak(new SpeechSynthesisUtterance(str(data.term)));
	};
	return (
		<Frame title={title} icon={title ? <BookOpenText /> : undefined}>
			<div className="flex items-end gap-3">
				<div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-1">
					<span className="font-display text-[calc(26px*var(--ws-fs))] leading-tight font-semibold text-primary">{str(data.term)}</span>
					{str(data.phonetic) && <span className="font-sans text-[calc(14px*var(--ws-fs))] text-muted">{str(data.phonetic)}</span>}
					{str(data.pos) && <span className="font-sans text-[calc(13px*var(--ws-fs))] text-subtle italic">{str(data.pos)}</span>}
				</div>
				<Pill label="Say it" onClick={say}>
					<SpeakerHigh />
				</Pill>
			</div>
			<ol className="mt-3 flex flex-col gap-3 border-t border-hairline pt-3">
				{senses.map((s, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: senses in order
					<li key={i} className="flex gap-3">
						{senses.length > 1 && <span className="w-4 shrink-0 font-sans text-[13px] text-subtle tabular-nums">{i + 1}</span>}
						<div className="flex min-w-0 flex-col gap-1">
							<p className={body}>
								<Txt text={s.meaning} />
							</p>
							{str(s.example) && (
								<p className={clsx(small, "italic")}>
									“<Txt text={s.example} />”
								</p>
							)}
						</div>
					</li>
				))}
			</ol>
			{syn.length > 0 && (
				<div className="mt-3 flex flex-wrap gap-1.5">
					{syn.map((w) => (
						<span key={w} className="rounded-pill bg-primary/5 px-2.5 py-1 font-sans text-[calc(13px*var(--ws-fs))] text-muted">
							{w}
						</span>
					))}
				</div>
			)}
		</Frame>
	);
}

export function GlossaryWidget({ data, title }: Props<R>) {
	const terms = arr<R>(data.terms);
	return (
		<Frame title={title || "Glossary"} icon={<BookOpenText />} flush>
			<dl className="divide-y divide-hairline">
				{terms.map((t, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: terms in order
					<div key={i} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:gap-4">
						<dt className={clsx(label, "sm:w-[32%] sm:shrink-0")}>
							<Txt text={t.term} />
						</dt>
						<dd className={small}>
							<Txt text={t.meaning} />
						</dd>
					</div>
				))}
			</dl>
		</Frame>
	);
}

export function QuizWidget({ data, title }: Props<R>) {
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
				<span className="font-sans text-[13px] text-muted tabular-nums">
					{done ? `${score} of ${qs.length}` : `${at + 1} / ${qs.length}`}
				</span>
			}
		>
			<div className="mb-3 flex gap-1">
				{qs.map((_, i) => {
					const p = picks[i];
					const right = p !== null && p === num(qs[i]?.answer);
					return (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: one dot per question
							key={i}
							className={clsx(
								"h-1 flex-1 rounded-pill transition-colors",
								p === null ? (i === at ? "bg-primary/25" : "bg-primary/10") : right ? "bg-credit" : "bg-debit",
							)}
						/>
					);
				})}
			</div>
			<AnimatePresence mode="wait" initial={false}>
				{done ? (
					<motion.div key="done" {...swap} className="flex flex-col items-center gap-3 py-4 text-center">
						<span className="font-display text-[calc(34px*var(--ws-fs))] font-semibold text-primary tabular-nums">
							{score}/{qs.length}
						</span>
						<p className={small}>
							{score === qs.length ? "Every one right." : score >= qs.length / 2 ? "Good going. Review the misses?" : "Worth another go."}
						</p>
						<Pill
							label="Try again"
							onClick={() => {
								setPicks(qs.map(() => null));
								setAt(0);
							}}
						>
							<ArrowsClockwise /> Try again
						</Pill>
					</motion.div>
				) : (
					q && (
						<motion.div key={at} {...swap} className="flex flex-col gap-2.5">
							<p className={clsx(body, "font-medium")}>
								<Txt text={q.q} />
							</p>
							<div className="flex flex-col gap-1.5">
								{arr(q.options).map((o, i) => {
									const chosen = pick === i;
									const right = pick !== null && i === answer;
									const wrong = chosen && i !== answer;
									return (
										<button
											// biome-ignore lint/suspicious/noArrayIndexKey: options in order
											key={i}
											type="button"
											disabled={pick !== null}
											onClick={() => setPicks((p) => p.map((x, j) => (j === at ? i : x)))}
											className={clsx(
												"flex min-h-[44px] items-center gap-3 rounded-[13px] px-3.5 py-2.5 text-left font-sans text-[calc(14px*var(--ws-fs))] transition-colors",
												right
													? "bg-credit/12 text-primary ring-1 ring-credit/40"
													: wrong
														? "bg-debit/12 text-primary ring-1 ring-debit/40"
														: pick === null
															? "cursor-pointer bg-primary/5 text-primary hover:bg-primary/10"
															: "bg-primary/[0.03] text-muted",
											)}
										>
											<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/5 font-sans text-[12px] font-semibold text-muted">
												{right ? (
													<CheckCircle weight="fill" className="size-6 text-credit" />
												) : wrong ? (
													<XCircle weight="fill" className="size-6 text-debit" />
												) : (
													String.fromCharCode(65 + i)
												)}
											</span>
											<span className="min-w-0 flex-1">
												<Txt text={o} />
											</span>
										</button>
									);
								})}
							</div>
							{pick !== null && (
								<motion.div
									initial={{ opacity: 0, y: 4 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: DUR.base, ease: EASE }}
									className="flex flex-col gap-2.5"
								>
									{str(q.explain) && (
										<p className={clsx(small, "rounded-[13px] bg-primary/[0.03] px-3.5 py-2.5")}>
											<Txt text={q.explain} />
										</p>
									)}
									<div className="flex justify-end">
										<Pill label={at === qs.length - 1 ? "See score" : "Next question"} onClick={() => setAt((a) => a + 1)} active>
											{at === qs.length - 1 ? "See score" : "Next"} <ArrowRight />
										</Pill>
									</div>
								</motion.div>
							)}
						</motion.div>
					)
				)}
			</AnimatePresence>
		</Frame>
	);
}

export function FlashcardsWidget({ data, title }: Props<R>) {
	const cards = arr<R>(data.cards);
	const [at, setAt] = useState(0);
	const [flipped, setFlipped] = useState(false);
	const [dir, setDir] = useState(1);
	const go = (d: number) => {
		const next = (at + d + cards.length) % cards.length;
		setDir(d);
		setFlipped(false);
		setAt(next);
	};
	const c = cards[at];
	if (!c) return null;
	return (
		<Frame
			title={title || "Flashcards"}
			icon={<CardsThree />}
			action={
				<span className="font-sans text-[13px] text-muted tabular-nums">
					{at + 1} / {cards.length}
				</span>
			}
		>
			<div className="[perspective:1200px]">
				<AnimatePresence mode="popLayout" initial={false} custom={dir}>
					<motion.button
						key={at}
						type="button"
						custom={dir}
						variants={{
							enter: (d: number) => ({ x: d * 40, opacity: 0 }),
							center: { x: 0, opacity: 1 },
							exit: (d: number) => ({ x: d * -40, opacity: 0, transition: { duration: DUR.fast } }),
						}}
						initial="enter"
						animate="center"
						exit="exit"
						transition={{ duration: DUR.slow, ease: EASE_OUT_EXPO }}
						drag="x"
						dragConstraints={{ left: 0, right: 0 }}
						dragElastic={0.4}
						onDragEnd={(_, i) => {
							if (Math.abs(i.offset.x) > 60 && cards.length > 1) go(i.offset.x < 0 ? 1 : -1);
						}}
						onClick={() => setFlipped((f) => !f)}
						aria-label={flipped ? "Show the front" : "Show the answer"}
						className="relative block h-[180px] w-full cursor-pointer touch-pan-y"
					>
						<motion.div
							animate={{ rotateY: flipped ? 180 : 0 }}
							transition={snappySpring}
							className="relative h-full w-full [transform-style:preserve-3d]"
						>
							<Face side="front" text={c.front} />
							<Face side="back" text={c.back} />
						</motion.div>
					</motion.button>
				</AnimatePresence>
			</div>
			<div className="mt-3 flex items-center justify-between">
				<Pill label="Previous card" onClick={() => go(-1)}>
					<ArrowLeft />
				</Pill>
				<span className="font-sans text-[13px] text-subtle">Tap to flip</span>
				<Pill label="Next card" onClick={() => go(1)}>
					<ArrowRight />
				</Pill>
			</div>
		</Frame>
	);
}

function Face({ side, text }: { side: "front" | "back"; text: unknown }) {
	return (
		<div
			className={clsx(
				"absolute inset-0 flex items-center justify-center overflow-y-auto rounded-[13px] px-5 py-4 text-center [backface-visibility:hidden]",
				side === "front" ? "bg-primary/5" : "bg-brand/10 [transform:rotateY(180deg)]",
			)}
		>
			<p
				className={clsx(
					"font-sans leading-relaxed text-primary",
					side === "front" ? "text-[calc(17px*var(--ws-fs))] font-semibold" : "text-[calc(15px*var(--ws-fs))]",
				)}
			>
				<Txt text={text} />
			</p>
		</div>
	);
}

export function TldrWidget({ data, title }: Props<R>) {
	const points = arr(data.points);
	return (
		<Frame title={title || "In short"} icon={<Sparkle />}>
			<p className={clsx(body, "font-medium")}>
				<Txt text={data.summary} />
			</p>
			{points.length > 0 && (
				<ul className="mt-3 flex flex-col gap-2 border-t border-hairline pt-3">
					{points.map((p, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: points in order
						<li key={i} className="flex gap-2.5">
							<span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-brand" />
							<span className={clsx(body, "text-muted")}>
								<Txt text={p} />
							</span>
						</li>
					))}
				</ul>
			)}
		</Frame>
	);
}

export function QuoteWidget({ data, title }: Props<R>) {
	const who = [str(data.author), str(data.source)].filter(Boolean);
	return (
		<Frame title={title}>
			<figure className="flex gap-3">
				<Quotes weight="fill" className="mt-0.5 size-6 shrink-0 text-gold" />
				<div className="flex min-w-0 flex-col gap-2">
					<blockquote className="font-display text-[calc(18px*var(--ws-fs))] leading-snug font-medium text-primary">
						<Txt text={data.text} />
					</blockquote>
					{who.length > 0 && (
						<figcaption className={small}>
							{str(data.author) && <span className="font-medium text-primary">{str(data.author)}</span>}
							{str(data.author) && str(data.source) && ", "}
							{str(data.source) && <cite className="not-italic">{str(data.source)}</cite>}
						</figcaption>
					)}
				</div>
			</figure>
		</Frame>
	);
}

export function CalcWidget({ data, title }: Props<R>) {
	const steps = arr(data.steps);
	const [open, setOpen] = useState(false);
	return (
		<Frame title={title || "Calculation"} icon={<Calculator />} action={<CopyPill text={str(data.result)} />}>
			<div className="flex flex-col items-end gap-1 rounded-[13px] bg-primary/[0.03] px-4 py-3.5 text-right">
				<span className="max-w-full overflow-x-auto font-mono text-[calc(14px*var(--ws-fs))] text-muted">
					<Txt text={data.expression} />
				</span>
				<span className="max-w-full overflow-x-auto font-display text-[calc(30px*var(--ws-fs))] leading-tight font-semibold text-primary tabular-nums">
					= <Txt text={data.result} />
				</span>
			</div>
			{steps.length > 0 && (
				<>
					<button
						type="button"
						onClick={() => setOpen((o) => !o)}
						aria-expanded={open}
						className="mt-2 cursor-pointer font-sans text-[13px] font-medium text-muted hover:text-primary"
					>
						{open ? "Hide working" : "Show working"}
					</button>
					{open && (
						<ol className="mt-2 flex flex-col gap-1.5">
							{steps.map((s, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: steps in order
								<li key={i} className={clsx(small, "flex gap-2.5")}>
									<span className="w-4 shrink-0 text-subtle tabular-nums">{i + 1}</span>
									<span className="min-w-0">
										<Txt text={s} />
									</span>
								</li>
							))}
						</ol>
					)}
				</>
			)}
		</Frame>
	);
}

export function ConvertWidget({ data, title }: Props<R>) {
	const [flip, setFlip] = useState(false);
	const a = rec(flip ? data.to : data.from);
	const b = rec(flip ? data.from : data.to);
	const Side = ({ s, big }: { s: R; big?: boolean }) => (
		<div className="flex min-w-0 flex-col">
			<span
				className={clsx(
					"truncate font-display leading-tight font-semibold text-primary tabular-nums",
					big ? "text-[calc(28px*var(--ws-fs))]" : "text-[calc(20px*var(--ws-fs))] text-muted",
				)}
			>
				{num(s.value) !== null ? fmt(num(s.value) as number, 6) : "?"}
			</span>
			<span className={small}>{str(s.unit)}</span>
		</div>
	);
	return (
		<Frame title={title || "Conversion"} icon={<ArrowsDownUp />}>
			<div className="flex items-center gap-3">
				<div className="flex min-w-0 flex-1 flex-col gap-3">
					<AnimatePresence mode="wait" initial={false}>
						<motion.div key={flip ? "b" : "a"} {...swap} className="flex flex-col gap-3">
							<Side s={a} />
							<span aria-hidden className="h-px bg-hairline" />
							<Side s={b} big />
						</motion.div>
					</AnimatePresence>
				</div>
				<Pill label="Swap" onClick={() => setFlip((f) => !f)}>
					<ArrowsDownUp />
				</Pill>
			</div>
			{str(data.note) && (
				<p className={clsx(small, "mt-3")}>
					<Txt text={data.note} />
				</p>
			)}
		</Frame>
	);
}

export function TranslationWidget({ data, title }: Props<R>) {
	const say = () => {
		if (!("speechSynthesis" in window)) return;
		window.speechSynthesis.cancel();
		window.speechSynthesis.speak(new SpeechSynthesisUtterance(str(data.text)));
	};
	return (
		<Frame title={title || "Translation"} icon={<Translate />}>
			<div className="flex flex-col gap-1">
				<span className="font-sans text-[12.5px] font-medium text-subtle">{str(data.from)}</span>
				<p className={clsx(body, "text-muted")}>{str(data.source)}</p>
			</div>
			<div className="mt-3 flex flex-col gap-1 border-t border-hairline pt-3">
				<span className="font-sans text-[12.5px] font-medium text-gold">{str(data.to)}</span>
				<p className="font-sans text-[calc(18px*var(--ws-fs))] leading-snug font-medium text-primary">{str(data.text)}</p>
				{str(data.pronunciation) && <p className={clsx(small, "italic")}>{str(data.pronunciation)}</p>}
			</div>
			<div className="mt-3 flex gap-2">
				<CopyPill text={str(data.text)} />
				<Pill label="Read aloud" onClick={say}>
					<SpeakerHigh /> Listen
				</Pill>
			</div>
		</Frame>
	);
}

export function CodeWidget({ data, title }: Props<R>) {
	const code = str(data.code);
	const lines = code.split("\n");
	return (
		<Frame
			title={title || str(data.filename) || str(data.language) || "Code"}
			icon={<Code />}
			action={<CopyPill text={code} />}
			flush
		>
			<div className="mt-1 overflow-x-auto border-t border-hairline bg-primary/[0.03]">
				<pre className="flex min-w-fit py-3 font-mono text-[calc(12.5px*var(--ws-fs))] leading-[1.65]">
					<span aria-hidden className="select-none px-3 text-right text-subtle tabular-nums">
						{lines.map((_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: line numbers
							<span key={i} className="block">
								{i + 1}
							</span>
						))}
					</span>
					<code className="pr-4 text-primary">{code}</code>
				</pre>
			</div>
			{str(data.language) && (title || str(data.filename)) && (
				<p className="px-4 py-2 font-sans text-[12.5px] text-subtle">{str(data.language)}</p>
			)}
		</Frame>
	);
}
