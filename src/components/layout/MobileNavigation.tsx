"use client";

import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { useClerk } from "@clerk/nextjs";
import { useAppPathname } from "@/i18n/useAppPathname";
import { useCallback, useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import {
	collapse,
	staggerItem,
	staggerParentFast,
	swap,
} from "@/lib/motion-presets";
import {
	ArrowUpRight,
	CaretDown,
	Moon,
	SignOut,
	Sun,
	X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { sidebarList } from "@/data/sidebar";
import clsx from "clsx";
import { BadgedIcon } from "@/components/ui/Badge";
import { handleSignOut } from "@/lib/utils";
import { withThemeTransition } from "@/lib/theme-transition";
import { LanguageMenu } from "@/components/ui/LanguageMenu";
import { useT } from "@/i18n/client";

import { BrandRitual } from "@/components/layout/BrandRitual";
import { ProductsWheel } from "@/components/layout/products/ProductsWheel";
import { SidebarWallet } from "@/components/layout/SidebarWallet";
import {
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { NotificationsPopover } from "@/components/layout/NotificationsPopover";
import { VividOrb } from "@/components/vivid/VividOrb";
import { unreadMessagesCountAtom } from "@/store/messageCache";
import {
	badgeForNavKey,
	unreadBmCountAtom,
	unreadNotificationsCountAtom,
} from "@/store/ui.atom";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

export function MobileNavigation() {
	const t = useT();
	const user = useAtomValue(userAtom);
	const unreadCount = useAtomValue(unreadMessagesCountAtom);
	const unreadNotifications = useAtomValue(unreadNotificationsCountAtom);
	const unreadBm = useAtomValue(unreadBmCountAtom);
	const { signOut } = useClerk();
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	const pathname = useAppPathname();
	const [isOpen, setIsOpen] = useState(false);
	const [langOpen, setLangOpen] = useState(false);
	const [productsOpen, setProductsOpen] = useState(false);
	// The Products row: where the wheel's blur spreads from.
	const productsRow = useRef<HTMLButtonElement>(null);
	const closeProducts = useCallback(() => setProductsOpen(false), []);
	useEffect(() => setMounted(true), []);
	const isLight = mounted && resolvedTheme === "light";

	// Close sidebar on route change
	useEffect(() => {
		setIsOpen(false);
	}, [pathname]);

	// Escape and the body scroll lock are the overlay grammar's job now; the
	// scrim catches the outside tap. The hand-rolled overflow effect that used
	// to live here did half of that and left Escape unhandled.
	const closeDrawer = useCallback(() => setIsOpen(false), []);
	useOverlayDismiss(isOpen, closeDrawer);

	if (!user) return null;

	const fullName =
		user.firstName && user.lastName
			? `${user.firstName} ${user.lastName}`
			: user.username;

	return (
		<>
			{/* Mobile Header. Three slots: menu avatar, the brand mark centred
			    (absolutely, so it stays centred no matter how wide the actions
			    grow), and the actions that used to eat the feed bar's width —
			    search, which had NO touch entry point at all, and Go Live. */}
			{/* Frosted, no rule under it (owner 2026-10-16): the bar, the stories
			    and the tabs read as one glass top, cleanly. */}
			<header className="fixed top-0 left-0 right-0 pt-safe bg-page/75 backdrop-blur-xl backdrop-saturate-150 z-sticky md:hidden">
				<div className="relative h-14 flex items-center justify-between px-2">
					{/* 44x44 target, small glyph — the tappable box doesn't shrink
					    to match the mark.

					    Two bars, the lower one half-length. Hand-drawn rather
					    than taken from the icon set: every stock "list" glyph is
					    two or three FULL-width bars, and the asymmetry is the
					    whole point of the mark. */}
					<div className="flex items-center shrink-0">
						<button
							type="button"
							onClick={() => setIsOpen(true)}
							aria-label="Open navigation menu"
							className="flex h-12 w-12 shrink-0 items-center justify-center rounded-pill text-primary active:bg-primary/10 transition-colors"
						>
							<svg
								width="24"
								height="24"
								viewBox="0 0 20 20"
								fill="none"
								aria-hidden="true"
							>
								<path
									d="M3 7h14M3 13h7"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
								/>
							</svg>
						</button>
						{/* Search left the bar (owner 2026-10-16, top bar A): it
						    lives on Explore, one tap away in the bottom bar, and
						    the menu side stays as light as the actions side. */}
						<span className="h-11 w-11" aria-hidden />
					</div>

					{/* The animated lockup, centred (owner 2026-09-03: back to the
					    middle): absolute so it stays centred no matter how wide
					    the action cluster grows. */}
					<Link
						href="/"
						aria-label="WorldSpace home"
						className="absolute left-1/2 -translate-x-1/2 flex h-12 items-center justify-center px-2 rounded-pill active:bg-primary/10 transition-colors"
					>
						<BrandRitual size={36} wordSize={18} />
					</Link>

					{/* Vivid + bell in identical 44px cells on one axis. Go Live
					    left the bar (owner 2026-10-16): it lives in the + drawer
					    now, and Vivid's turning orb takes its place. */}
					<div className="flex items-center shrink-0">
						<Link
							href="/vivid"
							aria-label="Vivid"
							className="flex h-11 w-11 items-center justify-center rounded-pill active:bg-primary/10 transition-colors"
						>
							<VividOrb size={26} />
						</Link>
						{/* Notifications moved UP out of the bottom bar: it is
						    something you check, not somewhere you navigate. */}
						<NotificationsPopover compact />
					</div>
				</div>
			</header>

			{/* The navigation drawer, on the standard overlay grammar. It used to
			    be an always-mounted left drawer with its own scrim, its own CSS
			    slide and `inert` to keep the closed panel out of the tab order;
			    it now mounts on open as the grammar's `sheet` — the variant for a
			    flow that wants the width — so unmounting does the `inert` job and
			    OverlayScrim/useOverlayDismiss own the tap-out, Escape and the
			    scroll lock. */}
			<AnimatePresence>
				{isOpen && (
					// The drawer is a phones-only surface; the wrapper carries the
					// `md:hidden` the old backdrop had, since OverlayScrim is
					// deliberately class-free.
					<div key="nav-scrim" className="md:hidden">
						<OverlayScrim
							onClose={closeDrawer}
							label="Close navigation menu"
						/>
					</div>
				)}
				{isOpen && (
					<motion.aside
						key="nav-panel"
						role="dialog"
						aria-modal="true"
						aria-label="Navigation menu"
						initial={{ x: "-100%" }}
						animate={{ x: 0 }}
						exit={{ x: "-100%" }}
						transition={{ duration: 0.26, ease: [0.2, 0, 0, 1] }}
						// A SIDE sheet (owner 2026-09-03): slides in from the left
						// like a hamburger menu should, not up from the bottom.
						// Same frost ground as every overlay panel.
						// A very strong blur, clean (owner 2026-10-16): the
						// page goes to soft colour behind it, no frost texture,
						// no rules inside.
						className="fixed inset-y-0 left-0 z-modal flex w-[86%] max-w-[360px] flex-col overflow-hidden rounded-r-[28px] bg-raised/55 shadow-pop backdrop-blur-[48px] backdrop-saturate-[1.8] md:hidden [html[data-ws-theme=platform-light]_&]:bg-surface/70"
					>
						{/* The brand leads the sheet (owner 2026-09-03): the lockup
						    up top with real breathing room — clear of the status
						    bar — and the profile moved down to the footer. */}
						{/* Whose menu this is leads the sheet. One row on the rows'
						    own grid (owner 2026-10-16, "align it very well"): the
						    avatar's edge sits on the icons' edge below, and the
						    close button is centred on the avatar. */}
						<div className="pt-safe shrink-0">
							<div className="flex items-center gap-2 px-3 pb-3 pt-5">
								{/* A clean border, no fill (owner 2026-10-16). */}
								<Link
									href={user.username ? `/profile/${user.username}` : "/profile"}
									onClick={closeDrawer}
									className="flex min-w-0 flex-1 items-center gap-3 rounded-pill border border-primary/[0.12] py-1.5 pl-1.5 pr-4 transition-colors hover:border-primary/25"
								>
									<span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-pill">
										<SafeAvatar src={user.avatar} className="object-cover" alt={user.username || "User"} />
									</span>
									<span className="flex min-w-0 flex-col gap-0.5">
										<span className="truncate font-sans text-[calc(16px*var(--ws-fs))] font-bold leading-tight text-primary">
											{fullName}
										</span>
										<span className="truncate font-sans text-[calc(13px*var(--ws-fs))] leading-tight text-muted">
											@{user.username}
										</span>
									</span>
								</Link>
								<motion.button
									type="button"
									onClick={closeDrawer}
									aria-label="Close navigation menu"
									whileTap={{ scale: 0.92 }}
									className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-primary/[0.08] text-primary transition-colors hover:bg-primary/[0.14]"
								>
									<X size={16} weight="bold" />
								</motion.button>
							</div>
						</div>

						{/* One scroll column owns everything between the identity
						    header and the footer — the wallet strip scrolls WITH
						    the links, so on a short screen nothing below it is
						    unreachable. */}
						<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2">
							{/* Wallet strip — same component as the desktop right
							    rail; renders nothing when the wallet is
							    unreachable, so the drawer just tightens up. */}
							<div className="pb-2">
								<SidebarWallet />
							</div>

							{/* Navigation Links */}
							{/* Mounts with the drawer, so the rows cascade once per
							    open and never on a badge re-render. */}
							<motion.nav
								variants={staggerParentFast}
								initial="hidden"
								animate="show"
								className="flex flex-col gap-1"
							>
							{sidebarList
								// Studio is creator-only; mirror the desktop rail's gate.
								.filter(
									(item) =>
										item.title !== "Studio" || user?.role === "creator",
								)
								// The bottom bar already carries these four — the
								// drawer holds what the bar can't (owner 2026-09-03:
								// no repetition).
								.filter(
									(item) =>
										![
											"nav.home",
											"nav.explore",
											"nav.messages",
											"nav.profile",
											"nav.videos",
										].includes(item.labelKey),
								)
								.map((item) => {
								const rowClasses = (isActive: boolean) =>
									clsx(
										// Same row language as the desktop rail:
										// pill rows, active = bg/chip + semibold.
										"flex items-center gap-3.5 px-4 py-3.5 rounded-pill transition-colors font-sans text-[calc(16.5px*var(--ws-fs))] relative",
										// Active is bold and nothing else (owner 2026-10-16,
										// matching the desktop rail): no fill behind it.
										isActive
											? "text-primary font-bold"
											: "text-muted hover:text-primary",
									);

								// The Products entry opens the wheel of apps (owner
								// 2026-10-16: "let mobile have its own animation too").
								if (item.isDropdown) {
									return (
										<motion.div key={item.labelKey} variants={staggerItem}>
											<button
												ref={productsRow}
												type="button"
												onClick={() => setProductsOpen(true)}
												aria-haspopup="dialog"
												aria-expanded={productsOpen}
												className={clsx(rowClasses(false), "w-full cursor-pointer")}
											>
												<item.icon isActive={false} />
												<span className="flex-1 text-left">{t(item.labelKey)}</span>
											</button>
											<ProductsWheel origin={productsRow} open={productsOpen} onClose={closeProducts} />
										</motion.div>
									);
								}

								const isActive = pathname === item.link;
								const href =
									item.labelKey === "nav.profile" && user?.username
										? `/profile/${user.username}`
										: item.link;

								const badgeCount = badgeForNavKey(
									item.labelKey,
									unreadNotifications,
									unreadCount,
									unreadBm,
								);

								return (
									<motion.div key={item.labelKey} variants={staggerItem}>
										<Link
											href={href}
											className={rowClasses(isActive)}
											onClick={closeDrawer}
										>
											<BadgedIcon count={badgeCount} label={t(item.labelKey)}>
												<item.icon isActive={isActive} />
											</BadgedIcon>
											<span>{t(item.labelKey)}</span>
										</Link>
									</motion.div>
								);
							})}
							</motion.nav>
						</div>

						{/* Footer Actions. The bottom edge is the phone's, so the
						    home indicator gets its clearance here rather than on a
						    wrapper the panel no longer has. */}
						<div className="shrink-0 px-3 pt-2 pb-[calc(8px+var(--ws-safe-bottom))]">
							<button
								type="button"
								onClick={() =>
									withThemeTransition(() => setTheme(isLight ? "dark" : "light"))
								}
								className="w-full flex items-center gap-3 px-4 py-3 rounded-pill text-muted hover:text-primary hover:bg-primary/5 transition-colors font-sans font-medium text-[calc(15px*var(--ws-fs))] cursor-pointer"
							>
								<AnimatePresence mode="wait" initial={false}>
									<motion.span
										key={mounted && isLight ? "to-dark" : "to-light"}
										{...swap}
										className="flex items-center gap-3"
									>
										{mounted && isLight ? <Moon size={20} /> : <Sun size={20} />}
										{mounted && isLight ? t("nav.darkMode") : t("nav.lightMode")}
									</motion.span>
								</AnimatePresence>
							</button>
							<div className="pb-1">
								<LanguageMenu
									expanded={langOpen}
									onToggle={() => setLangOpen((v) => !v)}
								/>
							</div>
							<button
								onClick={() => handleSignOut(signOut)}
								className="w-full flex items-center gap-3 px-4 py-3 text-danger hover:bg-primary/5 rounded-pill transition-colors font-sans font-bold text-[calc(15px*var(--ws-fs))] cursor-pointer"
							>
								<SignOut size={20} />
								{t("nav.logout")}
							</button>
						</div>
					</motion.aside>
				)}
			</AnimatePresence>
		</>
	);
}
