"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import {
	ArrowUpRight,
	CaretDown,
	ChartPieSlice,
	GameController,
	GraduationCap,
	MonitorPlay,
	Moon,
	DotsThree,
	ShoppingBagOpen,
	SignOut,
	Sun,
	UserCircle,
	Wallet,
} from "@phosphor-icons/react";
import clsx from "clsx";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { mainNav, moreItem, youNav, type SidebarItem } from "@/data/sidebar";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { unreadMessagesCountAtom } from "@/store/messageCache";
import { unreadNotificationsCountAtom } from "@/store/ui.atom";
import { handleSignOut } from "@/lib/utils";
import { withThemeTransition } from "@/lib/theme-transition";
import { useT } from "@/i18n/client";

/* Every WorldStreet product, spelled out — the Products section expands
   inline (no popover), so the ecosystem is discoverable, not hidden. */
const ECOSYSTEM = [
	{
		title: "Dashboard",
		description: "Wallet, portfolio and settings",
		href: "https://dashboard.worldstreetgold.com",
		icon: ChartPieSlice,
	},
	{
		title: "Academy",
		description: "Courses, order books, certifications",
		href: "https://academy.worldstreetgold.com",
		icon: GraduationCap,
	},
	{
		title: "Xstream",
		description: "Live streams and drops",
		href: "https://xtreme.worldstreetgold.com",
		icon: MonitorPlay,
	},
	{
		title: "Shop",
		description: "The WorldStreet marketplace",
		href: "https://shop.worldstreetgold.com",
		icon: ShoppingBagOpen,
	},
	{
		title: "Wallet",
		description: "Send, swap and hold assets",
		href: "https://wallet.worldstreetgold.com",
		icon: Wallet,
	},
	{
		title: "Arcade",
		description: "Games and competitions",
		href: "https://arcade.worldstreetgold.com",
		icon: GameController,
	},
];

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
	const pathname = usePathname();
	const user = useAtomValue(userAtom);
	const unreadCount = useAtomValue(unreadMessagesCountAtom);
	const unreadNotifications = useAtomValue(unreadNotificationsCountAtom);
	const { signOut } = useClerk();
	const router = useRouter();
	const [menuOpen, setMenuOpen] = useState(false);
	const [productsOpen, setProductsOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	// Theme is only knowable client-side; render the toggle after mount so
	// SSR and the first client paint agree.
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const isLight = mounted && resolvedTheme === "light";

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setMenuOpen(false);
			}
		};
		if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
		return () =>
			document.removeEventListener("mousedown", handleClickOutside);
	}, [menuOpen]);

	const badgeFor = (item: SidebarItem) =>
		item.title === "Messages"
			? unreadCount
			: item.title === "Notifications"
				? unreadNotifications
				: 0;

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
				<span className="relative inline-flex w-[22px] h-[22px] items-center justify-center">
					<item.icon isActive={isActive} />
					{badgeCount > 0 && (
						<span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-4 h-4 px-1 text-[9px] font-bold text-brand-on bg-brand rounded-pill border border-page font-sans tabular-nums">
							{badgeCount > 9 ? "9+" : badgeCount}
						</span>
					)}
				</span>
				<span className="text-[15px] font-sans">{t(item.labelKey)}</span>
			</Link>
		);
	};

	return (
		<header className="w-[264px] shrink-0 hidden md:flex flex-col sticky top-0 h-dvh overflow-y-auto no-scrollbar pl-4 pr-5 border-r border-hairline">
			{/* Intro: logo leads, nav items cascade after it (animate-rise + delays). */}
			<div className="py-7 px-2 animate-rise">
				<Link href="/" className="flex items-center gap-2 group">
					<Image
						src="/images/wsa-mark.png"
						alt="WorldStreet"
						width={26}
						height={26}
						className="h-[26px] w-[26px] object-contain shrink-0"
					/>
					<div className="flex flex-col leading-tight min-w-0">
						<span className="font-display font-semibold text-[15px] text-primary tracking-tight truncate">
							WorldStreet
						</span>
						<span className="font-sans text-[10px] font-semibold uppercase tracking-[2px] text-gold">
							Social
						</span>
					</div>
				</Link>
			</div>

			<nav className="flex flex-col gap-0.5 flex-1 px-2">
				{mainNav.map((item, i) => renderItem(item, i, 60))}

				<Eyebrow>{t("nav.you")}</Eyebrow>
				{youNav.map((item, i) => renderItem(item, i, 240))}

				{/* Products — expands inline so the ecosystem is one glance away. */}
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
							<div className="ml-4 pl-4 border-l border-hairline flex flex-col gap-0.5 py-1">
								{ECOSYSTEM.map((app) => (
									<a
										key={app.title}
										href={app.href}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-muted hover:bg-surface hover:text-primary transition-colors group/app"
									>
										<app.icon size={17} />
										<span className="flex flex-col min-w-0 flex-1 leading-tight">
											<span className="font-sans text-[13.5px] font-medium">
												{app.title}
											</span>
											<span className="font-sans text-[11px] text-subtle truncate">
												{app.description}
											</span>
										</span>
										<ArrowUpRight
											size={13}
											className="text-subtle opacity-0 group-hover/app:opacity-100 transition-opacity shrink-0"
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
								window.scrollTo({ top: 0, behavior: "smooth" });
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
					ref={menuRef}
				>
					{menuOpen && (
						<div className="absolute bottom-full left-0 w-[230px] card-depth overflow-hidden mb-3 z-dropdown animate-rise py-1">
							<Link
								href={
									user.username ? `/profile/${user.username}` : "/profile"
								}
								onClick={() => setMenuOpen(false)}
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
								{mounted && isLight ? t("nav.darkMode") : t("nav.lightMode")}
							</button>
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
					)}

					<button
						type="button"
						onClick={() => setMenuOpen((v) => !v)}
						className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface transition-colors text-left group cursor-pointer"
					>
						<div className="relative w-10 h-10 rounded-pill overflow-hidden border border-hairline shrink-0">
							<Image
								src={user.avatar}
								alt={user.username || "User"}
								fill
								className="object-cover"
							/>
						</div>
						<div className="flex flex-col flex-1 min-w-0">
							<span className="font-semibold text-sm text-primary truncate font-sans">
								{user.firstName + " " + user.lastName || user.username}
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
