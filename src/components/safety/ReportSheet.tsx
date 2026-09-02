"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Check, Prohibit, ShieldCheck } from "@phosphor-icons/react";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { reportAction } from "@/lib/report.actions";
import {
	REPORT_DETAILS_MAX,
	REPORT_REASONS,
	REPORT_TARGET_LABEL_KEY,
	type ReportReasonId,
	type ReportTargetType,
} from "@/lib/reports";
import { useT } from "@/i18n/client";

const EASE = [0.2, 0, 0, 1] as const;

type Step = "reason" | "detail" | "done";

/**
 * The one report flow in the product, shared by every surface that can report
 * something — profiles, posts, comments, stories, rooms, communities.
 *
 * Three steps rather than one form, for a reason: picking a reason from a
 * list of twelve while also composing free text is a lot to hold at once, and
 * the third step exists because a report that vanishes into silence is what
 * makes people stop reporting. The confirmation says what actually happens
 * next and offers the block they probably also wanted.
 */
export default function ReportSheet({
	targetType,
	targetId,
	subject,
	canBlock = false,
	alreadyBlocked = false,
	onBlock,
	onClose,
}: {
	targetType: ReportTargetType;
	targetId: string;
	/** How to name the thing in the heading — usually "@handle". */
	subject?: string;
	/** Offer "also block this account" on the confirmation step. */
	canBlock?: boolean;
	alreadyBlocked?: boolean;
	onBlock?: () => void | Promise<void>;
	onClose: () => void;
}) {
	const t = useT();
	const reduce = useReducedMotion();
	const { toast } = useToast();

	const [step, setStep] = useState<Step>("reason");
	const [reason, setReason] = useState<ReportReasonId | null>(null);
	const [details, setDetails] = useState("");
	const [busy, setBusy] = useState(false);
	const [blocking, setBlocking] = useState(false);
	const [blocked, setBlocked] = useState(alreadyBlocked);

	// Esc + the body scroll lock come from the overlay grammar now.
	useOverlayDismiss(true, onClose);

	const targetLabel = t(REPORT_TARGET_LABEL_KEY[targetType]);
	const chosen = useMemo(
		() => REPORT_REASONS.find((r) => r.id === reason) ?? null,
		[reason],
	);

	const submit = async () => {
		if (!reason || busy) return;
		setBusy(true);
		const res = await reportAction({ targetType, targetId, reason, details });
		setBusy(false);

		if (!res.success) {
			toast(res.message ?? t("report.error"), { type: "error" });
			return;
		}
		setStep("done");
	};

	const blockNow = async () => {
		if (!onBlock || blocking || blocked) return;
		setBlocking(true);
		await onBlock();
		setBlocking(false);
		setBlocked(true);
	};

	const heading =
		step === "done"
			? t("report.done.title")
			: subject
				? `${t("report.title")} ${subject}`
				: `${t("report.title")} ${targetLabel}`;

	const subheading =
		step === "reason"
			? t("report.subtitle")
			: step === "detail"
				? t("report.detail.subtitle")
				: t("report.done.subtitle");

	return (
		<ConfirmModalPortal>
			<OverlayScrim onClose={onClose} label={t("common.close")} />
			<OverlayPanel dragClose={onClose} variant="sheet" label={heading}>
				{/* header */}
				<OverlayHeader onClose={onClose} closeLabel={t("common.close")}>
					{step === "detail" && (
						<button
							type="button"
							onClick={() => setStep("reason")}
							aria-label={t("common.back")}
							className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-chip text-muted transition-colors hover:text-primary"
						>
							<ArrowLeft size={14} weight="bold" />
						</button>
					)}
					<div className="min-w-0 flex-1">
						<h2 className="truncate font-sans text-[14px] font-semibold text-primary">
							{heading}
						</h2>
						<p className="truncate font-sans text-[11.5px] text-subtle">
							{subheading}
						</p>
					</div>
				</OverlayHeader>

				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(20px+var(--ws-safe-bottom))]">
					<AnimatePresence mode="wait" initial={false}>
						{step === "reason" && (
							<motion.div
								key="reason"
								initial={reduce ? false : { opacity: 0, x: 8 }}
								animate={{ opacity: 1, x: 0 }}
								exit={reduce ? { opacity: 0 } : { opacity: 0, x: -8 }}
								transition={{ duration: 0.2, ease: EASE }}
								className="flex flex-col gap-1.5"
								role="radiogroup"
								aria-label={t("report.subtitle")}
							>
								{REPORT_REASONS.map((r) => (
									<button
										key={r.id}
										type="button"
										role="radio"
										aria-checked={reason === r.id}
										onClick={() => {
											setReason(r.id);
											setStep("detail");
										}}
										className="cursor-pointer rounded-xl bg-chip px-3.5 py-3 text-left transition-colors hover:bg-raised"
									>
										<span className="flex items-center gap-2">
											<span className="font-sans text-[14.5px] font-semibold text-primary">
												{t(r.labelKey)}
											</span>
											{r.priority && (
												<span className="rounded-pill bg-raised px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
													{t("report.reason.urgent")}
												</span>
											)}
										</span>
										<span className="mt-0.5 block font-sans text-[12.5px] text-muted">
											{t(r.descKey)}
										</span>
									</button>
								))}
							</motion.div>
						)}

						{step === "detail" && (
							<motion.div
								key="detail"
								initial={reduce ? false : { opacity: 0, x: 8 }}
								animate={{ opacity: 1, x: 0 }}
								exit={reduce ? { opacity: 0 } : { opacity: 0, x: -8 }}
								transition={{ duration: 0.2, ease: EASE }}
								className="flex flex-col gap-4"
							>
								{chosen && (
									<div className="rounded-xl bg-chip px-3.5 py-3">
										<span className="block font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">
											{t("report.detail.reasonLabel")}
										</span>
										<span className="mt-1 block font-sans text-[14.5px] font-semibold text-primary">
											{t(chosen.labelKey)}
										</span>
										<span className="mt-0.5 block font-sans text-[12.5px] text-muted">
											{t(chosen.descKey)}
										</span>
									</div>
								)}

								<div>
									<label
										htmlFor="report-details"
										className="block font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-subtle"
									>
										{t("report.detail.label")}
									</label>
									<textarea
										id="report-details"
										value={details}
										onChange={(e) =>
											setDetails(
												e.target.value.slice(0, REPORT_DETAILS_MAX),
											)
										}
										rows={4}
										placeholder={t("report.detail.placeholder")}
										className="mt-1.5 w-full resize-none rounded-xl bg-sunken px-3.5 py-3 font-sans text-base text-primary outline-none transition-colors placeholder:text-subtle focus:bg-raised sm:text-[15px]"
									/>
									<div className="mt-1 flex justify-end">
										<span
											className={clsx(
												"font-sans text-[11px] tabular-nums",
												details.length > REPORT_DETAILS_MAX - 60
													? "text-primary"
													: "text-subtle",
											)}
										>
											{details.length}/{REPORT_DETAILS_MAX}
										</span>
									</div>
								</div>

								<button
									type="button"
									onClick={submit}
									disabled={busy}
									className="h-11 w-full cursor-pointer rounded-pill bg-brand font-sans text-[14px] font-semibold text-brand-on transition-colors hover:bg-brand-active disabled:cursor-not-allowed disabled:opacity-60"
								>
									{busy ? t("report.sending") : t("report.submit")}
								</button>

								<p className="text-center font-sans text-[12px] text-subtle">
									{t("report.anonymous")}
								</p>
							</motion.div>
						)}

						{step === "done" && (
							<motion.div
								key="done"
								initial={reduce ? false : { opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.24, ease: EASE }}
								className="flex flex-col gap-4"
							>
								<div className="flex items-start gap-3 rounded-xl bg-chip px-3.5 py-3">
									<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-raised text-gold">
										<ShieldCheck size={16} weight="duotone" />
									</span>
									<p className="font-sans text-[13.5px] text-muted">
										{t("report.done.body")}
									</p>
								</div>

								{canBlock && onBlock && (
									<button
										type="button"
										onClick={blockNow}
										disabled={blocking || blocked}
										className={clsx(
											"flex h-11 w-full items-center justify-center gap-2 rounded-pill font-sans text-[14px] font-semibold transition-colors",
											blocked
												? "cursor-default bg-chip text-muted"
												: "cursor-pointer bg-chip text-primary hover:bg-raised",
										)}
									>
										{blocked ? (
											<>
												<Check size={15} weight="bold" />
												{t("report.done.blocked")}
											</>
										) : (
											<>
												<Prohibit size={15} weight="bold" />
												{blocking
													? t("report.done.blocking")
													: subject
														? `${t("report.done.blockCta")} ${subject}`
														: t("report.done.blockCta")}
											</>
										)}
									</button>
								)}

								<button
									type="button"
									onClick={onClose}
									className="h-11 w-full cursor-pointer rounded-pill bg-brand font-sans text-[14px] font-semibold text-brand-on transition-colors hover:bg-brand-active"
								>
									{t("common.done")}
								</button>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</OverlayPanel>
		</ConfirmModalPortal>
	);
}
