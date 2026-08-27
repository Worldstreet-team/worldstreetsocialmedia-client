"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
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

	if (typeof document === "undefined") return null;

	return createPortal(
		<>
			<OverlayScrim onClose={onClose} label={t("fab.close")} />
			<OverlayPanel variant="sheet" label={t("translate.panel")}>
				<OverlayHeader onClose={onClose} closeLabel={t("fab.close")}>
					<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand/10 text-gold">
						<Translate size={17} />
					</span>
					<h2 className="flex-1 truncate font-display text-[16px] font-semibold text-primary">
						{t("translate.panel")}
					</h2>
				</OverlayHeader>

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
			</OverlayPanel>
		</>,
		document.body,
	);
}
