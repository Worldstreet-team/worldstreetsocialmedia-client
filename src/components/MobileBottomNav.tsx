"use client";

import Link from "next/link";
import { useAppPathname } from "@/i18n/useAppPathname";
// Nav uses Phosphor with weight="fill" on the active tab, matching the rail.
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
	Bell,
	ChatCircleDots,
	House,
	MagnifyingGlass,
	MonitorPlay,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { BadgedIcon } from "@/components/ui/Badge";
import { useAtomValue } from "jotai";
import { unreadMessagesCountAtom } from "@/store/messageCache";
import { unreadNotificationsCountAtom } from "@/store/ui.atom";
import { useT } from "@/i18n/client";

const navIcon = (Icon: PhosphorIcon) => {
	const NavIcon = ({ isActive }: { isActive?: boolean }) => (
		<Icon
			size={22}
			weight={isActive ? "fill" : "duotone"}
			aria-hidden="true"
		/>
	);
	NavIcon.displayName = `NavIcon(${Icon.displayName ?? "icon"})`;
	return NavIcon;
};

const HomeIcon = navIcon(House);
const SearchIcon = navIcon(MagnifyingGlass);
const VideoIcon = navIcon(MonitorPlay);
const MessageIcon = navIcon(ChatCircleDots);
const BellIcon = navIcon(Bell);

export const MobileBottomNav = () => {
	const t = useT();
	const pathname = useAppPathname();
	const unreadMessages = useAtomValue(unreadMessagesCountAtom);
	const unreadNotifications = useAtomValue(unreadNotificationsCountAtom);

	const navItems = [
		{
			href: "/",
			icon: HomeIcon,
			label: t("nav.home"),
			active: pathname === "/",
		},
		{
			href: "/explore",
			icon: SearchIcon,
			label: t("nav.explore"),
			active: pathname.startsWith("/explore"),
		},
		{
			href: "/live",
			icon: VideoIcon,
			label: t("nav.videos"),
			active: pathname.startsWith("/live"),
		},
		{
			href: "/notifications",
			icon: BellIcon,
			label: t("nav.notifications"),
			active: pathname === "/notifications",
			badge: unreadNotifications,
		},
		{
			href: "/messages",
			icon: MessageIcon,
			label: t("nav.messages"),
			active: pathname.startsWith("/messages"),
			badge: unreadMessages,
		},
	];

	// Don't show on auth/onboarding flows.
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

	// Hide on post detail screens and the full-screen vertical surface.
	// Exact-match /live (plus real subroutes): a bare startsWith("/live")
	// also swallowed /live-now and left that page with no navigation at all.
	if (
		pathname.startsWith("/post/") ||
		pathname === "/live" ||
		pathname.startsWith("/live/")
	) {
		return null;
	}

	return (
		<>
			{/* The compose FAB that floated here was one of TWO gold FABs
			    stacked in the same corner — CreateFab (root layout) is the one
			    create entry point now.

			    Docked glass bar (owner ruling 2026-08-27): flush to the bottom
			    edge and full-bleed rather than floating, but still glass —
			    this and the media editors remain the sanctioned exceptions to
			    the ecosystem no-backdrop-blur rule. The feed still scrolls
			    under it, so `pb-nav`/`bottom-nav` clearance still applies. */}
			<div className="fixed inset-x-0 bottom-0 z-sticky md:hidden border-t border-hairline glass-nav backdrop-blur-xl backdrop-saturate-150">
				{/* Docked means the bar now sits UNDER the home indicator, so it
				    owns the safe-area inset again (a floating bar cleared it via
				    its own `bottom` offset instead). */}
				<div style={{ paddingBottom: "var(--ws-safe-bottom)" }}>
				<div className="flex justify-between items-center h-16 px-1">
					{navItems.map((item) => (
						<Link
							key={item.href}
							href={item.href}
							className={clsx(
								// 05-screens responsive spec: icon 20 + 10px label.
								// `.glass-nav` follows the theme, so the ink is the
								// normal token pair — text-gold resolves to the AA
								// dark gold on paper and bright gold on stone.
								"flex flex-col items-center justify-center gap-1 w-full h-full min-w-0 active:bg-primary/10 transition-colors",
								item.active ? "text-gold" : "text-muted",
							)}
						>
							<BadgedIcon count={item.badge} label={item.label}>
								<item.icon isActive={item.active} />
							</BadgedIcon>
							<span
								className={clsx(
									// One line, ellipsized: long locales ("Notificaciones",
									// "Nachrichten") must not wrap or squeeze siblings.
									"text-[10px] leading-none font-sans whitespace-nowrap truncate max-w-full px-0.5",
									item.active ? "font-semibold" : "font-medium",
								)}
							>
								{item.label}
							</span>
						</Link>
					))}
					</div>
				</div>
			</div>
		</>
	);
};
