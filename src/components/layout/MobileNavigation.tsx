"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { userAtom } from "@/store/user.atom";
import { useClerk } from "@clerk/nextjs";
import { useAppPathname } from "@/i18n/useAppPathname";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
	ArrowUpRight,
	CaretDown,
	MagnifyingGlass,
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
import { FeedHeaderActions } from "@/components/feed/FeedHeaderActions";
import { unreadMessagesCountAtom } from "@/store/messageCache";
import { badgeForNavKey, commandPaletteOpenAtom, unreadNotificationsCountAtom } from "@/store/ui.atom";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

export function MobileNavigation() {
	const t = useT();
	const user = useAtomValue(userAtom);
	const unreadCount = useAtomValue(unreadMessagesCountAtom);
	const unreadNotifications = useAtomValue(unreadNotificationsCountAtom);
	const { signOut } = useClerk();
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	const pathname = useAppPathname();
	const [isOpen, setIsOpen] = useState(false);
	const [langOpen, setLangOpen] = useState(false);
	const [productsOpen, setProductsOpen] = useState(false);
	const setPaletteOpen = useSetAtom(commandPaletteOpenAtom);

	useEffect(() => setMounted(true), []);
	const isLight = mounted && resolvedTheme === "light";

	// Close sidebar on route change
	useEffect(() => {
		setIsOpen(false);
	}, [pathname]);

	// Prevent scrolling when sidebar is open
	useEffect(() => {
		if (isOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "unset";
		}
		return () => {
			document.body.style.overflow = "unset";
		};
	}, [isOpen]);

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
					{/* 44x44 target around a 32px avatar the glyph stays small,
					    the tappable box doesn't. */}
					<button
						type="button"
						onClick={() => setIsOpen(true)}
						aria-label="Open navigation menu"
						className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill active:bg-raised transition-colors"
					>
						<span className="relative block w-8 h-8 rounded-full overflow-hidden border border-hairline">
							<SafeAvatar src={user.avatar} className="object-cover" alt={user.username || "User"} />
						</span>
					</button>

					{/* The animated lockup, centred: the W draws, floods gold, and
					    the wordmark walks in — the hub's brand ritual. */}
					<Link
						href="/"
						aria-label="WorldSpace home"
						className="absolute left-1/2 -translate-x-1/2 flex h-11 items-center justify-center px-2 rounded-pill active:bg-raised transition-colors"
					>
						<BrandRitual size={32} />
					</Link>

					<div className="flex items-center gap-1 shrink-0">
						<button
							type="button"
							onClick={() => setPaletteOpen(true)}
							aria-label={t("rail.search")}
							className="flex h-11 w-11 items-center justify-center rounded-pill text-muted active:bg-raised transition-colors"
						>
							<MagnifyingGlass size={20} />
						</button>
						<FeedHeaderActions compact />
					</div>
				</div>
			</header>

			{/* Sidebar Drawer. CSS transitions, not framer: they run on the
			    compositor once started, so a busy main thread (dev hydration,
			    translation churn) can't freeze the panel mid-slide — which the
			    rAF-driven version visibly did. Always mounted; `inert` keeps the
			    closed panel out of the tab order. */}
			{/* Backdrop */}
			<div
				onClick={() => setIsOpen(false)}
				aria-hidden="true"
				className={clsx(
					"fixed inset-0 bg-scrim z-dropdown md:hidden transition-opacity duration-[var(--ws-motion-slow)]",
					isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
				)}
			/>

			{/* Drawer */}
			<div
				inert={!isOpen || undefined}
				className={clsx(
					// Sheets/drawers slide at motion-slow with the one easing —
					// no spring physics in the motion system.
					"fixed top-0 bottom-0 left-0 w-[80%] max-w-[300px] bg-page border-r border-hairline z-dropdown flex flex-col md:hidden pt-safe pb-safe transition-transform duration-[var(--ws-motion-slow)]",
					isOpen ? "translate-x-0" : "-translate-x-full",
				)}
			>
				{/* Drawer Header */}
				<div className="p-4 border-b border-hairline flex items-center justify-between gap-2">
					<div className="flex items-center gap-3 min-w-0">
						<div className="relative w-10 h-10 shrink-0 rounded-full overflow-hidden border border-hairline">
							<SafeAvatar src={user.avatar} className="object-cover" alt={user.username || "User"} />
						</div>
						<div className="flex flex-col min-w-0">
							<span className="font-bold text-primary text-sm truncate font-sans">
								{fullName}
							</span>
							<span className="text-subtle text-[13px] truncate font-sans">
								@{user.username}
							</span>
						</div>
					</div>
					<button
						type="button"
						onClick={() => setIsOpen(false)}
						aria-label="Close navigation menu"
						className="flex h-11 w-11 shrink-0 items-center justify-center hover:bg-surface rounded-pill text-muted transition-colors"
					>
						<X size={20} />
					</button>
				</div>

				{/* Navigation Links */}
				<nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
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
									: "text-muted hover:text-primary hover:bg-surface",
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
												className="flex items-center gap-2 pl-[52px] pr-4 py-2.5 rounded-pill text-muted hover:text-primary hover:bg-surface transition-colors font-sans text-sm"
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
						);

						return (
							<Link
								key={item.labelKey}
								href={href}
								className={rowClasses(isActive)}
								onClick={() => setIsOpen(false)}
							>
								<BadgedIcon count={badgeCount} label={t(item.labelKey)}>
									<item.icon isActive={isActive} />
								</BadgedIcon>
								<span>{t(item.labelKey)}</span>
							</Link>
						);
					})}
				</nav>

				{/* Footer Actions */}
				<div className="p-4 border-t border-hairline">
					<button
						type="button"
						onClick={() =>
							withThemeTransition(() => setTheme(isLight ? "dark" : "light"))
						}
						className="w-full flex items-center gap-3 px-4 py-3 rounded-pill text-muted hover:text-primary hover:bg-surface transition-colors font-sans font-medium text-sm cursor-pointer"
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
						className="w-full flex items-center gap-3 px-4 py-3 text-danger hover:bg-surface rounded-pill transition-colors font-sans font-bold text-sm cursor-pointer"
					>
						<SignOut size={20} />
						{t("nav.logout")}
					</button>
				</div>
			</div>
		</>
	);
}
