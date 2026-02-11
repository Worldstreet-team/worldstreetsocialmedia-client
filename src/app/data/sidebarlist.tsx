import BellIcon from "@/assets/icons/BellIcon";
import BookmarkIcon from "@/assets/icons/BookmarkIcon";
import HomeIcon from "@/assets/icons/HomeIcon";
import MessageIcon from "@/assets/icons/MessageIcon";
import SearchIcon from "@/assets/icons/SearchIcon";
import UserIcon from "@/assets/icons/UserIcon";

const sidebarList = [
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
];

export { sidebarList };
