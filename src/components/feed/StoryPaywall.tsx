"use client";

import { useState } from "react";
import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";
import {
	Camera,
	Confetti,
	Crown,
	CurrencyDollar,
	DownloadSimple,
	Fire,
	Heart,
	Lightning,
	MusicNotes,
	SealCheck,
	Sparkle,
	Star,
	X,
} from "@phosphor-icons/react";
import { unlockStoryAction } from "@/lib/stories.actions";
import { useT } from "@/i18n/client";

const OUTER = [Star, Heart, Sparkle, Crown, Fire, MusicNotes, Camera, Confetti];
const INNER = [SealCheck, Lightning, CurrencyDollar, DownloadSimple, Star, Heart];

/**
 * The $1 unlock drawer, living inside the story frame.
 *
 * Two icon orbits circle the price in opposite directions, each glyph
 * counter-rotated so it stays upright while its ring turns. Under reduced
 * motion the rings hold still and the price still reads.
 */
export function StoryPaywall({
	storyId,
	fromScreenshot,
	onUnlocked,
	onClose,
}: {
	storyId: string;
	/** True when a screenshot attempt opened this rather than the Save button. */
	fromScreenshot: boolean;
	onUnlocked: (url: string) => void;
	onClose: () => void;
}) {
	const t = useT();
	const reduce = useReducedMotion();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const unlock = async () => {
		if (busy) return;
		setBusy(true);
		setError(null);
		const res = await unlockStoryAction(storyId);
		setBusy(false);
		if (res.success && res.url) {
			onUnlocked(res.url);
			return;
		}
		setError(
			res.code === "INSUFFICIENT_BALANCE"
				? t("story.unlock.topup")
				: (res.message ?? t("story.unlock.topup")),
		);
	};

	return (
		<motion.div
			initial={{ y: "100%" }}
			animate={{ y: 0 }}
			exit={{ y: "100%" }}
			transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
			className="absolute inset-x-0 bottom-0 z-30 rounded-t-2xl glass-dock backdrop-blur-xl backdrop-saturate-150 glass-ink"
			onClick={(e) => e.stopPropagation()}
		>
			<button
				type="button"
				onClick={onClose}
				aria-label={t("common.cancel")}
				className="absolute right-3 top-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill glass-chip transition-colors"
			>
				<X size={14} weight="bold" />
			</button>

			{/* the orbit stage */}
			<div className="relative mx-auto mt-7 h-[168px] w-[168px]">
				{/* outer ring, clockwise */}
				<div
					className="absolute inset-0"
					style={
						reduce ? undefined : { animation: "ws-orbit 26s linear infinite" }
					}
				>
					{OUTER.map((Icon, i) => (
						<span
							key={i}
							className="absolute left-1/2 top-1/2"
							style={{
								transform: `rotate(${(360 / OUTER.length) * i}deg) translateY(-76px) rotate(${-(360 / OUTER.length) * i}deg)`,
							}}
						>
							<span
								className="block glass-ink-dim"
								style={
									reduce
										? undefined
										: { animation: "ws-orbit-rev 26s linear infinite" }
								}
							>
								<Icon size={15} weight="duotone" />
							</span>
						</span>
					))}
				</div>

				{/* inner ring, anticlockwise */}
				<div
					className="absolute inset-[34px]"
					style={
						reduce
							? undefined
							: { animation: "ws-orbit-rev 18s linear infinite" }
					}
				>
					{INNER.map((Icon, i) => (
						<span
							key={i}
							className="absolute left-1/2 top-1/2"
							style={{
								transform: `rotate(${(360 / INNER.length) * i}deg) translateY(-50px) rotate(${-(360 / INNER.length) * i}deg)`,
							}}
						>
							<span
								className="block text-gold/80"
								style={
									reduce
										? undefined
										: { animation: "ws-orbit 18s linear infinite" }
								}
							>
								<Icon size={13} weight="fill" />
							</span>
						</span>
					))}
				</div>

				{/* the price */}
				<div className="absolute inset-0 flex items-center justify-center">
					<span className="font-display text-[44px] font-semibold leading-none tabular-nums">
						$1
					</span>
				</div>
			</div>

			<div className="px-6 pb-6 pt-4 text-center">
				<h3 className="font-display text-[17px] font-semibold leading-tight">
					{t("story.unlock.title")}
				</h3>
				<p className="mx-auto mt-1.5 max-w-[32ch] font-sans text-[12.5px] leading-relaxed glass-ink-dim">
					{fromScreenshot
						? t("story.unlock.screenshotSub")
						: t("story.unlock.sub")}
				</p>

				{error && (
					<p className="mt-2.5 font-sans text-[12px] leading-relaxed text-danger">
						{error}
					</p>
				)}

				<button
					type="button"
					onClick={unlock}
					disabled={busy}
					className={clsx(
						"mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-pill font-sans text-[14px] font-semibold transition-colors",
						busy ? "cursor-not-allowed glass-chip opacity-60" : "cursor-pointer glass-cta",
					)}
				>
					{busy && (
						<span className="h-3.5 w-3.5 animate-spin rounded-pill border-2 border-current/30 border-t-current" />
					)}
					{busy ? t("story.unlock.processing") : t("story.unlock.cta")}
				</button>
			</div>
		</motion.div>
	);
}
