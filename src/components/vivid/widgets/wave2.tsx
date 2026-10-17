"use client";

import clsx from "clsx";
import {
	ArrowRight,
	ArrowSquareOut,
	ArrowsClockwise,
	Bell,
	CalendarPlus,
	ChatCircleText,
	Check,
	DownloadSimple,
	FileText,
	Hash,
	Key,
	Lightbulb,
	Pause,
	PencilLine,
	Play,
	Question,
	ShieldCheck,
	ShieldWarning,
	Sparkle,
	Timer,
	Warning,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { EASE_OUT_EXPO, collapse, swap } from "@/lib/motion-presets";
import { More } from "./learn";
import {
	arr,
	Btn,
	CopyBtn,
	Display,
	Frame,
	num,
	type Props,
	rec,
	str,
	T,
	Tag,
	Txt,
	useActions,
	useAsk,
	useStill,
	well,
} from "./parts";

/* Wave 2, no live data (docs/vivid-widgets.md 7.2): reply-ideas, rewrite,
   clarify, answer-hero, knowledge-panel, practice-problem, scam-check,
   secret-warning, doc-summary, caption-options, timer, reminder. graph-plot
   and diagram are in plot.tsx. */

type R = Record<string, unknown>;

/** Post length, counted the way a person sees letters (grapheme clusters). */
const POST_LIMIT = 280;
function graphemes(s: string) {
	try {
		return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)].length;
	} catch {
		return [...s].length;
	}
}

/* ---- words ---- */

export function ReplyIdeasWidget({ data, title, live }: Props<R>) {
	const { insert } = useActions();
	const replies = arr<R>(data.replies);
	const context = str(data.context);
	return (
		<Frame title={title || "Reply ideas"} icon={<ChatCircleText />} live={live}>
			{context && (
				<p className={clsx(T.body, "mb-4 border-hairline border-l-2 pl-3 text-muted")}>
					<Txt text={context} />
				</p>
			)}
			<ul className="flex flex-col items-end gap-2.5">
				{replies.map((r, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: replies in order
					<li key={i} className="flex max-w-[88%] flex-col items-end gap-1">
						{str(r.tone) && <span className={clsx(T.label, "pr-1")}>{str(r.tone)}</span>}
						<button
							type="button"
							onClick={() => insert(str(r.text))}
							className={clsx(
								T.body,
								"cursor-pointer rounded-[18px] rounded-br-[6px] bg-[var(--vivid-well-press)] px-4 py-2.5 text-left transition-colors hover:bg-[var(--vivid-brand-wash)]",
							)}
						>
							{str(r.text)}
						</button>
					</li>
				))}
			</ul>
			<p className={clsx(T.label, "mt-3 text-right")}>Tap one to put it in your reply</p>
		</Frame>
	);
}

export function RewriteWidget({ data, title, live }: Props<R>) {
	const { insert } = useActions();
	const variants = arr<R>(data.variants);
	const original = str(data.original);
	const [at, setAt] = useState(0);
	const [showOriginal, setShowOriginal] = useState(false);
	const v = variants[at];
	if (!v) return null;
	const text = str(v.text);
	return (
		<Frame title={title || "Rewrite"} icon={<PencilLine />} live={live}>
			{variants.length > 1 && (
				<div role="tablist" aria-label="Versions" className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
					{variants.map((x, i) => (
						<button
							// biome-ignore lint/suspicious/noArrayIndexKey: versions in order
							key={i}
							type="button"
							role="tab"
							aria-selected={at === i}
							onClick={() => setAt(i)}
							className={clsx(
								"relative h-10 shrink-0 cursor-pointer rounded-pill px-4 font-sans text-[calc(13.5px*var(--ws-fs))] font-medium whitespace-nowrap transition-colors",
								at === i ? "text-primary" : "text-muted hover:text-primary",
							)}
						>
							{at === i && <motion.span layoutId={`rw-${variants.length}-${str(variants[0]?.label)}`} className="absolute inset-0 rounded-pill bg-[var(--vivid-well-press)]" />}
							<span className="relative">{str(x.label) || `Version ${i + 1}`}</span>
						</button>
					))}
				</div>
			)}
			<AnimatePresence mode="wait" initial={false}>
				<motion.p key={at} {...swap} role="tabpanel" className={clsx(well, T.body, "px-4 py-3.5 whitespace-pre-wrap")}>
					{text}
				</motion.p>
			</AnimatePresence>
			{original && (
				<div className="mt-1">
					<More open={showOriginal} onClick={() => setShowOriginal((o) => !o)}>
						{showOriginal ? "Hide original" : "Compare with the original"}
					</More>
					<AnimatePresence initial={false}>
						{showOriginal && (
							<motion.p key="o" {...collapse} className={clsx(T.body, "overflow-hidden border-hairline border-l-2 pl-3 whitespace-pre-wrap text-muted")}>
								{original}
							</motion.p>
						)}
					</AnimatePresence>
				</div>
			)}
			<div className="mt-4 flex gap-2">
				<Btn label="Use this" tone="primary" onClick={() => insert(text)}>
					<Check weight="bold" /> Use this
				</Btn>
				<CopyBtn text={text} />
			</div>
		</Frame>
	);
}

