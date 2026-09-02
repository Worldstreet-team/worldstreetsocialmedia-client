"use client";

import { formatCompact } from "@/lib/utils";
import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { PersonName } from "@/components/ui/PersonName";
import { CaretLeft, CaretRight, Waveform } from "@phosphor-icons/react";
import { SectionHead } from "@/components/layout/SectionHead";
import { EqBars, spaceBackground } from "@/components/voice/SpaceCard";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { useAppPathname } from "@/i18n/useAppPathname";
import { useT } from "@/i18n/client";
import { getSpacesAction } from "@/lib/space.actions";
import { voiceRefreshAtom } from "@/store/voice.atom";

interface SpaceHost {
	_id?: string;
	username?: string;
	avatar?: string;
	isVerified?: boolean;
	firstName?: string;
	lastName?: string;
}

interface Space {
	id: string;
	title: string;
	status: "scheduled" | "live" | "ended";
	scheduledFor?: string;
	host?: SpaceHost;
	community?: { name?: string; slug?: string } | null;
	membersCount?: number;
	/** The canvas the host picked in the create sheet. */
	cover?: string;
	/** A custom upload, which wins over the preset. */
	coverImage?: string;
}

/* How many of each tier the rail shows before deferring to /voice. Live
   rooms earn more slots than scheduled ones — a room you can join now is
   worth more rail than one you can only diarise. */
const MAX_LIVE = 3;
const MAX_UPCOMING = 2;

/**
 * Three-bar equaliser — the "this is audio, and it is happening" signal that
 * a static dot can't carry. Transform-only (scaleY on a bottom origin), and
 * it flattens to a static meter under prefers-reduced-motion.
 *
 * The loop runs longer than the three UI durations on purpose: those govern
 * state transitions, while ambient loops already sit outside them (the
 * skeleton shimmer is 1.6s, the sidebar shine 5s).
 */
function LiveBars() {
	const reduced = useReducedMotion();
	return (
		<span
			className="flex h-3.5 shrink-0 items-end gap-[2px]"
			aria-hidden="true"
		>
			{[0, 1, 2].map((i) => (
				<motion.span
					key={i}
					className="h-full w-[3px] origin-bottom rounded-pill bg-danger"
					initial={{ scaleY: 0.4 }}
					animate={
						reduced ? { scaleY: 0.5 } : { scaleY: [0.35, 1, 0.5, 0.85, 0.35] }
					}
					transition={
						reduced
							? undefined
							: {
									duration: 1.2,
									repeat: Number.POSITIVE_INFINITY,
									ease: "easeInOut",
									delay: i * 0.16,
								}
					}
				/>
			))}
		</span>
	);
}

/** "in 12m" / "in 3h" / "Tue" — short enough for the rail's right edge. */
function startsIn(iso?: string): string | null {
	if (!iso) return null;
	const ms = new Date(iso).getTime() - Date.now();
	if (!Number.isFinite(ms)) return null;
	if (ms <= 0) return "now";
	const mins = Math.round(ms / 60000);
	if (mins < 60) return `in ${mins}m`;
	const hours = Math.round(mins / 60);
	if (hours < 24) return `in ${hours}h`;
	return new Date(iso).toLocaleDateString(undefined, { weekday: "short" });
}



