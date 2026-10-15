"use client";

import { Heart } from "@phosphor-icons/react";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
import WolfIcon from "@/assets/icons/WolfIcon";
import { MarketSquareLockup } from "@/assets/icons/MarketMark";
import { useMotionReduced } from "@/lib/motion";
import s from "./promo-scenes.module.css";

/**
 * The frame every product card shares: the camera rig (a far and a near
 * layer that the camera drifts through), the kinetic headline, the beat
 * chip, the call to action and the light sweep that marks the cut. The
 * clock, the reasoning and the hero-frame rule live in
 * promo-scenes.module.css.
 */
export function PromoScene({
	bg,
	far,
	near,
	chip,
	eyebrow,
	title,
	headline,
	cta,
	href,
	onOpen,
	label,
}: {
	/** The ground class (each product's own light). */
	bg: string;
	/** Behind the art, lagging the camera. */
	far?: React.ReactNode;
	/** The product's art, leading the camera. */
	near?: React.ReactNode;
	chip?: React.ReactNode;
	eyebrow?: string;
	/** Built word by word. */
	title?: string;
	/** Instead of a title: a lockup that is its own headline. */
	headline?: React.ReactNode;
	cta: string;
	href?: string;
	onOpen?: () => void;
	/** What the card does, for a screen reader (the comp is decorative). */
	label: string;
}) {
	const ref = useRef<HTMLElement | null>(null);
	const [visible, setVisible] = useState(false);
	const reduced = useMotionReduced();

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		// Mostly on screen counts: the peek of the next card stays still, and
		// a card replays its story from the top each time it slides in.
		const io = new IntersectionObserver(
			([e]) => setVisible(e.isIntersecting && e.intersectionRatio >= 0.6),
			{ threshold: [0, 0.6, 1] },
		);
		io.observe(el);
		return () => io.disconnect();
	}, []);

	const words = title?.split(" ") ?? [];
	const inner = (
		<>
			<span className={clsx(s.cam, s.layer)} aria-hidden>
				<span className={clsx(s.layer, bg)} />
				{far && <span className={clsx(s.layer, s.far)}>{far}</span>}
				{near && <span className={clsx(s.layer, s.near)}>{near}</span>}
			</span>
			{chip}
			<span className={s.text}>
				{eyebrow && <span className={s.eyebrow}>{eyebrow}</span>}
				{headline}
				{title && (
					<span className={s.title}>
						{words.map((w, i) => (
							<span key={`${w}-${i}`}>
								<span className={s.mask}>
									<span
										className={s.word}
										style={{ animationDelay: `${120 + i * 80}ms` }}
									>
										{w}
									</span>
								</span>
								{i < words.length - 1 ? " " : null}
							</span>
						))}
					</span>
				)}
				<span className={s.cta}>{cta}</span>
			</span>
			<span className={s.sweep} aria-hidden />
		</>
	);

	// no-underline!: the Underline links setting is for links in running
	// text; a whole card with a pill in it is plainly one.
	const className = clsx(
		s.scene,
		visible && !reduced && s.on,
		"block h-[168px] w-[78%] shrink-0 snap-start cursor-pointer rounded-xl text-left no-underline!",
	);

	return href ? (
		<a
			ref={(el) => {
				ref.current = el;
			}}
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={label}
			className={className}
		>
			{inner}
		</a>
	) : (
		<button
			ref={(el) => {
				ref.current = el;
			}}
			type="button"
			onClick={onOpen}
			aria-label={label}
			className={className}
		>
			{inner}
		</button>
	);
}

/* ---- the six comps ---------------------------------------------------------- */

const MOTES = [
	{ left: "58%", delay: "0s" },
	{ left: "66%", delay: "0.5s" },
	{ left: "74%", delay: "1s" },
	{ left: "82%", delay: "1.5s" },
	{ left: "70%", delay: "2s" },
	{ left: "88%", delay: "2.5s" },
];

/** Premium: the seal turns in the light, then the tick lands on your name. */
export function PremiumScene(props: { eyebrow: string; title: string; cta: string; onOpen: () => void }) {
	return (
		<PromoScene
			{...props}
			label={`${props.title}. ${props.cta}`}
			bg={s.premiumBg}
			far={MOTES.map((m) => (
				<span key={m.left} className={s.mote} style={{ left: m.left, animationDelay: m.delay }} />
			))}
			near={
				<span className={s.seal}>
					<VerifiedIcon size={{ width: "72", height: "72" }} shine />
				</span>
			}
			chip={
				<span className={s.chip}>
					<span className={s.dotAvatar} />
					<span className={s.nameBar} />
					<span className={s.stamp}>
						<VerifiedIcon size={{ width: "14", height: "14" }} />
					</span>
				</span>
			}
		/>
	);
}

