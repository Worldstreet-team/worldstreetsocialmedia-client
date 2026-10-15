"use client";

import { motionReduced } from "@/lib/motion";

import { useRef, useState } from "react";
import clsx from "clsx";
import { useSetAtom } from "jotai";
import { premiumOpenAtom } from "@/store/ui.atom";
import { useT } from "@/i18n/client";
import { XSTREAM_WEB_URL } from "@/const";
import { MarketSquareLockup } from "@/assets/icons/MarketMark";
import { PremiumScene, WolfScene, XstreamScene } from "./promo/PromoScenes";

/**
 * WorldStreet's products on the right rail, the one place promos live.
 *
 * Four cards and no more (owner 2026-10-15: "only show the xtream, the wolf
 * of worldstreet, market square and the checkmark"; Academy and Arcade were
 * cut). Premium, Xstream and the Wolf are six-second motion pieces ("actual
 * video motion ... 6 seconds loops with texts and camera movements"), built
 * in code rather than shipped as video: sharp at any density, a few KB,
 * replayed from the top each time a card slides into view, and a designed
 * still frame under reduced motion. The comps live in ./promo. Market
 * Square is its original card, held still ("leave the old market square
 * design there without motion").
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
				// The original card, still: the house ambience behind the
				// lockup and a full-width Visit. [&_*]:animate-none! holds the
				// lockup's glitch, its gradient and the ambience drift (the
				// important is needed: those rules are unlayered in
				// globals.css and outrank any layered utility).
				<a
					key="market"
					href="https://tsionark.com"
					target="_blank"
					rel="noopener noreferrer"
					aria-label={`Market Square. ${t("promo.market.cta")}`}
					className="relative block h-[168px] w-[78%] shrink-0 snap-start cursor-pointer overflow-hidden rounded-xl bg-surface text-left no-underline! [&_*]:animate-none!"
				>
					<img
						src="/images/promo/ambience-dark.webp"
						alt=""
						aria-hidden="true"
						className="promo-amb promo-amb-dark"
					/>
					<img
						src="/images/promo/ambience-light.webp"
						alt=""
						aria-hidden="true"
						className="promo-amb promo-amb-light"
					/>
					<span className="relative flex h-full flex-col p-3.5">
						<span className="flex flex-1 items-center justify-center pb-1">
							<MarketSquareLockup
								markClassName="h-[27px] w-auto"
								wordClassName="font-display text-[calc(22px*var(--ws-fs))] font-semibold leading-none"
							/>
						</span>
						<span className="mt-3 flex h-8 w-full items-center justify-center rounded-pill bg-primary font-sans text-[calc(12px*var(--ws-fs))] font-semibold text-page">
							{t("promo.market.cta")}
						</span>
					</span>
				</a>
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
