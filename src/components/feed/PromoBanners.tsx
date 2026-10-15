"use client";

import { motionReduced } from "@/lib/motion";

import { useRef, useState } from "react";
import clsx from "clsx";
import { useSetAtom } from "jotai";
import { premiumOpenAtom } from "@/store/ui.atom";
import { useT } from "@/i18n/client";
import { XSTREAM_WEB_URL } from "@/const";
import {
	AcademyScene,
	ArcadeScene,
	MarketScene,
	PremiumScene,
	WolfScene,
	XstreamScene,
} from "./promo/PromoScenes";

/**
 * WorldStreet's products on the right rail, the one place promos live.
 *
 * Each card is a six-second motion piece (owner 2026-10-15: "actual video
 * motion ... 6 seconds loops with texts and camera movements following the
 * themes"), built in code rather than shipped as video: sharp at any
 * density, a few KB instead of megabytes, replayed from the top each time a
 * card slides into view, and a designed still frame under reduced motion.
 * The comps live in ./promo; every picture is the product's own (owner:
 * "use our own images"). Vivid AI has no picture of its own yet, so no card.
 *
 * The strip does not rotate on its own; it scrolls (a trackpad swipe, a
 * drag on a phone) and the dots follow it and jump to a card.
 */
export function PromoBanners() {
	const t = useT();
	const setPremiumOpen = useSetAtom(premiumOpenAtom);
	const [index, setIndex] = useState(0);
	const track = useRef<HTMLDivElement>(null);

	const cards = [
		{
			key: "premium",
			label: t("promo.premium.eyebrow"),
			node: (
				<PremiumScene
					key="premium"
					eyebrow={t("promo.premium.eyebrow")}
					title={t("promo.premium.title")}
					cta={t("promo.premium.cta")}
					onOpen={() => setPremiumOpen(true)}
				/>
			),
		},
		{
			key: "academy",
			label: "Academy",
			node: (
				<AcademyScene
					key="academy"
					title="Learn the markets"
					cta="Start learning"
					href="https://academy.worldstreetgold.com"
				/>
			),
		},
		{
			key: "xstream",
			label: "Xstream",
			node: (
				<XstreamScene
					key="xstream"
					title="Go live, watch live"
					cta="Open Xstream"
					href={XSTREAM_WEB_URL}
				/>
			),
		},
		{
			key: "arcade",
			label: "Arcade",
			node: (
				<ArcadeScene
					key="arcade"
					title="Play and compete"
					cta="Play now"
					href="https://arcade.worldstreetgold.com"
				/>
			),
		},
		{
			key: "wolf",
			label: t("promo.wolf.eyebrow"),
			node: (
				<WolfScene
					key="wolf"
					eyebrow={t("promo.wolf.eyebrow")}
					title={t("promo.wolf.title")}
					cta={t("promo.wolf.cta")}
					onOpen={() => setPremiumOpen(true)}
				/>
			),
		},
		{
			key: "market",
			label: "Market Square",
			node: (
				<MarketScene
					key="market"
					cta={t("promo.market.cta")}
					href="https://tsionark.com"
				/>
			),
		},
	];

	/** Card width plus the gap: one step of the track. */
	const step = () => {
		const card = track.current?.firstElementChild as HTMLElement | null;
		return card ? card.offsetWidth + 10 : 1;
	};

	const goTo = (i: number) => {
		track.current?.scrollTo({
			left: i * step(),
			behavior: motionReduced() ? "auto" : "smooth",
		});
	};

	return (
		<div>
			<div
				ref={track}
				onScroll={(e) =>
					setIndex(
						Math.min(
							cards.length - 1,
							Math.round(e.currentTarget.scrollLeft / step()),
						),
					)
				}
				className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{cards.map((c) => c.node)}
			</div>

			<div className="mt-3 flex items-center justify-center gap-1.5">
				{cards.map((c, i) => (
					<button
						key={c.key}
						type="button"
						aria-label={c.label}
						aria-current={i === index}
						onClick={() => goTo(i)}
						className={clsx(
							"h-[5px] cursor-pointer rounded-pill transition-all",
							i === index
								? "w-4 bg-primary"
								: "w-[5px] bg-primary/20 hover:bg-primary/40",
						)}
					/>
				))}
			</div>
		</div>
	);
}
