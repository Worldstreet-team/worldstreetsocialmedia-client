"use client";

import clsx from "clsx";
import { Check, Copy } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import { TeX, VividInline } from "@/components/vivid/VividMarkdown";

/*
 * The pieces every Vivid widget is built from (gateway docs/vivid-widgets.md).
 * A widget is one solid card on the surface step with a quiet header; depth
 * inside it comes from hairlines and the rest wash, never a second card.
 * Data arrives cleaned by the gateway's validators, but every reader here
 * still defends: an old client meeting a newer shape must draw less, never
 * throw inside an answer.
 */

/** The card itself; the same shape as the window's other cards. */
export const box = "overflow-hidden rounded-[18px] bg-surface ring-1 ring-primary/[0.06]";

/** Body copy inside a widget. */
export const body = "font-sans text-[calc(14px*var(--ws-fs))] leading-relaxed text-primary";
export const small = "font-sans text-[calc(13px*var(--ws-fs))] leading-snug text-muted";
export const label = "font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary";

export type Props<T> = { data: T; title?: string; live?: boolean };

/** A widget's card with its header: the title, a bare glyph, an action at the right. */
export function Frame({
	title,
	icon,
	action,
	children,
	className,
	flush,
}: {
	title?: string;
	icon?: ReactNode;
	action?: ReactNode;
	children: ReactNode;
	className?: string;
	/** Children run to the card's edges (tables, lists with their own rows). */
	flush?: boolean;
}) {
	const head = title || icon || action;
	return (
		<section className={clsx(box, className)}>
			{head && (
				<header className="flex min-h-[44px] items-center gap-2 px-4 pt-3">
					{icon && <span className="flex shrink-0 text-muted [&>svg]:size-[calc(17px*var(--ws-fs))]">{icon}</span>}
					{title && (
						<h3 className={clsx(label, "min-w-0 flex-1 truncate")}>
							<Txt text={title} />
						</h3>
					)}
					{!title && <span className="flex-1" />}
					{action}
				</header>
			)}
			<div className={clsx(!flush && "px-4 pb-4", head ? "pt-2" : !flush && "pt-4")}>{children}</div>
		</section>
	);
}

/** A string with maths, bold and links in it; plain text otherwise. */
export function Txt({ text }: { text: unknown }) {
	const s = str(text);
	if (!s) return null;
	return /[\\*_`[$]/.test(s) ? <VividInline text={s} /> : <>{s}</>;
}

/** A bare TeX field (the gateway strips any fences), set as display maths. */
export function Display({ tex, className }: { tex: unknown; className?: string }) {
	const t = str(tex);
	if (!t) return null;
	return (
		<div className={clsx("overflow-x-auto text-[calc(17px*var(--ws-fs))]", className)}>
			<TeX tex={t} display />
		</div>
	);
}

/** A small round action in a widget's header or foot. */
export function Pill({
	children,
	onClick,
	label: name,
	href,
	active,
}: {
	children: ReactNode;
	onClick?: () => void;
	label: string;
	href?: string;
	active?: boolean;
}) {
	const cls = clsx(
		"inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-pill px-3 font-sans no-underline text-[calc(13px*var(--ws-fs))] font-medium transition-colors [&>svg]:size-[15px]",
		active ? "bg-primary/10 text-primary" : "bg-primary/5 text-muted hover:bg-primary/10 hover:text-primary",
	);
	if (href)
		return (
			<a href={href} target="_blank" rel="noopener noreferrer" aria-label={name} className={cls}>
				{children}
			</a>
		);
	return (
		<button type="button" onClick={onClick} aria-label={name} className={cls}>
			{children}
		</button>
	);
}

/** Copy to the clipboard, with the tick for a beat. */
export function CopyPill({ text, label: name = "Copy" }: { text: string; label?: string }) {
	const [done, setDone] = useState(false);
	return (
		<Pill
			label={done ? "Copied" : name}
			onClick={() => {
				void navigator.clipboard?.writeText(text).catch(() => {});
				setDone(true);
				setTimeout(() => setDone(false), 1400);
			}}
		>
			{done ? <Check weight="bold" /> : <Copy />}
			{done ? "Copied" : name}
		</Pill>
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
export function arr<T = unknown>(v: unknown): T[] {
	return Array.isArray(v) ? (v as T[]) : [];
}
export function rec(v: unknown): Record<string, unknown> {
	return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** 1234.5 → "1,234.5"; keeps up to `digits` decimals and drops trailing zeros. */
export function fmt(n: number, digits = 2) {
	return n.toLocaleString(undefined, { maximumFractionDigits: digits });
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
 * The steps of a ramp in the brand colour, for slices and series: one hue,
 * stepped toward the surface, so a chart never invents a colour the palette
 * does not have and follows the palette and the mode.
 */
export function ramp(i: number, n: number) {
	if (n <= 1) return "var(--ws-brand-primary)";
	const pct = Math.round(100 - (i / n) * 72);
	return `color-mix(in srgb, var(--ws-brand-primary) ${pct}%, var(--ws-bg-surface))`;
}

/** Series colours for lines and grouped bars: brand, then ink, then the money pair. */
export const SERIES = [
	"var(--ws-brand-primary)",
	"color-mix(in srgb, var(--ws-text-primary) 70%, transparent)",
	"var(--ws-money-convert)",
	"var(--ws-money-debit)",
];
