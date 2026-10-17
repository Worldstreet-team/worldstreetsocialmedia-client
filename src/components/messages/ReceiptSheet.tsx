"use client";

import { ArrowRight, Check, Copy, DownloadSimple, ShareNetwork, X } from "@phosphor-icons/react";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { createPortal } from "react-dom";
import { OverlayPanel, OverlayScrim, useOverlayDismiss } from "@/components/ui/Overlay";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

export interface ReceiptData {
	amountMinor: number;
	note?: string;
	at?: string;
	fromName: string;
	toName: string;
	fromAvatar?: string;
	toAvatar?: string;
	/** The payment message's id: the one stable handle both people share. */
	reference: string;
}

const money = (minor: number) =>
	`$${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Short, readable, and the same for both sides: the tail of the message id. */
export const receiptRef = (id: string) => `WS-${id.slice(-8).toUpperCase()}`;

/**
 * The receipt behind a payment message (owner pick 2026-10-07, "Statement").
 *
 * A hero in the payment's own fill (the bubble passes its resolved gradient,
 * since the chat theme's variables do not reach a portal), who paid whom,
 * a three-step status line, the facts as a small grid, a reference you can
 * copy, and Share / Save PDF.
 *
 * Portalled to the body: a bubble rides inside transformed, virtualised
 * rows, and a fixed panel inside a transformed parent is fixed to that
 * parent, not the screen.
 *
 * Honest about what it knows: a payment message only exists once the
 * transfer has cleared, so every step is complete, but only Sent carries a
 * time, because that is the only time the message records.
 */
export function ReceiptSheet({
	open,
	onClose,
	data,
	heroFill,
	heroInk,
}: {
	open: boolean;
	onClose: () => void;
	data: ReceiptData;
	heroFill?: string;
	heroInk?: string;
}) {
	useOverlayDismiss(open, onClose);
	const [copied, setCopied] = useState(false);
	if (typeof document === "undefined") return null;

	const ref = receiptRef(data.reference);
	const when = data.at ? new Date(data.at) : null;
	const summary = [
		`WorldStreet payment receipt`,
		`${money(data.amountMinor)} from ${data.fromName} to ${data.toName}`,
		data.note ? `Note: ${data.note}` : "",
		when ? `Date: ${format(when, "d MMM yyyy, h:mm a")}` : "",
		`Reference: ${ref}`,
	]
		.filter(Boolean)
		.join("\n");

	const copyRef = async () => {
		try {
			await navigator.clipboard.writeText(ref);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1400);
		} catch {
			/* clipboard blocked: nothing to undo */
		}
	};
	const share = async () => {
		if (navigator.share) {
			try {
				await navigator.share({ title: "Payment receipt", text: summary });
				return;
			} catch {
				/* dismissed: fall through to copy */
			}
		}
		try {
			await navigator.clipboard.writeText(summary);
		} catch {
			/* ignore */
		}
	};
	// A plain printable page; the browser's own Save as PDF does the rest.
	const savePdf = () => {
		const w = window.open("", "_blank", "width=480,height=720");
		if (!w) return;
		const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
		const rows = [
			["Amount", money(data.amountMinor)],
			["From", data.fromName],
			["To", data.toName],
			...(data.note ? [["Note", data.note]] : []),
			...(when ? [["Date", format(when, "d MMM yyyy, h:mm a")]] : []),
			["Status", "Completed"],
			["Reference", ref],
		];
		w.document.write(
			`<!doctype html><title>Receipt ${esc(ref)}</title><style>body{font:14px system-ui,sans-serif;color:#0c0a09;padding:32px;max-width:420px;margin:auto}h1{font-size:15px;margin:0 0 4px}.amt{font-size:36px;font-weight:600;margin:12px 0 20px}table{width:100%;border-collapse:collapse}td{padding:9px 0;border-bottom:1px solid #e7e5e4}td:first-child{color:#78716c}td:last-child{text-align:right;font-weight:600}</style><h1>WorldStreet payment receipt</h1><div class="amt">${esc(money(data.amountMinor))}</div><table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table><script>window.onload=()=>{window.print()}</script>`,
		);
		w.document.close();
	};

	const face = (src: string | undefined, name: string) => (
		<span className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-white font-sans text-[10px] font-bold text-[#0C0A09]">
			{src ? <SafeAvatar src={src} /> : name.charAt(0).toUpperCase()}
		</span>
	);

	return createPortal(
		<AnimatePresence>
			{open && (
				<>
					<OverlayScrim onClose={onClose} label="Close receipt" />
					<OverlayPanel
						variant="center"
						ground="none"
						dragClose={onClose}
						label="Payment receipt"
						className="!top-[6vh] !max-h-[88vh] !w-[min(420px,94vw)] overflow-hidden !rounded-[28px] bg-surface/80 shadow-pop backdrop-blur-2xl backdrop-saturate-150"
					>
						<div className="flex min-h-0 flex-col overflow-y-auto">
							<div
								className="flex flex-col gap-3.5 px-5 pb-6 pt-4"
								style={{
									background:
										heroFill ||
										"#087A94",
									color: heroInk || "#FFFFFF",
								}}
							>
								<div className="flex items-center">
									<span className="font-sans text-[calc(13px*var(--ws-fs))] font-semibold opacity-80">
										Payment receipt
									</span>
									<button
										type="button"
										onClick={onClose}
										aria-label="Close"
										className="ml-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-pill bg-white/15 transition-colors hover:bg-white/25"
									>
										<X size={15} weight="bold" />
									</button>
								</div>
								<span className="font-display text-[calc(42px*var(--ws-fs))] font-semibold leading-none tracking-[-0.03em] tabular-nums">
									{money(data.amountMinor)}
								</span>
								<span className="flex flex-wrap items-center gap-2.5">
									{[
										[data.fromAvatar, data.fromName],
										[data.toAvatar, data.toName],
									].map(([src, name], i) => (
										<span key={i === 0 ? "from" : "to"} className="contents">
											{i === 1 && <ArrowRight size={15} weight="bold" className="opacity-80" />}
											<span className="flex h-[30px] items-center gap-1.5 rounded-pill bg-white/15 py-0.5 pl-[3px] pr-2.5">
												{face(src, name ?? "")}
												<span className="max-w-[120px] truncate font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold">
													{name}
												</span>
											</span>
										</span>
									))}
								</span>
							</div>

							<ol className="grid grid-cols-3 px-5 pb-1 pt-5">
								{["Sent", "Cleared", "Delivered"].map((label, i) => (
									<li key={label} className="flex flex-col gap-1.5">
										<span className="flex items-center">
											<span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-pill bg-success text-white">
												<Check size={11} weight="bold" />
											</span>
											{i < 2 && <span className="h-0.5 flex-1 bg-success/40" />}
										</span>
										<span className="font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
											{label}
										</span>
										<span className="font-mono text-[calc(10.5px*var(--ws-fs))] text-subtle">
											{i === 0 && when ? format(when, "h:mm a") : " "}
										</span>
									</li>
								))}
							</ol>

							<div className="grid grid-cols-2 gap-2 px-5 pt-4">
								{(
									[
										["Note", data.note || "No note"],
										["Date", when ? format(when, "d MMM yyyy") : "—"],
										["From", data.fromName],
										["To", data.toName],
									] as const
								).map(([k, v]) => (
									<div key={k} className="rounded-[14px] bg-primary/5 px-3 py-2.5">
										<span className="block font-sans text-[calc(11.5px*var(--ws-fs))] font-semibold text-subtle">
											{k}
										</span>
										<span className="block truncate font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary">
											{v}
										</span>
									</div>
								))}
							</div>

							<div className="px-5 pt-2">
								<div className="flex h-11 items-center gap-2 rounded-[14px] bg-primary/5 pl-3 pr-1.5">
									<span className="font-sans text-[calc(12px*var(--ws-fs))] font-semibold text-subtle">Ref</span>
									<span className="font-mono text-[calc(13px*var(--ws-fs))] font-semibold text-primary">{ref}</span>
									<button
										type="button"
										onClick={() => void copyRef()}
										className="ml-auto flex h-8 cursor-pointer items-center gap-1.5 rounded-[9px] bg-primary/5 px-2.5 font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold text-primary transition-colors hover:bg-primary/10"
									>
										{copied ? <Check size={13} weight="bold" /> : <Copy size={13} />}
										{copied ? "Copied" : "Copy"}
									</button>
								</div>
							</div>

							<div className="flex flex-col gap-2.5 px-5 pb-5 pt-4">
								<div className="flex gap-2.5">
									<motion.button
										type="button"
										whileTap={{ scale: 0.97 }}
										onClick={() => void share()}
										className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-pill bg-primary/5 font-sans text-[calc(14px*var(--ws-fs))] font-bold text-primary transition-colors hover:bg-primary/10"
									>
										<ShareNetwork size={16} />
										Share
									</motion.button>
									<motion.button
										type="button"
										whileTap={{ scale: 0.97 }}
										onClick={savePdf}
										className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-pill bg-brand font-sans text-[calc(14px*var(--ws-fs))] font-bold text-brand-on transition-colors hover:bg-brand-active"
									>
										<DownloadSimple size={16} weight="bold" />
										Save PDF
									</motion.button>
								</div>
							</div>
						</div>
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>,
		document.body,
	);
}
