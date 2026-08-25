// Nav icons are Phosphor (the mobile app's library) — the active state is a
// real filled glyph via weight="fill", not a heavier stroke. Lucide stays for
// the utility icons elsewhere; nav is the surface where fill pays off.
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
	Bell,
	BookmarkSimple,
	ChartBar,
	ChatCircleDots,
	House,
	MagnifyingGlass,
	MonitorPlay,
	SquaresFour,
	UserCircle,
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
			weight={isActive ? "fill" : "regular"}
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
		icon: navIcon(MagnifyingGlass),
	},
	{
		labelKey: "nav.videos",
		title: "Videos",
		link: "/live",
		icon: navIcon(MonitorPlay),
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
		labelKey: "nav.studio",
		title: "Studio",
		link: "/studio",
		icon: navIcon(ChartBar),
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
