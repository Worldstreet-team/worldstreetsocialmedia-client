"use client";

import clsx from "clsx";
import {
	ArrowClockwise,
	ArrowsDownUp,
	ArrowsLeftRight,
	Cloud,
	CloudFog,
	CloudLightning,
	CloudMoon,
	CloudRain,
	CloudSnow,
	CloudSun,
	Drop,
	Moon,
	Sun,
	Umbrella,
	Wind,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { type ComponentType, type ReactNode, useState } from "react";
import { swap } from "@/lib/motion-presets";
import { arr, Btn, Frame, money, num, type Props, str, T, useAsk, useStripEnd, well } from "./parts";

/* Wave 2 LIVE (docs/vivid-widgets.md 7.3): weather and fx-rate. A live card
   carries the tool's own payload, so every figure here came from the
   provider this turn. Each one says where and when (source, as of) and goes
   visibly out of date when old, with a Refresh that asks again. market (in
   data.tsx) shares the foot. */

type R = Record<string, unknown>;
type Glyph = ComponentType<{ className?: string; weight?: "duotone" | "regular" | "fill" }>;

/** The provider's line under a live card: "Open-Meteo · as of 09:30", and Refresh when it is old. */
export function LiveFoot({ source, asOf, stale, refresh, tz, extra }: { source: string; asOf: string; stale: boolean; refresh?: string; tz?: string; extra?: ReactNode }) {
	const ask = useAsk();
	const at = new Date(asOf);
	let when = "";
	if (!Number.isNaN(at.getTime())) {
		const sameDay = new Date().toDateString() === at.toDateString();
		const opts: Intl.DateTimeFormatOptions = sameDay
			? { hour: "numeric", minute: "2-digit" }
			: { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" };
		try {
			when = at.toLocaleString(undefined, { ...opts, timeZone: tz || undefined });
		} catch {
			when = at.toLocaleString(undefined, opts);
		}
	}
	return (
		<div className="mt-4 flex min-h-[40px] flex-wrap items-center justify-between gap-x-3 gap-y-1 border-hairline border-t pt-3">
			<span className={clsx(T.label, "tabular-nums")}>
				{source}
				{when && ` · as of ${when}`}
				{stale && <span className="font-semibold text-warning"> · out of date</span>}
				{extra}
			</span>
			{stale && ask && refresh && (
				<Btn label="Refresh" tone="ghost" onClick={() => ask(refresh)}>
					<ArrowClockwise /> Refresh
				</Btn>
			)}
		</div>
	);
}

const ageHours = (iso: string) => {
	const t = Date.parse(iso);
	return Number.isNaN(t) ? 0 : (Date.now() - t) / 3_600_000;
};

/* ---- weather ---- */

/** The eight WMO groups the tool sends, with the night faces of clear and partly cloudy. */
function sky(icon: string, isDay: boolean): { Icon: Glyph; word: string } {
	switch (icon) {
		case "clear":
			return { Icon: isDay ? Sun : Moon, word: "Clear" };
		case "partly-cloudy":
			return { Icon: isDay ? CloudSun : CloudMoon, word: "Partly cloudy" };
		case "cloudy":
			return { Icon: Cloud, word: "Cloudy" };
		case "fog":
			return { Icon: CloudFog, word: "Fog" };
		case "drizzle":
			return { Icon: Drop, word: "Drizzle" };
		case "rain":
			return { Icon: CloudRain, word: "Rain" };
		case "snow":
			return { Icon: CloudSnow, word: "Snow" };
		case "storm":
			return { Icon: CloudLightning, word: "Storm" };
		default:
			return { Icon: Cloud, word: "" };
	}
}

/** "2026-10-17T14:00" (the place's local time, no offset) to "2 PM" in the reader's style. */
function hourOf(t: string) {
	const h = Number(t.slice(11, 13));
	if (!Number.isFinite(h)) return "";
	return new Date(Date.UTC(2000, 0, 1, h)).toLocaleTimeString(undefined, { hour: "numeric", timeZone: "UTC" });
}
/** "2026-10-18" to "Sat". */
function dayOf(d: string) {
	const t = Date.parse(`${d}T12:00:00Z`);
	return Number.isNaN(t) ? d : new Date(t).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
}

const deg = (n: number | null) => (n === null ? "–" : `${Math.round(n)}°`);

export function WeatherWidget({ data, title, live }: Props<R>) {
	const temp = num(data.temp);
	const [strip, end, edge] = useStripEnd<HTMLDivElement>();
	if (temp === null) return null;
	const imperial = str(data.units) === "imperial";
	const now = sky(str(data.icon), data.isDay !== false);
	const place = [str(data.place), str(data.region) || str(data.country)].filter(Boolean).join(", ");
	const hourly = arr<R>(data.hourly);
	const daily = arr<R>(data.daily);
	const lows = daily.map((d) => num(d.low)).filter((v): v is number => v !== null);
	const highs = daily.map((d) => num(d.high)).filter((v): v is number => v !== null);
	const wlo = Math.min(...lows, temp);
	const whi = Math.max(...highs, temp);
	const span = whi - wlo || 1;
	const pop = num(data.popPct);
	const stale = ageHours(str(data.asOf)) > 3;
	return (
		<Frame title={title || place || "Weather"} icon={<now.Icon />} live={live} label={`Weather in ${place}`}>
			{/* Now: the temperature is the answer. */}
			<div className={clsx("flex items-center justify-between gap-4", stale && "opacity-60")}>
				<div className="flex min-w-0 flex-col gap-1">
					<span className="font-display text-[calc(56px*var(--ws-fs))] leading-none font-semibold tracking-[-0.02em] text-primary tabular-nums">
						{deg(temp)}
					</span>
					<span className={T.strong}>{str(data.condition) || now.word}</span>
					<span className={clsx(T.label, "tabular-nums")}>
						Feels like {deg(num(data.feels))} · High {deg(num(data.high))} · Low {deg(num(data.low))}
					</span>
				</div>
				<now.Icon weight="duotone" className="size-16 shrink-0 text-primary" />
			</div>
			<div className="mt-4 grid grid-cols-3 gap-2">
				{[
					{ Icon: Drop as Glyph, label: "Humidity", value: num(data.humidity) !== null ? `${Math.round(num(data.humidity) as number)}%` : "–" },
					{ Icon: Wind as Glyph, label: "Wind", value: num(data.wind) !== null ? `${Math.round(num(data.wind) as number)} ${imperial ? "mph" : "km/h"}` : "–" },
					{ Icon: Umbrella as Glyph, label: "Rain", value: pop !== null ? `${Math.round(pop)}%` : "–" },
				].map((s) => (
					<div key={s.label} className={clsx(well, "flex min-w-0 flex-col gap-1 px-3 py-2.5")}>
						<span className={clsx(T.label, "flex items-center gap-1.5")}>
							<s.Icon className="size-3.5 shrink-0" />
							{s.label}
						</span>
						<span className={clsx(T.strong, "truncate tabular-nums")}>{s.value}</span>
					</div>
				))}
			</div>
			{hourly.length > 0 && (
				<div ref={strip} data-end={end} className={clsx(edge, "-mx-4 mt-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden")}>
					<ol className="flex w-max gap-1">
						{hourly.map((h, i) => {
							const k = sky(str(h.icon), h.isDay !== false);
							const p = num(h.popPct);
							return (
								// biome-ignore lint/suspicious/noArrayIndexKey: hours in order
								<li key={i} className={clsx("flex w-[54px] flex-col items-center gap-1.5 rounded-[13px] py-2.5", i === 0 && "bg-[var(--vivid-well)]")}>
									<span className={clsx(T.label, i === 0 && "font-semibold text-primary")}>{i === 0 ? "Now" : hourOf(str(h.t))}</span>
									<k.Icon weight="duotone" className="size-6 text-primary" />
									<span className={clsx(T.strong, "tabular-nums")}>{deg(num(h.temp))}</span>
									<span className={clsx("font-sans text-[calc(12px*var(--ws-fs))] tabular-nums", p !== null && p >= 20 ? "text-primary" : "text-transparent")}>
										{p !== null ? `${Math.round(p)}%` : "0%"}
									</span>
								</li>
							);
						})}
					</ol>
				</div>
			)}
			{daily.length > 0 && (
				<ol className="mt-3 flex flex-col">
					{daily.map((d, i) => {
						const k = sky(str(d.icon), true);
						const lo = num(d.low) ?? wlo;
						const hi = num(d.high) ?? whi;
						const p = num(d.popPct);
						return (
							// biome-ignore lint/suspicious/noArrayIndexKey: days in order
							<li key={i} className="grid h-11 grid-cols-[52px_28px_40px_36px_1fr_36px] items-center gap-2 border-hairline border-t first:border-t-0">
								<span className={clsx(T.body, i === 0 && "font-semibold")}>{i === 0 ? "Today" : dayOf(str(d.d))}</span>
								<k.Icon weight="duotone" className="size-6 text-primary" aria-label={str(d.condition) || k.word} />
								<span className="font-sans text-[calc(12.5px*var(--ws-fs))] text-muted tabular-nums">{p !== null && p >= 20 ? `${Math.round(p)}%` : ""}</span>
								<span className={clsx(T.body, "text-right text-muted tabular-nums")}>{deg(lo)}</span>
								<span className="relative h-1.5 rounded-pill bg-[var(--vivid-track)]" aria-hidden>
									<span
										className="absolute inset-y-0 rounded-pill bg-brand"
										style={{ left: `${((lo - wlo) / span) * 100}%`, right: `${100 - ((hi - wlo) / span) * 100}%` }}
									/>
									{i === 0 && (
										<span
											className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-[var(--ws-bg-page)]"
											style={{ left: `${((temp - wlo) / span) * 100}%` }}
										/>
									)}
								</span>
								<span className={clsx(T.body, "text-right tabular-nums")}>{deg(hi)}</span>
							</li>
						);
					})}
				</ol>
			)}
			<LiveFoot
				source={str(data.source) || "Open-Meteo"}
				asOf={str(data.asOf)}
				tz={str(data.timezone)}
				stale={stale}
				refresh={`What's the weather in ${place} right now?`}
			/>
		</Frame>
	);
}

/* ---- exchange rate ---- */

const sig = (n: number) => n.toLocaleString(undefined, { maximumSignificantDigits: 6 });

export function FxRateWidget({ data, title, live }: Props<R>) {
	const rate = num(data.rate);
	const [flip, setFlip] = useState(false);
	if (rate === null) return null;
	const base = str(data.base);
	const quote = str(data.quote);
	const inverse = num(data.inverse) ?? 1 / rate;
	const amount = num(data.amount);
	const converted = num(data.converted);
	const [from, to, r] = flip ? [quote, base, inverse] : [base, quote, rate];
	const next = Date.parse(str(data.nextUpdate));
	const stale = Number.isFinite(next) ? Date.now() > next + 6 * 3_600_000 : ageHours(str(data.asOf)) > 36;
	return (
		<Frame title={title || `${base} to ${quote}`} icon={<ArrowsLeftRight />} live={live}>
			<div className={clsx("relative flex items-end justify-between gap-3", stale && "opacity-60")}>
				<AnimatePresence mode="wait" initial={false}>
					<motion.div key={flip ? "b" : "a"} {...swap} className="flex min-w-0 flex-col gap-1">
						<span className={T.label}>1 {from} =</span>
						<span className="flex min-w-0 items-baseline gap-2">
							<span className={clsx(T.hero, "truncate")}>{sig(r)}</span>
							<span className="font-display text-[calc(18px*var(--ws-fs))] font-semibold text-muted">{to}</span>
						</span>
					</motion.div>
				</AnimatePresence>
				<Btn label={`Show ${to} to ${from}`} icon onClick={() => setFlip((f) => !f)}>
					<ArrowsDownUp weight="bold" />
				</Btn>
			</div>
			{amount !== null && converted !== null && (
				<div className={clsx(well, "mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3")}>
					<span className={clsx(T.body, "text-muted tabular-nums")}>{money(amount, base)}</span>
					<span className={clsx(T.figure, "tabular-nums")}>{money(converted, quote)}</span>
				</div>
			)}
			<LiveFoot
				source={str(data.source) || "ExchangeRate-API"}
				asOf={str(data.asOf)}
				stale={stale}
				refresh={`What's the ${base} to ${quote} rate today?`}
				extra={
					Number.isFinite(next) && !stale
						? ` · next rate ${new Date(next).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
						: null
				}
			/>
			<p className={clsx(T.label, "mt-1")}>One published rate a day. Banks and apps add their own margin.</p>
		</Frame>
	);
}

