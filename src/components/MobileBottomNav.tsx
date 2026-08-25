"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
// Nav uses Phosphor with weight="fill" on the active tab, matching the rail.
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
	Bell,
	ChatCircleDots,
	House,
	MagnifyingGlass,
	MonitorPlay,
	Plus,
} from "@phosphor-icons/react";
import clsx from "clsx";
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
	const pathname = usePathname();
	const router = useRouter();
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
	if (pathname.startsWith("/post/") || pathname.startsWith("/live")) {
		return null;
	}

	const openComposer = () => {
		const composer = document.querySelector<HTMLTextAreaElement>(
			"#post-composer-input",
		);
		if (composer) {
			window.scrollTo({ top: 0, behavior: "smooth" });
			composer.focus();
		} else {
			router.push("/");
		}
	};

	return (
		<>
			{/* Compose FAB — the one gold CTA on mobile, floated above the bar. */}
			<button
				type="button"
				onClick={openComposer}
				aria-label={t("composer.post")}
				className="md:hidden fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-sticky flex h-13 w-13 items-center justify-center rounded-pill bg-brand text-brand-on shadow-nav active:bg-brand-active transition-colors"
				style={{ width: 52, height: 52 }}
			>
				<Plus size={24} weight="bold" />
			</button>

			<div className="fixed bottom-0 left-0 right-0 z-sticky bg-page border-t border-hairline/70 md:hidden">
				<div className="flex justify-between items-center h-16 px-1">
					{navItems.map((item) => (
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
								<item.icon isActive={item.active} />
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
					))}
				</div>
				{/* Safe area spacer for iPhone home indicator */}
				<div className="h-[env(safe-area-inset-bottom)] bg-page" />
			</div>
		</>
	);
};