export function ClarifyWidget({ data, title, live }: Props<R>) {
	const send = useAsk();
	const qs = arr<R>(data.questions);
	const [picks, setPicks] = useState<string[][]>(() => qs.map(() => []));
	const [sent, setSent] = useState(false);
	const any = picks.some((p) => p.length > 0);
	const toggle = (qi: number, o: string, multi: boolean) =>
		setPicks((all) =>
			all.map((p, i) => (i !== qi ? p : multi ? (p.includes(o) ? p.filter((x) => x !== o) : [...p, o]) : p[0] === o ? [] : [o])),
		);
	const go = () => {
		if (!send || !any) return;
		const lines = qs.map((q, i) => (picks[i].length ? `${str(q.q)}: ${picks[i].join(", ")}` : null)).filter(Boolean);
		setSent(true);
		send(lines.join("\n"));
	};
	return (
		<Frame title={title || "A few questions first"} icon={<Question />} live={live}>
			{str(data.prompt) && (
				<p className={clsx(T.body, "mb-4 text-muted")}>
					<Txt text={data.prompt} />
				</p>
			)}
			<div className="flex flex-col gap-5">
				{qs.map((q, qi) => {
					const multi = q.multi === true;
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: questions in order
						<fieldset key={qi} disabled={sent} className="flex flex-col gap-2.5">
							<legend className={clsx(T.strong, "mb-2.5")}>
								<Txt text={q.q} />
								{multi && <span className={clsx(T.label, "ml-2 font-normal")}>Pick any</span>}
							</legend>
							<div role={multi ? "group" : "radiogroup"} className="flex flex-wrap gap-2">
								{arr(q.options)
									.map(str)
									.map((o) => {
										const on = picks[qi]?.includes(o);
										return (
											<button
												key={o}
												type="button"
												role={multi ? "checkbox" : "radio"}
												aria-checked={on}
												onClick={() => toggle(qi, o, multi)}
												className={clsx(
													"inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-pill px-4 font-sans text-[calc(14px*var(--ws-fs))] transition-colors disabled:cursor-default",
													on
														? "bg-[var(--vivid-brand-wash)] font-medium text-primary ring-[1.5px] ring-brand ring-inset"
														: "bg-[var(--vivid-well)] text-primary hover:bg-[var(--vivid-well-press)]",
												)}
											>
												{on && <Check weight="bold" className="size-3.5 text-gold" />}
												{o}
											</button>
										);
									})}
							</div>
						</fieldset>
					);
				})}
			</div>
			<div className="mt-5 flex items-center justify-end gap-3">
				{sent && <span className={T.label}>Sent</span>}
				<Btn label="Continue" tone="primary" disabled={!any || sent || !send} onClick={go}>
					Continue <ArrowRight weight="bold" />
				</Btn>
			</div>
		</Frame>
	);
}

export function AnswerHeroWidget({ data, title, live }: Props<R>) {
	return (
		<Frame title={title || "Answer"} icon={<Sparkle />} live={live}>
			<div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
				<span className="font-display text-[calc(44px*var(--ws-fs))] leading-[1.05] font-semibold tracking-[-0.015em] text-balance text-primary tabular-nums">
					<Txt text={data.answer} />
				</span>
				{str(data.unit) && <span className="font-display text-[calc(20px*var(--ws-fs))] font-medium text-muted">{str(data.unit)}</span>}
			</div>
			{str(data.context) && (
				<p className={clsx(T.body, "mt-2 text-muted")}>
					<Txt text={data.context} />
				</p>
			)}
			{str(data.source) && (
				<div className="mt-3">
					<Tag>{str(data.source)}</Tag>
				</div>
			)}
		</Frame>
	);
}