/** Academy: a chart draws itself behind her while the lesson fills. */
export function AcademyScene(props: { title: string; cta: string; href: string }) {
	const candles = [
		{ x: 14, y: 58, h: 22 },
		{ x: 30, y: 50, h: 26 },
		{ x: 46, y: 54, h: 18 },
		{ x: 62, y: 38, h: 28 },
		{ x: 78, y: 30, h: 24 },
		{ x: 94, y: 20, h: 30 },
	];
	return (
		<PromoScene
			{...props}
			eyebrow="Academy"
			label={`Academy. ${props.title}. ${props.cta}`}
			bg={s.academyBg}
			far={
				<svg className={s.chart} viewBox="0 0 110 90" preserveAspectRatio="none" aria-hidden>
					{candles.map((c, i) => (
						<rect
							key={c.x}
							className={s.candle}
							x={c.x - 2.5}
							y={c.y}
							width="5"
							height={c.h}
							rx="1"
							fill={i % 3 === 2 ? "rgb(248 113 113 / 0.55)" : "rgb(94 234 212 / 0.45)"}
							style={{ animationDelay: `${i * 70}ms` }}
						/>
					))}
					<path
						className={s.chartLine}
						pathLength={1}
						d="M2 80 L14 66 L30 60 L46 64 L62 46 L78 40 L94 26 L108 14"
					/>
				</svg>
			}
			near={<img className={s.student} src="/images/products/academy.webp" alt="" />}
			chip={
				<span className={s.chip}>
					Candles 101
					<span className={s.progress}>
						<span className={s.progressFill} />
					</span>
				</span>
			}
		/>
	);
}

/** Xstream: on air. Stage light, the chili's heat, reactions floating up. */
export function XstreamScene(props: { title: string; cta: string; href: string }) {
	return (
		<PromoScene
			{...props}
			eyebrow="Xstream"
			label={`Xstream. ${props.title}. ${props.cta}`}
			bg={s.xstreamBg}
			far={
				<>
					<span className={s.beam} style={{ left: "46%" }} />
					<span className={s.beam} style={{ left: "70%", animationDelay: "-1.5s" }} />
				</>
			}
			near={
				<>
					<span className={s.chili}>
						<img className={s.heat} src="/images/products/xstream.webp" alt="" />
						<img className={s.chiliImg} src="/images/products/xstream.webp" alt="" />
					</span>
					{[0, 1, 2].map((i) => (
						<Heart
							key={i}
							className={s.heart}
							weight="fill"
							size={12 + (i % 2) * 3}
							style={{ animationDelay: `${i}s`, right: 26 + i * 9 }}
						/>
					))}
				</>
			}
			chip={
				<span className={clsx(s.chip, s.live)}>
					<span className={s.liveDot} />
					LIVE
				</span>
			}
		/>
	);
}

/** Arcade: the board rolls in under her. */
export function ArcadeScene(props: { title: string; cta: string; href: string }) {
	return (
		<PromoScene
			{...props}
			eyebrow="Arcade"
			label={`Arcade. ${props.title}. ${props.cta}`}
			bg={s.arcadeBg}
			far={
				<span className={s.floorWrap}>
					<span className={s.floor} />
				</span>
			}
			near={<img className={s.queen} src="/images/products/arcade.webp" alt="" />}
			chip={
				<span className={s.chip}>
					<span className={s.pulseDot} />
					Your move
				</span>
			}
		/>
	);
}

/** Wolf of WorldStreet: night over a skyline of candles, then the howl. */
export function WolfScene(props: { eyebrow: string; title: string; cta: string; onOpen: () => void }) {
	const bars = [38, 60, 46, 74, 56, 92];
	const stars = [
		{ top: "14%", left: "40%", d: "0s" },
		{ top: "26%", left: "52%", d: "0.6s" },
		{ top: "10%", left: "62%", d: "1.2s" },
		{ top: "34%", left: "46%", d: "0.3s" },
	];
	return (
		<PromoScene
			{...props}
			label={`${props.title}. ${props.cta}`}
			bg={s.wolfBg}
			far={
				<>
					{stars.map((st) => (
						<span
							key={st.left}
							className={s.star}
							style={{ top: st.top, left: st.left, animationDelay: st.d }}
						/>
					))}
					<span className={s.moon} />
					<span className={s.skyline}>
						{bars.map((h, i) => (
							<span
								key={`${h}-${i}`}
								className={s.bar}
								style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }}
							/>
						))}
					</span>
				</>
			}
			near={
				<>
					<span className={s.ring} />
					<span className={s.wolf}>
						<WolfIcon size={76} animated />
					</span>
				</>
			}
		/>
	);
}

/** Market Square: a comet across an open grid; the lockup glitches on the beat. */
export function MarketScene(props: { cta: string; href: string }) {
	return (
		<PromoScene
			{...props}
			label={`Market Square. ${props.cta}`}
			bg={s.marketBg}
			far={
				<>
					<span className={s.scan} />
					<span className={s.comet} />
					<span className={s.comet} style={{ top: "62%", animationDelay: "1.5s" }} />
				</>
			}
			headline={
				<span className={s.lockup}>
					<MarketSquareLockup
						markClassName="h-[26px] w-auto text-white"
						wordClassName="font-display text-[calc(22px*var(--ws-fs))] font-semibold leading-none"
					/>
				</span>
			}
			title="The universal platform"
		/>
	);
}
