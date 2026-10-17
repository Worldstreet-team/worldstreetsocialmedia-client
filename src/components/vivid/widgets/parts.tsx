"use client";

import clsx from "clsx";
import { Check, Copy } from "@phosphor-icons/react";
import { motion, useReducedMotionConfig } from "framer-motion";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { TeX, VividInline } from "@/components/vivid/VividMarkdown";
import { staggerItem } from "@/lib/motion-presets";
import s from "./widgets.module.css";

/*
 * The kit every Vivid widget is built from (gateway docs/vivid-widgets.md for
 * the data, docs/vivid-widgets-design.md for the look). One family:
 *
 *  - the shell: a wash card at 20, padded 16 on a phone and 20 from sm, a
 *    header of a bare glyph and a 14px title, then the body 12px under it;
 *  - three sizes of type: one display figure (Poppins), 15px body, 13px
 *    labels in sentence case, every changing number tabular;
 *  - wells (13) step up from the card, hairlines separate rows, space
 *    separates groups;
 *  - one accent, the brand token; credit and debit only for up and down.
 *
 * Data arrives cleaned by the gateway's validators, but every reader here
 * still defends: an old client meeting a newer shape draws less, never
 * throws inside an answer.
 */

export type Props<T> = { data: T; title?: string; live?: boolean };

/* ---- asking from inside a widget ---- */

/**
 * "Widgets can ask too": a synonym, a term or a related item sends a scoped
 * question. Null when asking is not possible (an old answer, Vivid busy),
 * and then those parts render as plain text.
 */
export const AskContext = createContext<((q: string) => void) | null>(null);
export const useAsk = () => useContext(AskContext);

/**
 * What wave-2 widgets do when tapped (docs/vivid-widgets.md 7.1). `insert`
 * puts text into the composer Vivid was opened over, or copies it; it never
 * sends. `insertPost` opens the post composer filled in. Null outside an
 * answer (a preview), and the buttons then copy.
 */
export type PayDraft = { profileId: string; handle: string; amountMinor: number; note: string };
export type WidgetActions = {
	insert: (text: string) => void;
	insertPost: (text: string) => void;
	/** 8.1 pay: open the real Send sheet in the chat with this person, filled in. Never sends. */
	pay?: (draft: PayDraft) => void;
};

/**
 * Citations (8.2 sources): which numbers this answer's sources widget holds,
 * a way for `[n]` in the prose to ask for one, and the latest ask, which the
 * widget answers by opening that chip.
 */
export type CiteState = { has: Set<number>; ask: (n: number) => void; asked: { n: number; at: number } | null };
export const CiteContext = createContext<CiteState | null>(null);
export const ActionsContext = createContext<WidgetActions | null>(null);
export function useActions(): WidgetActions {
	const a = useContext(ActionsContext);
	return (
		a ?? {
			insert: (t) => void navigator.clipboard?.writeText(t).catch(() => {}),
			insertPost: (t) => void navigator.clipboard?.writeText(t).catch(() => {}),
		}
	);
}

/** Whether to skip drawing in: reduced motion (both triggers) or an answer loaded from history. */
export function useStill(live?: boolean) {
	const reduce = useReducedMotionConfig();
	return !live || !!reduce;
}

/* ---- type ---- */

export const T = {
	/** The one figure a widget answers with. */
	hero: "font-display text-[calc(34px*var(--ws-fs))] leading-[1.1] font-semibold tracking-[-0.01em] text-primary tabular-nums",
	/** A big name or term. */
	display: "font-display text-[calc(22px*var(--ws-fs))] leading-tight font-semibold text-primary",
	/** A number in a tile. */
	figure: "font-display text-[calc(24px*var(--ws-fs))] leading-tight font-semibold text-primary tabular-nums",
	body: "font-sans text-[calc(15px*var(--ws-fs))] leading-[1.55] text-primary",
	strong: "font-sans text-[calc(15px*var(--ws-fs))] leading-snug font-semibold text-primary",
	label: "font-sans text-[calc(13px*var(--ws-fs))] leading-snug text-muted",
	/** A label that leads a row or names a section. */
	head: "font-sans text-[calc(13px*var(--ws-fs))] leading-snug font-semibold text-primary",
} as const;

/** A well inside the card. */
export const well = "rounded-[13px] bg-[var(--vivid-well)]";

/* ---- the shell ---- */