export function KnowledgePanelWidget({ data, title, live }: Props<R>) {
	const ask = useAsk();
	const facts = Object.entries(rec(data.facts));
	const links = arr<R>(data.links).filter((l) => /^https?:\/\//.test(str(l.url)));
	const [open, setOpen] = useState(false);
	const name = str(data.name);
	const summary = str(data.summary);
	const image = str(data.image);
	return (
		<Frame title={title || "About"} icon={<Sparkle />} live={live}>
			<div className="flex items-center gap-4">
				{/^https?:\/\//.test(image) ? (
					// biome-ignore lint/performance/noImgElement: a remote picture the model chose; no Next loader for arbitrary hosts
					<img src={image} alt="" className="size-16 shrink-0 rounded-[13px] bg-[var(--vivid-well)] object-cover" />
				) : (
					<span className="flex size-16 shrink-0 items-center justify-center rounded-[13px] bg-[var(--vivid-well-press)] font-display text-[24px] font-semibold text-primary">
						{name.slice(0, 1).toUpperCase()}
					</span>
				)}
				<div className="flex min-w-0 flex-col gap-0.5">
					<span className={T.display}>{name}</span>
					{str(data.kind) && <span className={T.label}>{str(data.kind)}</span>}
				</div>
			</div>
			{summary && (
				<div className="mt-4">
					<p className={clsx(T.body, !open && "line-clamp-2")}>
						<Txt text={summary} />
					</p>
					{summary.length > 140 && (
						<More open={open} onClick={() => setOpen((o) => !o)}>
							{open ? "Less" : "More"}
						</More>
					)}
				</div>
			)}
			{facts.length > 0 && (
				<dl className="mt-3 flex flex-col">
					{facts.map(([k, v]) => (
						<div key={k} className="flex gap-4 border-hairline border-t py-3">
							<dt className={clsx(T.label, "w-[36%] shrink-0 pt-px")}>{k}</dt>
							<dd className={clsx(T.body, "min-w-0")}>
								<Txt text={v} />
							</dd>
						</div>
					))}
				</dl>
			)}
			{(links.length > 0 || ask) && (
				<div className="mt-4 flex flex-wrap gap-2">
					{links.map((l, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: links in order
						<Btn key={i} label={str(l.label)} href={str(l.url)}>
							{str(l.label)} <ArrowSquareOut />
						</Btn>
					))}
				</div>
			)}
		</Frame>
	);
}

export function PracticeProblemWidget({ data, title, live }: Props<R>) {
	const steps = arr<R>(data.steps);
	const [hint, setHint] = useState(false);
	const [answer, setAnswer] = useState(false);
	const [shown, setShown] = useState(0);
	return (
		<Frame title={title || "Practice problem"} icon={<Lightbulb />} live={live}>
			<p className={clsx(T.strong, "text-[calc(16.5px*var(--ws-fs))] leading-[1.5]")}>
				<Txt text={data.question} />
			</p>
			<AnimatePresence initial={false}>
				{hint && str(data.hint) && (
					<motion.div key="h" {...collapse} className="overflow-hidden">
						<p className={clsx(well, T.body, "mt-4 flex gap-2.5 px-4 py-3")}>
							<Lightbulb weight="fill" className="mt-[3px] size-4 shrink-0 text-gold" />
							<span className="min-w-0">
								<Txt text={data.hint} />
							</span>
						</p>
					</motion.div>
				)}
				{answer && (
					<motion.div key="a" {...collapse} className="overflow-hidden">
						<div className="mt-4 flex items-start gap-3 rounded-[13px] bg-[var(--vivid-brand-wash)] px-4 py-3.5">
							<span className="mt-[3px] flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-brand-on">
								<Check weight="bold" className="size-3" />
							</span>
							<p className={clsx(T.strong, "min-w-0")}>
								<Txt text={data.answer} />
							</p>
						</div>
						{steps.length > 0 && (
							<ol className="mt-4 flex flex-col gap-4">
								{steps.slice(0, shown).map((st, i) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: steps in order
									<motion.li key={i} {...swap} className="flex gap-3.5">
										<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--vivid-well)] font-sans text-[12.5px] font-semibold text-primary tabular-nums">
											{i + 1}
										</span>
										<div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-[3px]">
											<p className={T.strong}>
												<Txt text={st.title} />
											</p>
											{str(st.tex) && <Display tex={st.tex} className={clsx(well, "px-4 py-2")} />}
										</div>
									</motion.li>
								))}
							</ol>
						)}
					</motion.div>
				)}
			</AnimatePresence>
			<div className="mt-4 flex flex-wrap gap-2">
				{!answer && str(data.hint) && (
					<Btn label="Hint" onClick={() => setHint(true)} disabled={hint}>
						<Lightbulb /> Hint
					</Btn>
				)}
				{!answer ? (
					<Btn label="Show answer" tone="primary" onClick={() => setAnswer(true)}>
						Show answer
					</Btn>
				) : (
					shown < steps.length && (
						<Btn label="Next step" onClick={() => setShown((n) => n + 1)}>
							{shown === 0 ? "Show the working" : "Next step"} <ArrowRight weight="bold" />
						</Btn>
					)
				)}
			</div>
		</Frame>
	);
}

