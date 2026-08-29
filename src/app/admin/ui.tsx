"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

/** Shared building blocks for the write desks, in the house glass family:
 *  Card is a pane (`glass-card`, carrying its ONE blur), everything inside
 *  is `glass-tile` — a tint, never a second blur. Same rules AdminShell
 *  documents; the desks just follow them. */

export function Card({
	title,
	children,
	action,
}: {
	title?: string;
	children: React.ReactNode;
	action?: React.ReactNode;
}) {
	return (
		<section className="glass-card rounded-xl p-4 backdrop-blur-lg backdrop-saturate-150 sm:p-5">
			{(title || action) && (
				<div className="flex items-center justify-between mb-3">
					{title && (
						<h2 className="font-display text-[15px] font-semibold text-primary">
							{title}
						</h2>
					)}
					{action}
				</div>
			)}
			{children}
		</section>
	);
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
	return (
		<div className="glass-tile rounded-lg p-3.5">
			<div className="text-muted text-[12px] uppercase tracking-wide font-sans">
				{label}
			</div>
			<div className="font-display text-2xl font-semibold text-primary mt-1 tabular-nums">
				{value}
			</div>
			{sub && <div className="text-subtle text-[12px] mt-1">{sub}</div>}
		</div>
	);
}

export function Tag({
	children,
	tone = "neutral",
}: {
	children: React.ReactNode;
	tone?: "neutral" | "good" | "bad" | "brand";
}) {
	const tones = {
		neutral: "glass-tile text-muted",
		good: "glass-tile text-success",
		bad: "glass-tile text-danger",
		brand: "glass-tile text-brand",
	} as const;
	return (
		<span
			className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${tones[tone]}`}
		>
			{children}
		</span>
	);
}

export function Btn({
	children,
	onClick,
	tone = "neutral",
	busy,
	disabled,
	small,
}: {
	children: React.ReactNode;
	onClick?: () => void;
	tone?: "neutral" | "brand" | "danger";
	busy?: boolean;
	disabled?: boolean;
	small?: boolean;
}) {
	const tones = {
		neutral: "glass-tile text-primary hover:opacity-80",
		brand: "bg-brand text-brand-on hover:bg-brand-active",
		danger: "glass-tile text-danger hover:opacity-80",
	} as const;
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled || busy}
			className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-opacity disabled:opacity-40 ${
				small ? "px-2.5 py-1 text-[12px]" : "px-3.5 py-1.5 text-[13px]"
			} ${tones[tone]}`}
		>
			{busy && <Loader2 size={13} className="animate-spin" />}
			{children}
		</button>
	);
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
	return (
		<input
			{...props}
			className={`glass-tile rounded-lg px-3 py-1.5 text-[13px] text-primary placeholder:text-subtle outline-none focus:border-brand w-full ${props.className ?? ""}`}
		/>
	);
}

/**
 * A destructive action that unfolds into its reason box — the API refuses
 * reasonless destruction anyway, so the UI collects it up front.
 */
export function ReasonAction({
	label,
	tone = "danger",
	onConfirm,
}: {
	label: string;
	tone?: "danger" | "brand" | "neutral";
	onConfirm: (reason: string) => Promise<void>;
}) {
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState("");
	const [busy, setBusy] = useState(false);

	if (!open) {
		return (
			<Btn tone={tone} small onClick={() => setOpen(true)}>
				{label}
			</Btn>
		);
	}
	return (
		<span className="inline-flex items-center gap-1.5">
			<Input
				autoFocus
				placeholder="Reason (required)"
				value={reason}
				onChange={(e) => setReason(e.target.value)}
				className="!w-52"
			/>
			<Btn
				tone={tone}
				small
				busy={busy}
				disabled={!reason.trim()}
				onClick={async () => {
					setBusy(true);
					try {
						await onConfirm(reason.trim());
						setOpen(false);
						setReason("");
					} finally {
						setBusy(false);
					}
				}}
			>
				Confirm
			</Btn>
			<Btn small onClick={() => setOpen(false)}>
				Cancel
			</Btn>
		</span>
	);
}

export function Empty({ text }: { text: string }) {
	return (
		<div className="text-subtle text-[13px] py-8 text-center">{text}</div>
	);
}

export function ErrorNote({ text }: { text: string }) {
	return (
		<div className="text-danger text-[13px] py-2" role="alert">
			{text}
		</div>
	);
}

export const fmtDate = (d?: string | Date | null) =>
	d ? new Date(d).toLocaleString() : "—";

export const usd = (minor?: number | null) =>
	typeof minor === "number" ? `$${(minor / 100).toFixed(2)}` : "—";
