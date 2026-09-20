"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { Switch } from "@/components/ui/Switch";
import { menuStagger, staggerItem, staggerPop, swap } from "@/lib/motion-presets";

/**
 * The settings grammar (owner 2026-09-20, second pass: "the make over we
 * gave the messages, do it the same for the settings, custom components
 * like select, nice use of icons and headers").
 *
 * So it is the Messages architecture: every group is a frosted block
 * (`glass-frost`, 16px radius, the same fill as the inbox blocks) with a
 * real header, an icon in a wash chip, a display title and its caption, and
 * the rows inside ruled with hairlines. A row keeps the inspector shape the
 * owner picked first: name, what it does, the control at the right edge;
 * on a phone the explanation drops under the name.
 *
 * A choice is `Select`, a designed dropdown, not a native one: a pill
 * trigger in the rest wash showing the current value, and a menu that
 * unfolds from it with the chosen option ticked.
 */

export function SettingGroup({
	id,
	icon: Icon,
	title,
	caption,
	tone,
	children,
}: {
	/** Matches a GROUPS entry; the sub-nav scrolls to `group-<id>`. */
	id: string;
	icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
	title: string;
	caption?: string;
	tone?: "danger";
	children: React.ReactNode;
}) {
	return (
		// scroll-mt clears the sticky header pill (and the chip strip on a
		// phone). No overflow-hidden: nothing in a block may clip, and the
		// Select menu is portalled out anyway.
		<section
			id={`group-${id}`}
			data-group={id}
			className={clsx(
				"scroll-mt-[128px] rounded-2xl px-4 pb-1.5 pt-4 glass-frost backdrop-blur-xl lg:scroll-mt-[88px] lg:px-5",
				tone === "danger" && "ring-1 ring-danger/20",
			)}
		>
			<div className="flex items-start gap-3 pb-3">
				{Icon && (
					<span
						className={clsx(
							"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
							tone === "danger" ? "bg-danger/10 text-danger" : "bg-primary/5 text-primary",
						)}
					>
						<Icon className="h-[18px] w-[18px]" strokeWidth={2} />
					</span>
				)}
				<div className="min-w-0 pt-px">
					<h3
						className={clsx(
							"font-display text-[calc(17px*var(--ws-fs))] font-semibold leading-tight tracking-tight",
							tone === "danger" ? "text-danger" : "text-primary",
						)}
					>
						{title}
					</h3>
					{caption && (
						<p className="mt-1 max-w-[68ch] font-sans text-[calc(13px*var(--ws-fs))] leading-snug text-muted max-w-[60ch]">
							{caption}
						</p>
					)}
				</div>
			</div>
			<div className="flex flex-col [&>*:last-child]:border-b-0">{children}</div>
		</section>
	);
}

/** One setting. `children` is the control; it sits at the right edge. */
export function SettingRow({
	label,
	hint,
	disabled,
	children,
}: {
	label: React.ReactNode;
	hint?: React.ReactNode;
	disabled?: boolean;
	children?: React.ReactNode;
}) {
	return (
		<div
			className={clsx(
				"grid min-h-[56px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-hairline py-2 first:border-t",
				disabled && "opacity-60",
			)}
		>
			<span className="font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary">
				{label}
			</span>
			{/* Under the name on a phone, its own column on a desktop. Always
			    rendered on a desktop so the control column stays put. */}
			<span
				className={clsx(
					"col-start-1 row-start-2 font-sans text-[calc(12.5px*var(--ws-fs))] leading-snug text-muted max-w-[60ch]",
					!hint && "hidden",
				)}
			>
				{hint}
			</span>
			<span className="col-start-2 row-span-2 row-start-1 flex items-center justify-end">
				{children}
			</span>
		</div>
	);
}

/**
 * The designed dropdown. Modelled on ui/GlassSelect (same portal, same
 * reason: a block with backdrop-filter is a stacking context, so a menu
 * rendered inside one is painted over by the NEXT block), with a compact
 * pill trigger, a menu wider than its trigger, and full keyboard support.
 */