/* ---- safety ---- */

const WEIGHT_DOT: Record<string, string> = { high: "bg-danger", medium: "bg-warning", low: "bg-primary/35" };

export function ScamCheckWidget({ data, title, live }: Props<R>) {
	const verdict = str(data.verdict);
	const signs = arr<R>(data.signs);
	const advice = arr(data.advice).map(str).filter(Boolean);
	const band =
		verdict === "scam"
			? { cls: "bg-[var(--vivid-danger-wash)] text-danger", icon: <ShieldWarning weight="fill" />, word: "This looks like a scam" }
			: verdict === "suspicious"
				? { cls: "bg-[var(--vivid-warning-wash)] text-warning", icon: <Warning weight="fill" />, word: "Be careful with this" }
				: { cls: "bg-[var(--vivid-well)] text-primary", icon: <ShieldCheck />, word: "No warning signs found" };
	return (
		<Frame title={title || "Scam check"} icon={<ShieldWarning />} live={live}>
			<div className={clsx("flex items-center gap-3 rounded-[13px] px-4 py-3.5 [&>svg]:size-6 [&>svg]:shrink-0", band.cls)}>
				{band.icon}
				<span className="font-display text-[calc(18px*var(--ws-fs))] leading-snug font-semibold">{band.word}</span>
			</div>
			{str(data.summary) && (
				<p className={clsx(T.body, "mt-4")}>
					<Txt text={data.summary} />
				</p>
			)}
			{signs.length > 0 && (
				<>
					<h4 className={clsx(T.head, "mt-5 mb-1")}>What gave it away</h4>
					<ul className="flex flex-col">
						{signs.map((sg, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: signs in order
							<li key={i} className={clsx(T.body, "flex gap-3 border-hairline border-t py-2.5 first:border-t-0")}>
								<span
									aria-label={`${str(sg.weight) || "low"} weight`}
									className={clsx("mt-[8px] size-2 shrink-0 rounded-full", WEIGHT_DOT[str(sg.weight)] ?? WEIGHT_DOT.low)}
								/>
								<span className="min-w-0">
									<Txt text={sg.text} />
								</span>
							</li>
						))}
					</ul>
				</>
			)}
			{advice.length > 0 && <Advice items={advice} />}
		</Frame>
	);
}

function Advice({ items, title = "What to do now" }: { items: string[]; title?: string }) {
	return (
		<>
			<h4 className={clsx(T.head, "mt-5 mb-3")}>{title}</h4>
			<ol className="flex flex-col gap-3">
				{items.map((a, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: advice in order
					<li key={i} className="flex gap-3">
						<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--vivid-well)] font-sans text-[12px] font-semibold text-primary tabular-nums">
							{i + 1}
						</span>
						<span className={clsx(T.body, "min-w-0 pt-px")}>
							<Txt text={a} />
						</span>
					</li>
				))}
			</ol>
		</>
	);
}

const SECRET: Record<string, string> = {
	"seed-phrase": "a recovery phrase",
	"private-key": "a private key",
	password: "a password",
	card: "a card number",
	bank: "bank details",
	"api-key": "an API key",
	other: "something secret",
};

