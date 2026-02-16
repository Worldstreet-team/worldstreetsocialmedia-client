"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
// import { Home, Search, Bell, Mail, Bookmark, User } from "lucide-react";
import clsx from "clsx";
import HomeIcon from "@/assets/icons/HomeIcon";
import SearchIcon from "@/assets/icons/SearchIcon";
import MessageIcon from "@/assets/icons/MessageIcon";
import BellIcon from "@/assets/icons/BellIcon";
import BookmarkIcon from "@/assets/icons/BookmarkIcon";

export const MobileBottomNav = () => {
	const pathname = usePathname();

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
		},
		{
			href: "/messages",
			icon: MessageIcon,
			label: "Messages",
			active: pathname.startsWith("/messages"),
		},
		{
			href: "/bookmarks",
			icon: BookmarkIcon,
			label: "Bookmarks",
			active: pathname === "/bookmarks",
		},
	];

	// Don't show on auth pages or if not logged in (handled by parent layout logic usually, but here checking path)
	if (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) {
		return null;
	}

	return (
		<div className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-md border-t border-zinc-800 md:hidden pb-safe">
			<div className="flex justify-around items-center h-16 px-2">
				{navItems.map((item) => {
					const isActive = pathname === item.href;
					return (
						<Link
							key={item.href}
							href={item.href}
							className={clsx(
								"flex flex-col items-center justify-center w-full h-full gap-1 active:scale-90 transition-transform",
								item.active ? "text-white" : "text-zinc-500",
							)}
						>
							<item.icon isActive={isActive} />
						</Link>
					);
				})}
			</div>
			{/* Safe area spacer for iPhone home indicator */}
			<div className="h-[env(safe-area-inset-bottom)] bg-black" />
		</div>
	);
};
