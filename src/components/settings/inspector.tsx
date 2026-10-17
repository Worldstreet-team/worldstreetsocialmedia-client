"use client";

import { ArrowsLeftRight, DeviceMobile } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "@/components/ui/icons";
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
import {
	DUR,
	EASE,
	EASE_IN,
	menuStagger,
	sheetSpring,
	staggerItem,
	staggerParentFast,
	staggerPop,
	swap,
	thumbSpring,
} from "@/lib/motion-presets";

/**
 * The settings grammar (owner 2026-10-07, replacing the frosted blocks of
 * 2026-09-20).
 *
 * A group is flat: a small uppercase heading, its caption, then the rows
 * ruled with hairlines. No block, no icon; the page title and the rail
 * already say where you are, and a block around every group made the page
 * read as a stack of cards. A row keeps the inspector shape: name, what it
 * does, the control at the right edge; on a phone the explanation drops
 * under the name.
 *
 * A choice is `Select`, a designed dropdown, or on a desktop a `Segmented`
 * control when there are three or fewer short options (`segmented="auto"`).
 * A phone always gets the dropdown and its bottom sheet: a row is too
 * narrow for buttons beside the name.
 */

export function SettingGroup({
	id,
	title,
	caption,
	tone,
	children,
}: {
	/** Matches a GROUPS entry; the sub-nav scrolls to `group-<id>`. */
	id: string;
	title: string;
	caption?: string;
	tone?: "danger";
	children: React.ReactNode;
}) {
	return (
		// scroll-mt clears the sticky header. The negative margin gives the
		// search ring room around the rows without moving them.
		<section
			id={`group-${id}`}
			data-group={id}
			className="-mx-3 scroll-mt-[128px] rounded-2xl px-3 pb-1 pt-3 transition-shadow lg:scroll-mt-[88px]"
		>
			<div className="pb-2.5">
				<h3
					className={clsx(
						"font-sans text-[calc(12px*var(--ws-fs))] font-semibold uppercase tracking-[0.1em]",
						tone === "danger" ? "text-danger" : "text-subtle",
					)}
				>
					{title}
				</h3>
				{caption && (
					<p className="mt-1 max-w-[62ch] font-sans text-[calc(13.5px*var(--ws-fs))] leading-snug text-muted">
						{caption}
					</p>
				)}
			</div>
			<div className="flex flex-col [&>*:last-child]:border-b-0">{children}</div>
		</section>
	);
}

/**
 * Where a setting takes effect, said on its row so the save status above
 * never over-promises. `device`: stays on this device, never synced (Theme,
 * Language). `both`: turning yours off hides theirs from you too.
 */
export type RowTag = "device" | "both";

function ScopeTag({ tag }: { tag: RowTag }) {
	const Glyph = tag === "device" ? DeviceMobile : ArrowsLeftRight;
	return (
		<span
			title={
				tag === "device"
					? "Stays on this device. It does not follow your account."
					: "Works both ways: off hides other people's from you too."
			}
			className="inline-flex h-5 shrink-0 items-center gap-1 rounded-pill bg-primary/5 px-1.5 font-sans text-[calc(11px*var(--ws-fs))] font-medium text-subtle"
		>
			<Glyph size={11} weight="bold" aria-hidden />
			{tag === "device" ? "This device" : "Both ways"}
		</span>
	);
}

/**
 * One setting. `children` is the control; it sits at the right edge.
 *
 * On a desktop the explanation is always under the name. On a phone it is
 * behind a tap on the name (mobile direction A): a section of ten settings
 * was ten two-line paragraphs, and the screen read as a document. The name
 * is only a button where there is something to open.
 */
