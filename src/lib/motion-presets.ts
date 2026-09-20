/**
 * The app's motion vocabulary (owner 2026-09-20: "cool beziers", staggered
 * menus and emoji bars, wired widely).
 *
 * One file on purpose. The design system's rule was one easing and three
 * durations; the owner has since asked for richer motion, and the way to
 * grant that without two hundred private curves is a small named set that
 * every surface draws from. If a preset is wrong, it is wrong once, here.
 *
 * Everything is transform and opacity. Reduced motion needs no code at the
 * call site: PreferencesProvider's MotionConfig drops transforms for anyone
 * who asked (OS setting or the in-app toggle), which turns every preset
 * below into a plain fade or a cut.
 *
 * Usage, the common shapes:
 *
 *   <motion.div {...menu("top-right")}>            a popover / context menu
 *   <motion.div {...menuStagger("top-right")}>     ...whose children cascade
 *   <motion.ul variants={staggerParent} initial="hidden" animate="show">
 *     <motion.li variants={staggerItem} />          its children, cascading
 *   <motion.span {...pop} />                        a badge or reaction landing
 *   <motion.button {...press} />                    tap feedback
 *   <motion.span layoutId="x-thumb" transition={thumbSpring} />   a sliding thumb
 *   <motion.span key={value} {...swap} />           a label / counter swapping
 *   <motion.section {...reveal(i)} />               a card rising on first paint
 *   <motion.div {...collapse} />                    a region opening (inside AnimatePresence)
 */

/*
 * House rules for using these (research pass 2026-09-20, checked against
 * Material 3, Apple's spring talk and practitioner sources):
 * - Frequency first. Anything done a hundred times a day (send, typing, row
 *   hover, scrolling history) gets no entrance; delight is for rare moments.
 * - A cascade plays on first open only, never on refetch or history load,
 *   and the whole of it fits in 300ms: 35ms apart up to ~6 items, 18ms for
 *   lists, the index clamped at 8.
 * - Keyboard-driven actions cut or fade; they never wait for a flourish.
 * - Other people's actions roll a number; pops are for the person's own.
 * - Nothing here blocks input: menus are clickable mid-cascade.
 *
 */

/* ── curves ───────────────────────────────────────────────────────────── */

/** The house curve: quick away, long settle. Default for almost everything. */
export const EASE = [0.2, 0, 0, 1] as const;
/** Expo out: a harder launch and a longer glide, for things that travel. */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
/** About 10% overshoot, for small things that LAND: reactions, ticks,
 *  glyphs of 32px or less. Never on menus, sheets, opacity or colour. */
export const EASE_BACK = [0.34, 1.56, 0.64, 1] as const;
/** About 4% overshoot, for chips and badges: lands without bouncing. */
export const EASE_BACK_SOFT = [0.34, 1.35, 0.64, 1] as const;
/** Leaving: Material 3's emphasized-accelerate. Exits are always quicker
 *  than entrances (60-80% of the enter, or less) and never stagger. */
export const EASE_IN = [0.3, 0, 0.8, 0.15] as const;
/** Draggable sheets settling, at DUR.travel. */
export const EASE_SHEET = [0.32, 0.72, 0, 1] as const;
/** Symmetric, for loops and things that go there and back. */
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const DUR = { fast: 0.12, base: 0.2, slow: 0.32, travel: 0.5 } as const;

/* ── menu: a popover unfolding from the corner nearest its trigger ────── */

type Origin =
	| "top-left"
	| "top-right"
	| "bottom-left"
	| "bottom-right"
	| "top"
	| "bottom"
	| "center";

const ORIGIN: Record<Origin, string> = {
	"top-left": "0% 0%",
	"top-right": "100% 0%",
	"bottom-left": "0% 100%",
	"bottom-right": "100% 100%",
	top: "50% 0%",
	bottom: "50% 100%",
	center: "50% 50%",
};

/** Spread onto the menu's container (must sit inside AnimatePresence to get
 *  the exit). `origin` is the corner closest to whatever opened it. */
export function menu(origin: Origin = "top-right") {
	const fromBelow = origin.startsWith("bottom");
	return {
		initial: { opacity: 0, scale: 0.94, y: fromBelow ? 6 : -6 },
		animate: {
			opacity: 1,
			scale: 1,
			y: 0,
			transition: { duration: 0.24, ease: EASE_OUT_EXPO },
		},
		exit: {
			opacity: 0,
			scale: 0.97,
			y: fromBelow ? 4 : -4,
			transition: { duration: DUR.fast, ease: EASE_IN },
		},
		style: { transformOrigin: ORIGIN[origin] },
	} as const;
}

/** A menu that unfolds from its corner AND cascades its children, as one
 *  variant tree: spread onto the container, then give each child
 *  `variants={staggerItem}` (rows) or `variants={staggerPop}` (emoji, chips).
 *  `pace` is the gap between children in seconds. */
