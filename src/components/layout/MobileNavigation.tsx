"use client";

import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { useClerk } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { LogOut, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { sidebarList } from "@/data/sidebar";
import clsx from "clsx";
import { handleSignOut } from "@/lib/utils";
import { DEFAULT_AVATAR } from "@/const";

import { unreadMessagesCountAtom } from "@/store/messageCache";
import { unreadNotificationsCountAtom } from "@/store/ui.atom";

export function MobileNavigation() {
	const user = useAtomValue(userAtom);
	const unreadCount = useAtomValue(unreadMessagesCountAtom);
	const unreadNotifications = useAtomValue(unreadNotificationsCountAtom);
	const { signOut } = useClerk();
	const pathname = usePathname();
	const [isOpen, setIsOpen] = useState(false);

	// Close sidebar on route change
	useEffect(() => {
		setIsOpen(false);
	}, [pathname]);

	// Prevent scrolling when sidebar is open
	useEffect(() => {
		if (isOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "unset";
		}
		return () => {
			document.body.style.overflow = "unset";
		};
	}, [isOpen]);

	if (!user) return null;

	const fullName =
		user.firstName && user.lastName
			? `${user.firstName} ${user.lastName}`
			: user.username;

	return (
		<>
			{/* Mobile Header */}
			<header className="fixed top-0 left-0 right-0 h-14 bg-page border-b border-hairline flex items-center justify-between px-4 z-sticky md:hidden">
				<div className="flex items-center gap-3">
					<button
						onClick={() => setIsOpen(true)}
						className="relative w-8 h-8 rounded-full overflow-hidden border border-hairline"
					>
						<Image
							src={user.avatar || DEFAULT_AVATAR}
							alt={user.username || "User"}
							fill
							className="object-cover"
						/>
					</button>
					{/* Placeholder for center logo if needed, currently aligned left/right */}
				</div>

				{/* Unified ecosystem lockup mark (05-screens): gold wsa-mark 26px,
				    unboxed, never a typed letter tile. */}
				<Link href="/" aria-label="WorldStreet Social home">
					<Image
						src="/images/wsa-mark.png"
						alt="WorldStreet"
						width={26}
						height={26}
						className="h-[26px] w-[26px] object-contain"
					/>
				</Link>
			</header>

			{/* Sidebar Drawer */}
			<AnimatePresence>
				{isOpen && (
					<>
						{/* Backdrop */}
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={() => setIsOpen(false)}
							className="fixed inset-0 bg-scrim z-dropdown md:hidden"
						/>

						{/* Drawer */}
						<motion.div
							initial={{ x: "-100%" }}
							animate={{ x: 0 }}
							exit={{ x: "-100%" }}
							// Sheets/drawers slide at motion-slow with the one easing —
							// no spring physics in the motion system.
							transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
							className="fixed top-0 bottom-0 left-0 w-[80%] max-w-[300px] bg-page border-r border-hairline z-dropdown flex flex-col md:hidden"
						>
							{/* Drawer Header */}
							<div className="p-4 border-b border-hairline flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="relative w-10 h-10 rounded-full overflow-hidden border border-hairline">
										<Image
											src={user.avatar || DEFAULT_AVATAR}
											alt={user.username || "User"}
											fill
											className="object-cover"
										/>
									</div>
									<div className="flex flex-col">
										<span className="font-bold text-primary text-sm truncate font-sans">
											{fullName}
										</span>
										<span className="text-subtle text-[13px] truncate font-sans">
											@{user.username}
										</span>
									</div>
								</div>
								<button
									onClick={() => setIsOpen(false)}
									className="p-2 hover:bg-surface rounded-full text-muted"
								>
									<X className="w-5 h-5" />
								</button>
							</div>

							{/* Navigation Links */}
							<nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
								{sidebarList.map((item, index) => {
									const isActive = pathname === item.link;
									const href =
										item.title === "Profile" && user?.username
											? `/profile/${user.username}`
											: item.link;

									return (
										<Link
											key={index}
											href={href}
											className={clsx(
												// Same row language as the desktop rail:
												// pill rows, active = bg/chip + semibold.
												"flex items-center gap-3 px-4 py-3 rounded-pill transition-colors font-sans relative",
												isActive
													? "bg-chip text-primary font-semibold"
													: "text-muted hover:text-primary hover:bg-surface",
											)}
											onClick={() => setIsOpen(false)}
										>
											<div className="relative">
												<item.icon isActive={isActive} />
												{(() => {
													const badgeCount =
														item.title === "Messages"
															? unreadCount
															: item.title === "Notifications"
																? unreadNotifications
																: 0;
													return badgeCount > 0 ? (
														<span className="absolute -top-2 -right-2 flex items-center justify-center w-4 h-4 text-[9px] font-bold text-brand-on bg-brand rounded-full border border-page font-sans tabular-nums">
															{badgeCount > 9 ? "9+" : badgeCount}
														</span>
													) : null;
												})()}
											</div>
											<span>{item.title}</span>
										</Link>
									);
								})}
							</nav>

							{/* Footer Actions */}
							<div className="p-4 border-t border-hairline">
								<button
									onClick={() => handleSignOut(signOut)}
									className="w-full flex items-center gap-3 px-4 py-3 text-danger hover:bg-surface rounded-pill transition-colors font-sans font-bold text-sm cursor-pointer"
								>
									<LogOut className="w-5 h-5" />
									Log out
								</button>
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>
		</>
	);
}
