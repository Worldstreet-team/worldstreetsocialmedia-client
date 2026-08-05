"use client";

import { useEffect, useState } from "react";
import {
	AtSign,
	Bell,
	Heart,
	MessageCircle,
	Repeat,
	User as UserIcon,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import {
	getNotificationsAction,
	markNotificationsReadAction,
} from "@/lib/notification.actions";
import Link from "next/link";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useSetAtom } from "jotai";
import { unreadNotificationsCountAtom } from "@/store/ui.atom";

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
	const setUnreadNotifications = useSetAtom(unreadNotificationsCountAtom);

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
				setUnreadNotifications(0);
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
				return <Heart className="w-5 h-5 text-danger fill-current" />;
			case "follow":
				return <UserIcon className="w-5 h-5 text-primary" />;
			case "reply":
				return <MessageCircle className="w-5 h-5 text-muted" />;
			case "repost":
				return <Repeat className="w-5 h-5 text-success" />;
			case "mention":
				return <AtSign className="w-5 h-5 text-gold" />;
			default:
				return <div className="w-5 h-5 bg-raised rounded-pill" />;
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
		<div className="flex flex-col min-h-dvh pb-nav md:pb-20">
			<header className="sticky top-0 z-sticky bg-page border-b border-hairline">
				<div className="px-4 py-3">
					<h1 className="font-display text-lg font-semibold text-primary">
						Notifications
					</h1>
				</div>
				<div className="flex w-full">
					{["all", "verified", "mentions"].map((tab) => (
						<button
							key={tab}
							onClick={() => setActiveTab(tab as any)}
							className="flex-1 h-12 hover:bg-raised/40 transition-colors relative cursor-pointer"
							type="button"
						>
							<span
								className={clsx(
									"text-sm capitalize font-sans",
									activeTab === tab
										? "font-semibold text-primary"
										: "font-medium text-muted",
								)}
							>
								{tab}
							</span>
							{activeTab === tab && (
								<div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-0.5 bg-brand rounded-pill" />
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
							className="p-4 border-b border-hairline flex gap-3"
						>
							<div className="w-8 flex justify-end">
								<div className="skeleton w-5 h-5 rounded-pill" />
							</div>
							<div className="flex flex-col gap-2 flex-1">
								<div className="skeleton w-10 h-10 rounded-pill" />
								<div className="skeleton h-3 w-40 rounded-sm" />
							</div>
						</div>
					))
				) : filteredNotifications.length > 0 ? (
					filteredNotifications.map((notification) => (
						<Link
							href={getRedirectUrl(notification)}
							key={notification._id}
							className={clsx(
								"p-4 border-b border-hairline hover:bg-surface/60 transition-colors cursor-pointer flex gap-3",
								!notification.read && "bg-surface/40",
							)}
						>
							<div className="w-8 flex justify-end mt-1">
								{getIcon(notification.type)}
							</div>
							<div className="flex flex-col gap-2 flex-1 min-w-0">
								<div
									className="w-8 h-8 shrink-0 rounded-full bg-cover bg-center border border-hairline"
									style={{
										backgroundImage: `url('${notification.sender.avatar}')`,
									}}
								/>
								<div className="text-primary text-[15px] font-sans break-words">
									<span className="font-bold hover:underline cursor-pointer mr-1">
										{notification.sender.firstName}{" "}
										{notification.sender.lastName}
									</span>
									<span className="text-muted">
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
										<p className="text-muted text-[15px] mt-0.5 line-clamp-2">
											{notification.post.content}
										</p>
									)}
								{notification.type === "like" && notification.post && (
									<p className="text-subtle text-sm mt-0.5 line-clamp-1">
										{notification.post.content}
									</p>
								)}
							</div>
						</Link>
					))
				) : (
					<div className="py-10">
						<EmptyState
							icon={Bell}
							title="Nothing yet"
							caption="Likes, follows, replies and mentions land here as they happen."
						/>
					</div>
				)}
			</div>
		</div>
	);
}
