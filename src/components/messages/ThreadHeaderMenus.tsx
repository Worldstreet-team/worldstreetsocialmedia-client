"use client";

import { CaretRight } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { menuStagger, staggerItem } from "@/lib/motion-presets";

/**
 * The thread header's popups (owner pick 2026-10-07): the Call menu, the
 * overflow menu with its Mute submenu, and the name card.
 *
 * One surface for all of them: 16px radius, one hairline, a long soft
 * shadow, 40px rows of icon, label and an optional value or shortcut,
 * destructive rows last and red after a divider.
 *
 * Portalled to the body and fixed to the trigger's rect, like the settings
 * Select: the header sits inside a transformed, themed pane, so a menu
 * rendered in place would be positioned against the pane and would inherit
 * the chat theme's chrome ink (`.chat-chrome` re-points the ink tokens),
 * painting a theme's light ink on the app's surface.
 */

export function useAnchoredMenu() {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLButtonElement>(null);
	const toggle = useCallback(() => setOpen((v) => !v), []);
	const close = useCallback(() => setOpen(false), []);
	return { open, ref, toggle, close };
}

export function Popover({
	anchor,
	open,
	onClose,
	align = "end",
	width = 260,
	offset = 8,
	children,
	label,
}: {
	anchor: React.RefObject<HTMLElement | null>;
	open: boolean;
	onClose: () => void;
	/** Which edge of the trigger the panel lines up with. */
	align?: "start" | "end";
	width?: number;
	offset?: number;
	children: ReactNode;
	label: string;
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
		const scroll = (e: Event) => {
			if (!panel.current?.contains(e.target as Node)) onClose();
		};
		document.addEventListener("pointerdown", down, true);
		window.addEventListener("keydown", key);
		window.addEventListener("resize", place);
		window.addEventListener("scroll", scroll, true);
		return () => {
			document.removeEventListener("pointerdown", down, true);
			window.removeEventListener("keydown", key);
			window.removeEventListener("resize", place);
			window.removeEventListener("scroll", scroll, true);
		};
	}, [open, onClose, place, anchor]);
	if (typeof document === "undefined") return null;
	const left = rect
		? Math.max(12, Math.min(window.innerWidth - width - 12, align === "end" ? rect.right - width : rect.left))
		: 0;
	return createPortal(
		<AnimatePresence>
			{/* The thread dims and blurs behind an open menu (owner
			    2026-10-16, Messages round 3 design): the menu reads as the
			    one thing on screen. A tap on it closes, like any outside tap. */}
			{open && rect && (
				<motion.div
					key="scrim"
					aria-hidden
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.18 }}
					className="fixed inset-0 z-toast bg-[#04060a]/40 backdrop-blur-[6px]"
				/>
			)}
			{open && rect && (
				<motion.div
					key="popover"
					ref={panel}
					role="menu"
					aria-label={label}
					{...menuStagger(align === "end" ? "top-right" : "top-left", 0.014)}
					style={{ position: "fixed", top: rect.bottom + offset, left, width }}
					className="z-toast rounded-[26px] bg-raised/75 [html[data-ws-theme=platform-light]_&]:bg-surface/90 p-2 shadow-pop backdrop-blur-2xl backdrop-saturate-150"
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>,
		document.body,
	);
}

export function MenuItem({
	icon,
	label,
	sub,
	value,
	kbd,
	chevron,
	danger,
	active,
	nested,
	onClick,
}: {
	icon: ReactNode;
	label: string;
	sub?: string;
	value?: string;
	kbd?: string;
	chevron?: boolean;
	danger?: boolean;
	active?: boolean;
	/** Inside a group that opens later (the Mute options): no entrance
	 *  variants, or the rows would wait for a stagger that already ran. */
	nested?: boolean;
	onClick: () => void;
}) {
	return (
		<motion.button
			variants={nested ? undefined : staggerItem}
			type="button"
			role="menuitem"
			onClick={onClick}
			className={clsx(
				// Pill rows on the glass (design, Messages round 3): a soft
				// fill on hover, a firmer one for the row whose submenu is open.
				"flex w-full cursor-pointer items-center gap-3 rounded-pill px-3 text-left outline-none transition-colors focus-visible:bg-primary/10",
				sub ? "min-h-[52px] py-1.5" : "h-11",
				active ? "bg-primary/[0.09]" : "hover:bg-primary/[0.06]",
				danger ? "text-danger" : "text-primary",
			)}
		>
			<span className={clsx("flex h-5 w-5 shrink-0 items-center justify-center", danger ? "text-danger" : "text-primary/80")}>
				{icon}
			</span>
			<span className="min-w-0 flex-1">
				<span className="block truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium">{label}</span>
				{sub && (
					<span className="block truncate font-sans text-[calc(12px*var(--ws-fs))] text-subtle">{sub}</span>
				)}
			</span>
			{value && <span className="shrink-0 font-sans text-[calc(12.5px*var(--ws-fs))] text-subtle">{value}</span>}
			{kbd && (
				<span className="shrink-0 rounded-md bg-primary/5 px-1.5 py-0.5 font-sans text-[calc(11px*var(--ws-fs))] text-subtle">
					{kbd}
				</span>
			)}
			{chevron && <CaretRight size={13} weight="bold" className="shrink-0 text-subtle" />}
		</motion.button>
	);
}

export function MenuDivider() {
	return <div aria-hidden className="mx-1 my-1 h-px bg-hairline" />;
}

export function MenuHeading({ children }: { children: ReactNode }) {
	return (
		<div className="px-2.5 pb-1 pt-1.5 font-sans text-[calc(12px*var(--ws-fs))] font-semibold text-subtle">
			{children}
		</div>
	);
}