function SpaceRow({ space, live }: { space: Space; live: boolean }) {
	const t = useT();
	const count = space.membersCount ?? 0;
	const when = startsIn(space.scheduledFor);

	return (
		<Link
			href="/voice"
			// The card wears the canvas the host chose, so a room is
			// recognisable by its colour before you have read the title.
			style={{ background: spaceBackground(space as any) }}
			className="group relative block overflow-hidden rounded-xl p-3 transition-opacity hover:opacity-95"
		>
			{/* Ink on this card is fixed light: it sits on the host's art, which
			    does not follow the theme, so text-primary would go black on
			    paper and vanish. */}
			<span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0c0a09]/85 via-[#0c0a09]/35 to-[#0c0a09]/20" />

			<span className="relative flex items-center justify-between gap-2">
				{live ? (
					<span className="flex items-center gap-1.5 rounded-[4px] bg-danger px-1.5 py-px font-sans text-[9px] font-bold tracking-wide text-white">
						{t("live.badge")}
					</span>
				) : (
					<span className="rounded-[4px] bg-[#fafaf9]/15 px-1.5 py-px font-sans text-[9px] font-bold uppercase tracking-wide text-[#fafaf9]/85">
						{when}
					</span>
				)}
				{live && <EqBars className="text-[#fafaf9]" />}
			</span>

			<span className="relative mt-2 block truncate font-display text-[14px] font-semibold leading-snug text-[#fafaf9]">
				{space.title}
			</span>

			<span className="relative mt-2 flex items-center gap-1.5">
				<span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-pill bg-[#1c1917]">
					<SafeAvatar src={space.host?.avatar} />
				</span>
				<PersonName
					person={space.host as any}
					size={11}
					className="min-w-0 font-sans text-[11.5px] text-[#fafaf9]/80"
				/>
				<span className="ml-auto shrink-0 font-sans text-[11px] font-semibold tabular-nums text-[#fafaf9]/85">
					{formatCompact(count)} {live ? t("rail.spaces.listening") : t("rail.spaces.going")}
				</span>
			</span>
		</Link>
	);
}

/**
 * Space Voice in the right rail: live audio rooms first, then what's
 * scheduled next. Sits directly under Live now so everything happening
 * right now is one block of the column, and borrows that section's
 * grammar — same eyebrow, same ringed avatar, same row hover — so it reads
 * as part of the rail rather than a widget bolted on.
 *
 * A CAROUSEL rather than a stack: five stacked rooms ate most of the rail's
 * height and pushed everything below it off-screen. One room at a time, paged
 * by hand, so the section costs one row however many rooms are running.
 *
 * Absent entirely when there is nothing live and nothing scheduled; an
 * empty section is worse than no section.
 */
export function SpacesRail({ delay = 210 }: { delay?: number }) {
	const t = useT();
	const { client } = useRealtime();
	const refreshTick = useAtomValue(voiceRefreshAtom);
	const [live, setLive] = useState<Space[]>([]);
	const [upcoming, setUpcoming] = useState<Space[]>([]);
	const trackRef = useRef<HTMLDivElement>(null);
	const [page, setPage] = useState(0);
	// Smooth paging is motion; honour the reader's setting like everything else.
	const reduced = useReducedMotion();
	const onVoice = useAppPathname().startsWith("/voice");

	const load = useCallback(async () => {
		const res = await getSpacesAction();
		if (!res.success) return;
		setLive((res.live ?? []).slice(0, MAX_LIVE));
		setUpcoming((res.upcoming ?? []).slice(0, MAX_UPCOMING));
	}, []);

	// This used to fetch once on mount and never again, so cancelling or
	// starting a room left the rail advertising it until a full reload.
	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshTick is the signal; its value is unused.
	useEffect(() => {
		void load();
	}, [load, refreshTick]);

	// The gateway announces started/ended/cancelled on `spaces`; no poll needed.
	useEffect(() => {
		if (!client) return;
		const channel = client.channels.get("spaces");
		const onEvent = () => void load();
		void channel.subscribe(onEvent);
		return () => channel.unsubscribe(onEvent);
	}, [client, load]);

	// A room ending can shorten the list under a reader parked on the last
	// page, which would leave the counter reading "3/2" and both arrows dead.
	const slideCount = live.length + upcoming.length;
	useEffect(() => {
		setPage((current) => Math.max(0, Math.min(current, slideCount - 1)));
	}, [slideCount]);

	/**
	 * Hold the carousel where the reader left it.
	 *
	 * This section re-renders often and for reasons that have nothing to do
	 * with the reader: a listener count ticks, the `spaces` channel fires, and
	 * the live rail above it polls every 20 seconds. Under
	 * `scroll-snap-type: mandatory` the browser re-snaps whenever the content
	 * inside the scroller changes, which slid the carousel back on its own —
	 * it read as autoplay. Re-assert the page we are supposed to be on after
	 * a CONTENT update, without animation so a correction is never mistaken
	 * for a deliberate move.
	 *
	 * Deliberately not keyed on `page`: paging scrolls smoothly and `syncPage`
	 * updates `page` part-way through, so correcting on that would snap the
	 * animation dead half-way. The page is read from a ref instead — this
	 * effect only ever runs when the rooms themselves changed.
	 */
	const pageRef = useRef(0);
	pageRef.current = page;
	useEffect(() => {
		const el = trackRef.current;
		if (!el) return;
		const target = pageRef.current * slideStep();
		if (Math.abs(el.scrollLeft - target) > 1) {
			el.scrollTo({ left: target, behavior: "auto" });
		}
	}, [live, upcoming]);

	// Live rooms first, then scheduled — one flat list so paging is linear.
	const slides = [
		...live.map((space) => ({ space, live: true })),
		...upcoming.map((space) => ({ space, live: false })),
	];

	// One page of travel: the distance between two slides' left edges, which
	// is slide width PLUS the gap. Measuring the gap rather than assuming it
	// means the number stays right if the spacing is ever retuned. Falls back
	// to the slide's own width for a single slide, where there is no gap to
	// measure and no paging to do. Never the scroller's clientWidth — the
	// track carries px-3, so that is 24px too wide and drifts every press.
	const slideStep = () => {
		const el = trackRef.current;
		if (!el) return 1;
		const first = el.children[0] as HTMLElement | undefined;
		const second = el.children[1] as HTMLElement | undefined;
		if (first && second) return second.offsetLeft - first.offsetLeft;
		return first?.offsetWidth || el.clientWidth || 1;
	};

	// The scroller is the source of truth for which page we are on: it also
	// moves under trackpad swipes and keyboard, so reading it back keeps the
	// counter and arrows honest however the reader got there.
	const syncPage = () => {
		const el = trackRef.current;
		if (!el) return;
		setPage(Math.round(el.scrollLeft / slideStep()));
	};

	const goTo = (index: number) => {
		const el = trackRef.current;
		if (!el) return;
		const clamped = Math.max(0, Math.min(index, slides.length - 1));
		el.scrollTo({
			left: clamped * slideStep(),
			behavior: reduced ? "auto" : "smooth",
		});
	};

	if (slides.length === 0) return null;

	const atStart = page <= 0;
	const atEnd = page >= slides.length - 1;
	const arrow =
		"flex h-6 w-6 items-center justify-center rounded-pill text-subtle transition-colors hover:bg-raised hover:text-primary disabled:pointer-events-none disabled:opacity-30";

	return (
		<section className="animate-rise" style={{ animationDelay: `${delay}ms` }}>
			<SectionHead
				icon={<Waveform size={13} weight="duotone" />}
				label={t("rail.spaces")}
				live={live.length > 0}
				trailing={
					<span className="flex items-center gap-1">
						{/* Controls only exist when there is somewhere to go. */}
						{slides.length > 1 && (
							<>
								<button
									type="button"
									onClick={() => goTo(page - 1)}
									disabled={atStart}
									aria-label={t("rail.spaces.prev")}
									className={arrow}
								>
									<CaretLeft size={13} weight="bold" />
								</button>
								<span className="font-sans text-[11px] tabular-nums text-subtle">
									{page + 1}/{slides.length}
								</span>
								<button
									type="button"
									onClick={() => goTo(page + 1)}
									disabled={atEnd}
									aria-label={t("rail.spaces.next")}
									className={arrow}
								>
									<CaretRight size={13} weight="bold" />
								</button>
							</>
						)}
						{/* "See all" is a link to where you already are when the
						    reader is on /voice — offering it there is a dead end
						    dressed as a way out. The carousel controls stay. */}
						{!onVoice && (
							<Link
								href="/voice"
								className="ml-1 font-sans text-[11px] font-semibold text-gold hover:underline"
							>
								{t("rail.seeAll")}
							</Link>
						)}
					</span>
				}
			/>
			{/* One room per page. Snap keeps a hand-swipe landing on a room
			    rather than between two, and the scroller stays the source of
			    truth for `page`. */}
			<div
				ref={trackRef}
				onScroll={syncPage}
				className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{slides.map(({ space, live: isLive }) => (
					<div key={space.id} className="w-full shrink-0 snap-start">
						<SpaceRow space={space} live={isLive} />
					</div>
				))}
			</div>
		</section>
	);
}