export function Select<V extends string | number>({
	label,
	value,
	options,
	onPick,
	disabled,
}: {
	label: string;
	value: V;
	options: readonly (readonly [V, string])[];
	onPick: (v: V) => void;
	disabled?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [rect, setRect] = useState<DOMRect | null>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const listId = useId();
	const index = Math.max(
		0,
		options.findIndex(([v]) => v === value),
	);

	const place = useCallback(() => {
		const el = triggerRef.current;
		if (el) setRect(el.getBoundingClientRect());
	}, []);
	useLayoutEffect(() => {
		if (open) place();
	}, [open, place]);

	const close = useCallback((refocus: boolean) => {
		setOpen(false);
		if (refocus) triggerRef.current?.focus();
	}, []);

	useEffect(() => {
		if (!open) return;
		const onDown = (e: PointerEvent) => {
			const t = e.target as Node;
			if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t))
				close(false);
		};
		// The page behind scrolls away from a fixed menu, so a scroll closes
		// it; a scroll INSIDE the menu is the list itself and is left alone.
		const onScroll = (e: Event) => {
			if (!menuRef.current?.contains(e.target as Node)) close(false);
		};
		document.addEventListener("pointerdown", onDown, true);
		window.addEventListener("resize", place);
		window.addEventListener("scroll", onScroll, true);
		return () => {
			document.removeEventListener("pointerdown", onDown, true);
			window.removeEventListener("resize", place);
			window.removeEventListener("scroll", onScroll, true);
		};
	}, [open, place, close]);

	// Focus lands on the chosen option, so arrows start from where you are.
	useEffect(() => {
		if (!open || !rect) return;
		menuRef.current
			?.querySelectorAll<HTMLButtonElement>('[role="option"]')
			[index]?.focus();
	}, [open, rect, index]);

	const onMenuKey = (e: React.KeyboardEvent) => {
		const items = Array.from(
			menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [],
		);
		const at = items.indexOf(document.activeElement as HTMLButtonElement);
		const go = (i: number) => {
			e.preventDefault();
			items[(i + items.length) % items.length]?.focus();
		};
		if (e.key === "ArrowDown") go(at + 1);
		else if (e.key === "ArrowUp") go(at - 1);
		else if (e.key === "Home") go(0);
		else if (e.key === "End") go(items.length - 1);
		else if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			close(true);
		} else if (e.key === "Tab") close(false);
		else if (e.key.length === 1 && /\S/.test(e.key)) {
			// Type a letter, land on the next option that starts with it.
			const k = e.key.toLowerCase();
			const order = [...items.slice(at + 1), ...items.slice(0, at + 1)];
			order.find((b) => b.textContent?.trim().toLowerCase().startsWith(k))?.focus();
		}
	};

	const MENU_MAX = 320;
	const MENU_W = Math.max(rect?.width ?? 0, 220);
	const need = Math.min(MENU_MAX, options.length * 44 + 12);
	const flip = rect ? window.innerHeight - rect.bottom < need + 12 : false;
	const menuMotion = menuStagger(flip ? "bottom-right" : "top-right", 0.018);

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				disabled={disabled}
				onClick={() => setOpen((v) => !v)}
				onKeyDown={(e) => {
					if (e.key === "ArrowDown" || e.key === "ArrowUp") {
						e.preventDefault();
						setOpen(true);
					}
				}}
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-controls={open ? listId : undefined}
				aria-label={`${label}: ${options[index]?.[1] ?? ""}`}
				className={clsx(
					"flex h-10 max-w-[52vw] cursor-pointer items-center gap-2 rounded-pill pl-4 pr-3 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary transition-colors disabled:cursor-default lg:max-w-[260px]",
					open ? "bg-primary/10" : "bg-primary/5 hover:bg-primary/10",
				)}
			>
				{/* The value rolls when it changes. The inner span truncates for
				    itself: an inline-block in a truncating parent is replaced
				    whole by the ellipsis. */}
				<span className="relative min-w-0 overflow-hidden">
					<AnimatePresence mode="popLayout" initial={false}>
						<motion.span key={String(value)} {...swap} className="block truncate">
							{options[index]?.[1]}
						</motion.span>
					</AnimatePresence>
				</span>
				<ChevronDown
					aria-hidden
					className={clsx(
						"h-3.5 w-3.5 shrink-0 text-muted transition-transform",
						open && "rotate-180",
					)}
					strokeWidth={2.5}
				/>
			</button>

			{/* The portal stays once the trigger has been measured; the
			    presence inside it is what lets the exit play. */}
			{rect &&
				typeof document !== "undefined" &&
				createPortal(
					<AnimatePresence>
						{open && (
							<motion.div
								key="menu"
								ref={menuRef}
								id={listId}
								role="listbox"
								aria-label={label}
								onKeyDown={onMenuKey}
								{...menuMotion}
								style={{
									...menuMotion.style,
									position: "fixed",
									// Right edges meet: the control sits at the row's
									// right edge, so the menu grows leftward from it.
									left: Math.max(12, rect.right - MENU_W),
									width: MENU_W,
									...(flip
										? { bottom: window.innerHeight - rect.top + 6 }
										: { top: rect.bottom + 6 }),
									maxHeight: MENU_MAX,
								}}
								className="z-toast overflow-y-auto rounded-2xl p-1.5 shadow-nav glass-frost backdrop-blur-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
							>
								{options.map(([v, l], i) => {
									const active = i === index;
									return (
										<motion.button
											key={String(v)}
											type="button"
											role="option"
											aria-selected={active}
											variants={i < 8 ? staggerItem : undefined}
											onClick={() => {
												onPick(v);
												close(true);
											}}
											className={clsx(
												"flex min-h-[40px] w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 text-left font-sans text-[calc(13.5px*var(--ws-fs))] outline-none transition-colors focus-visible:bg-primary/10",
												active
													? "bg-primary/10 font-semibold text-primary"
													: "font-medium text-muted hover:bg-primary/5 hover:text-primary",
											)}
										>
											<span className="min-w-0 flex-1 truncate">{l}</span>
											{active && (
												<motion.span variants={staggerPop} className="flex shrink-0 text-gold">
													<Check className="h-3.5 w-3.5" strokeWidth={3} />
												</motion.span>
											)}
										</motion.button>
									);
								})}
							</motion.div>
						)}
					</AnimatePresence>,
					document.body,
				)}
		</>
	);
}

