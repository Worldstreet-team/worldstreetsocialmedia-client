"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import clsx from "clsx";
import {
	ChartLineUp,
	CurrencyCircleDollar,
	Hash,
	Lightbulb,
	Translate,
	TrendDown,
	TrendUp,
	X,
} from "@phosphor-icons/react";
import { LOCALES, type Locale } from "@/i18n/config";
import { useT } from "@/i18n/client";
import { translatePostToAction } from "@/lib/translate.actions";
import { decodePost } from "@/lib/decode";

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

	const decoded = useMemo(() => decodePost(content), [content]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

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

	if (typeof document === "undefined") return null;

	return createPortal(
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
			onClick={onClose}
			className="fixed inset-0 z-modal bg-scrim flex items-end sm:items-center justify-center sm:p-4"
		>
			<motion.div
				initial={{ opacity: 0, scale: 0.98, y: 8 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label={t("translate.panel")}
				className="w-full sm:max-w-[520px] max-h-[85dvh] flex flex-col bg-surface border border-hairline rounded-t-xl sm:rounded-xl shadow-nav overflow-hidden"
			>
				<div className="flex items-center gap-3 px-4 py-3 border-b border-hairline shrink-0">
					<span className="flex h-9 w-9 items-center justify-center rounded-pill bg-brand/10 text-gold">
						<Translate size={17} />
					</span>
					<h2 className="flex-1 font-display text-[16px] font-semibold text-primary">
						{t("translate.panel")}
					</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label={t("fab.close")}
						className="flex h-10 w-10 items-center justify-center rounded-pill text-subtle hover:text-primary hover:bg-raised transition-colors cursor-pointer"
					>
						<X size={17} />
					</button>
				</div>

				{/* language tabs */}
				<div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-hairline shrink-0 overflow-x-auto [scrollbar-width:none]">
					{LOCALES.map((loc) => (
						<button
							key={loc}
							type="button"
							onClick={() => setTarget(loc)}
							className={clsx(
								"h-8 px-3.5 rounded-pill font-sans text-[12.5px] font-semibold uppercase tracking-wide transition-colors cursor-pointer shrink-0",
								target === loc
									? "bg-primary text-page"
									: "bg-raised/60 text-muted hover:text-primary",
							)}
						>
							{loc}
						</button>
					))}
				</div>

				<div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
					{/* original */}
					<p className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle mb-1.5">
						{t("translate.original")}
					</p>
					<p className="font-sans text-[13.5px] text-muted whitespace-pre-wrap leading-relaxed mb-4">
						{content}
					</p>

					{/* translation */}
					<p className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle mb-1.5">
						{target.toUpperCase()}
					</p>
					{loading && !current ? (
						<div className="space-y-2 mb-4">
							<div className="h-4 skeleton rounded w-full" />
							<div className="h-4 skeleton rounded w-2/3" />
						</div>
					) : current?.kind === "translated" ? (
						<div className="mb-4">
							<p className="font-sans text-[15px] text-primary whitespace-pre-wrap leading-relaxed">
								{current.text}
							</p>
							{current.source && (
								<p className="font-sans text-[12px] text-subtle mt-1.5">
									{t("post.translatedFrom")}{" "}
									{sourceLabel(current.source)}
								</p>
							)}
						</div>
					) : current?.kind === "same" ? (
						<p className="font-sans text-[13.5px] text-subtle mb-4">
							{t("translate.same")}
						</p>
					) : (
						<p className="font-sans text-[13.5px] text-subtle mb-4">
							{t("translate.failed")}
						</p>
					)}

					<div className="border-t border-hairline my-4" />

					{/* decoded */}
					<p className="flex items-center gap-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle mb-2.5">
						<Lightbulb size={13} />
						{t("translate.decoded")}
					</p>

					{decoded.entities.length === 0 &&
					decoded.signals.length === 0 ? (
						<p className="font-sans text-[13px] text-subtle">
							{t("translate.empty")}
						</p>
					) : (
						<>
							{decoded.entities.length > 0 && (
								<div className="flex flex-col gap-2 mb-4">
									{decoded.entities.map((e) => (
										<div
											key={e.term}
											className="flex items-baseline gap-2.5"
										>
											<span
												className={clsx(
													"shrink-0 rounded-[6px] px-2 py-0.5 text-[12px] font-semibold font-sans",
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
											<span className="font-sans text-[13px] text-muted leading-snug">
												{e.explanation}
											</span>
										</div>
									))}
								</div>
							)}

							{/* signals + tone */}
							<div className="flex items-center gap-1.5 flex-wrap">
								<span
									className={clsx(
										"flex items-center gap-1.5 h-7 px-3 rounded-pill text-[12px] font-semibold font-sans",
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
								</span>
								{decoded.signals.map((sig) => (
									<span
										key={sig}
										className="flex items-center gap-1 h-7 px-3 rounded-pill bg-raised text-primary text-[12px] font-semibold font-sans tabular-nums"
									>
										<CurrencyCircleDollar
											size={13}
											className="text-subtle"
										/>
										{sig}
									</span>
								))}
							</div>
						</>
					)}
				</div>
			</motion.div>
		</motion.div>,
		document.body,
	);
}
