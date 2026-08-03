"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
// 03-icons: web uses the standardized lucide set for nav.
import { Bell, Home, MessageCircle, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import { unreadMessagesCountAtom } from "@/store/messageCache";
import { unreadNotificationsCountAtom } from "@/store/ui.atom";

const navIcon = (Icon: LucideIcon) => {
	const NavIcon = ({ isActive }: { isActive?: boolean }) => (
		<Icon
			className="w-5 h-5"
			strokeWidth={isActive ? 2.5 : 2}
			aria-hidden="true"
		/>
	);
	NavIcon.displayName = `NavIcon(${Icon.displayName ?? "icon"})`;
	return NavIcon;
};

const HomeIcon = navIcon(Home);
const SearchIcon = navIcon(Search);
const MessageIcon = navIcon(MessageCircle);
const BellIcon = navIcon(Bell);

export const MobileBottomNav = () => {
	const pathname = usePathname();
	const unreadMessages = useAtomValue(unreadMessagesCountAtom);
	const unreadNotifications = useAtomValue(unreadNotificationsCountAtom);

	const navItems = [
		{
			href: "/",
			icon: HomeIcon,
			label: "Home",
			active: pathname === "/",
		},
		{
			href: "/explore",
			icon: SearchIcon,
			label: "Explore",
			active: pathname.startsWith("/explore"),
		},
		{
			href: "/notifications",
			icon: BellIcon,
			label: "Notifications",
			active: pathname === "/notifications",
			badge: unreadNotifications,
		},
		{
			href: "/messages",
			icon: MessageIcon,
			label: "Messages",
			active: pathname.startsWith("/messages"),
			badge: unreadMessages,
		},
	];

	// Don't show on auth pages or if not logged in (handled by parent layout logic usually, but here checking path)
	// Don't show on auth pages or if not logged in (handled by parent layout logic usually, but here checking path)
	if (
		pathname.startsWith("/sign-in") ||
		pathname.startsWith("/sign-up") ||
		pathname.startsWith("/onboarding")
	) {
		return null;
	}

	// Hide on message detail screens (when deep in a conversation)
	if (pathname.startsWith("/messages/") && pathname.split("/").length > 2) {
		return null;
	}

	// Hide on post detail screens
	if (pathname.startsWith("/post/")) {
		return null;
	}

	return (
		<div className="fixed bottom-0 left-0 right-0 z-sticky bg-page border-t border-hairline/70 md:hidden">
			<div className="flex justify-between items-center h-16 px-2">
				{navItems.map((item) => {
					// Single active predicate — the same startsWith matcher drives
						// icon weight, color, and label so sub-routes stay in sync.
						const isActive = item.active;
					return (
						<Link
							key={item.href}
							href={item.href}
							className={clsx(
								// 05-screens responsive spec: icon 20 + 10px label,
								// active tab renders in brand gold.
								"flex flex-col items-center justify-center gap-1 w-full h-full active:bg-raised transition-colors",
								item.active ? "text-gold" : "text-subtle",
							)}
						>
							<span className="relative">
								<item.icon isActive={isActive} />
								{(item.badge ?? 0) > 0 && (
									<span className="absolute -top-1.5 -right-2 flex items-center justify-center min-w-4 h-4 px-0.5 text-[9px] font-bold text-brand-on bg-brand rounded-pill border border-page font-sans tabular-nums">
										{(item.badge ?? 0) > 9 ? "9+" : item.badge}
									</span>
								)}
							</span>
							<span
								className={clsx(
									"text-[10px] leading-none font-sans",
									item.active ? "font-semibold" : "font-medium",
								)}
							>
								{item.label}
							</span>
						</Link>
					);
				})}
			</div>
			{/* Safe area spacer for iPhone home indicator */}
			<div className="h-[env(safe-area-inset-bottom)] bg-page" />
		</div>
	);
};
