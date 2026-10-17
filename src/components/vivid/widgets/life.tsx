"use client";

import clsx from "clsx";
import {
	CalendarBlank,
	CalendarPlus,
	Check,
	Clock,
	ClockCountdown,
	CookingPot,
	DownloadSimple,
	Globe,
	ListChecks,
	MapPin,
	Minus,
	Path,
	Phone,
	Plus,
	Star,
	User,
	Users,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { DUR, EASE } from "@/lib/motion-presets";
import { arr, body, fmt, Frame, label, num, Pill, type Props, rec, small, str, Txt } from "./parts";

/* Plans and places: timeline, checklist, recipe, itinerary, place, event,
   person, countdown. */

type R = Record<string, unknown>;

export function TimelineWidget({ data, title }: Props<R>) {
	const events = arr<R>(data.events);
	return (
		<Frame title={title || "Timeline"} icon={<Path />}>
			<ol className="flex flex-col">
				{events.map((e, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: events in order
					<li key={i} className="relative flex gap-3.5 pb-4 last:pb-0">
						{i < events.length - 1 && <span aria-hidden className="absolute top-4 bottom-0 left-[5px] w-px bg-hairline" />}
						<span
							aria-hidden
							className={clsx("relative mt-[5px] size-[11px] shrink-0 rounded-full ring-[3px] ring-surface", i === events.length - 1 ? "bg-brand" : "bg-primary/30")}
						/>
						<div className="flex min-w-0 flex-col gap-0.5">
							<span className="font-sans text-[12.5px] font-semibold text-gold tabular-nums">{str(e.date)}</span>
							<span className={label}>
								<Txt text={e.title} />
							</span>
							{str(e.body) && (
								<span className={small}>
									<Txt text={e.body} />
								</span>
							)}
						</div>
					</li>
				))}
			</ol>
		</Frame>
	);
}

export function ChecklistWidget({ data, title }: Props<R>) {
	const items = arr<R>(data.items);
	const [done, setDone] = useState<boolean[]>(() => items.map((it) => it.done === true));
	const count = done.filter(Boolean).length;
	return (
		<Frame
			title={title || "Checklist"}
			icon={<ListChecks />}
			action={
				<span className="font-sans text-[13px] text-muted tabular-nums">
					{count}/{items.length}
				</span>
			}
			flush
		>
			<div className="mx-4 mb-1 h-1 overflow-hidden rounded-pill bg-primary/[0.07]">
				<motion.div
					className="h-full rounded-pill bg-brand"
					animate={{ width: `${items.length ? (count / items.length) * 100 : 0}%` }}
					transition={{ duration: DUR.slow, ease: EASE }}
				/>
			</div>
			<ul className="flex flex-col pb-1.5">
				{items.map((it, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: items in order
					<li key={i}>
						<button
							type="button"
							role="checkbox"
							aria-checked={done[i]}
							onClick={() => setDone((d) => d.map((x, j) => (j === i ? !x : x)))}
							className="flex min-h-[44px] w-full cursor-pointer items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-primary/[0.03]"
						>
							<motion.span
								initial={false}
								animate={{ scale: done[i] ? [1, 0.86, 1] : 1 }}
								transition={{ duration: DUR.base, ease: EASE }}
								className={clsx(
									"mt-px flex size-5 shrink-0 items-center justify-center rounded-[6px] transition-colors",
									done[i] ? "bg-brand text-brand-on" : "ring-[1.5px] ring-primary/25",
								)}
							>
								{done[i] && <Check weight="bold" className="size-3" />}
							</motion.span>
							<span className={clsx(body, "min-w-0 transition-colors", done[i] && "text-subtle line-through decoration-primary/30")}>
								<Txt text={it.text} />
							</span>
						</button>
					</li>
				))}
			</ul>
		</Frame>
	);
}

/** "1 1/2 cups", "½ tsp", "2-3 cloves": the leading amount, scaled; anything else untouched. */
const FRACTIONS: Record<string, number> = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };
const AMOUNT = /^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+|[¼½¾⅓⅔⅛]|\d+[¼½¾⅓⅔⅛])(?:\s*[-–]\s*(\d+(?:\.\d+)?))?/;

function parseAmount(s: string): number {
	let n = 0;
	for (const part of s.trim().split(/\s+/)) {
		const uni = part.match(/^(\d*)([¼½¾⅓⅔⅛])$/);
		if (uni) n += Number(uni[1] || 0) + FRACTIONS[uni[2]];
		else if (part.includes("/")) {
			const [a, b] = part.split("/").map(Number);
			n += b ? a / b : 0;
		} else n += Number(part);
	}
	return n;
}

