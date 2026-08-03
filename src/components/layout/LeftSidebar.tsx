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
	ShoppingBag,
	Sun,
	Wallet,
} from "lucide-react";
import clsx from "clsx";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { sidebarList } from "@/data/sidebar";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { unreadMessagesCountAtom } from "@/store/messageCache";
import { unreadNotificationsCountAtom } from "@/store/ui.atom";
import { handleSignOut } from "@/lib/utils";
import { withThemeTransition } from "@/lib/theme-transition";

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

export function LeftSidebar() {
	const pathname = usePathname();
	const user = useAtomValue(userAtom);
	const unreadCount = useAtomValue(unreadMessagesCountAtom);
	const unreadNotifications = useAtomValue(unreadNotificationsCountAtom);
	const { signOut } = useClerk();
	const router = useRouter();
	const [isMenuOpen, setIsMenuOpen] = useState<boolean | "more">(false);
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
				menuRef.current && !menuRef.current.contains(target) &&
				moreMenuRef.current && !moreMenuRef.current.contains(target)
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

	return (
		<header className="w-[260px] hidden md:flex flex-col sticky top-0 h-screen pl-4 pr-6 border-r border-hairline">
			{/* Intro: logo leads, nav items cascade after it (animate-rise + delays). */}
			<div className="py-8 px-2 animate-rise">
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

			<nav className="flex flex-col gap-1 mt-2 flex-1 px-2">
				{sidebarList.map((item, index) => {
					const isActive = pathname === item.link;
					// Handle "More" dropdown state
					const isMoreOpen = isMenuOpen === "more"; // modifying string state logic below

					const href =
						item.title === "Profile" && user?.username
							? `/profile/${user.username}`
							: item.link;

					const riseDelay = { animationDelay: `${60 + index * 30}ms` };

					if (item.isDropdown) {
						return (
							<div
								key={index}
								className="relative animate-rise"
								style={riseDelay}
								ref={moreMenuRef}
							>
								<button
									onClick={() =>
										setIsMenuOpen(isMenuOpen === "more" ? false : "more")
									}
									className={clsx(
										"flex items-center gap-3 px-4 py-3 rounded-pill transition-colors group relative w-full text-left cursor-pointer",
										isMoreOpen
											? "bg-chip font-semibold text-primary"
											: "text-muted hover:bg-surface hover:text-primary",
									)}
								>
									<div className="relative">
										<span className="inline-flex w-5 h-5 items-center justify-center">
											<item.icon isActive={isMoreOpen} />
										</span>
									</div>
									<span className="text-[15px] font-sans">
										{item.title}
									</span>
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
						);
					}

					return (
						<Link
							key={index}
							href={href}
							style={riseDelay}
							className={clsx(
								"flex items-center gap-3 px-4 py-3 rounded-pill transition-colors group relative animate-rise",
								isActive
									? "bg-chip font-semibold text-primary"
									: "text-muted hover:bg-surface hover:text-primary",
							)}
						>
							<div className="relative">
								<span className="inline-flex w-5 h-5 items-center justify-center">
									<item.icon isActive={isActive} />
								</span>
								{(() => {
									const badgeCount =
										item.title === "Messages"
											? unreadCount
											: item.title === "Notifications"
												? unreadNotifications
												: 0;
									return badgeCount > 0 ? (
										<span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-[10px] font-bold text-brand-on bg-brand rounded-full border-2 border-page animate-rise font-sans tabular-nums">
											{badgeCount > 9 ? "9+" : badgeCount}
										</span>
									) : null;
								})()}
							</div>

							<span className="text-[15px] font-sans">
								{item.title}
							</span>
						</Link>
					);
				})}

				{/* Primary CTA. Spec 05-screens: "gold Post button (pill, full-width)".
				    Focuses the composer when it's on screen, otherwise routes home to it. */}
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
					style={{ animationDelay: "280ms" }}
					className="mt-6 w-full h-12 bg-brand hover:bg-brand-active text-brand-on font-semibold text-[15px] rounded-pill font-sans transition-colors cursor-pointer animate-rise"
				>
					Post
				</button>
			</nav>

			{/* Theme switch — light platform palette is an explicit opt-in. */}
			<div
				className="px-2 mb-2 animate-rise"
				style={{ animationDelay: "300ms" }}
			>
				<button
					type="button"
					onClick={() =>
						withThemeTransition(() =>
							setTheme(isLight ? "dark" : "light"),
						)
					}
					aria-label={
						isLight ? "Switch to dark mode" : "Switch to light mode"
					}
					className="flex items-center gap-3 px-4 py-2.5 rounded-pill transition-colors w-full text-left text-muted hover:bg-surface hover:text-primary cursor-pointer"
				>
					<span className="inline-flex w-5 h-5 items-center justify-center">
						{mounted && isLight ? (
							<Moon className="w-5 h-5" strokeWidth={2} />
						) : (
							<Sun className="w-5 h-5" strokeWidth={2} />
						)}
					</span>
					<span className="text-[14px] font-sans">
						{mounted && isLight ? "Dark mode" : "Light mode"}
					</span>
				</button>
			</div>

			{user && (
				<div
					className="mb-8 px-2 relative animate-rise"
					style={{ animationDelay: "320ms" }}
					ref={menuRef}
				>
					{isMenuOpen && (
						<div className="absolute bottom-full left-0 w-[220px] bg-surface border border-hairline rounded-lg shadow-nav overflow-hidden mb-4 z-dropdown animate-rise">
							<button
								type="button"
								className="w-full text-left px-3.5 py-2.5 hover:bg-raised text-sm text-danger font-sans font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
								onClick={() => handleSignOut(signOut)}
							>
								<LogOut className="w-4 h-4" />
								Log out @{user.username}
							</button>
						</div>
					)}

					<button
						type="button"
						onClick={() => setIsMenuOpen(!isMenuOpen)}
						className="w-full flex items-center gap-3 p-3 rounded-full hover:bg-surface transition-colors text-left group cursor-pointer"
					>
						<div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-hairline group-hover:border-brand transition-colors">
							<Image
								src={user.avatar}
								alt={user.username || "User"}
								fill
								className="object-cover"
							/>
						</div>
						<div className="flex flex-col flex-1 min-w-0">
							<span className="font-bold text-sm text-primary truncate font-sans group-hover:text-gold transition-colors">
								{user.firstName + " " + user.lastName || user.username}
							</span>
							<span className="text-subtle text-[13px] truncate font-sans">
								@{user.username}
							</span>
						</div>
						<MoreHorizontal className="w-5 h-5 text-subtle group-hover:text-primary transition-colors" />
					</button>
				</div>
			)}
		</header>
	);
}
