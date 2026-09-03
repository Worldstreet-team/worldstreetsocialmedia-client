"use client";

import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { useClerk } from "@clerk/nextjs";
import { useAppPathname } from "@/i18n/useAppPathname";
import { useCallback, useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { AnimatePresence } from "framer-motion";
import {
	ArrowUpRight,
	CaretDown,
	Moon,
	SignOut,
	Sun,
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
import { SidebarWallet } from "@/components/layout/SidebarWallet";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { NotificationsPopover } from "@/components/layout/NotificationsPopover";
import { FeedHeaderActions } from "@/components/feed/FeedHeaderActions";
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
			<header className="fixed top-0 left-0 right-0 pt-safe bg-page border-b border-hairline z-sticky md:hidden">
				<div className="relative h-14 flex items-center justify-between px-2">
					{/* 44x44 target, small glyph — the tappable box doesn't shrink
					    to match the mark.

					    Two bars, the lower one half-length. Hand-drawn rather
					    than taken from the icon set: every stock "list" glyph is
					    two or three FULL-width bars, and the asymmetry is the
					    whole point of the mark. */}
					<button
						type="button"
						onClick={() => setIsOpen(true)}
						aria-label="Open navigation menu"
						className="flex h-12 w-12 shrink-0 items-center justify-center rounded-pill text-primary active:bg-raised transition-colors"
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

					{/* The animated lockup, centred (owner 2026-09-03: back to the
					    middle): absolute so it stays centred no matter how wide
					    the action cluster grows. */}
					<Link
						href="/"
						aria-label="WorldSpace home"
						className="absolute left-1/2 -translate-x-1/2 flex h-12 items-center justify-center px-2 rounded-pill active:bg-raised transition-colors"
					>
						<BrandRitual size={36} wordSize={18} />
					</Link>

					{/* Bell + live in identical 44px cells on one axis. Search
					    left the header (owner 2026-09-03) — it lives on the
					    bottom tab bar now, where Explore used to sit. */}
					<div className="flex items-center shrink-0">
						{/* Notifications moved UP out of the bottom bar: it is
						    something you check, not somewhere you navigate, and it
						    was holding a permanent tab slot for a glance. */}
						<NotificationsPopover compact />
						<span className="flex h-11 w-11 items-center justify-center">
							<FeedHeaderActions compact />
						</span>
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
					<OverlayPanel
						key="nav-panel"
						dragClose={closeDrawer} variant="sheet"
						label="Navigation menu"
						className="md:hidden"
					>
						{/* Identity replaces the header title outright — whose menu
						    this is IS the heading. */}
						<OverlayHeader
							onClose={closeDrawer}
							closeLabel="Close navigation menu"
						>
							<div className="flex items-center gap-2.5 min-w-0 flex-1">
								<div className="relative w-8 h-8 shrink-0 rounded-full overflow-hidden border border-hairline">
									<SafeAvatar src={user.avatar} className="object-cover" alt={user.username || "User"} />
								</div>
								<div className="flex flex-col min-w-0">
									<span className="font-bold text-primary text-[14px] truncate font-sans leading-tight">
										{fullName}
									</span>
									<span className="text-subtle text-[12px] truncate font-sans leading-tight">
										@{user.username}
									</span>
								</div>
							</div>
						</OverlayHeader>

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
							<nav className="flex flex-col gap-1">
							{sidebarList
								// Studio is creator-only; mirror the desktop rail's gate.
								.filter(
									(item) =>
										item.title !== "Studio" || user?.role === "creator",
								)
								.map((item) => {
								const rowClasses = (isActive: boolean) =>
									clsx(
										// Same row language as the desktop rail:
										// pill rows, active = bg/chip + semibold.
										"flex items-center gap-3 px-4 py-3 rounded-pill transition-colors font-sans relative",
										isActive
											? "bg-chip text-primary font-semibold"
											: "text-muted hover:text-primary hover:bg-raised",
									);

								// The Products entry is a disclosure over the ecosystem
								// links, not a route — href="#" renders an inert row.
								if (item.isDropdown) {
									return (
										<div key={item.labelKey}>
											<button
												type="button"
												onClick={() => setProductsOpen((v) => !v)}
												aria-expanded={productsOpen}
												className={clsx(rowClasses(false), "w-full cursor-pointer")}
											>
												<item.icon isActive={false} />
												<span className="flex-1 text-left">{t(item.labelKey)}</span>
												<CaretDown
													size={14}
													className={clsx(
														"transition-transform",
														productsOpen && "rotate-180",
													)}
												/>
											</button>
											{productsOpen &&
												item.dropdownItems?.map((product) => (
													<a
														key={product.title}
														href={product.link}
														target="_blank"
														rel="noopener noreferrer"
														className="flex items-center gap-2 pl-[52px] pr-4 py-2.5 rounded-pill text-muted hover:text-primary hover:bg-raised transition-colors font-sans text-sm"
													>
														{product.title}
														<ArrowUpRight size={13} />
													</a>
												))}
										</div>
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
									<Link
										key={item.labelKey}
										href={href}
										className={rowClasses(isActive)}
										onClick={closeDrawer}
									>
										<BadgedIcon count={badgeCount} label={t(item.labelKey)}>
											<item.icon isActive={isActive} />
										</BadgedIcon>
										<span>{t(item.labelKey)}</span>
									</Link>
								);
							})}
							</nav>
						</div>

						{/* Footer Actions. The bottom edge is the phone's, so the
						    home indicator gets its clearance here rather than on a
						    wrapper the panel no longer has. */}
						<div className="shrink-0 border-t border-hairline px-3 pt-2 pb-[calc(8px+var(--ws-safe-bottom))]">
							<button
								type="button"
								onClick={() =>
									withThemeTransition(() => setTheme(isLight ? "dark" : "light"))
								}
								className="w-full flex items-center gap-3 px-4 py-3 rounded-pill text-muted hover:text-primary hover:bg-raised transition-colors font-sans font-medium text-sm cursor-pointer"
							>
								{mounted && isLight ? <Moon size={20} /> : <Sun size={20} />}
								{mounted && isLight ? t("nav.darkMode") : t("nav.lightMode")}
							</button>
							<div className="pb-1">
								<LanguageMenu
									expanded={langOpen}
									onToggle={() => setLangOpen((v) => !v)}
								/>
							</div>
							<button
								onClick={() => handleSignOut(signOut)}
								className="w-full flex items-center gap-3 px-4 py-3 text-danger hover:bg-raised rounded-pill transition-colors font-sans font-bold text-sm cursor-pointer"
							>
								<SignOut size={20} />
								{t("nav.logout")}
							</button>
						</div>
					</OverlayPanel>
				)}
			</AnimatePresence>
		</>
	);
}
