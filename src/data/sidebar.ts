import BellIcon from "@/assets/icons/BellIcon";
import BookmarkIcon from "@/assets/icons/BookmarkIcon";
import HomeIcon from "@/assets/icons/HomeIcon";
import MessageIcon from "@/assets/icons/MessageIcon";
import SearchIcon from "@/assets/icons/SearchIcon";
import UserIcon from "@/assets/icons/UserIcon";

import MoreCircleIcon from "@/assets/icons/MoreCircleIcon";

import { IconProps } from "@/app/types";

interface SidebarItem {
	title: string;
	link: string;
	icon: React.FC<IconProps>;
	isDropdown?: boolean;
	dropdownItems?: { title: string; link: string }[];
}

const sidebarList: SidebarItem[] = [
	{
		title: "Home",
		link: "/",
		icon: HomeIcon,
	},
	{
		title: "Explore",
		link: "/explore",
		icon: SearchIcon,
	},
	{
		title: "Notifications",
		link: "/notifications",
		icon: BellIcon,
	},
	{
		title: "Messages",
		link: "/messages",
		icon: MessageIcon,
	},
	{
		title: "Bookmarks",
		link: "/bookmarks",
		icon: BookmarkIcon,
	},
	{
		title: "Profile",
		link: "/profile",
		icon: UserIcon,
	},
	{
		title: "More",
		link: "#", // Handled programmatically
		icon: MoreCircleIcon,
		isDropdown: true,
		dropdownItems: [
			{ title: "Academy", link: "https://academy.worldstreetgold.com" },
			{ title: "XTreme", link: "https://xtreme.worldstreetgold.com" },
			{ title: "Ecommerce", link: "https://shop.worldstreetgold.com" },
			{ title: "Dashboard", link: "https://worldstreetgold.com" },
		],
	},
];

export { sidebarList };