export function SecretWarningWidget({ data, title, live }: Props<R>) {
	const what = SECRET[str(data.kind)] ?? SECRET.other;
	const advice = arr(data.advice).map(str).filter(Boolean);
	return (
		<Frame title={title || "Keep this private"} icon={<Key />} live={live}>
			<div className="flex items-start gap-3 rounded-[13px] bg-[var(--vivid-danger-wash)] px-4 py-3.5 text-danger">
				<ShieldWarning weight="fill" className="mt-0.5 size-6 shrink-0" />
				<div className="flex min-w-0 flex-col gap-1">
					<span className="font-display text-[calc(18px*var(--ws-fs))] leading-snug font-semibold">That looks like {what}</span>
					<span className={clsx(T.body, "text-primary")}>Anyone who has it can use it. Never share it, not even with Vivid or WorldSpace staff.</span>
				</div>
			</div>
			{str(data.why) && (
				<p className={clsx(T.body, "mt-4")}>
					<Txt text={data.why} />
				</p>
			)}
			{advice.length > 0 && <Advice items={advice} />}
		</Frame>
	);
}

/* ---- documents and posts ---- */

export function DocSummaryWidget({ data, title, live }: Props<R>) {
	const points = arr(data.points);
	const quotes = arr<R>(data.quotes);
	const pages = num(data.pages);
	return (
		<Frame title={title || "Summary"} icon={<FileText />} live={live}>
			<div className={clsx(well, "flex items-center gap-3 px-3 py-2.5")}>
				<span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--vivid-well-press)] text-muted">
					<FileText className="size-5" />
				</span>
				<div className="flex min-w-0 flex-col">
					<span className={clsx(T.strong, "truncate")}>{str(data.title)}</span>
					{pages !== null && <span className={T.label}>{pages === 1 ? "1 page" : `${pages} pages`}</span>}
				</div>
			</div>
			<p className={clsx(T.body, "mt-4")}>
				<Txt text={data.summary} />
			</p>
			{points.length > 0 && (
				<>
					<h4 className={clsx(T.head, "mt-5 mb-2")}>Key points</h4>
					<ul className="flex flex-col gap-2.5">
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
				</>
			)}
			{quotes.length > 0 && (
				<>
					<h4 className={clsx(T.head, "mt-5 mb-2")}>In its own words</h4>
					<ul className="flex flex-col gap-3">
						{quotes.map((q, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: quotes in order
							<li key={i} className="flex flex-col gap-1.5 border-brand border-l-[3px] pl-3">
								<p className={clsx(T.body, "italic")}>
									<Txt text={q.text} />
								</p>
								{num(q.page) !== null && <span className={T.label}>Page {num(q.page)}</span>}
							</li>
						))}
					</ul>
				</>
			)}
		</Frame>
	);
}

