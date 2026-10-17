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
	NavigationArrow,
	Path,
	Phone,
	Plus,
	Star,
	User,
	Users,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { DUR, EASE, swap } from "@/lib/motion-presets";
import { arr, Btn, Frame, fmt, num, type Props, rec, str, T, Txt, well } from "./parts";

/* Plans and places: timeline, checklist, recipe, itinerary, place, event,
   person, countdown. */

type R = Record<string, unknown>;

export function TimelineWidget({ data, title, live }: Props<R>) {
	const events = arr<R>(data.events);
	return (
		<Frame title={title || "Timeline"} icon={<Path />} live={live}>
			<ol className="flex flex-col">
				{events.map((e, i) => {
					const last = i === events.length - 1;
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: events in order
						<li key={i} className="relative grid grid-cols-[72px_14px_1fr] gap-x-3 pb-5 last:pb-0">
							<span className="pt-px text-right font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-muted tabular-nums">
								{str(e.date)}
							</span>
							<span className="relative flex justify-center">
								{!last && <span aria-hidden className="absolute top-4 -bottom-5 w-px bg-hairline" />}
								<span
									aria-hidden
									className={clsx("relative mt-[5px] size-2.5 rounded-full", last ? "bg-brand" : "bg-primary/35")}
								/>
							</span>
							<div className="flex min-w-0 flex-col gap-1">
								<span className={T.strong}>
									<Txt text={e.title} />
								</span>
								{str(e.body) && (
									<span className={clsx(T.body, "text-muted")}>
										<Txt text={e.body} />
									</span>
								)}
							</div>
						</li>
					);
				})}
			</ol>
		</Frame>
	);
}

