"use client";

import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { useClerk } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { sidebarList } from "@/data/sidebar";
import clsx from "clsx";

import { unreadMessagesCountAtom } from "@/store/messageCache";

export function MobileNavigation() {
	const user = useAtomValue(userAtom);
	const unreadCount = useAtomValue(unreadMessagesCountAtom);
	const { signOut } = useClerk();
	const router = useRouter();
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
			<header className="fixed top-0 left-0 right-0 h-14 bg-black/80 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between px-4 z-40 md:hidden">
				<div className="flex items-center gap-3">
					<button
						onClick={() => setIsOpen(true)}
						className="relative w-8 h-8 rounded-full overflow-hidden border border-zinc-700"
					>
						<Image
							src={
								user.avatar ||
								"https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"
							}
							alt={user.username || "User"}
							fill
							className="object-cover"
						/>
					</button>
					{/* Placeholder for center logo if needed, currently aligned left/right */}
				</div>

				<div className="w-8 h-8 flex items-center justify-center bg-yellow-500 rounded-lg text-black font-black font-space-mono text-lg">
					W
				</div>
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
							className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
						/>

						{/* Drawer */}
						<motion.div
							initial={{ x: "-100%" }}
							animate={{ x: 0 }}
							exit={{ x: "-100%" }}
							transition={{ type: "spring", damping: 25, stiffness: 200 }}
							className="fixed top-0 bottom-0 left-0 w-[80%] max-w-[300px] bg-black border-r border-zinc-800 z-50 flex flex-col md:hidden"
						>
							{/* Drawer Header */}
							<div className="p-4 border-b border-zinc-800 flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="relative w-10 h-10 rounded-full overflow-hidden border border-zinc-700">
										<Image
											src={
												user.avatar ||
												"https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"
											}
											alt={user.username || "User"}
											fill
											className="object-cover"
										/>
									</div>
									<div className="flex flex-col">
										<span className="font-bold text-white text-sm truncate font-space-mono">
											{fullName}
										</span>
										<span className="text-zinc-500 text-xs truncate font-space-mono">
											@{user.username}
										</span>
									</div>
								</div>
								<button
									onClick={() => setIsOpen(false)}
									className="p-2 hover:bg-zinc-900 rounded-full text-zinc-400"
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
												"flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-space-mono relative",
												isActive
													? "bg-zinc-900 text-white font-bold"
													: "text-zinc-400 hover:text-white hover:bg-zinc-900/50",
											)}
											onClick={() => setIsOpen(false)}
										>
											<div className="relative">
												<item.icon isActive={isActive} />
												{item.title === "Messages" && unreadCount > 0 && (
													<span className="absolute -top-2 -right-2 flex items-center justify-center w-4 h-4 text-[9px] font-bold text-black bg-yellow-500 rounded-full border border-black animate-in zoom-in font-space-mono">
														{unreadCount > 9 ? "9+" : unreadCount}
													</span>
												)}
											</div>
											<span>{item.title}</span>
										</Link>
									);
								})}
							</nav>

							{/* Footer Actions */}
							<div className="p-4 border-t border-zinc-800">
								<button
									onClick={() => signOut(() => router.push("/sign-in"))}
									className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-zinc-900 rounded-xl transition-colors font-space-mono font-bold text-sm cursor-pointer"
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