/** A choice, as a dropdown row that shows the current value. */
export function SelectRow<V extends string | number>({
	label,
	hint,
	value,
	options,
	onPick,
	disabled,
}: {
	label: string;
	hint?: string;
	value: V;
	options: readonly (readonly [V, string])[];
	onPick: (v: V) => void;
	disabled?: boolean;
}) {
	return (
		<SettingRow label={label} hint={hint} disabled={disabled}>
			<Select
				label={label}
				value={value}
				options={options}
				onPick={onPick}
				disabled={disabled}
			/>
		</SettingRow>
	);
}

export function ToggleRow({
	label,
	hint,
	checked,
	disabled,
	onChange,
}: {
	label: string;
	hint?: string;
	checked: boolean;
	disabled?: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<SettingRow label={label} hint={hint} disabled={disabled}>
			<Switch
				checked={checked}
				disabled={disabled}
				onChange={onChange}
				label={label}
				className="-mr-[3px]"
			/>
		</SettingRow>
	);
}

/** A fact, not a control: email, renewal date. */
export function ValueRow({
	label,
	hint,
	value,
}: {
	label: string;
	hint?: string;
	value: React.ReactNode;
}) {
	return (
		<SettingRow label={label} hint={hint}>
			<span className="max-w-[52vw] truncate font-sans text-[calc(13px*var(--ws-fs))] tabular-nums text-muted lg:max-w-[320px]">
				{value}
			</span>
		</SettingRow>
	);
}

/** The small bordered button a row ends in: Change, Download, Manage. */
export const rowButton =
	"h-10 shrink-0 cursor-pointer rounded-pill bg-primary/5 px-4 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-default disabled:opacity-50";