export function ChecklistWidget({ data, title, live }: Props<R>) {
	const items = arr<R>(data.items);
	const [done, setDone] = useState<boolean[]>(() => items.map((it) => it.done === true));
	const count = done.filter(Boolean).length;
	return (
		<Frame
			title={title || "Checklist"}
			icon={<ListChecks />}
			action={<span className={clsx(T.label, "pr-2.5 tabular-nums")}>{`${count} of ${items.length}`}</span>}
			live={live}
			flush
		>
			<div className="mx-4 mb-2 h-1 overflow-hidden rounded-pill bg-[var(--vivid-track)] sm:mx-5">
				<motion.div
					className="h-full rounded-pill bg-brand"
					initial={false}
					animate={{ width: `${items.length ? (count / items.length) * 100 : 0}%` }}
					transition={{ duration: DUR.slow, ease: EASE }}
				/>
			</div>
			<ul className="flex flex-col pb-2">
				{items.map((it, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: items in order
					<li key={i}>
						<button
							type="button"
							role="checkbox"
							aria-checked={done[i]}
							onClick={() => setDone((d) => d.map((x, j) => (j === i ? !x : x)))}
							className="flex min-h-[48px] w-full cursor-pointer items-center gap-3.5 px-4 py-2.5 text-left transition-colors hover:bg-[var(--vivid-well)] sm:px-5"
						>
							<span
								className={clsx(
									"flex size-[22px] shrink-0 items-center justify-center rounded-[7px] transition-colors",
									done[i] ? "bg-brand text-brand-on" : "ring-[1.5px] ring-primary/30 ring-inset",
								)}
							>
								<AnimatePresence initial={false}>
									{done[i] && (
										<motion.span key="t" {...swap} className="flex">
											<Check weight="bold" className="size-3.5" />
										</motion.span>
									)}
								</AnimatePresence>
							</span>
							<span className={clsx(T.body, "min-w-0 transition-colors", done[i] && "text-muted line-through decoration-primary/30")}>
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

function parseAmount(v: string): number {
	let n = 0;
	for (const part of v.trim().split(/\s+/)) {
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
	const frac = (
		[
			[0.125, "⅛"],
			[0.25, "¼"],
			[1 / 3, "⅓"],
			[0.5, "½"],
			[2 / 3, "⅔"],
			[0.75, "¾"],
		] as const
	).find(([v]) => Math.abs(rest - v) < 0.04);
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

/** A small fact in a recipe or place header: a glyph and a word. */
function Meta({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
	return (
		<span className={clsx(T.label, "flex items-center gap-1.5 [&>svg]:size-4")}>
			{icon}
			{children}
		</span>
	);
}

export function RecipeWidget({ data, title, live }: Props<R>) {
	const base = Number.parseInt(str(data.servings), 10);
	const scalable = Number.isFinite(base) && base > 0;
	const [serves, setServes] = useState(scalable ? base : 0);
	const ingredients = arr(data.ingredients).map(str);
	const steps = arr(data.steps);
	const [got, setGot] = useState<Set<number>>(() => new Set());
	const k = scalable ? serves / base : 1;
	return (
		<Frame title={title || "Recipe"} icon={<CookingPot />} live={live}>
			<div className="flex flex-col gap-2">
				<span className={T.display}>{str(data.name)}</span>
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
					{str(data.time) && <Meta icon={<Clock />}>{str(data.time)}</Meta>}
					{!scalable && str(data.servings) && <Meta icon={<Users />}>{str(data.servings)}</Meta>}
				</div>
			</div>
			{scalable && (
				<div className={clsx(well, "mt-4 flex items-center justify-between py-1 pr-1 pl-4")}>
					<span className={T.body}>
						Serves <span className="font-semibold tabular-nums">{serves}</span>
					</span>
					<span className="flex items-center">
						<Btn label="Fewer servings" tone="ghost" icon disabled={serves <= 1} onClick={() => setServes((x) => Math.max(1, x - 1))}>
							<Minus weight="bold" />
						</Btn>
						<Btn label="More servings" tone="ghost" icon disabled={serves >= 99} onClick={() => setServes((x) => Math.min(99, x + 1))}>
							<Plus weight="bold" />
						</Btn>
					</span>
				</div>
			)}
			<h4 className={clsx(T.head, "mt-5 mb-1")}>Ingredients</h4>
			<ul className="flex flex-col">
				{ingredients.map((ing, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: ingredients in order
					<li key={i} className="border-hairline border-t first:border-t-0">
						<button
							type="button"
							role="checkbox"
							aria-checked={got.has(i)}
							onClick={() =>
								setGot((g) => {
									const n = new Set(g);
									n.has(i) ? n.delete(i) : n.add(i);
									return n;
								})
							}
							className={clsx(T.body, "flex min-h-[44px] w-full cursor-pointer items-center gap-3 py-2 text-left", got.has(i) && "text-muted line-through decoration-primary/30")}
						>
							<span
								className={clsx(
									"flex size-5 shrink-0 items-center justify-center rounded-full transition-colors",
									got.has(i) ? "bg-brand text-brand-on" : "ring-[1.5px] ring-primary/30 ring-inset",
								)}
							>
								{got.has(i) && <Check weight="bold" className="size-3" />}
							</span>
							<span className="min-w-0 tabular-nums">{scaleLine(ing, k)}</span>
						</button>
					</li>
				))}
			</ul>
			<h4 className={clsx(T.head, "mt-5 mb-3")}>Method</h4>
			<ol className="flex flex-col gap-3.5">
				{steps.map((st, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: steps in order
					<li key={i} className="flex gap-3.5">
						<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--vivid-well)] font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold text-primary tabular-nums">
							{i + 1}
						</span>
						<p className={clsx(T.body, "min-w-0 pt-[3px]")}>
							<Txt text={st} />
						</p>
					</li>
				))}
			</ol>
		</Frame>
	);
}

export function ItineraryWidget({ data, title, live }: Props<R>) {
	const days = arr<R>(data.days);
	const [at, setAt] = useState(0);
	const day = days[at];
	return (
		<Frame title={title || "Itinerary"} icon={<CalendarBlank />} live={live}>
			{days.length > 1 && (
				<div role="tablist" aria-label="Days" className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
					{days.map((d, i) => (
						<button
							// biome-ignore lint/suspicious/noArrayIndexKey: days in order
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
							{at === i && (
								<motion.span layoutId={`it-day-${title ?? ""}-${days.length}`} className="absolute inset-0 rounded-pill bg-[var(--vivid-well-press)]" />
							)}
							<span className="relative">{str(d.label) || `Day ${i + 1}`}</span>
						</button>
					))}
				</div>
			)}
			{day && (
				<AnimatePresence mode="wait" initial={false}>
					<motion.ol key={at} {...swap} role={days.length > 1 ? "tabpanel" : undefined} className="flex flex-col">
						{days.length === 1 && <li className={clsx(T.head, "mb-3")}>{str(day.label)}</li>}
						{arr<R>(day.items).map((it, i, all) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: items in order
							<li key={i} className="relative grid grid-cols-[52px_14px_1fr] gap-x-3 pb-4 last:pb-0">
								<span className="pt-px text-right font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-muted tabular-nums">{str(it.time)}</span>
								<span className="relative flex justify-center">
									{i < all.length - 1 && <span aria-hidden className="absolute top-4 -bottom-4 w-px bg-hairline" />}
									<span aria-hidden className="relative mt-[5px] size-2.5 rounded-full bg-brand" />
								</span>
								<div className="flex min-w-0 flex-col gap-0.5">
									<span className={T.strong}>
										<Txt text={it.title} />
									</span>
									{str(it.note) && (
										<span className={clsx(T.body, "text-muted")}>
											<Txt text={it.note} />
										</span>
									)}
								</div>
							</li>
						))}
					</motion.ol>
				</AnimatePresence>
			)}
		</Frame>
	);
}

export function PlaceWidget({ data, title, live }: Props<R>) {
	const name = str(data.name);
	const address = str(data.address);
	const rating = num(data.rating);
	const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, address].filter(Boolean).join(", "))}`;
	return (
		<Frame title={title || "Place"} icon={<MapPin />} live={live}>
			<div className="flex flex-col gap-1.5">
				<span className={T.display}>{name}</span>
				{address && <span className={clsx(T.body, "text-muted")}>{address}</span>}
				<div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
					{rating !== null && (
						<Meta icon={<Star weight="fill" className="text-gold" />}>
							<span className="font-semibold text-primary tabular-nums">{fmt(rating, 1)}</span>
							{rating <= 5 && <span>out of 5</span>}
						</Meta>
					)}
					{str(data.hours) && <Meta icon={<Clock />}>{str(data.hours)}</Meta>}
				</div>
			</div>
			<div className="mt-4 flex flex-wrap gap-2">
				<Btn label="Directions" href={maps} tone="primary">
					<NavigationArrow weight="fill" /> Directions
				</Btn>
				{str(data.phone) && (
					<Btn label={`Call ${str(data.phone)}`} href={`tel:${str(data.phone).replace(/[^\d+]/g, "")}`}>
						<Phone /> Call
					</Btn>
				)}
				{/^https?:\/\//.test(str(data.url)) && (
					<Btn label="Website" href={str(data.url)}>
						<Globe /> Website
					</Btn>
				)}
			</div>
		</Frame>
	);
}

/** ISO to the compact UTC form calendars take: 20261017T090000Z. */
const calStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (v: string) => v.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

export function EventWidget({ data, title, live }: Props<R>) {
	const start = new Date(str(data.start));
	if (Number.isNaN(start.getTime())) return null;
	const endRaw = new Date(str(data.end));
	const end = Number.isNaN(endRaw.getTime()) ? new Date(start.getTime() + 3_600_000) : endRaw;
	const name = str(data.title);
	const where = str(data.location);
	const note = str(data.note);
	const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(str(data.start));
	const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
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
		<Frame title={title || "Event"} icon={<CalendarBlank />} live={live}>
			<div className="flex gap-4">
				<div className={clsx(well, "flex w-[60px] shrink-0 flex-col items-center overflow-hidden")}>
					<span className="w-full bg-brand py-1 text-center font-sans text-[12px] font-semibold text-brand-on">
						{start.toLocaleDateString(undefined, { month: "short" })}
					</span>
					<span className="py-1.5 font-display text-[calc(24px*var(--ws-fs))] leading-tight font-semibold text-primary tabular-nums">
						{start.getDate()}
					</span>
				</div>
				<div className="flex min-w-0 flex-col gap-1">
					<span className={clsx(T.display, "text-[calc(19px*var(--ws-fs))]")}>{name}</span>
					<span className={clsx(T.body, "text-muted tabular-nums")}>
						{start.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
						{!dateOnly && `, ${time(start)}${str(data.end) ? ` to ${time(end)}` : ""}`}
					</span>
					{where && <Meta icon={<MapPin />}>{where}</Meta>}
				</div>
			</div>
			{note && (
				<p className={clsx(T.body, "mt-4 border-hairline border-t pt-4 text-muted")}>
					<Txt text={note} />
				</p>
			)}
			<div className="mt-4 flex flex-wrap gap-2">
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

export function PersonWidget({ data, title, live }: Props<R>) {
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
		<Frame title={title || "Person"} icon={<User />} live={live}>
			<div className="flex items-center gap-4">
				<span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--vivid-well-press)] font-display text-[19px] font-semibold text-primary">
					{initials || <User className="size-6" />}
				</span>
				<div className="flex min-w-0 flex-col gap-0.5">
					<span className={T.display}>{name}</span>
					{str(data.role) && <span className={clsx(T.body, "text-muted")}>{str(data.role)}</span>}
				</div>
			</div>
			{facts.length > 0 && (
				<dl className="mt-4 flex flex-col">
					{facts.map(([k, v]) => (
						<div key={k} className="flex gap-4 border-hairline border-t py-3">
							<dt className={clsx(T.label, "w-[36%] shrink-0 pt-px")}>{k.replace(/_/g, " ")}</dt>
							<dd className={clsx(T.body, "min-w-0")}>
								<Txt text={v} />
							</dd>
						</div>
					))}
				</dl>
			)}
		</Frame>
	);
}

export function CountdownWidget({ data, title, live }: Props<R>) {
	const to = useMemo(() => new Date(str(data.to)).getTime(), [data.to]);
	// The clock starts on the client: a server render would disagree with it by a second.
	const [now, setNow] = useState<number | null>(null);
	useEffect(() => {
		setNow(Date.now());
		if (!Number.isFinite(to) || to <= Date.now()) return;
		const t = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(t);
	}, [to]);
	if (!Number.isFinite(to)) return null;
	const left = now === null ? 1 : Math.max(0, to - now);
	const span = now === null ? 0 : left;
	const parts = [
		["days", Math.floor(span / 86_400_000)],
		["hours", Math.floor(span / 3_600_000) % 24],
		["minutes", Math.floor(span / 60_000) % 60],
		["seconds", Math.floor(span / 1000) % 60],
	] as const;
	return (
		<Frame title={str(data.title) || title || "Countdown"} icon={<ClockCountdown />} live={live}>
			{left === 0 ? (
				<p className={T.display}>It's here.</p>
			) : (
				<div className="grid grid-cols-4 gap-2" role="timer" aria-label={`${parts[0][1]} days, ${parts[1][1]} hours left`}>
					{parts.map(([unit, v]) => (
						<div key={unit} className={clsx(well, "flex flex-col items-center gap-0.5 py-3")}>
							<span className="font-display text-[calc(30px*var(--ws-fs))] leading-tight font-semibold text-primary tabular-nums">
								{now === null ? "––" : String(v).padStart(2, "0")}
							</span>
							<span className={T.label}>{unit}</span>
						</div>
					))}
				</div>
			)}
			<p className={clsx(T.label, "mt-3")}>
				{new Date(to).toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" })}
			</p>
		</Frame>
	);
}
