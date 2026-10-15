"use client";

import { motionReduced } from "@/lib/motion";

import { useRef, useState } from "react";
import clsx from "clsx";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
import { useSetAtom } from "jotai";
import WolfIcon from "@/assets/icons/WolfIcon";
import { MarketSquareLockup } from "@/assets/icons/MarketMark";
import { premiumOpenAtom } from "@/store/ui.atom";
import { useT } from "@/i18n/client";
import { XSTREAM_WEB_URL } from "@/const";

interface Slide {
	key: string;
	eyebrow?: string;
	title?: React.ReactNode;
	cta: string;
	onOpen?: () => void;
	href?: string;
	/** A mark drawn in code, centred in the art side of the card. */
	mark?: React.ReactNode;
	/** Or the product's own picture, a transparent cut-out from its repo. */
	art?: string;
}

/**
 * WorldStreet's products on the right rail (Concept A, owner 2026-10-15:
 * "use our own images"), the one place promos live.
 *
 * Every picture is the product's own: the Academy's hero from
 * worldstreet-academy, the Arcade's chess queen from worldstreet-arcade,
 * Xstream's chili from xtreme-livestream (cut down to webp in
 * public/images/products), and the tick, the wolf and the Market Square
 * lockup the rail already drew. Vivid AI has no picture of its own yet, so
 * it has no slide rather than a made-up one.
 *
 * It does not rotate on its own: the rail sits beside the feed all day,
 * and motion in the corner of the eye is the thing people stop reading
 * for. A card and a half shows, so the edge of the next says there is
 * more; it scrolls (a trackpad swipe, a drag on a phone) and the dots
 * follow it and jump to a card.
 */
export function PromoBanners() {
	const t = useT();
	const setPremiumOpen = useSetAtom(premiumOpenAtom);
	const [index, setIndex] = useState(0);
	const track = useRef<HTMLDivElement>(null);

	const slides: Slide[] = [
		{
			key: "premium",
			eyebrow: t("promo.premium.eyebrow"),
			title: t("promo.premium.title"),
			cta: t("promo.premium.cta"),
			onOpen: () => setPremiumOpen(true),
			// The real badge, not a lookalike: this advert sells the tick.
			mark: <VerifiedIcon size={{ width: "52", height: "52" }} />,
		},
		{
			key: "academy",
			eyebrow: "Academy",
			title: "Learn the markets",
			cta: "Start learning",
			href: "https://academy.worldstreetgold.com",
			art: "/images/products/academy.webp",
		},
		{
			key: "xstream",
			eyebrow: "Xstream",
			title: "Go live, watch live",
			cta: "Open Xstream",
			href: XSTREAM_WEB_URL,
			art: "/images/products/xstream.webp",
		},
		{
			key: "arcade",
			eyebrow: "Arcade",
			title: "Play and compete",
			cta: "Play now",
			href: "https://arcade.worldstreetgold.com",
			art: "/images/products/arcade.webp",
		},
		{
			key: "wolf",
			eyebrow: t("promo.wolf.eyebrow"),
			title: t("promo.wolf.title"),
			cta: t("promo.wolf.cta"),
			onOpen: () => setPremiumOpen(true),
			mark: <WolfIcon size={52} />,
		},
		{
			key: "market",
			title: (
				<MarketSquareLockup
					markClassName="h-[18px] w-auto"
					wordClassName="font-display text-[calc(15px*var(--ws-fs))] font-semibold leading-none"
				/>
			),
			cta: t("promo.market.cta"),
			href: "https://tsionark.com",
		},
	];

	/** Card width plus the gap: one step of the track. */
	const step = () => {
		const el = track.current;
		const card = el?.firstElementChild as HTMLElement | null;
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
							slides.length - 1,
							Math.round(e.currentTarget.scrollLeft / step()),
						),
					)
				}
				className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{slides.map((slide) => {
					const inner = (
						<>
							{/* the house ambience, light and dark */}
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

							{/* the product's own picture, standing on the right edge */}
							{slide.art && (
								<img
									src={slide.art}
									alt=""
									aria-hidden="true"
									loading="lazy"
									className="pointer-events-none absolute right-0 bottom-0 h-[92%] w-auto max-w-[56%] object-contain object-bottom"
								/>
							)}
							{slide.mark && (
								<span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2">
									{slide.mark}
								</span>
							)}

							<span className="relative flex h-full max-w-[60%] flex-col justify-end gap-1 p-4">
								{slide.eyebrow && (
									<span className="block font-sans text-[calc(10px*var(--ws-fs))] font-semibold uppercase tracking-[0.16em] text-primary/60">
										{slide.eyebrow}
									</span>
								)}
								{slide.title && (
									<span className="block font-sans text-[calc(15px*var(--ws-fs))] font-semibold leading-snug text-primary">
										{slide.title}
									</span>
								)}
								<span className="mt-2 inline-flex h-[30px] w-fit items-center rounded-pill bg-primary px-3.5 font-sans text-[calc(12px*var(--ws-fs))] font-semibold text-page">
									{slide.cta}
								</span>
							</span>
						</>
					);

					// no-underline!: the Underline links setting is for links in
					// running text; a whole card with a pill in it is plainly one.
					const className =
						"relative block h-[168px] w-[78%] shrink-0 snap-start cursor-pointer overflow-hidden rounded-xl bg-surface text-left no-underline!";

					return slide.href ? (
						<a
							key={slide.key}
							href={slide.href}
							target="_blank"
							rel="noopener noreferrer"
							className={className}
						>
							{inner}
						</a>
					) : (
						<button
							key={slide.key}
							type="button"
							onClick={slide.onOpen}
							className={className}
						>
							{inner}
						</button>
					);
				})}
			</div>

			<div className="mt-3 flex items-center justify-center gap-1.5">
				{slides.map((slide, i) => (
					<button
						key={slide.key}
						type="button"
						aria-label={slide.eyebrow ?? slide.key}
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
