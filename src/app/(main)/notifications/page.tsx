"use client";

import { useState } from "react";
import UserIcon from "@/assets/icons/UserIcon";

interface Notification {
	id: string;
	type: "like" | "repost" | "follow" | "mention";
	user: {
		id: string;
		firstName: string;
		lastName: string;
		username: string;
		avatar: string;
	};
	content?: string;
	timestamp: string;
}

const mockNotifications: Notification[] = [
	{
		id: "1",
		type: "like",
		user: {
			id: "explore-1",
			firstName: "Sarah",
			lastName: "Jenkins",
			username: "sarahj",
			avatar:
				"https://lh3.googleusercontent.com/aida-public/AB6AXuCrp34VmESHTo261MN1Rc3zBWkEtk09VIjrBp8j8OVmuRKK6ceIlRLRVCMVyjwYBU4a87Tz6vikc-Mk2NAh1dx5pzPCgbrva_agHBP3bm7gfy0eJ8ZvwnUFIvuslrOZbbibFsif7CPsuyV5q2IhY26-0HHFkS8qQ1CN3rHz_yThZB0NXZKeT5T0w9tjWuc1akfU15v2RkpkvCKrVbWfjyduXU8Onn7VjgT-gK2mjXoh9-hLe3YL10NQSRntESIK-qU6pd6OI599Py9n",
		},
		content: "liked your reply",
		timestamp: "2h",
	},
	{
		id: "2",
		type: "follow",
		user: {
			id: "explore-2",
			firstName: "Emma",
			lastName: "Kev",
			username: "mwong_dev",
			avatar:
				"https://lh3.googleusercontent.com/aida-public/AB6AXuCXdk5dh86NTCbKe4uLLFK5NqhYzhGpxA4AKvVrCW_HKiw-9qxPrPfb9laqZrDl8Lo2e97tBII8c03MKmx2qk0kVMiqVnvpdSPZda5BIs5KPxs0uwVkNA8ciklAYsXYTHEmVVzTOmFeESPrOyBKl4tq8Wt0JAVkLoLq6-nwtSYAMOqgIpMtKivBasXLe2DdhG4CuUANRO0XlW-a6E9NLpobOgevAw5yu-vRVem1WIBOU-XMHrf2j_liJ5z8--zw8cWW0OzCdxfUuwlF",
		},
		timestamp: "4h",
	},
	{
		id: "3",
		type: "mention",
		user: {
			id: "explore-3",
			firstName: "David",
			lastName: "Jordy",
			username: "jordy",
			avatar:
				"https://lh3.googleusercontent.com/aida-public/AB6AXuDd-evzsvivS30hlWWhs8NK4GS34z0MFLA5ys1E3Xi1Ze3ANPr33B0eo21EVy-ojF_5DOaAZE0B3oFNEkrr_Mg7yUw5MjBFBPl9K0FqUaqfg7kRqt7THyQOFiT-26kEOsmd3DLbSysRcKBwH-ceObCR6X9heUYmSw5DotEK-maSeeV0OdOCRtH8RLjgLjOwwYcT5GKk3JH4tOlCxbirUsuCk5Kikl9XBPwJXR8-J_VDkcTSowSNq6G-XXTq53J7jarGjNf4ml9v8hFW",
		},
		content: "mentioned you in a post",
		timestamp: "1d",
	},
];

export default function NotificationsPage() {
	const [activeTab, setActiveTab] = useState<"all" | "verified" | "mentions">(
		"all",
	);

	return (
		<div className="flex flex-col min-h-screen">
			<header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-border-gray">
				<div className="px-4 py-3">
					<h1 className="text-xl font-bold">Notifications</h1>
				</div>
				<div className="flex">
					{["all", "verified", "mentions"].map((tab) => (
						<button
							key={tab}
							onClick={() => setActiveTab(tab as any)}
							className="flex-1 px-4 py-4 hover:bg-hover-gray transition-colors relative"
							type="button"
						>
							<span
								className={`text-[15px] capitalize ${activeTab === tab ? "font-bold" : "font-medium text-text-light"}`}
							>
								{tab}
							</span>
							{activeTab === tab && (
								<div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-primary rounded-full transition-all" />
							)}
						</button>
					))}
				</div>
			</header>

			<div className="flex flex-col">
				{mockNotifications.map((notification) => (
					<article
						key={notification.id}
						className="p-4 border-b border-border-gray hover:bg-black/[0.03] transition-colors cursor-pointer flex gap-3"
					>
						<div className="w-8 flex justify-end">
							{notification.type === "like" && (
								<span className="material-symbols-outlined text-[#F91880] filled-icon">
									favorite
								</span>
							)}
							{notification.type === "follow" && (
								<span className="material-symbols-outlined text-primary filled-icon">
									person
								</span>
							)}
							{notification.type === "mention" && (
								<span className="material-symbols-outlined text-primary filled-icon">
									alternate_email
								</span>
							)}
							{notification.type === "repost" && (
								<span className="material-symbols-outlined text-[#00BA7C] filled-icon">
									repeat
								</span>
							)}
						</div>
						<div className="flex flex-col gap-2 flex-1">
							<div
								className="w-10 h-10 rounded-full bg-cover bg-center"
								style={{
									backgroundImage: `url('${notification.user.avatar}')`,
								}}
							></div>
							<div>
								<span className="font-bold hover:underline cursor-pointer">
									{notification.user.firstName} {
										notification.user.lastName
									}{" "}
								</span>
								<span className="text-text-primary text-[15px]">
									{notification.type === "follow"
										? "followed you"
										: notification.content}
								</span>
							</div>
							{notification.type === "mention" && (
								<p className="text-text-light text-[15px] mt-1">
									Hey <span className="text-primary">@alexrivera</span>,
									checking out the new designs! Great work!
								</p>
							)}
						</div>
					</article>
				))}
			</div>
		</div>
	);
}
