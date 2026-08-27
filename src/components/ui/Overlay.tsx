"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { X } from "@phosphor-icons/react";
import { useEffect } from "react";

/**
 * THE overlay grammar. Every popover, sheet, select and modal in the app is
 * built from these — ratified from the home search window, 2026-08-27.
 *
 * Before this there were forty-odd overlays, each with its own scrim opacity,
 * radius, easing and close affordance. They were recognisably the same idea
 * rendered forty different ways, which is the definition of an app that feels
 * unfinished. Reach for these instead of hand-rolling a `fixed inset-0`.
 *
 * The rules, so a new surface does not drift:
 *
 * - **One blur per stack.** The panel carries `backdrop-blur`; the scrim is a
 *   flat wash. Blur the scrim too and the page behind goes to soup.
 * - **`glass-frost` follows the theme** (dark fill in dark, white in light),
 *   so ink must come from theme tokens — `text-primary`, `text-muted`,
 *   `text-subtle` — never `glass-ink`, which is fixed white and vanishes on
 *   the light panel.
 * - **Chips inside are tints**, not another glass layer.
 * - Radius is `rounded-2xl`. This is the sanctioned exception to the tight
 *   radius ladder; glass surfaces are their own family.
 */

/** The one easing. */
const EASE = [0.2, 0, 0, 1] as const;

export const overlayPanelClass =
	"glass-frost backdrop-blur-2xl backdrop-saturate-150 overflow-hidden flex flex-col";

/** Drops down from the top. For search, command and anything centred. */
export const centerMotion = {
	initial: { opacity: 0, y: -10, scale: 0.985 },
	animate: { opacity: 1, y: 0, scale: 1 },
	exit: { opacity: 0, y: -10, scale: 0.985 },
	transition: { duration: 0.22, ease: EASE },
};

/** Grows from the control that opened it. For anchored popovers and sheets. */
export const anchoredMotion = {
	initial: { opacity: 0, y: 16, scale: 0.98 },
	animate: { opacity: 1, y: 0, scale: 1 },
	exit: { opacity: 0, y: 16, scale: 0.98 },
	transition: { duration: 0.26, ease: EASE },
};

/**
 * Esc to dismiss, and the page behind must not scroll under the panel.
 * Every overlay needs both; almost none of them had both.
 */
export function useOverlayDismiss(open: boolean, onClose: () => void) {
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			window.removeEventListener("keydown", onKey);
			document.body.style.overflow = prev;
		};
	}, [open, onClose]);
}

/**
 * The click-catcher behind a panel.
 *
 * `dim={false}` for a desktop popover: a popover is not a modal, and dimming
 * the thing you are acting on — the video you are commenting on, the feed you
 * are searching — is exactly backwards. Sheets and modals dim.
 */
export function OverlayScrim({
	onClose,
	dim = true,
	label = "Close",
}: {
	onClose: () => void;
	dim?: boolean;
	label?: string;
}) {
	return (
		<motion.button
			type="button"
			aria-label={label}
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.2, ease: EASE }}
			onClick={onClose}
			className={clsx(
				"fixed inset-0 z-modal cursor-default",
				// Dimmed on mobile even for popovers: down there the panel owns
				// the screen and there is nothing to keep visible behind it.
				dim ? "bg-black/50" : "bg-black/45 sm:bg-transparent",
			)}
		/>
	);
}

export type OverlayVariant = "center" | "anchored" | "sheet";

const VARIANT: Record<OverlayVariant, string> = {
	// Search, command palette, pickers: a plate that drops from the top.
	center:
		"fixed left-1/2 top-[7vh] z-modal w-[min(680px,94vw)] -translate-x-1/2 max-h-[78vh] rounded-2xl",
	// Comments, chat, menus: bottom sheet on a phone, floating card on desktop.
	anchored:
		"fixed z-modal inset-x-0 bottom-0 max-h-[74vh] rounded-t-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[380px] sm:max-h-[min(600px,72vh)] sm:rounded-2xl",
	// Forms and flows that want the width: full sheet up from the bottom.
	sheet:
		"fixed z-modal inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl sm:inset-x-auto sm:left-1/2 sm:bottom-auto sm:top-[7vh] sm:w-[min(560px,94vw)] sm:-translate-x-1/2 sm:rounded-2xl",
};

export function OverlayPanel({
	variant = "center",
	className,
	label,
	children,
}: {
	variant?: OverlayVariant;
	className?: string;
	/** Accessible name. A dialog without one is unnavigable by screen reader. */
	label: string;
	children: React.ReactNode;
}) {
	const motionProps = variant === "center" ? centerMotion : anchoredMotion;
	return (
		<motion.div
			role="dialog"
			aria-modal="true"
			aria-label={label}
			{...motionProps}
			style={variant === "anchored" ? { transformOrigin: "bottom right" } : undefined}
			className={clsx(overlayPanelClass, VARIANT[variant], className)}
		>
			{/* Grab handle, phones only, and only where the panel rises from the
			    bottom edge — it is a lie on a centred plate. */}
			{variant !== "center" && (
				<span
					aria-hidden
					className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-pill bg-primary/25 sm:hidden"
				/>
			)}
			{children}
		</motion.div>
	);
}

/** Title row with the standard close chip. */
export function OverlayHeader({
	title,
	count,
	onClose,
	closeLabel = "Close",
	children,
}: {
	title?: React.ReactNode;
	/** Rendered next to the title in muted tabular figures. */
	count?: React.ReactNode;
	onClose: () => void;
	closeLabel?: string;
	/** Replaces the title entirely — a search field, a segmented control. */
	children?: React.ReactNode;
}) {
	return (
		<div className="flex h-12 shrink-0 items-center gap-2 px-4">
			{children ?? (
				<h2 className="flex-1 truncate font-sans text-[14px] font-semibold text-primary">
					{title}
					{count != null && (
						<span className="ml-1.5 font-normal tabular-nums text-subtle">
							{count}
						</span>
					)}
				</h2>
			)}
			<button
				type="button"
				onClick={onClose}
				aria-label={closeLabel}
				/* A tint, not another blur — nesting backdrop-filter inside a
				   blurred panel blurs the panel's own fill. */
				className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-chip text-muted transition-colors hover:text-primary"
			>
				<X size={14} weight="bold" />
			</button>
		</div>
	);
}