function niceAmount(n: number) {
	const whole = Math.floor(n);
	const rest = n - whole;
	const frac = [
		[0.125, "⅛"],
		[0.25, "¼"],
		[1 / 3, "⅓"],
		[0.5, "½"],
		[2 / 3, "⅔"],
		[0.75, "¾"],
	].find(([v]) => Math.abs(rest - (v as number)) < 0.04);
	if (rest < 0.04) return String(whole);
	if (rest > 0.96) return String(whole + 1);
	if (frac) return `${whole || ""}${frac[1]}`;
	return fmt(n, 1);
}

function scaleLine(line: string, k: number) {
	if (k === 1) return line;
	const m = line.match(AMOUNT);
	if (!m) return line;
	const a = niceAmount(parseAmount(m[1]) * k);
	const b = m[2] ? `–${niceAmount(Number(m[2]) * k)}` : "";
	return a + b + line.slice(m[0].length);
}

export function RecipeWidget({ data, title }: Props<R>) {
	const base = Number.parseInt(str(data.servings), 10);
	const scalable = Number.isFinite(base) && base > 0;
	const [serves, setServes] = useState(scalable ? base : 0);
	const ingredients = arr(data.ingredients).map(str);
	const steps = arr(data.steps);
	const [got, setGot] = useState<Set<number>>(() => new Set());
	const k = scalable ? serves / base : 1;
	return (
		<Frame title={title || str(data.name) || "Recipe"} icon={<CookingPot />}>
			<div className="flex flex-wrap items-center gap-2">
				{title && str(data.name) && <span className={clsx(label, "mr-auto")}>{str(data.name)}</span>}
				{str(data.time) && (
					<span className="flex items-center gap-1.5 rounded-pill bg-primary/5 px-2.5 py-1 font-sans text-[12.5px] text-muted">
						<Clock className="size-3.5" /> {str(data.time)}
					</span>
				)}
				{scalable ? (
					<span className="flex items-center gap-1 rounded-pill bg-primary/5 p-0.5 font-sans text-[12.5px] text-muted">
						<button
							type="button"
							aria-label="Fewer servings"
							disabled={serves <= 1}
							onClick={() => setServes((s) => Math.max(1, s - 1))}
							className="flex size-7 cursor-pointer items-center justify-center rounded-full hover:bg-primary/10 disabled:opacity-40"
						>
							<Minus className="size-3.5" />
						</button>
						<span className="min-w-[64px] text-center tabular-nums">
							Serves <span className="font-semibold text-primary">{serves}</span>
						</span>
						<button
							type="button"
							aria-label="More servings"
							disabled={serves >= 99}
							onClick={() => setServes((s) => Math.min(99, s + 1))}
							className="flex size-7 cursor-pointer items-center justify-center rounded-full hover:bg-primary/10 disabled:opacity-40"
						>
							<Plus className="size-3.5" />
						</button>
					</span>
				) : (
					str(data.servings) && (
						<span className="flex items-center gap-1.5 rounded-pill bg-primary/5 px-2.5 py-1 font-sans text-[12.5px] text-muted">
							<Users className="size-3.5" /> {str(data.servings)}
						</span>
					)
				)}
			</div>
			<h4 className={clsx(label, "mt-4 mb-1.5")}>Ingredients</h4>
			<ul className="grid gap-x-4 sm:grid-cols-2">
				{ingredients.map((ing, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: ingredients in order
					<li key={i}>
						<button
							type="button"
							onClick={() =>
								setGot((g) => {
									const n = new Set(g);
									n.has(i) ? n.delete(i) : n.add(i);
									return n;
								})
							}
							className={clsx(small, "flex w-full cursor-pointer items-start gap-2.5 py-1.5 text-left text-primary", got.has(i) && "text-subtle line-through")}
						>
							<span
								className={clsx(
									"mt-[3px] flex size-4 shrink-0 items-center justify-center rounded-full transition-colors",
									got.has(i) ? "bg-brand text-brand-on" : "ring-[1.5px] ring-primary/25",
								)}
							>
								{got.has(i) && <Check weight="bold" className="size-2.5" />}
							</span>
							<span className="min-w-0 tabular-nums">{scaleLine(ing, k)}</span>
						</button>
					</li>
				))}
			</ul>
			<h4 className={clsx(label, "mt-4 mb-2")}>Method</h4>
			<ol className="flex flex-col gap-2.5">
				{steps.map((s, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: steps in order
					<li key={i} className="flex gap-3">
						<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/5 font-sans text-[12px] font-semibold text-primary tabular-nums">
							{i + 1}
						</span>
						<p className={clsx(body, "min-w-0 pt-px")}>
							<Txt text={s} />
						</p>
					</li>
				))}
			</ol>
		</Frame>
	);
}

