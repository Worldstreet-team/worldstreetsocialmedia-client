"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppPathname } from "@/i18n/useAppPathname";
import { useClerk } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import {
	ArrowUpRight,
	CaretDown,
	Moon,
	DotsThree,
	SignOut,
	Sun,
	UserCircle,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence } from "framer-motion";
import { BadgedIcon } from "@/components/ui/Badge";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import Image from "next/image";
import { useCallback, useState, useEffect, useRef} from "react";
import { mainNav, moreItem, youNav, type SidebarItem } from "@/data/sidebar";
import { useAtomValue, useSetAtom } from "jotai";
import { userAtom } from "@/store/user.atom";
import { ECOSYSTEM } from "@/data/ecosystem";
import { UserBadges } from "@/components/ui/UserBadges";
import { unreadMessagesCountAtom } from "@/store/messageCache";
import { liveSpacesCountAtom } from "@/store/voice.atom";
import { badgeForNavKey, unreadNotificationsCountAtom } from "@/store/ui.atom";
import { handleSignOut } from "@/lib/utils";
import { withThemeTransition } from "@/lib/theme-transition";
import { mainScroller } from "@/lib/utils";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
import { premiumOpenAtom } from "@/store/ui.atom";
import { BrandRitual } from "@/components/layout/BrandRitual";
import { LanguageMenu } from "@/components/ui/LanguageMenu";
import { useT } from "@/i18n/client";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

/* Every WorldStreet product, spelled out — the Products section expands
   inline (no popover), so the ecosystem is discoverable, not hidden.
   One shared wsa-mark stands in for per-product icons: these are all the
   same brand, and distinct glyphs read as unrelated apps.

   Names, order and destinations mirror the hub's address book
   (Worldstreet/components/landing/platform-links.ts) so the ecosystem
   reads the same everywhere keep this list in step with it. Notably
   there is NO Wallet platform: the wallet is a feature inside the
   dashboard, not a subdomain. Forex and Crypto are two products that
   share one trading desk, which is why both point at /trade. The hub's
 "Community" entry is deliberately omitted here this app already has
   its own Communities section in the nav above. */

/* Section eyebrow — the landing page's uppercase-tracking micro-label. */
function Eyebrow({ children }: { children: React.ReactNode }) {
	return (
		<p className="px-4 pt-5 pb-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle select-none">
			{children}
		</p>
	);
}