export function CaptionOptionsWidget({ data, title, live }: Props<R>) {
	const { insertPost } = useActions();
	const options = arr<R>(data.options);
	const tags = arr(data.hashtags).map(str).filter(Boolean);
	const [chosen, setChosen] = useState<Set<string>>(() => new Set());
	const suffix = [...chosen].join(" ");
	const full = (t: string) => (suffix ? `${t}\n\n${suffix}` : t);
	return (
		<Frame title={title || "Captions"} icon={<PencilLine />} live={live} flush>
			<ul className="flex flex-col px-4 sm:px-5">
				{options.map((o, i) => {
					const text = str(o.text);
					const n = graphemes(full(text));
					const over = n > POST_LIMIT;
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: options in order
						<li key={i} className="flex flex-col gap-2 border-hairline border-t py-3.5 first:border-t-0 first:pt-1">
							{str(o.tone) && <span className={T.label}>{str(o.tone)}</span>}
							<p className={clsx(T.body, "whitespace-pre-wrap")}>{text}</p>
							<div className="flex items-center justify-between gap-3">
								<span className={clsx("font-sans text-[calc(13px*var(--ws-fs))] tabular-nums", over ? "font-semibold text-danger" : "text-muted")}>
									{n} / {POST_LIMIT}
									{over && " · too long for a post"}
								</span>
								<Btn label="Use this caption" tone="quiet" onClick={() => insertPost(full(text))}>
									Use
								</Btn>
							</div>
						</li>
					);
				})}
			</ul>
			{tags.length > 0 && (
				<div className="flex flex-col gap-2 border-hairline border-t px-4 pt-3.5 pb-4 sm:px-5 sm:pb-5">
					<span className={T.label}>Add hashtags</span>
					<div className="flex flex-wrap gap-2">
						{tags.map((t) => {
							const on = chosen.has(t);
							return (
								<button
									key={t}
									type="button"
									aria-pressed={on}
									onClick={() =>
										setChosen((c) => {
											const n = new Set(c);
											n.has(t) ? n.delete(t) : n.add(t);
											return n;
										})
									}
									className={clsx(
										"inline-flex min-h-[36px] cursor-pointer items-center gap-1 rounded-pill px-3 font-sans text-[calc(13.5px*var(--ws-fs))] transition-colors",
										on
											? "bg-[var(--vivid-brand-wash)] font-medium text-primary ring-[1.5px] ring-brand ring-inset"
											: "bg-[var(--vivid-well)] text-primary hover:bg-[var(--vivid-well-press)]",
									)}
								>
									{on ? <Check weight="bold" className="size-3.5 text-gold" /> : <Hash className="size-3.5 text-muted" />}
									{t.replace(/^#/, "")}
								</button>
							);
						})}
					</div>
				</div>
			)}
		</Frame>
	);
}

/* ---- time ---- */

function clock(s: number) {
	const h = Math.floor(s / 3600);
	const m = Math.floor(s / 60) % 60;
	const sec = s % 60;
	const two = (n: number) => String(n).padStart(2, "0");
	return h ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}

/** Three soft beeps from Web Audio: nothing to download, and only while the page is open. */
function chime() {
	try {
		const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		const ctx = new Ctx();
		[0, 0.32, 0.64].forEach((t) => {
			const o = ctx.createOscillator();
			const g = ctx.createGain();
			o.frequency.value = 880;
			g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
			g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + t + 0.02);
			g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25);
			o.connect(g).connect(ctx.destination);
			o.start(ctx.currentTime + t);
			o.stop(ctx.currentTime + t + 0.28);
		});
		setTimeout(() => void ctx.close(), 1400);
	} catch {
		/* no audio */
	}
}

export function TimerWidget({ data, title, live }: Props<R>) {
	const total = Math.min(Math.max(Math.round(num(data.seconds) ?? 60), 1), 86400);
	const [budget, setBudget] = useState(total);
	const [left, setLeft] = useState(total);
	// Starts by itself only in the turn that drew it; from history it waits for Start.
	const [running, setRunning] = useState(!!live);
	const endAt = useRef<number | null>(live ? Date.now() + total * 1000 : null);
	const still = useStill(live);
	// biome-ignore lint/correctness/useExhaustiveDependencies: the clock restarts on start and pause only
	useEffect(() => {
		if (!running) return;
		if (endAt.current === null) endAt.current = Date.now() + left * 1000;
		const t = setInterval(() => {
			const l = Math.max(0, Math.ceil(((endAt.current as number) - Date.now()) / 1000));
			setLeft(l);
			if (l === 0) {
				setRunning(false);
				endAt.current = null;
				chime();
			}
		}, 250);
		return () => clearInterval(t);
	}, [running]);
	const pause = () => {
		setRunning(false);
		endAt.current = null;
	};
	const add = () => {
		setLeft((l) => l + 60);
		setBudget((b) => b + 60);
		if (endAt.current !== null) endAt.current += 60_000;
	};
	const reset = () => {
		setRunning(false);
		endAt.current = null;
		setLeft(total);
		setBudget(total);
	};
	const r = 64;
	const c = 2 * Math.PI * r;
	const f = budget ? left / budget : 0;
	const done = left === 0;
	return (
		<Frame title={title || str(data.label) || "Timer"} icon={<Timer />} live={live}>
			<div className="flex flex-col items-center gap-4">
				<div className="relative size-[156px]">
					<svg viewBox="0 0 156 156" className="size-full -rotate-90" aria-hidden>
						<circle cx={78} cy={78} r={r} fill="none" stroke="var(--vivid-track)" strokeWidth={8} />
						<motion.circle
							cx={78}
							cy={78}
							r={r}
							fill="none"
							stroke="var(--ws-brand-primary)"
							strokeWidth={8}
							strokeLinecap="round"
							strokeDasharray={c}
							animate={{ strokeDashoffset: c * (1 - f) }}
							transition={still ? { duration: 0 } : { duration: 0.3, ease: EASE_OUT_EXPO }}
						/>
					</svg>
					<div className="absolute inset-0 flex flex-col items-center justify-center" role="timer" aria-live="off">
						<span className="font-display text-[calc(34px*var(--ws-fs))] leading-none font-semibold text-primary tabular-nums">
							{done ? "Done" : clock(left)}
						</span>
						{str(data.label) && title && <span className={clsx(T.label, "mt-1 max-w-[110px] truncate")}>{str(data.label)}</span>}
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Btn label="Reset" tone="ghost" icon onClick={reset}>
						<ArrowsClockwise />
					</Btn>
					{running ? (
						<Btn label="Pause" tone="primary" onClick={pause}>
							<Pause weight="fill" /> Pause
						</Btn>
					) : (
						<Btn label={done ? "Start again" : left < budget ? "Resume" : "Start"} tone="primary" onClick={() => (done ? (reset(), setRunning(true)) : setRunning(true))}>
							<Play weight="fill" /> {done ? "Again" : left < budget ? "Resume" : "Start"}
						</Btn>
					)}
					<Btn label="Add a minute" onClick={add}>
						+1 min
					</Btn>
				</div>
			</div>
		</Frame>
	);
}

const calStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (v: string) => v.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
const RRULE: Record<string, string> = { daily: "FREQ=DAILY", weekly: "FREQ=WEEKLY", monthly: "FREQ=MONTHLY" };

/**
 * A reminder. A web page cannot promise to ring later (the tab may be shut),
 * so the web hands it to the person's calendar, which can (7.1 schedule:
 * "offer Add to calendar instead"). The app schedules it on the device.
 */
export function ReminderWidget({ data, title, live }: Props<R>) {
	const text = str(data.text);
	const at = useMemo(() => new Date(str(data.at)), [data.at]);
	const repeat = str(data.repeat);
	if (Number.isNaN(at.getTime())) return null;
	const end = new Date(at.getTime() + 15 * 60_000);
	const rule = RRULE[repeat];
	const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(text)}&dates=${calStamp(at)}/${calStamp(end)}${
		rule ? `&recur=${encodeURIComponent(`RRULE:${rule}`)}` : ""
	}`;
	const saveIcs = () => {
		const ics = [
			"BEGIN:VCALENDAR",
			"VERSION:2.0",
			"PRODID:-//WorldSpace//Vivid//EN",
			"BEGIN:VEVENT",
			`UID:${calStamp(at)}-reminder@worldspace`,
			`DTSTAMP:${calStamp(new Date())}`,
			`DTSTART:${calStamp(at)}`,
			`DTEND:${calStamp(end)}`,
			`SUMMARY:${icsText(text)}`,
			rule && `RRULE:${rule}`,
			"BEGIN:VALARM",
			"ACTION:DISPLAY",
			`DESCRIPTION:${icsText(text)}`,
			"TRIGGER:PT0M",
			"END:VALARM",
			"END:VEVENT",
			"END:VCALENDAR",
		]
			.filter(Boolean)
			.join("\r\n");
		const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
		const a = document.createElement("a");
		a.href = url;
		a.download = "reminder.ics";
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	};
	return (
		<Frame title={title || "Reminder"} icon={<Bell />} live={live}>
			<p className={T.display}>{text}</p>
			<div className={clsx(well, "mt-4 flex flex-col gap-0.5 px-4 py-3")}>
				<span className={clsx(T.strong, "tabular-nums")}>
					{at.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })},{" "}
					{at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
				</span>
				<span className={T.label}>
					{repeat ? `Every ${repeat === "daily" ? "day" : repeat === "weekly" ? "week" : "month"} · ` : ""}
					Your time, {Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ")}
				</span>
			</div>
			<p className={clsx(T.label, "mt-3")}>Your calendar will remind you, even with this page closed.</p>
			<div className="mt-3 flex flex-wrap gap-2">
				<Btn label="Add to Google Calendar" href={google} tone="primary">
					<CalendarPlus /> Add to calendar
				</Btn>
				<Btn label="Download .ics" onClick={saveIcs}>
					<DownloadSimple /> .ics file
				</Btn>
			</div>
		</Frame>
	);
}