export function SettingRow({
	label,
	hint,
	tag,
	disabled,
	children,
}: {
	label: React.ReactNode;
	hint?: React.ReactNode;
	tag?: RowTag;
	disabled?: boolean;
	children?: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const hintId = useId();
	return (
		<div
			className={clsx(
				"grid min-h-[56px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-hairline py-2 first:border-t",
				disabled && "opacity-60",
			)}
		>
			{hint ? (
				<button
					type="button"
					onClick={() => setOpen((v) => !v)}
					aria-expanded={open}
					aria-controls={hintId}
					className="flex min-h-[40px] cursor-pointer items-center gap-1.5 text-left font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary lg:pointer-events-none lg:min-h-0 lg:cursor-default"
				>
					{label}
					{tag && <ScopeTag tag={tag} />}
					<ChevronDown
						aria-hidden
						className={clsx(
							"h-3.5 w-3.5 shrink-0 text-subtle transition-transform lg:hidden",
							open && "rotate-180",
						)}
						strokeWidth={2.25}
					/>
				</button>
			) : (
				<span className="flex items-center gap-1.5 font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary">
					{label}
					{tag && <ScopeTag tag={tag} />}
				</span>
			)}
			{hint && (
				<span
					id={hintId}
					className={clsx(
						"col-start-1 row-start-2 max-w-[60ch] pb-1 font-sans text-[calc(12.5px*var(--ws-fs))] leading-snug text-muted lg:block lg:pb-0",
						!open && "hidden",
					)}
				>
					{hint}
				</span>
			)}
			<span className="col-start-2 row-span-2 row-start-1 flex items-center justify-end">
				{children}
			</span>
		</div>
	);
}

/** A phone is anything under Tailwind's `lg`, where Settings turns into the
 *  hub and its pushes. Read at the moment of opening, never stored. */
export const isPhoneWidth = () =>
	typeof window !== "undefined" && window.innerWidth < 1024;

/**
 * A choice on a phone (owner 2026-09-20, mobile directions A + B): the
 * options rise as a bottom sheet instead of a menu hanging off a pill. A
 * thumb reaches the bottom of a phone, not a 40px target under its own
 * finger, and a sheet has room for every option at 48px.
 */
export function PickerSheet<V extends string | number>({
	open,
	title,
	value,
	options,
	onPick,
	onClose,
}: {
	open: boolean;
	title: string;
	value: V;
	options: readonly (readonly [V, string])[];
	onPick: (v: V) => void;
	onClose: () => void;
}) {
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
	if (typeof document === "undefined") return null;
	return createPortal(
		<AnimatePresence>
			{open && (
				<motion.div key="picker" className="fixed inset-0 z-modal flex items-end">
					<motion.button
						type="button"
						aria-label="Close"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1, transition: { duration: DUR.base, ease: EASE } }}
						exit={{ opacity: 0, transition: { duration: DUR.fast, ease: EASE_IN } }}
						onClick={onClose}
						className="absolute inset-0 cursor-default bg-scrim"
					/>
					<motion.div
						role="listbox"
						aria-label={title}
						initial={{ y: "100%" }}
						animate={{ y: 0, transition: sheetSpring }}
						exit={{ y: "100%", transition: { duration: DUR.base, ease: EASE_IN } }}
						drag="y"
						dragConstraints={{ top: 0, bottom: 0 }}
						dragElastic={{ top: 0, bottom: 0.6 }}
						onDragEnd={(_, info) => {
							if (info.offset.y > 90 || info.velocity.y > 600) onClose();
						}}
						className="relative max-h-[78dvh] w-full overflow-y-auto rounded-t-[22px] bg-raised px-2 pb-[calc(12px+var(--ws-safe-bottom,0px))] pt-2 shadow-sheet"
					>
						<span aria-hidden className="mx-auto mb-2 block h-1 w-9 rounded-pill bg-primary/15" />
						<h3 className="px-3 pb-2 pt-1 font-display text-[calc(16px*var(--ws-fs))] font-semibold text-primary">
							{title}
						</h3>
						<motion.div variants={staggerParentFast} initial="hidden" animate="show">
							{options.map(([v, l]) => {
								const active = v === value;
								return (
									<motion.button
										key={String(v)}
										type="button"
										role="option"
										aria-selected={active}
										variants={staggerItem}
										onClick={() => {
											onPick(v);
											onClose();
										}}
										className={clsx(
											"flex min-h-[48px] w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left font-sans text-[calc(15px*var(--ws-fs))] transition-colors",
											active
												? "bg-primary/10 font-semibold text-primary"
												: "font-medium text-muted",
										)}
									>
										<span className="min-w-0 flex-1 truncate">{l}</span>
										{active && <Check className="h-4 w-4 shrink-0 text-gold" strokeWidth={3} />}
									</motion.button>
								);
							})}
						</motion.div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>,
		document.body,
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
	// Decided when it opens: a sheet on a phone, the hanging menu otherwise.
	const [asSheet, setAsSheet] = useState(false);
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
		if (!open || asSheet) return;
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
	}, [open, asSheet, place, close]);

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
				onClick={() => {
					setAsSheet(isPhoneWidth());
					setOpen((v) => !v);
				}}
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
			<PickerSheet
				open={open && asSheet}
				title={label}
				value={value}
				options={options}
				onPick={onPick}
				onClose={() => close(false)}
			/>
			{rect &&
				typeof document !== "undefined" &&
				createPortal(
					<AnimatePresence>
						{open && !asSheet && (
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

/** Three or fewer options, each short enough to sit side by side. */
export const fitsSegmented = (options: readonly (readonly [unknown, string])[]) =>
	options.length <= 3 && options.every(([, l]) => l.length <= 12);

/**
 * Every option in view, one tap to change (owner 2026-10-07). A radio
 * group: arrows move and pick, only the chosen option is in the tab order,
 * and the pressed wash slides between options.
 */
export function Segmented<V extends string | number>({
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
	const thumbId = useId();
	const refs = useRef<(HTMLButtonElement | null)[]>([]);
	const index = Math.max(
		0,
		options.findIndex(([v]) => v === value),
	);
	const go = (i: number) => {
		const n = (i + options.length) % options.length;
		onPick(options[n][0]);
		refs.current[n]?.focus();
	};
	return (
		<div
			role="radiogroup"
			aria-label={label}
			className="flex h-10 items-center gap-0.5 rounded-pill bg-primary/5 p-[3px]"
		>
			{options.map(([v, l], i) => {
				const on = i === index;
				return (
					<button
						key={String(v)}
						ref={(el) => {
							refs.current[i] = el;
						}}
						type="button"
						role="radio"
						aria-checked={on}
						tabIndex={on ? 0 : -1}
						disabled={disabled}
						onClick={() => onPick(v)}
						onKeyDown={(e) => {
							if (e.key === "ArrowRight" || e.key === "ArrowDown") {
								e.preventDefault();
								go(i + 1);
							} else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
								e.preventDefault();
								go(i - 1);
							}
						}}
						className={clsx(
							"relative h-full cursor-pointer whitespace-nowrap rounded-pill px-3.5 font-sans text-[calc(13px*var(--ws-fs))] transition-colors disabled:cursor-default",
							on ? "font-semibold text-primary" : "font-medium text-muted hover:text-primary",
						)}
					>
						{on && (
							<motion.span
								aria-hidden
								layoutId={`segmented-${thumbId}`}
								transition={thumbSpring}
								className="absolute inset-0 rounded-pill bg-primary/10"
							/>
						)}
						<span className="relative">{l}</span>
					</button>
				);
			})}
		</div>
	);
}

/**
 * A choice row that shows the current value. `segmented` puts the options
 * side by side on a desktop: `true` always, `"auto"` when `fitsSegmented`.
 * Off by default, because the row is shared with Messages sheets that
 * have no room for it.
 */
export function SelectRow<V extends string | number>({
	label,
	hint,
	tag,
	value,
	options,
	onPick,
	disabled,
	segmented = false,
}: {
	label: string;
	hint?: string;
	tag?: RowTag;
	value: V;
	options: readonly (readonly [V, string])[];
	onPick: (v: V) => void;
	disabled?: boolean;
	segmented?: boolean | "auto";
}) {
	const select = (
		<Select
			label={label}
			value={value}
			options={options}
			onPick={onPick}
			disabled={disabled}
		/>
	);
	const seg = segmented === true || (segmented === "auto" && fitsSegmented(options));
	return (
		<SettingRow label={label} hint={hint} tag={tag} disabled={disabled}>
			{seg ? (
				<>
					<span className="hidden lg:flex">
						<Segmented
							label={label}
							value={value}
							options={options}
							onPick={onPick}
							disabled={disabled}
						/>
					</span>
					<span className="flex lg:hidden">{select}</span>
				</>
			) : (
				select
			)}
		</SettingRow>
	);
}

export function ToggleRow({
	label,
	hint,
	tag,
	checked,
	disabled,
	onChange,
}: {
	label: string;
	hint?: string;
	tag?: RowTag;
	checked: boolean;
	disabled?: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<SettingRow label={label} hint={hint} tag={tag} disabled={disabled}>
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