export function ItineraryWidget({ data, title }: Props<R>) {
	const days = arr<R>(data.days);
	const [at, setAt] = useState(0);
	const day = days[at];
	return (
		<Frame title={title || "Itinerary"} icon={<CalendarBlank />}>
			{days.length > 1 && (
				<div role="tablist" className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
					{days.map((d, i) => (
						<button
							// biome-ignore lint/suspicious/noArrayIndexKey: days in order
							key={i}
							type="button"
							role="tab"
							aria-selected={at === i}
							onClick={() => setAt(i)}
							className={clsx(
								"h-8 shrink-0 cursor-pointer rounded-pill px-3 font-sans text-[13px] font-medium whitespace-nowrap transition-colors",
								at === i ? "bg-primary/10 text-primary" : "bg-primary/[0.04] text-muted hover:text-primary",
							)}
						>
							{str(d.label) || `Day ${i + 1}`}
						</button>
					))}
				</div>
			)}
			{day && (
				<motion.ol key={at} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: DUR.base, ease: EASE }} className="flex flex-col">
					{days.length === 1 && <li className={clsx(label, "mb-2")}>{str(day.label)}</li>}
					{arr<R>(day.items).map((it, i, all) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: items in order
						<li key={i} className="relative flex gap-3 pb-3.5 last:pb-0">
							{i < all.length - 1 && <span aria-hidden className="absolute top-5 bottom-0 left-[46px] w-px bg-hairline" />}
							<span className="w-[40px] shrink-0 pt-px text-right font-sans text-[12.5px] text-muted tabular-nums">{str(it.time)}</span>
							<span aria-hidden className="relative mt-[6px] size-[9px] shrink-0 rounded-full bg-brand ring-[3px] ring-surface" />
							<div className="flex min-w-0 flex-col gap-0.5">
								<span className={label}>
									<Txt text={it.title} />
								</span>
								{str(it.note) && (
									<span className={small}>
										<Txt text={it.note} />
									</span>
								)}
							</div>
						</li>
					))}
				</motion.ol>
			)}
		</Frame>
	);
}