/** A widget's card: the header (bare glyph, title, actions), then its body. */
export function Frame({
	title,
	icon,
	action,
	children,
	flush,
	live,
	label: name,
}: {
	title?: ReactNode;
	icon?: ReactNode;
	action?: ReactNode;
	children: ReactNode;
	/** The body runs to the card's edges (tables, rows with their own padding). */
	flush?: boolean;
	live?: boolean;
	/** An accessible name when the title is not text. */
	label?: string;
}) {
	const still = useStill(live);
	const head = title || icon || action;
	return (
		<motion.section
			aria-label={name ?? (typeof title === "string" ? title : undefined)}
			className={clsx(s.root, "overflow-hidden")}
			variants={staggerItem}
			initial={still ? false : "hidden"}
			animate="show"
		>
			{head && (
				<header className="flex min-h-[40px] items-center gap-2.5 pt-2.5 pr-2.5 pl-4 sm:pl-5">
					{icon && <span className="flex shrink-0 text-muted [&>svg]:size-[calc(18px*var(--ws-fs))]">{icon}</span>}
					<h3 className="min-w-0 flex-1 truncate font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary">
						{typeof title === "string" ? <Txt text={title} /> : title}
					</h3>
					{action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
				</header>
			)}
			<div className={clsx(flush ? (head ? "pt-2" : "") : clsx("px-4 pb-4 sm:px-5 sm:pb-5", head ? "pt-2" : "pt-4 sm:pt-5"))}>{children}</div>
		</motion.section>
	);
}

/* ---- text ---- */

/** A string with maths, bold and links in it; plain text otherwise. */
export function Txt({ text }: { text: unknown }) {
	const v = str(text);
	if (!v) return null;
	return /[\\*_`[$]/.test(v) ? <VividInline text={v} /> : <>{v}</>;
}

/** A bare TeX field (the gateway strips any fences), set as display maths. */
export function Display({ tex, className }: { tex: unknown; className?: string }) {
	const t = str(tex);
	if (!t) return null;
	return (
		<div className={clsx("overflow-x-auto overflow-y-hidden text-[calc(17px*var(--ws-fs))] text-primary", className)}>
			<TeX tex={t} display />
		</div>
	);
}

/* ---- controls ---- */

const btnBase =
	"inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-pill font-sans text-[calc(13.5px*var(--ws-fs))] font-medium no-underline transition-colors disabled:cursor-default disabled:opacity-40 [&>svg]:size-[17px]";

/**
 * A button in a widget. `primary` is the one brand action a widget may have;
 * `quiet` sits on the wash; `ghost` is an icon in the header. All are 40px.
 */
export function Btn({
	children,
	onClick,
	label: name,
	href,
	tone = "quiet",
	icon,
	disabled,
	pressed,
}: {
	children?: ReactNode;
	onClick?: () => void;
	label: string;
	href?: string;
	tone?: "primary" | "quiet" | "ghost";
	/** Icon only: a 40px circle. */
	icon?: boolean;
	disabled?: boolean;
	pressed?: boolean;
}) {
	const cls = clsx(
		btnBase,
		icon ? "w-10" : "px-4",
		tone === "primary" && "bg-brand text-brand-on hover:bg-brand-active",
		tone === "quiet" && "bg-[var(--vivid-well)] text-primary hover:bg-[var(--vivid-well-press)] active:bg-[var(--vivid-well-press)]",
		tone === "ghost" && "text-muted hover:bg-[var(--vivid-well)] hover:text-primary active:bg-[var(--vivid-well-press)]",
	);
	if (href)
		return (
			<a href={href} target="_blank" rel="noopener noreferrer" aria-label={icon ? name : undefined} title={icon ? name : undefined} className={cls}>
				{children}
			</a>
		);
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label={icon ? name : undefined}
			aria-pressed={pressed}
			title={icon ? name : undefined}
			className={cls}
		>
			{children}
		</button>
	);
}

/** Copy to the clipboard, with the tick for a beat. Icon-only in a header. */
export function CopyBtn({ text, label: name = "Copy", icon }: { text: string; label?: string; icon?: boolean }) {
	const [done, setDone] = useState(false);
	const t = useRef<ReturnType<typeof setTimeout>>(undefined);
	useEffect(() => () => clearTimeout(t.current), []);
	return (
		<Btn
			label={done ? "Copied" : name}
			tone={icon ? "ghost" : "quiet"}
			icon={icon}
			onClick={() => {
				void navigator.clipboard?.writeText(text).catch(() => {});
				setDone(true);
				clearTimeout(t.current);
				t.current = setTimeout(() => setDone(false), 1400);
			}}
		>
			{done ? <Check weight="bold" className="text-primary" /> : <Copy />}
			{!icon && (done ? "Copied" : name)}
		</Btn>
	);
}

/** A small word in a pill: a part of speech, a language, a unit. */
export function Tag({ children, tone }: { children: ReactNode; tone?: "brand" }) {
	return (
		<span
			className={clsx(
				"inline-flex h-6 shrink-0 items-center rounded-pill px-2.5 font-sans text-[calc(12.5px*var(--ws-fs))] font-medium",
				tone === "brand" ? "bg-[var(--vivid-brand-wash)] text-gold" : "bg-[var(--vivid-well)] text-muted",
			)}
		>
			{children}
		</span>
	);
}

/** A term that asks about itself when tapped, plain text when asking is off. */
export function AskChip({ text, q }: { text: string; q: string }) {
	const ask = useAsk();
	const cls =
		"inline-flex min-h-[32px] items-center rounded-pill bg-[var(--vivid-well)] px-3 font-sans text-[calc(13.5px*var(--ws-fs))] text-primary";
	if (!ask) return <span className={cls}>{text}</span>;
	return (
		<button type="button" onClick={() => ask(q)} className={clsx(cls, "cursor-pointer transition-colors hover:bg-[var(--vivid-well-press)]")}>
			{text}
		</button>
	);
}

/** Up or down: a signed change in credit or debit ink on its wash. */
export function Delta({ value, suffix = "%", digits = 2 }: { value: number; suffix?: string; digits?: number }) {
	const up = value > 0;
	const flat = value === 0;
	return (
		<span
			className={clsx(
				"inline-flex h-6 items-center gap-0.5 rounded-pill px-2 font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold tabular-nums",
				flat ? "bg-[var(--vivid-well)] text-muted" : up ? "bg-[var(--vivid-credit-wash)] text-credit" : "bg-[var(--vivid-debit-wash)] text-debit",
			)}
		>
			{flat ? "" : up ? "+" : "−"}
			{fmt(Math.abs(value), digits)}
			{suffix}
		</span>
	);
}

/* ---- readers: the shape is validated upstream, these only keep a bad row from throwing ---- */

export function str(v: unknown): string {
	return typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
}
export function num(v: unknown): number | null {
	const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : Number.NaN;
	return Number.isFinite(n) ? n : null;
}
export function arr<X = unknown>(v: unknown): X[] {
	return Array.isArray(v) ? (v as X[]) : [];
}
export function rec(v: unknown): Record<string, unknown> {
	return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** 1234.5 → "1,234.5"; keeps up to `digits` decimals and drops trailing zeros. */
export function fmt(n: number, digits = 2) {
	return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

/** A short figure for an axis: 1.2K, 3.4M. */
export function short(n: number) {
	const a = Math.abs(n);
	if (a >= 1e9) return `${fmt(n / 1e9, 1)}B`;
	if (a >= 1e6) return `${fmt(n / 1e6, 1)}M`;
	if (a >= 1e4) return `${fmt(n / 1e3, 1)}K`;
	return fmt(n, a < 10 ? 2 : 1);
}

/** An amount in a currency when it is a real ISO code, a plain number otherwise. */
export function money(n: number, currency?: string) {
	if (currency && /^[A-Z]{3}$/.test(currency)) {
		try {
			return n.toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 2 });
		} catch {
			/* an unknown code */
		}
	}
	return currency ? `${currency}${fmt(n)}` : fmt(n);
}

/**
 * Slices of a pie: the brand hue at falling strength, so a chart never
 * invents a colour the palette does not have, and follows palette and mode.
 */
export function ramp(i: number, n: number) {
	if (n <= 1) return "var(--ws-brand-primary)";
	const pct = Math.round(100 - (i / (n - 1)) * 70);
	return `color-mix(in srgb, var(--ws-brand-primary) ${pct}%, transparent)`;
}

/**
 * Series in a line or bar chart: brand, then ink, then each at half strength
 * (the line chart also dashes series 3 and 4, so they never rely on colour).
 * Never a status colour: credit and debit mean up and down.
 */
export const SERIES = [
	"var(--ws-brand-primary)",
	"color-mix(in srgb, var(--ws-text-primary) 72%, transparent)",
	"color-mix(in srgb, var(--ws-brand-primary) 50%, transparent)",
	"color-mix(in srgb, var(--ws-text-primary) 38%, transparent)",
];

/** Whether a strip has scrolled to its end, for the fade on its far edge. */
export function useStripEnd<E extends HTMLElement>() {
	const ref = useRef<E>(null);
	const [end, setEnd] = useState(true);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const check = () => setEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
		check();
		el.addEventListener("scroll", check, { passive: true });
		const ro = new ResizeObserver(check);
		ro.observe(el);
		return () => {
			el.removeEventListener("scroll", check);
			ro.disconnect();
		};
	}, []);
	return [ref, end, s.edge] as const;
}

export { s as css };
