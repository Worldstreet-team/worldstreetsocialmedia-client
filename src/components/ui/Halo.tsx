"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { DUR, EASE, EASE_IN, press } from "@/lib/motion-presets";

/**
 * Halo, the popover grammar for menus that offer a handful of things to
 * make or do (owner pick 2026-10-10: "Direction B · Halo", solid, no glow).
 *
 * One glass panel on the surface step (owner 2026-10-12: "clean dark
 * blurs", white glass in the light theme), a hairline and the pop shadow,
 * a large radius. Inside: a row of round chips for the quick actions, then
 * pill rows for the rest, destructive rows last and red. Everything paints
 * from theme tokens, so it follows dark, light and the user's ground.
 */
export const haloPanel =
	"rounded-[28px] bg-raised/75 [html[data-ws-theme=platform-light]_&]:bg-surface/90 p-4 shadow-pop backdrop-blur-2xl backdrop-saturate-150";

/** The same glass for panels that own their own padding and shape. */
export const haloGlass =
	"bg-raised/75 [html[data-ws-theme=platform-light]_&]:bg-surface/90 shadow-pop backdrop-blur-2xl backdrop-saturate-150";

/** A round action: 52px circle, label beneath. */
export function HaloChip({
	icon,
	label,
	onClick,
	tone = "default",
	badge,
}: {
	icon: ReactNode;
	label: string;
	onClick: () => void;
	/** `brand` lights the most likely pick; `danger` tints the glyph only. */
	tone?: "default" | "brand" | "danger";
	badge?: number;
}) {
	return (
		<motion.button
			type="button"
			onClick={onClick}
			{...press}
			className="group flex w-[72px] cursor-pointer flex-col items-center gap-2 outline-none"
		>
			<span
				className={clsx(
					"relative flex h-[52px] w-[52px] items-center justify-center rounded-pill transition-colors",
					tone === "brand"
						? "bg-brand text-brand-on group-hover:bg-brand-active"
						: "bg-primary/[0.09] group-hover:bg-primary/[0.14]",
					tone === "danger" ? "text-danger" : tone === "default" && "text-primary",
					"group-focus-visible:ring-2 group-focus-visible:ring-brand",
				)}
			>
				{icon}
				{badge ? (
					<span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-pill border-2 border-surface bg-brand px-1 font-sans text-[10px] font-bold tabular-nums text-brand-on">
						{badge}
					</span>
				) : null}
			</span>
			<span
				className={clsx(
					"font-sans text-[calc(12px*var(--ws-fs))]",
					tone === "brand" ? "font-semibold text-primary" : "font-medium text-muted",
				)}
			>
				{label}
			</span>
		</motion.button>
	);
}

export function HaloChips({ children }: { children: ReactNode }) {
	return <div className="flex items-start justify-between px-1">{children}</div>;
}

/** A pill row: icon, label, optional trailing value. */
export function HaloRow({
	icon,
	label,
	value,
	trailing,
	onClick,
	danger,
}: {
	icon?: ReactNode;
	label: ReactNode;
	value?: ReactNode;
	trailing?: ReactNode;
	onClick: () => void;
	danger?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={clsx(
				"flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-pill bg-primary/[0.06] px-4 text-left outline-none transition-colors hover:bg-primary/[0.1] focus-visible:ring-2 focus-visible:ring-brand",
				danger ? "text-danger" : "text-primary",
			)}
		>
			{icon && (
				<span className={clsx("flex shrink-0", danger ? "text-danger" : "text-muted")}>
					{icon}
				</span>
			)}
			<span className="min-w-0 flex-1 truncate font-sans text-[calc(14px*var(--ws-fs))] font-semibold">
				{label}
			</span>
			{value != null && (
				<span className="shrink-0 truncate font-sans text-[calc(12.5px*var(--ws-fs))] text-subtle">
					{value}
				</span>
			)}
			{trailing}
		</button>
	);
}

/**
 * A Halo panel fixed to a trigger. Portalled to the body so a transformed
 * or themed ancestor can neither trap nor recolour it. Opens below the
 * trigger by default; `side="top"` for triggers near the bottom edge.
 */
export function HaloPopover({
	anchor,
	open,
	onClose,
	side = "bottom",
	align = "end",
	width = 280,
	offset = 10,
	label,
	children,
}: {
	anchor: React.RefObject<HTMLElement | null>;
	open: boolean;
	onClose: () => void;
	side?: "top" | "bottom";
	align?: "start" | "end";
	width?: number;
	offset?: number;
	label: string;
	children: ReactNode;
}) {
	const panel = useRef<HTMLDivElement>(null);
	const [rect, setRect] = useState<DOMRect | null>(null);
	const place = useCallback(() => {
		if (anchor.current) setRect(anchor.current.getBoundingClientRect());
	}, [anchor]);
	useLayoutEffect(() => {
		if (open) place();
	}, [open, place]);
	useEffect(() => {
		if (!open) return;
		const down = (e: PointerEvent) => {
			const t = e.target as Node;
			if (panel.current?.contains(t) || anchor.current?.contains(t)) return;
			onClose();
		};
		const key = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("pointerdown", down, true);
		window.addEventListener("keydown", key);
		window.addEventListener("resize", place);
		return () => {
			document.removeEventListener("pointerdown", down, true);
			window.removeEventListener("keydown", key);
			window.removeEventListener("resize", place);
		};
	}, [open, onClose, place, anchor]);
	if (typeof document === "undefined") return null;
	const w = Math.min(width, window.innerWidth - 24);
	const left = rect
		? Math.max(12, Math.min(window.innerWidth - w - 12, align === "end" ? rect.right - w : rect.left))
		: 0;
	const vertical =
		side === "top"
			? { bottom: rect ? window.innerHeight - rect.top + offset : 0 }
			: { top: rect ? rect.bottom + offset : 0 };
	const origin = `${side === "top" ? "bottom" : "top"} ${align === "end" ? "right" : "left"}`;
	return createPortal(
		<AnimatePresence>
			{open && rect && (
				<motion.div
					key="halo"
					ref={panel}
					role="dialog"
					aria-label={label}
					initial={{ opacity: 0, scale: 0.94, y: side === "top" ? 6 : -6 }}
					animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: DUR.base, ease: EASE } }}
					exit={{ opacity: 0, scale: 0.97, transition: { duration: DUR.fast, ease: EASE_IN } }}
					style={{ position: "fixed", left, width: w, transformOrigin: origin, ...vertical }}
					className={clsx("z-toast", haloPanel)}
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>,
		document.body,
	);
}
