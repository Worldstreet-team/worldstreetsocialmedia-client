"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import {
	ArrowUpRight,
	Clapperboard,
	GraduationCap,
	LogOut,
	Moon,
	MoreHorizontal,
	Radio,
	ShoppingBag,
	Sun,
	User as UserIcon,
	Wallet,
} from "lucide-react";
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
import { GoLiveSheet } from "@/components/feed/GoLiveSheet";

/* The ecosystem panel behind "More" — every WorldStreet app, spelled out.
   Icons are the platforms' 03-icons glyphs (graduation-cap, clapperboard,
   shopping-bag, wallet) on ListRow-style raised chips. */
const ECOSYSTEM = [
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
		icon: Clapperboard,
	},
	{
		title: "Shop",
		description: "The WorldStreet marketplace",
		href: "https://shop.worldstreetgold.com",
		icon: ShoppingBag,
	},
	{
		title: "Dashboard",
		description: "Wallet, portfolio and settings",
		href: "https://dashboard.worldstreetgold.com",
		icon: Wallet,
	},
];

/* Section eyebrow — the landing page's uppercase-tracking micro-label,
   reused as the rail's grouping device. */
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
	const [isMenuOpen, setIsMenuOpen] = useState<boolean | "more">(false);
	const [showGoLive, setShowGoLive] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const moreMenuRef = useRef<HTMLDivElement>(null);

	// Theme is only knowable client-side; render the toggle after mount so
	// SSR and the first client paint agree.
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const isLight = mounted && resolvedTheme === "light";

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			if (
				menuRef.current &&
				!menuRef.current.contains(target) &&
				moreMenuRef.current &&
				!moreMenuRef.current.contains(target)
			) {
				setIsMenuOpen(false);
			}
		};

		if (isMenuOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isMenuOpen]);

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
					"relative flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors group animate-rise",
					isActive
						? "bg-chip font-semibold text-primary"
						: "text-muted hover:bg-surface hover:text-primary",
				)}
			>
				{/* Modern active cue: a slim gold inset bar, not a heavier fill. */}
				{isActive && (
					<span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-pill bg-brand" />
				)}
				<span className="relative inline-flex w-5 h-5 items-center justify-center">
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
		<header className="w-[260px] shrink-0 hidden md:flex flex-col sticky top-0 h-dvh overflow-y-auto no-scrollbar pl-4 pr-6 border-r border-hairline">
			{/* Intro: logo leads, nav items cascade after it (animate-rise + delays). */}
			<div className="py-7 px-2 animate-rise">
				{/* Unified ecosystem lockup (05-screens): gold wsa-mark 26px, unboxed +
				    "WorldStreet" Poppins SemiBold 15 + gold app eyebrow. */}
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

				{/* More → ecosystem panel */}
				<div
					className="relative animate-rise"
					style={{ animationDelay: "300ms" }}
					ref={moreMenuRef}
				>
					<button
						type="button"
						onClick={() =>
							setIsMenuOpen(isMenuOpen === "more" ? false : "more")
						}
						className={clsx(
							"flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors w-full text-left cursor-pointer",
							isMenuOpen === "more"
								? "bg-chip font-semibold text-primary"
								: "text-muted hover:bg-surface hover:text-primary",
						)}
					>
						<span className="inline-flex w-5 h-5 items-center justify-center">
							<moreItem.icon isActive={isMenuOpen === "more"} />
						</span>
						<span className="text-[15px] font-sans">{t("nav.more")}</span>
					</button>

					{isMenuOpen === "more" && (
						<div className="absolute bottom-full left-0 w-[300px] bg-surface border border-hairline rounded-lg shadow-nav overflow-hidden mb-2 z-dropdown animate-rise py-2">
							<p className="px-4 pt-2 pb-1.5 font-sans font-medium text-[11px] uppercase tracking-[1px] text-subtle">
								More from WorldStreet
							</p>
							{ECOSYSTEM.map((app) => (
								<a
									key={app.title}
									href={app.href}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-raised transition-colors group/app"
									onClick={() => setIsMenuOpen(false)}
								>
									<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-raised border border-hairline">
										<app.icon className="w-[18px] h-[18px] text-primary" />
									</span>
									<span className="flex flex-col min-w-0 flex-1">
										<span className="font-sans text-sm font-medium text-primary">
											{app.title}
										</span>
										<span className="font-sans text-[12px] text-muted truncate">
											{app.description}
										</span>
									</span>
									<ArrowUpRight className="w-4 h-4 text-subtle opacity-0 group-hover/app:opacity-100 transition-opacity shrink-0" />
								</a>
							))}
							<p className="px-4 pt-2 pb-1 font-sans text-[11px] text-subtle border-t border-hairline mt-1.5">
								One account works everywhere.
							</p>
						</div>
					)}
				</div>

				{/* Quick actions: the one gold CTA + Go Live beside it.
				    05-screens: "gold Post button (pill, full-width)" — the pill
				    stays primary; Go Live is a danger-tinted square companion. */}
				<div
					className="mt-5 flex items-center gap-2 animate-rise"
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
						className="flex-1 h-12 bg-brand hover:bg-brand-active text-brand-on font-semibold text-[15px] rounded-pill font-sans transition-colors cursor-pointer"
					>
						{t("composer.post")}
					</button>
					<button
						type="button"
						onClick={() => setShowGoLive(true)}
						aria-label={t("golive.entry")}
						title={t("golive.entry")}
						className="h-12 w-12 shrink-0 flex items-center justify-center rounded-pill border border-danger/30 text-danger hover:bg-danger/10 transition-colors cursor-pointer"
					>
						<Radio className="w-5 h-5" />
					</button>
				</div>
			</nav>

			{showGoLive && <GoLiveSheet onClose={() => setShowGoLive(false)} />}

			{user && (
				<div
					className="mb-6 px-2 relative animate-rise"
					style={{ animationDelay: "360ms" }}
					ref={menuRef}
				>
					{isMenuOpen === true && (
						<div className="absolute bottom-full left-0 w-[230px] bg-surface border border-hairline rounded-lg shadow-nav overflow-hidden mb-3 z-dropdown animate-rise py-1">
							<Link
								href={user.username ? `/profile/${user.username}` : "/profile"}
								onClick={() => setIsMenuOpen(false)}
								className="w-full text-left px-3.5 py-2.5 hover:bg-raised text-sm text-primary font-sans font-medium flex items-center gap-2.5 transition-colors"
							>
								<UserIcon className="w-4 h-4" />
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
									<Moon className="w-4 h-4" />
								) : (
									<Sun className="w-4 h-4" />
								)}
								{mounted && isLight ? t("nav.darkMode") : t("nav.lightMode")}
							</button>
							<div className="my-1 border-t border-hairline" />
							<button
								type="button"
								className="w-full text-left px-3.5 py-2.5 hover:bg-raised text-sm text-danger font-sans font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
								onClick={() => handleSignOut(signOut)}
							>
								<LogOut className="w-4 h-4" />
								{t("nav.logout")} @{user.username}
							</button>
						</div>
					)}

					<button
						type="button"
						onClick={() => setIsMenuOpen(isMenuOpen === true ? false : true)}
						className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-transparent hover:border-hairline hover:bg-surface transition-colors text-left group cursor-pointer"
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
						<MoreHorizontal className="w-5 h-5 text-subtle group-hover:text-primary transition-colors shrink-0" />
					</button>
				</div>
			)}
		</header>
	);
}
