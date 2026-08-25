// 03-icons: web nav uses the standardized lucide set (the app's own filled
// vectors are the mobile exception). Active state bolds the stroke slightly
// to match the semibold label — never a different icon.
import type { LucideIcon } from "lucide-react";
import {
	BarChart3,
	Bell,
	Bookmark,
	Home,
	MessageCircle,
	MoreHorizontal,
	Search,
	SquarePlay,
	User,
} from "lucide-react";

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

const navIcon = (Icon: LucideIcon): React.FC<IconProps> => {
	const NavIcon = ({ isActive }: IconProps) => (
		<Icon
			className="w-5 h-5"
			strokeWidth={isActive ? 2.5 : 2}
			aria-hidden="true"
		/>
	);
	NavIcon.displayName = `NavIcon(${Icon.displayName ?? "icon"})`;
	return NavIcon;
};

/** The rail's primary destinations. */
export const mainNav: SidebarItem[] = [
	{ labelKey: "nav.home", title: "Home", link: "/", icon: navIcon(Home) },
	{
		labelKey: "nav.explore",
		title: "Explore",
		link: "/explore",
		icon: navIcon(Search),
	},
	{
		labelKey: "nav.videos",
		title: "Videos",
		link: "/live",
		icon: navIcon(SquarePlay),
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
		icon: navIcon(MessageCircle),
	},
	{
		labelKey: "nav.bookmarks",
		title: "Bookmarks",
		link: "/bookmarks",
		icon: navIcon(Bookmark),
	},
];

/** The personal section. */
export const youNav: SidebarItem[] = [
	{
		labelKey: "nav.profile",
		title: "Profile",
		link: "/profile",
		icon: navIcon(User),
	},
	{
		labelKey: "nav.studio",
		title: "Studio",
		link: "/studio",
		icon: navIcon(BarChart3),
	},
];

export const moreItem: SidebarItem = {
	labelKey: "nav.more",
	title: "More",
	link: "#", // Handled programmatically
	icon: navIcon(MoreHorizontal),
	isDropdown: true,
	// Cross-app link set per the DS TopNav spec (Dashboard · Academy ·
	// Xstream · Shop — Social is this app). "xtreme" subdomain hosts Xstream.
	dropdownItems: [
		{ title: "Dashboard", link: "https://dashboard.worldstreetgold.com" },
		{ title: "Academy", link: "https://academy.worldstreetgold.com" },
		{ title: "Xstream", link: "https://xtreme.worldstreetgold.com" },
		{ title: "Shop", link: "https://shop.worldstreetgold.com" },
	],
};

/** Flat list — kept for consumers that render one run (mobile drawer). */
export const sidebarList: SidebarItem[] = [...mainNav, ...youNav, moreItem];
