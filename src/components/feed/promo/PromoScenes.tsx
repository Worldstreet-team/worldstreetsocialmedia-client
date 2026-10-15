"use client";

import { Heart } from "@phosphor-icons/react";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
import WolfIcon from "@/assets/icons/WolfIcon";
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

/**
 * Wolf of WorldStreet: the mark in its own light. Still on purpose (the
 * first cut, with a skyline rising and sinking, a howl ring and twitching
 * ears, was "annoying"): the wolf stands in a gold halo, the camera pushes
 * in, and one glint crosses its facets as the halo brightens.
 */
export function WolfScene(props: { eyebrow: string; title: string; cta: string; onOpen: () => void }) {
	return (
		<PromoScene
			{...props}
			label={`${props.title}. ${props.cta}`}
			bg={s.wolfBg}
			far={<span className={s.halo} />}
			near={
				<span className={s.wolf}>
					<WolfIcon size={84} shine />
				</span>
			}
		/>
	);
}
