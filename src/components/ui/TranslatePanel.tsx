"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
	ChartLineUp,
	CurrencyCircleDollar,
	Hash,
	Lightbulb,
	Translate,
	TrendDown,
	TrendUp,
} from "@phosphor-icons/react";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { LOCALES, type Locale } from "@/i18n/config";
import { useT } from "@/i18n/client";
import { translatePostToAction } from "@/lib/translate.actions";
import { decodePost } from "@/lib/decode";
import {
	staggerItem,
	staggerParent,
	staggerParentFast,
	staggerPop,
	swap,
	thumbSpring,
} from "@/lib/motion-presets";

type Cached =
	| { kind: "translated"; text: string; source?: string }
	| { kind: "same" }
	| { kind: "failed" };

/**
 * The translate SECTION: not an inline swap but a full panel — pick any of
 * the app's languages, read the translation beside the original, and get the
 * post decoded underneath: tickers named, slang explained, the numeric
 * signals pulled out, and a tone read. Decoding is deterministic (no model);
 * translation rides the gateway's cached seam.
 */
export function TranslatePanel({
	content,
	onClose,
}: {
	content: string;
	onClose: () => void;
}) {
	const t = useT();
	const [target, setTarget] = useState<Locale>(t.locale);
	const [cache, setCache] = useState<Partial<Record<Locale, Cached>>>({});
	const [loading, setLoading] = useState(false);
	// Per instance, so two panels could never trade one thumb between them.
	const thumbId = useId();

	const decoded = useMemo(() => decodePost(content), [content]);

	// Mounted only while open, so the overlay is always "open" to the hook —
	// it carries Escape and the scroll lock for the page underneath.
	useOverlayDismiss(true, onClose);

	useEffect(() => {
		if (cache[target]) return;
		let stale = false;
		setLoading(true);
		(async () => {
			const res = await translatePostToAction(content, target);
			if (stale) return;
			let entry: Cached;
			if (!res.success) entry = { kind: "failed" };
			else if (res.sameLanguage) entry = { kind: "same" };
			else if (res.translated)
				entry = { kind: "translated", text: res.translated, source: res.source };
			else entry = { kind: "failed" };
			setCache((prev) => ({ ...prev, [target]: entry }));
			setLoading(false);
		})();
		return () => {
			stale = true;
		};
	}, [target, content, cache]);

	const current = cache[target];

	const sourceLabel = (code?: string) => {
		if (!code) return null;
		try {
			return (
				new Intl.DisplayNames([t.locale], { type: "language" }).of(
					code.split("-")[0].toLowerCase(),
				) ?? code
			);
		} catch {
			return code;
		}
	};

	const ToneIcon =
		decoded.tone === "bullish"
			? TrendUp
			: decoded.tone === "bearish"
				? TrendDown
				: ChartLineUp;

	// No entry for this language yet means it is on its way: the effect above
	// always fetches a missing one. Keying off `loading` alone left one frame,
	// before that effect ran, that fell through to "failed"; harmless as a
	// blink, but a swap would hold it on screen for a whole fade.
	const pending = !current;
	// What the translation slot is showing. The slot swaps when this changes
	// and at no other time, so a re-render never replays the roll.
	const bodyKey = pending ? "loading" : `${target}:${current.kind}`;

	// The decode reads in once, when the panel opens (it is memoised on the
	// post, so nothing refetches it). A long one takes the list pace so the
	// last chip is never still arriving after the sheet has settled.
	const cascade =
		decoded.entities.length + decoded.signals.length + 1 > 8
			? staggerParentFast
			: staggerParent;

	if (typeof document === "undefined") return null;

	return createPortal(
		<>
			<OverlayScrim onClose={onClose} label={t("fab.close")} />
			<OverlayPanel dragClose={onClose} variant="sheet" label={t("translate.panel")}>
				<OverlayHeader onClose={onClose} closeLabel={t("fab.close")}>
					<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand/10 text-gold">
						<Translate size={17} />
					</span>
					<h2 className="flex-1 truncate font-display text-[calc(16px*var(--ws-fs))] font-semibold text-primary">
						{t("translate.panel")}
					</h2>
				</OverlayHeader>

				{/* language tabs. The active fill is one element that slides
				    between the pills; every pill keeps its resting chip under it.
				    `layoutScroll` because the row scrolls sideways. */}
				<motion.div
					layoutScroll
					className="flex items-center gap-1.5 px-4 py-2.5 border-b border-hairline shrink-0 overflow-x-auto [scrollbar-width:none]"
				>
					{LOCALES.map((loc) => (
						<button
							key={loc}
							type="button"
							onClick={() => setTarget(loc)}
							className={clsx(
								"relative h-8 px-3.5 rounded-pill bg-raised/60 font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold uppercase tracking-wide transition-colors cursor-pointer shrink-0",
								target === loc
									? "text-page"
									: "text-muted hover:text-primary",
							)}
						>
							{target === loc && (
								<motion.span
									aria-hidden
									layoutId={thumbId}
									transition={thumbSpring}
									className="absolute inset-0 rounded-pill bg-primary"
								/>
							)}
							<span className="relative">{loc}</span>
						</button>
					))}
				</motion.div>

				<div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
					{/* original */}
					<p className="font-sans text-[calc(11px*var(--ws-fs))] font-semibold uppercase tracking-[0.12em] text-subtle mb-1.5">
						{t("translate.original")}
					</p>
					<p className="font-sans text-[calc(13.5px*var(--ws-fs))] text-muted whitespace-pre-wrap leading-relaxed mb-4">
						{content}
					</p>

					{/* translation */}
					<p className="font-sans text-[calc(11px*var(--ws-fs))] font-semibold uppercase tracking-[0.12em] text-subtle mb-1.5">
						{target.toUpperCase()}
					</p>
					{/* Skeleton, translation, "same language" and "failed" trade
					    places instead of blinking. popLayout, not wait: the text
					    is on screen the moment it exists. */}
					<div className="relative mb-4" aria-busy={loading && pending}>
						<AnimatePresence mode="popLayout" initial={false}>
							<motion.div key={bodyKey} {...swap}>
								{pending ? (
									<div className="space-y-2">
										<div className="h-4 skeleton rounded w-full" />
										<div className="h-4 skeleton rounded w-2/3" />
									</div>
								) : current?.kind === "translated" ? (
									<div>
										<p className="font-sans text-[calc(15px*var(--ws-fs))] text-primary whitespace-pre-wrap leading-relaxed">
											{current.text}
										</p>
										{current.source && (
											<p className="font-sans text-[calc(12px*var(--ws-fs))] text-subtle mt-1.5">
												{t("post.translatedFrom")}{" "}
												{sourceLabel(current.source)}
											</p>
										)}
									</div>
								) : current?.kind === "same" ? (
									<p className="font-sans text-[calc(13.5px*var(--ws-fs))] text-subtle">
										{t("translate.same")}
									</p>
								) : (
									<p className="font-sans text-[calc(13.5px*var(--ws-fs))] text-subtle">
										{t("translate.failed")}
									</p>
								)}
							</motion.div>
						</AnimatePresence>
					</div>

					<div className="border-t border-hairline my-4" />

					{/* decoded */}
					<p className="flex items-center gap-1.5 font-sans text-[calc(11px*var(--ws-fs))] font-semibold uppercase tracking-[0.12em] text-subtle mb-2.5">
						<Lightbulb size={13} />
						{t("translate.decoded")}
					</p>

					{decoded.entities.length === 0 &&
					decoded.signals.length === 0 ? (
						<p className="font-sans text-[calc(13px*var(--ws-fs))] text-subtle">
							{t("translate.empty")}
						</p>
					) : (
						// One variant tree for the whole decode: the rows rise,
						// then the chips land, as a single cascade.
						<motion.div variants={cascade} initial="hidden" animate="show">
							{decoded.entities.length > 0 && (
								<div className="flex flex-col gap-2 mb-4">
									{decoded.entities.map((e) => (
										<motion.div
											key={e.term}
											variants={staggerItem}
											className="flex items-baseline gap-2.5"
										>
											<span
												className={clsx(
													"shrink-0 rounded-[6px] px-2 py-0.5 text-[calc(12px*var(--ws-fs))] font-semibold font-sans",
													e.kind === "ticker" &&
														"bg-convert/10 text-gold font-mono",
													e.kind === "slang" &&
														"bg-raised text-primary",
													e.kind === "topic" &&
														"bg-raised text-muted",
												)}
											>
												{e.kind === "topic" ? (
													<span className="inline-flex items-center gap-0.5">
														<Hash size={11} />
														{e.term.slice(1)}
													</span>
												) : (
													e.term
												)}
											</span>
											<span className="font-sans text-[calc(13px*var(--ws-fs))] text-muted leading-snug">
												{e.explanation}
											</span>
										</motion.div>
									))}
								</div>
							)}

							{/* signals + tone */}
							<div className="flex items-center gap-1.5 flex-wrap">
								<motion.span
									variants={staggerPop}
									className={clsx(
										"flex items-center gap-1.5 h-7 px-3 rounded-pill text-[calc(12px*var(--ws-fs))] font-semibold font-sans",
										decoded.tone === "bullish" &&
											"bg-success/10 text-success",
										decoded.tone === "bearish" &&
											"bg-danger/10 text-danger",
										decoded.tone === "neutral" &&
											"bg-raised text-muted",
									)}
								>
									<ToneIcon size={13} weight="bold" />
									{t(`translate.tone.${decoded.tone}`)}
								</motion.span>
								{decoded.signals.map((sig) => (
									<motion.span
										key={sig}
										variants={staggerPop}
										className="flex items-center gap-1 h-7 px-3 rounded-pill bg-raised text-primary text-[calc(12px*var(--ws-fs))] font-semibold font-sans tabular-nums"
									>
										<CurrencyCircleDollar
											size={13}
											className="text-subtle"
										/>
										{sig}
									</motion.span>
								))}
							</div>
						</motion.div>
					)}
				</div>
			</OverlayPanel>
		</>,
		document.body,
	);
}