export function menuStagger(origin: Origin = "top-right", pace = 0.035) {
	const fromBelow = origin.startsWith("bottom");
	return {
		variants: {
			hidden: { opacity: 0, scale: 0.94, y: fromBelow ? 6 : -6 },
			show: {
				opacity: 1,
				scale: 1,
				y: 0,
				transition: {
					duration: 0.24,
					ease: EASE_OUT_EXPO,
					staggerChildren: pace,
					delayChildren: 0.05,
				},
			},
			exit: {
				opacity: 0,
				scale: 0.97,
				transition: { duration: DUR.fast, ease: EASE_IN },
			},
		},
		initial: "hidden",
		animate: "show",
		exit: "exit",
		style: { transformOrigin: ORIGIN[origin] },
	} as const;
}

/* ── stagger: children cascading in ───────────────────────────────────── */

/** Parent. Children using `staggerItem` (or `staggerPop`) follow it. */
export const staggerParent = {
	hidden: {},
	show: { transition: { staggerChildren: 0.035, delayChildren: 0.04 } },
	// Exits leave as one piece: a cascade on the way out is time the person
	// spends waiting for something they already dismissed.
	exit: {},
} as const;

/** A tighter cascade for long lists, so row 12 is not half a second late. */
export const staggerParentFast = {
	hidden: {},
	show: { transition: { staggerChildren: 0.018, delayChildren: 0.02 } },
	exit: {},
} as const;

/** A row or action: rises a few pixels as it fades in. */
export const staggerItem = {
	hidden: { opacity: 0, y: 8 },
	show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: EASE_OUT_EXPO } },
	exit: { opacity: 0, y: 4, transition: { duration: 0.1, ease: EASE_IN } },
} as const;

/** An emoji, chip or icon in a bar: scales up with a touch of overshoot. */
export const staggerPop = {
	// 0.8, not lower: nothing in an interface grows from nearly nothing.
	hidden: { opacity: 0, scale: 0.8, y: 6 },
	show: {
		opacity: 1,
		scale: 1,
		y: 0,
		transition: { duration: 0.32, ease: EASE_BACK },
	},
	exit: { opacity: 0, scale: 0.8, transition: { duration: 0.1, ease: EASE_IN } },
} as const;

/* ── pop: one small thing landing ─────────────────────────────────────── */

export const pop = {
	initial: { opacity: 0, scale: 0.8 },
	animate: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: EASE_BACK_SOFT } },
	exit: { opacity: 0, scale: 0.7, transition: { duration: DUR.fast, ease: EASE_IN } },
} as const;

/* ── press: tap feedback ──────────────────────────────────────────────── */

/** For primary buttons, FABs and chips. Hover never scales (house rule);
 *  only the press does, and only a hair. */
export const press = {
	whileTap: { scale: 0.96 },
	transition: { duration: DUR.fast, ease: EASE },
} as const;

/* ── thumb: the sliding indicator of a segmented control ──────────────── */

/** Give the active indicator a shared `layoutId` and this transition.
 *  Critically damped: it arrives, it does not wobble. Springs here are
 *  always explicit stiffness/damping; duration+bounce shorthands resolve
 *  to different numbers in different libraries. */
export const thumbSpring = {
	type: "spring",
	stiffness: 520,
	damping: 38,
	mass: 0.7,
} as const;
/** Toggles, a like, a swipe settling: about 0.3s with a trace of bounce.
 *  Use springs for anything that can be re-triggered mid-flight; beziers
 *  for one-shot enters and exits; never a spring on opacity or colour. */
export const snappySpring = { type: "spring", stiffness: 439, damping: 35.6 } as const;
export const sheetSpring = { type: "spring", stiffness: 700, damping: 48 } as const;

/* ── swap: content changing in place ──────────────────────────────────── */

/** Key the element by its value, inside AnimatePresence mode="popLayout"
 *  (or "wait"), and spread this: the old value lifts out, the new rises in. */
export const swap = {
	initial: { opacity: 0, y: 6 },
	animate: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } },
	exit: { opacity: 0, y: -6, transition: { duration: DUR.fast, ease: EASE_IN } },
} as const;

/* ── reveal: a card or section arriving on first paint ────────────────── */

/** `i` staggers siblings by index; cap it so a long page is not slow. */
export function reveal(i = 0) {
	return {
		initial: { opacity: 0, y: 12 },
		animate: {
			opacity: 1,
			y: 0,
			transition: {
				duration: 0.4,
				ease: EASE_OUT_EXPO,
				delay: Math.min(i, 8) * 0.04,
			},
		},
	} as const;
}

/* ── collapse: a region opening and closing ───────────────────────────── */

/** On a wrapper with `overflow-hidden`, inside AnimatePresence. Height is
 *  the one non-transform property here; it is what the job is. */
export const collapse = {
	initial: { height: 0, opacity: 0 },
	animate: {
		height: "auto",
		opacity: 1,
		transition: { height: { duration: DUR.slow, ease: EASE }, opacity: { duration: DUR.base, delay: 0.06 } },
	},
	exit: {
		height: 0,
		opacity: 0,
		transition: { height: { duration: DUR.base, ease: EASE_IN_OUT }, opacity: { duration: DUR.fast } },
	},
} as const;
