"use client";

import { useEffect, useState } from "react";
import {
	Heart,
	User as UserIcon,
	MessageCircle,
	Repeat,
	AtSign,
} from "lucide-react";
import {
	getNotificationsAction,
	markNotificationsReadAction,
} from "@/lib/notification.actions";
import Link from "next/link";
import clsx from "clsx";
import { useRouter } from "next/navigation";

interface Notification {
	_id: string;
	type: "like" | "repost" | "follow" | "reply" | "mention";
	sender: {
		userId: string;
		firstName: string;
		lastName: string;
		username: string;
		avatar: string;
		isVerified?: boolean;
	};
	post?: {
		_id: string;
		content: string;
	};
	read: boolean;
	createdAt: string;
}

export default function NotificationsPage() {
	const [notifications, setNotifications] = useState<Notification[]>([]);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState<"all" | "verified" | "mentions">(
		"all",
	);
	const router = useRouter();

	useEffect(() => {
		const fetchNotifications = async () => {
			setLoading(true);
			const res = await getNotificationsAction();
			if (res.success) {
				setNotifications(res.data);
				// Mark as read immediately when viewing the page?
				// Or maybe just mark the unread ones.
				// For now, let's mark all as read to clear the "badge" concept if we had one.
				markNotificationsReadAction();
			}
			setLoading(false);
		};

		fetchNotifications();
	}, []);

	const filteredNotifications = notifications.filter((n) => {
		if (activeTab === "all") return true;
		if (activeTab === "verified") return n.sender.isVerified;
		if (activeTab === "mentions") return n.type === "mention";
		return true;
	});

	const getIcon = (type: string) => {
		switch (type) {
			case "like":
				return <Heart className="w-5 h-5 text-pink-600 fill-current" />;
			case "follow":
				return <UserIcon className="w-5 h-5 text-blue-500 fill-current" />;
			case "reply":
				return <MessageCircle className="w-5 h-5 text-green-500" />; // Or another color
			case "repost":
				return <Repeat className="w-5 h-5 text-green-500" />;
			case "mention":
				return <AtSign className="w-5 h-5 text-yellow-500" />;
			default:
				return <div className="w-5 h-5 bg-zinc-500 rounded-full" />;
		}
	};

	const getRedirectUrl = (notification: Notification) => {
		if (notification.type === "follow") {
			return `/profile/${notification.sender.username}`;
		}
		if (notification.post) {
			return `/post/${notification.post._id}`;
		}
		return "#";
	};

	return (
		<div className="flex flex-col min-h-screen pb-20">
			<header className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-zinc-800">
				<div className="px-4 py-3">
					<h1 className="text-xl font-bold font-space-mono text-white">
						Notifications
					</h1>
				</div>
				<div className="flex w-full">
					{["all", "verified", "mentions"].map((tab) => (
						<button
							key={tab}
							onClick={() => setActiveTab(tab as any)}
							className="flex-1 px-4 py-4 hover:bg-zinc-900 transition-colors relative cursor-pointer"
							type="button"
						>
							<span
								className={clsx(
									"text-[15px] capitalize font-space-mono",
									activeTab === tab
										? "font-bold text-white"
										: "font-medium text-zinc-500",
								)}
							>
								{tab}
							</span>
							{activeTab === tab && (
								<div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-yellow-500 rounded-full transition-all" />
							)}
						</button>
					))}
				</div>
			</header>

			<div className="flex flex-col">
				{loading ? (
					[...Array(5)].map((_, i) => (
						<div
							key={i}
							className="p-4 border-b border-zinc-800 flex gap-3 animate-pulse"
						>
							<div className="w-8 flex justify-end">
								<div className="w-5 h-5 bg-zinc-800 rounded-full" />
							</div>
							<div className="flex flex-col gap-2 flex-1">
								<div className="w-10 h-10 bg-zinc-800 rounded-full" />
								<div className="h-4 w-32 bg-zinc-800 rounded" />
							</div>
						</div>
					))
				) : filteredNotifications.length > 0 ? (
					filteredNotifications.map((notification) => (
						<Link
							href={getRedirectUrl(notification)}
							key={notification._id}
							className={clsx(
								"p-4 border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors cursor-pointer flex gap-3",
								!notification.read && "bg-zinc-900/20",
							)}
						>
							<div className="w-8 flex justify-end mt-1">
								{getIcon(notification.type)}
							</div>
							<div className="flex flex-col gap-2 flex-1">
								<div
									className="w-8 h-8 rounded-full bg-cover bg-center border border-zinc-800"
									style={{
										backgroundImage: `url('${notification.sender.avatar}')`,
									}}
								/>
								<div className="text-white text-[15px] font-space-mono">
									<span className="font-bold hover:underline cursor-pointer mr-1">
										{notification.sender.firstName}{" "}
										{notification.sender.lastName}
									</span>
									<span className="text-zinc-500">
										{notification.type === "follow" && "followed you"}
										{notification.type === "like" && "liked your post"}
										{notification.type === "reply" && "replied to your post"}
										{notification.type === "mention" && "mentioned you"}
										{notification.type === "repost" && "reposted your post"}
									</span>
								</div>
								{(notification.type === "reply" ||
									notification.type === "mention") &&
									notification.post && (
										<p className="text-zinc-400 text-[15px] mt-0.5 line-clamp-2">
											{notification.post.content}
										</p>
									)}
								{notification.type === "like" && notification.post && (
									<p className="text-zinc-500 text-sm mt-0.5 line-clamp-1">
										{notification.post.content}
									</p>
								)}
							</div>
						</Link>
					))
				) : (
					<div className="p-12 text-center text-zinc-500 font-space-mono text-sm">
						No notifications yet.
					</div>
				)}
			</div>
		</div>
	);
}