export function LeftSidebar() {
	const t = useT();
	const pathname = useAppPathname();
	const user = useAtomValue(userAtom);
	const unreadCount = useAtomValue(unreadMessagesCountAtom);
	const unreadNotifications = useAtomValue(unreadNotificationsCountAtom);
	// Live rooms are not unread items, so they get a pulse rather than a
	// number — see the render below.
	const liveSpaces = useAtomValue(liveSpacesCountAtom);
	const { signOut } = useClerk();
	const router = useRouter();
	const [menuOpen, setMenuOpen] = useState(false);
	const [productsOpen, setProductsOpen] = useState(false);
	const [langOpen, setLangOpen] = useState(false);

	// Theme is only knowable client-side; render the toggle after mount so
	// SSR and the first client paint agree.
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const isLight = mounted && resolvedTheme === "light";

	// The click-catcher is the scrim's job now, and Escape plus the scroll lock
	// are the dismiss hook's — the hand-rolled mousedown listener that used to
	// live here handled outside-click only. The language sub-menu still has to
	// fold when the account menu shuts, which is the one thing left.
	const closeMenu = useCallback(() => setMenuOpen(false), []);
	/**
	 * The panel is portalled (the rail is sticky, so it owns a stacking
	 * context a z-modal scrim would sit above), which means it cannot inherit
	 * the rail's position. Measured from the trigger instead: an account menu
	 * that opens bottom-RIGHT of a screen when you clicked bottom-LEFT reads
	 * as a different control entirely.
	 */
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(
		null,
	);
	useEffect(() => {
		if (!menuOpen) return;
		const measure = () => {
			const r = triggerRef.current?.getBoundingClientRect();
			if (r) {
				setAnchor({
					left: Math.round(r.left),
					bottom: Math.round(window.innerHeight - r.top + 8),
				});
			}
		};
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, [menuOpen]);
	useOverlayDismiss(menuOpen, closeMenu);

	useEffect(() => {
		if (!menuOpen) setLangOpen(false);
	}, [menuOpen]);

	// Keyed on labelKey, not the display title: labelKey is the stable i18n
	// identifier, so renaming the visible label can't silently drop a badge.
	const badgeFor = (item: SidebarItem) =>
		badgeForNavKey(item.labelKey, unreadNotifications, unreadCount);

	const setPremiumOpen = useSetAtom(premiumOpenAtom);

	const renderItem = (item: SidebarItem, index: number, offset: number) => {
		const href =
			item.title === "Profile" && user?.username
				? `/profile/${user.username}`
				: item.link;
		const isActive =
			item.link === "/" ? pathname === "/" : pathname.startsWith(item.link);
		const badgeCount = badgeFor(item);

		return (
			<Link
				key={item.title}
				href={href}
				style={{ animationDelay: `${offset + index * 30}ms` }}
				className={clsx(
					// Active = light chip + filled glyph; nothing heavier.
					"relative flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors group animate-rise",
					isActive
						? "bg-raised text-primary font-semibold"
						: "text-muted hover:bg-surface hover:text-primary",
				)}
			>
				<BadgedIcon count={badgeCount} label={t(item.labelKey)}>
					<item.icon isActive={isActive} />
				</BadgedIcon>
				<span className="text-[15px] font-sans">{t(item.labelKey)}</span>
				{item.labelKey === "nav.voice" && liveSpaces > 0 && (
					// A broadcast dot, not a count: rooms are happening now, they
					// aren't a backlog. The title carries the actual number for
					// anyone who wants it.
					<span
						className="relative ml-auto flex h-2 w-2 shrink-0"
						title={`${liveSpaces} ${t("voice.liveNow")}`}
					>
						<span className="absolute inline-flex h-full w-full animate-ping rounded-pill bg-danger opacity-75" />
						<span className="relative inline-flex h-2 w-2 rounded-pill bg-danger" />
						<span className="sr-only">{t("voice.liveNow")}</span>
					</span>
				)}
			</Link>
		);
	};

	return (
		<header className="w-[264px] shrink-0 hidden md:flex flex-col sticky top-0 h-dvh overflow-y-auto no-scrollbar pl-4 pr-5 border-r border-hairline">
			{/* Intro: logo leads, nav items cascade after it (animate-rise + delays). */}
			<div className="py-7 px-2 animate-rise">
				{/* Same brand ritual the mobile top bar plays — the rail is where
				    the hub runs it, so the two apps now behave identically. */}
				<Link href="/" className="flex items-center gap-2 group">
					<BrandRitual size={34} wordSize={19} />
				</Link>
			</div>

			<nav className="flex flex-col gap-0.5 flex-1 px-2">
				{mainNav.map((item, i) => renderItem(item, i, 60))}

				<Eyebrow>{t("nav.you")}</Eyebrow>
				{youNav
					// The Studio is a creator tool; for everyone else the nav entry
					// is an ad for a door they can't open. The route stays reachable
					// (deep links get the become-a-creator pitch), only the nav hides.
					.filter(
						(item) => item.title !== "Studio" || user?.role === "creator",
					)
					.map((item, i) => renderItem(item, i, 240))}

				{/* Premium opens the subscription sheet rather than navigating.
				    Gold seal at rest: the row advertises the tick by wearing it. */}
				<button
					type="button"
					onClick={() => setPremiumOpen(true)}
					className="animate-rise flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors w-full text-left cursor-pointer text-muted hover:bg-surface hover:text-primary"
					style={{ animationDelay: "280ms" }}
				>
					<span className="inline-flex w-[22px] h-[22px] items-center justify-center">
						<VerifiedIcon size={{ width: "22", height: "22" }} />
					</span>
					<span className="text-[15px] font-sans">{t("nav.premium")}</span>
				</button>

				{/* Products expands inline so the ecosystem is one glance away. */}
				<div className="animate-rise" style={{ animationDelay: "300ms" }}>
					<button
						type="button"
						onClick={() => setProductsOpen((v) => !v)}
						aria-expanded={productsOpen}
						className={clsx(
							"flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors w-full text-left cursor-pointer",
							productsOpen
								? "text-primary"
								: "text-muted hover:bg-surface hover:text-primary",
						)}
					>
						<span className="inline-flex w-[22px] h-[22px] items-center justify-center">
							<moreItem.icon isActive={productsOpen} />
						</span>
						<span className="text-[15px] font-sans flex-1">
							{t("nav.products")}
						</span>
						<CaretDown
							size={14}
							className={clsx(
								"text-subtle transition-transform",
								productsOpen && "rotate-180",
							)}
						/>
					</button>

					<div
						className={clsx(
							"grid transition-[grid-template-rows] duration-200",
							productsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
						)}
					>
						<div className="overflow-hidden">
							{/* No rail/divider: the rows are indented to sit under the
							    parent's label, which is enough to read as nested. The
							    arrow is absolutely placed so it costs no row width 
							    "Cryptocurrencies" needs every pixel in this rail. */}
							<div className="flex flex-col py-0.5 pl-3">
								{ECOSYSTEM.map((app) => (
									<a
										key={app.title}
										href={app.href}
										target="_blank"
										rel="noopener noreferrer"
										className="relative flex items-center gap-2.5 pl-3 pr-7 py-2 rounded-xl text-muted hover:bg-surface hover:text-primary transition-colors group/app"
									>
										<Image
											src="/images/wsa-mark.png"
											alt=""
											width={15}
											height={15}
											aria-hidden
											className="h-[15px] w-[15px] object-contain shrink-0 opacity-70 group-hover/app:opacity-100 transition-opacity"
										/>
										<span className="font-sans text-[13.5px] flex-1 min-w-0 truncate">
											{app.title}
										</span>
										<ArrowUpRight
											size={12}
											className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle opacity-0 group-hover/app:opacity-100 transition-opacity"
										/>
									</a>
								))}
							</div>
						</div>
					</div>
				</div>

				{/* Quick actions: the one gold CTA + the glossy Go Live beside it.
				    The shine sweep passes every 5s (off under reduced motion). */}
				<div
					className="mt-5 animate-rise"
					style={{ animationDelay: "330ms" }}
				>
					<button
						type="button"
						onClick={() => {
							const composer =
								document.querySelector<HTMLTextAreaElement>(
									"#post-composer-input",
								);
							if (composer) {
								mainScroller().scrollTo({ top: 0, behavior: "smooth" });
								composer.focus();
							} else {
								router.push("/");
							}
						}}
						className="w-full h-12 shine bg-brand hover:bg-brand-active text-brand-on font-semibold text-[15px] rounded-pill font-sans transition-colors cursor-pointer"
					>
						{t("composer.post")}
					</button>
				</div>
			</nav>

			{user && (
				<div
					className="mb-6 mt-4 px-2 relative animate-rise"
					style={{ animationDelay: "360ms" }}
				>
					{/* The account menu, on the standard overlay grammar: `anchored`
					    — the variant for menus — portalled out of the rail so the
					    scrim can sit at `z-modal` over the whole page. As a sticky
					    element the rail is its own stacking context, so an in-place
					    panel could never rise above the scrim that dismisses it. */}
					<ConfirmModalPortal>
						<AnimatePresence>
							{menuOpen && (
								// A menu is not a modal: the feed stays lit behind it
								// on desktop, and dims only where the panel owns the
								// screen.
								<OverlayScrim
									key="account-scrim"
									onClose={closeMenu}
									dim={false}
									label={t("common.close")}
								/>
							)}
							{menuOpen && (
								<OverlayPanel
									key="account-panel"
									variant="anchored"
									label={`@${user.username}`}
									// Neutralise the variant's bottom-right desktop
									// parking so the measured anchor wins.
									className="sm:right-auto sm:bottom-auto sm:!w-[260px]"
									style={
										anchor
											? {
													// Phones keep the bottom sheet; only the
													// desktop card follows the trigger.
													...(window.innerWidth >= 640
														? { left: anchor.left, bottom: anchor.bottom }
														: null),
													transformOrigin: "bottom left",
												}
											: undefined
									}
								>
									<OverlayHeader
										title={`@${user.username}`}
										onClose={closeMenu}
										closeLabel={t("common.close")}
									/>
									<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(6px+var(--ws-safe-bottom))]">
										<Link
											href={
												user.username
													? `/profile/${user.username}`
													: "/profile"
											}
											onClick={closeMenu}
											className="w-full text-left px-3.5 py-2.5 hover:bg-raised text-sm text-primary font-sans font-medium flex items-center gap-2.5 transition-colors"
										>
											<UserCircle size={16} />
											{t("nav.viewProfile")}
										</Link>
										<button
											type="button"
											onClick={() =>
												withThemeTransition(() =>
													setTheme(isLight ? "dark" : "light"),
												)
											}
											className="w-full text-left px-3.5 py-2.5 hover:bg-raised text-sm text-primary font-sans font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
										>
											{mounted && isLight ? (
												<Moon size={16} />
											) : (
												<Sun size={16} />
											)}
											{mounted && isLight
												? t("nav.darkMode")
												: t("nav.lightMode")}
										</button>
										<LanguageMenu
											expanded={langOpen}
											onToggle={() => setLangOpen((v) => !v)}
										/>
										<div className="my-1 border-t border-hairline" />
										<button
											type="button"
											className="w-full text-left px-3.5 py-2.5 hover:bg-raised text-sm text-danger font-sans font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
											onClick={() => handleSignOut(signOut)}
										>
											<SignOut size={16} />
											{t("nav.logout")} @{user.username}
										</button>
									</div>
								</OverlayPanel>
							)}
						</AnimatePresence>
					</ConfirmModalPortal>

					<button
						type="button"
						ref={triggerRef}
						onClick={() => setMenuOpen((v) => !v)}
						aria-haspopup="dialog"
						aria-expanded={menuOpen}
						className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface transition-colors text-left group cursor-pointer"
					>
						<div className="relative w-10 h-10 rounded-pill overflow-hidden border border-hairline shrink-0">
							<SafeAvatar src={user.avatar} className="object-cover" alt={user.username || "User"} />
						</div>
						<div className="flex flex-col flex-1 min-w-0">
							<span className="flex items-center gap-1 min-w-0">
								<span className="font-semibold text-sm text-primary truncate font-sans">
									{user.firstName + " " + user.lastName || user.username}
								</span>
								<UserBadges
									isVerified={user.isVerified}
									verification={user.verification}
									badges={(user as any).badges}
									size={13}
								/>
							</span>
							<span className="text-subtle text-[12px] truncate font-sans">
								@{user.username}
							</span>
						</div>
						<DotsThree
							size={20}
							weight="bold"
							className="text-subtle group-hover:text-primary transition-colors shrink-0"
						/>
					</button>
				</div>
			)}
		</header>
	);
}
