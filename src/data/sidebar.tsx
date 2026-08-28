// Nav icons are Phosphor (the mobile app's library) — the active state is a
// real filled glyph via weight="fill", not a heavier stroke. Lucide stays for
// the utility icons elsewhere; nav is the surface where fill pays off.
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
	Bell,
	Binoculars,
	Briefcase,
	BookmarkSimple,
	Faders,
	GearSix,
	ChatCircleDots,
	House,
	MonitorPlay,
	SquaresFour,
	UserCircle,
	UsersThree,
	Waveform,
} from "@phosphor-icons/react";

import type { IconProps } from "@/app/types";

export interface SidebarItem {
	/** i18n key — LeftSidebar renders t(labelKey); title stays as fallback. */
	labelKey: string;
	title: string;
	link: string;
	icon: React.FC<IconProps>;
	isDropdown?: boolean;
	dropdownItems?: { title: string; link: string }[];
}

const navIcon = (Icon: PhosphorIcon): React.FC<IconProps> => {
	const NavIcon = ({ isActive }: IconProps) => (
		<Icon
			size={22}
			weight={isActive ? "fill" : "duotone"}
			aria-hidden="true"
		/>
	);
	NavIcon.displayName = `NavIcon(${Icon.displayName ?? "icon"})`;
	return NavIcon;
};

/** The rail's primary destinations. */
export const mainNav: SidebarItem[] = [
	{ labelKey: "nav.home", title: "Home", link: "/", icon: navIcon(House) },
	{
		labelKey: "nav.explore",
		title: "Explore",
		link: "/explore",
		// Binoculars, not a magnifier (owner ruling 2026-08-28): the magnifier
		// is search's glyph; Explore is about looking around, not looking up.
		icon: navIcon(Binoculars),
	},
	{
		labelKey: "nav.videos",
		title: "Videos",
		link: "/live",
		icon: navIcon(MonitorPlay),
	},
	{
		labelKey: "nav.voice",
		title: "Voice",
		link: "/voice",
		icon: navIcon(Waveform),
	},
	{
		labelKey: "nav.communities",
		title: "Communities",
		link: "/communities",
		icon: navIcon(UsersThree),
	},
	{
		labelKey: "nav.notifications",
		title: "Notifications",
		link: "/notifications",
		icon: navIcon(Bell),
	},
	{
		labelKey: "nav.messages",
		title: "Messages",
		link: "/messages",
		icon: navIcon(ChatCircleDots),
	},
	{
		labelKey: "nav.bookmarks",
		title: "Bookmarks",
		link: "/bookmarks",
		icon: navIcon(BookmarkSimple),
	},
];

/** The personal section. */
export const youNav: SidebarItem[] = [
	{
		labelKey: "nav.profile",
		title: "Profile",
		link: "/profile",
		icon: navIcon(UserCircle),
	},
	{
		// Deals, not chat: ad bookings negotiate here, and the label keeps the
		// team's name for the surface.
		labelKey: "nav.bm",
		title: "Business",
		link: "/bm",
		icon: navIcon(Briefcase),
	},
	{
		labelKey: "nav.studio",
		title: "Studio",
		link: "/studio",
		icon: navIcon(Faders),
	},
	{
		labelKey: "nav.settings",
		title: "Settings",
		link: "/settings",
		icon: navIcon(GearSix),
	},
];

export const moreItem: SidebarItem = {
	labelKey: "nav.products",
	title: "Products",
	link: "#", // Handled programmatically
	icon: navIcon(SquaresFour),
	isDropdown: true,
	// Cross-app link set per the DS TopNav spec. "xtreme" subdomain hosts
	// Xstream; Wallet/Arcade follow the same subdomain convention.
	dropdownItems: [
		{ title: "Dashboard", link: "https://dashboard.worldstreetgold.com" },
		{ title: "Academy", link: "https://academy.worldstreetgold.com" },
		{ title: "Xstream", link: "https://xtreme.worldstreetgold.com" },
		{ title: "Shop", link: "https://shop.worldstreetgold.com" },
		{ title: "Wallet", link: "https://wallet.worldstreetgold.com" },
		{ title: "Arcade", link: "https://arcade.worldstreetgold.com" },
	],
};

/** Flat list — kept for consumers that render one run (mobile drawer). */
export const sidebarList: SidebarItem[] = [...mainNav, ...youNav, moreItem];
