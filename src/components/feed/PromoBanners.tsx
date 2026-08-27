"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
import { useSetAtom } from "jotai";
import WolfIcon from "@/assets/icons/WolfIcon";
import { MarketSquareLockup } from "@/assets/icons/MarketMark";
import { premiumOpenAtom } from "@/store/ui.atom";
import { useT } from "@/i18n/client";

const ROTATE_MS = 5500;

interface Slide {
	key: string;
	eyebrow?: string;
	cta: string;
	onOpen?: () => void;
	href?: string;
	/** Sits in the crisp upper half of the artwork. */
	mark: React.ReactNode;
	title?: React.ReactNode;
	sub?: string;
}

/**
 * The promo carousel on the right rail.
 *
 * The ambience photograph fills the whole card, not a header strip. Its blur
 * is baked as a vertical ramp (see public/images/promo), so the top stays
 * crisp behind the mark while the bottom softens into a wash that copy can
 * sit on without a heavy scrim.
 *
 * One and a half cards show at a time so the rail admits there is more to
 * swipe to, and the dots live under the track rather than over the artwork.
 */
export function PromoBanners() {
	const t = useT();
	const setPremiumOpen = useSetAtom(premiumOpenAtom);
	const [index, setIndex] = useState(0);
	const [paused, setPaused] = useState(false);
	const reduceRef = useRef(false);

	useEffect(() => {
		reduceRef.current = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
	}, []);

	const slides: Slide[] = [
		{
			key: "premium",
			eyebrow: t("promo.premium.eyebrow"),
			title: t("promo.premium.title"),
			cta: t("promo.premium.cta"),
			onOpen: () => setPremiumOpen(true),
			mark: (
				// The real badge component, not a lookalike: this advert sells the
				// tick, so it shows the tick.
				<span className="drop-shadow-[0_2px_18px_rgba(234,179,8,0.55)]">
					<VerifiedIcon size={{ width: "44", height: "44" }} />
				</span>
			),
		},
		{
			key: "wolf",
			eyebrow: t("promo.wolf.eyebrow"),
			title: t("promo.wolf.title"),
			cta: t("promo.wolf.cta"),
			onOpen: () => setPremiumOpen(true),
			mark: <WolfIcon size={46} />,
		},
		{
			key: "market",
			// The lockup is the headline: MARKET in ink, Square in gradient.
			mark: (
				<MarketSquareLockup
					markClassName="h-[27px] w-auto"
					wordClassName="font-display text-[22px] font-semibold leading-none"
				/>
			),
			cta: t("promo.market.cta"),
			href: "https://tsionark.com",
		},
	];

	const count = slides.length;
	const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);

	useEffect(() => {
		if (paused || reduceRef.current) return;
		const id = setInterval(next, ROTATE_MS);
		return () => clearInterval(id);
	}, [paused, next]);

	return (
		<div
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
			onFocusCapture={() => setPaused(true)}
			onBlurCapture={() => setPaused(false)}
		>
			<div className="overflow-hidden">
				<div
					className="flex gap-2.5 transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)]"
					style={{ transform: `translateX(calc(${-index} * (68% + 0.625rem)))` }}
				>
					{slides.map((slide) => {
						const inner = (
							<>
								{/* the photograph, full bleed */}
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
									{/* mark rides the crisp top of the frame */}
									<span className="flex flex-1 items-center justify-center pb-1">
										{slide.mark}
									</span>

									{slide.eyebrow && (
										<span className="block font-sans text-[9.5px] font-bold uppercase tracking-[0.14em] text-primary/55">
											{slide.eyebrow}
										</span>
									)}
									{slide.title && (
										<span className="mt-1 block font-display text-[15px] font-semibold leading-tight text-primary">
											{slide.title}
										</span>
									)}
									{slide.sub && (
										<span className="mt-0.5 block font-sans text-[11px] text-primary/55">
											{slide.sub}
										</span>
									)}

									<span className="mt-3 flex h-8 w-full items-center justify-center rounded-pill bg-primary font-sans text-[12px] font-semibold text-page">
										{slide.cta}
									</span>
								</span>
							</>
						);

						// shine-soft, not shine: the CTA-sized sweep reads as a flare
						// across a whole card.
						const className =
							"shine-soft relative block h-[236px] w-[68%] shrink-0 cursor-pointer overflow-hidden rounded-xl bg-surface text-left";

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
			</div>

			<div className="mt-2.5 flex items-center justify-center gap-1.5">
				{slides.map((slide, i) => (
					<button
						key={slide.key}
						type="button"
						aria-label={slide.eyebrow ?? slide.key}
						aria-current={i === index}
						onClick={() => setIndex(i)}
						className={clsx(
							"h-1.5 cursor-pointer rounded-pill transition-all",
							i === index
								? "w-4 bg-primary"
								: "w-1.5 bg-primary/25 hover:bg-primary/45",
						)}
					/>
				))}
			</div>
		</div>
	);
}
