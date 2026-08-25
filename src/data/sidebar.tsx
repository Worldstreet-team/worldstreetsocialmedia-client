// 03-icons: web nav uses the standardized lucide set (the app's own filled
// vectors are the mobile exception). house / search / bell / message-circle /
// bookmark / more-horizontal are all in-set; `user` is a documented deviation
// (the set has no profile glyph). Active state bolds the stroke slightly to
// match the semibold label — never a different icon.
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

interface SidebarItem {
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

const sidebarList: SidebarItem[] = [
	{
		title: "Home",
		link: "/",
		icon: navIcon(Home),
	},
	{
		title: "Explore",
		link: "/explore",
		icon: navIcon(Search),
	},
	{
		title: "Notifications",
		link: "/notifications",
		icon: navIcon(Bell),
	},
	{
		title: "Messages",
		link: "/messages",
		icon: navIcon(MessageCircle),
	},
	{
		title: "Bookmarks",
		link: "/bookmarks",
		icon: navIcon(Bookmark),
	},
	{
		title: "Videos",
		link: "/live",
		icon: navIcon(SquarePlay),
	},
	{
		title: "Studio",
		link: "/studio",
		icon: navIcon(BarChart3),
	},
	{
		title: "Profile",
		link: "/profile",
		icon: navIcon(User),
	},
	{
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
	},
];

export { sidebarList };
