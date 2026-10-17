"use client";

import { Users } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

/**
 * One face in the Messages rail, with a hover card (owner 2026-10-08).
 *
 * A rail of faces is fast but anonymous, so hovering (or focusing) a face
 * lifts a small card beside it: who it is, the last line, when, and how
 * much is waiting. A short delay keeps a pointer sweeping down the rail
 * from strobing cards; moving between faces swaps them without the delay.
 *
 * The card is portalled and fixed to the face's rect: the rail is a
 * scrolling column inside the transformed Messages layout.
 */

let lastClosedAt = 0;

export function RailFace({
	title,
	avatar,
	preview,
	time,
	unread,
	active,
	isGroup,
	memberCount,
	onClick,
}: {
	title: string;
	avatar?: string;
	preview: string;
	time: string;
	unread: number;
	active: boolean;
	isGroup?: boolean;
	memberCount?: number;
	onClick: () => void;
}) {
	const ref = useRef<HTMLButtonElement>(null);
	const timer = useRef<number | null>(null);
	const [rect, setRect] = useState<DOMRect | null>(null);

	const show = useCallback(() => {
		if (timer.current) window.clearTimeout(timer.current);
		// Moving from one face to the next: no wait, the card just follows.
		const wait = Date.now() - lastClosedAt < 250 ? 0 : 140;
		timer.current = window.setTimeout(() => {
			if (ref.current) setRect(ref.current.getBoundingClientRect());
		}, wait);
	}, []);
	const hide = useCallback(() => {
		if (timer.current) window.clearTimeout(timer.current);
		setRect((r) => {
			if (r) lastClosedAt = Date.now();
			return null;
		});
	}, []);
	useEffect(() => () => {
		if (timer.current) window.clearTimeout(timer.current);
	}, []);
	// The rail scrolls; a card left behind would point at nothing.
	useEffect(() => {
		if (!rect) return;
		const off = () => hide();
		window.addEventListener("scroll", off, true);
		return () => window.removeEventListener("scroll", off, true);
	}, [rect, hide]);

	return (
		<>
			<button
				ref={ref}
				type="button"
				onClick={() => {
					hide();
					onClick();
				}}
				onPointerEnter={(e) => e.pointerType === "mouse" && show()}
				onPointerLeave={hide}
				onFocus={show}
				onBlur={hide}
				aria-label={title}
				aria-current={active ? "true" : undefined}
				className={clsx(
					"relative flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-[18px] transition-colors",
					active ? "bg-primary/10" : "hover:bg-primary/5",
				)}
			>
				<span className="relative h-11 w-11 overflow-hidden rounded-pill bg-raised">
					{avatar ? <SafeAvatar src={avatar} /> : <Users size={20} className="m-3 text-muted" />}
				</span>
				{unread > 0 && !active && (
					<span className="absolute right-1.5 top-1.5 h-3 w-3 rounded-pill bg-brand ring-2 ring-page" />
				)}
			</button>
			{typeof document !== "undefined" &&
				createPortal(
					<AnimatePresence>
						{rect && (
							<motion.div
								key="card"
								role="tooltip"
								initial={{ opacity: 0, x: -8, scale: 0.97 }}
								animate={{ opacity: 1, x: 0, scale: 1, transition: { type: "spring", stiffness: 520, damping: 34, mass: 0.7 } }}
								exit={{ opacity: 0, x: -4, scale: 0.98, transition: { duration: 0.12 } }}
								style={{
									position: "fixed",
									left: rect.right + 14,
									top: rect.top + rect.height / 2,
									translateY: "-50%",
									transformOrigin: "left center",
								}}
								className="pointer-events-none z-toast w-[264px]"
							>
								{/* The notch, pointing at the face (owner 2026-10-12): a
								    glass triangle cut with clip-path, so it never doubles up
								    with the card's own translucent fill. */}
								<span
									aria-hidden
									className="absolute left-[-9px] top-1/2 h-5 w-[10px] -translate-y-1/2 bg-surface/80 backdrop-blur-2xl [clip-path:polygon(100%_0,0_50%,100%_100%)]"
								/>
								<div className="relative flex flex-col gap-2 rounded-[22px] bg-surface/80 shadow-pop backdrop-blur-2xl backdrop-saturate-150 p-3">
									<div className="flex items-center gap-2.5">
										<span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-pill bg-raised">
											{avatar ? <SafeAvatar src={avatar} /> : <Users size={16} className="m-2.5 text-muted" />}
										</span>
										<span className="min-w-0 flex-1">
											<span className="block truncate font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary">
												{title}
											</span>
											<span className="block font-sans text-[calc(11.5px*var(--ws-fs))] text-subtle" suppressHydrationWarning>
												{isGroup && memberCount ? `${memberCount} members · ${time}` : time}
											</span>
										</span>
										{unread > 0 && (
											<span className="shrink-0 rounded-pill bg-brand px-2 py-0.5 font-sans text-[calc(11px*var(--ws-fs))] font-bold tabular-nums text-brand-on">
												{unread > 99 ? "99+" : unread} new
											</span>
										)}
									</div>
									{preview && (
										<p className={clsx("line-clamp-2 font-sans text-[calc(13px*var(--ws-fs))] leading-snug", unread > 0 ? "text-primary" : "text-muted")}>
											{preview}
										</p>
									)}
								</div>
							</motion.div>
						)}
					</AnimatePresence>,
					document.body,
				)}
		</>
	);
}