export function PlaceWidget({ data, title }: Props<R>) {
	const name = str(data.name);
	const address = str(data.address);
	const rating = num(data.rating);
	const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, address].filter(Boolean).join(", "))}`;
	return (
		<Frame title={title}>
			<div className="flex gap-3">
				<span className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-brand/10 text-gold">
					<MapPin weight="fill" className="size-5" />
				</span>
				<div className="flex min-w-0 flex-col gap-0.5">
					<span className="font-sans text-[calc(16px*var(--ws-fs))] font-semibold text-primary">{name}</span>
					{address && <span className={small}>{address}</span>}
					{rating !== null && (
						<span className="mt-0.5 flex items-center gap-1 font-sans text-[13px] text-muted">
							<Star weight="fill" className="size-3.5 text-gold" />
							<span className="font-medium text-primary tabular-nums">{fmt(rating, 1)}</span>
							{rating <= 5 && <span className="text-subtle">/ 5</span>}
						</span>
					)}
					{str(data.hours) && (
						<span className={clsx(small, "mt-0.5 flex items-center gap-1.5")}>
							<Clock className="size-3.5 shrink-0" /> {str(data.hours)}
						</span>
					)}
				</div>
			</div>
			<div className="mt-3 flex flex-wrap gap-2">
				<Pill label="Open in Maps" href={maps} active>
					<MapPin /> Directions
				</Pill>
				{str(data.phone) && (
					<Pill label={`Call ${str(data.phone)}`} href={`tel:${str(data.phone).replace(/[^\d+]/g, "")}`}>
						<Phone /> {str(data.phone)}
					</Pill>
				)}
				{/^https?:\/\//.test(str(data.url)) && (
					<Pill label="Website" href={str(data.url)}>
						<Globe /> Website
					</Pill>
				)}
			</div>
		</Frame>
	);
}

/** ISO to the compact UTC form calendars take: 20261017T090000Z. */
const calStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s: string) => s.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

export function EventWidget({ data, title }: Props<R>) {
	const start = new Date(str(data.start));
	if (Number.isNaN(start.getTime())) return null;
	const endRaw = new Date(str(data.end));
	const end = Number.isNaN(endRaw.getTime()) ? new Date(start.getTime() + 3_600_000) : endRaw;
	const name = str(data.title);
	const where = str(data.location);
	const note = str(data.note);
	const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(str(data.start));
	const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(name)}&dates=${calStamp(start)}/${calStamp(end)}${
		where ? `&location=${encodeURIComponent(where)}` : ""
	}${note ? `&details=${encodeURIComponent(note)}` : ""}`;
	const saveIcs = () => {
		const ics = [
			"BEGIN:VCALENDAR",
			"VERSION:2.0",
			"PRODID:-//WorldSpace//Vivid//EN",
			"BEGIN:VEVENT",
			`UID:${calStamp(start)}-${Math.abs([...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7))}@worldspace`,
			`DTSTAMP:${calStamp(new Date())}`,
			`DTSTART:${calStamp(start)}`,
			`DTEND:${calStamp(end)}`,
			`SUMMARY:${icsText(name)}`,
			where && `LOCATION:${icsText(where)}`,
			note && `DESCRIPTION:${icsText(note)}`,
			"END:VEVENT",
			"END:VCALENDAR",
		]
			.filter(Boolean)
			.join("\r\n");
		const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
		const a = document.createElement("a");
		a.href = url;
		a.download = `${name.replace(/[^\w\- ]+/g, "").trim() || "event"}.ics`;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	};
	return (
		<Frame title={title}>
			<div className="flex gap-3.5">
				<div className="flex w-[52px] shrink-0 flex-col items-center overflow-hidden rounded-[13px] bg-primary/5">
					<span className="w-full bg-brand py-0.5 text-center font-sans text-[11px] font-semibold text-brand-on uppercase">
						{start.toLocaleDateString(undefined, { month: "short" })}
					</span>
					<span className="py-1 font-display text-[22px] leading-tight font-semibold text-primary tabular-nums">{start.getDate()}</span>
				</div>
				<div className="flex min-w-0 flex-col gap-0.5">
					<span className="font-sans text-[calc(16px*var(--ws-fs))] font-semibold text-primary">{name}</span>
					<span className={clsx(small, "tabular-nums")}>
						{start.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
						{!dateOnly && ` · ${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
						{!dateOnly && str(data.end) && ` to ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
					</span>
					{where && (
						<span className={clsx(small, "flex items-center gap-1")}>
							<MapPin className="size-3.5 shrink-0" /> {where}
						</span>
					)}
					{note && (
						<p className={clsx(small, "mt-1")}>
							<Txt text={note} />
						</p>
					)}
				</div>
			</div>
			<div className="mt-3 flex flex-wrap gap-2">
				<Pill label="Add to Google Calendar" href={google} active>
					<CalendarPlus /> Add to calendar
				</Pill>
				<Pill label="Download .ics" onClick={saveIcs}>
					<DownloadSimple /> .ics
				</Pill>
			</div>
		</Frame>
	);
}

export function PersonWidget({ data, title }: Props<R>) {
	const facts = Object.entries(rec(data.facts));
	const name = str(data.name);
	const initials = name
		.split(/\s+/)
		.map((w) => w[0])
		.filter(Boolean)
		.slice(0, 2)
		.join("")
		.toUpperCase();
	return (
		<Frame title={title}>
			<div className="flex items-center gap-3">
				<span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/5 font-display text-[17px] font-semibold text-primary">
					{initials || <User className="size-5" />}
				</span>
				<div className="flex min-w-0 flex-col">
					<span className="font-sans text-[calc(17px*var(--ws-fs))] font-semibold text-primary">{name}</span>
					{str(data.role) && <span className={small}>{str(data.role)}</span>}
				</div>
			</div>
			{facts.length > 0 && (
				<dl className="mt-3 divide-y divide-hairline border-t border-hairline">
					{facts.map(([k, v]) => (
						<div key={k} className="flex gap-4 py-2">
							<dt className="w-[34%] shrink-0 font-sans text-[13px] text-muted">{k}</dt>
							<dd className="min-w-0 font-sans text-[calc(13.5px*var(--ws-fs))] text-primary">
								<Txt text={v} />
							</dd>
						</div>
					))}
				</dl>
			)}
		</Frame>
	);
}

export function CountdownWidget({ data, title }: Props<R>) {
	const to = useMemo(() => new Date(str(data.to)).getTime(), [data.to]);
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!Number.isFinite(to) || to <= Date.now()) return;
		const t = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(t);
	}, [to]);
	if (!Number.isFinite(to)) return null;
	const left = Math.max(0, to - now);
	const parts = [
		["days", Math.floor(left / 86_400_000)],
		["hours", Math.floor(left / 3_600_000) % 24],
		["min", Math.floor(left / 60_000) % 60],
		["sec", Math.floor(left / 1000) % 60],
	] as const;
	return (
		<Frame title={str(data.title) || title || "Countdown"} icon={<ClockCountdown />}>
			{left === 0 ? (
				<p className={clsx(body, "font-medium")}>It's here.</p>
			) : (
				<div className="grid grid-cols-4 gap-1.5">
					{parts.map(([unit, v]) => (
						<div key={unit} className="flex flex-col items-center rounded-[13px] bg-primary/[0.04] py-2.5">
							<span className="font-display text-[calc(26px*var(--ws-fs))] leading-tight font-semibold text-primary tabular-nums">
								{String(v).padStart(2, "0")}
							</span>
							<span className="font-sans text-[12px] text-muted">{unit}</span>
						</div>
					))}
				</div>
			)}
			<p className="mt-2.5 font-sans text-[13px] text-subtle">
				{new Date(to).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
			</p>
		</Frame>
	);
}
