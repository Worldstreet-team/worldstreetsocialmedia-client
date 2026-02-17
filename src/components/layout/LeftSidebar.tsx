"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { LogOut, MoreHorizontal } from "lucide-react";
import clsx from "clsx";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { sidebarList } from "@/data/sidebar";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/user.atom";
import { unreadMessagesCountAtom } from "@/store/messageCache";

export function LeftSidebar() {
	const pathname = usePathname();
	const user = useAtomValue(userAtom);
	const unreadCount = useAtomValue(unreadMessagesCountAtom);
	const { signOut } = useClerk();
	const router = useRouter();
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setIsMenuOpen(false);
			}
		};

		if (isMenuOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isMenuOpen]);

	return (
		<header className="w-[275px] hidden md:flex flex-col sticky top-0 h-screen pl-4 pr-6 border-r border-zinc-800">
			<div className="py-8 px-2">
				<Link href="/" className="flex items-center gap-3 group">
					<div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center border-2 border-transparent group-hover:border-white transition-all shadow-[4px_4px_0px_rgba(255,255,255,0.2)]">
						<span className="font-black text-black font-sans text-2xl">W</span>
					</div>
				</Link>
			</div>

			<nav className="flex flex-col gap-4 mt-2 flex-1 px-2">
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
								"flex items-center gap-2 px-4 py-3.5 rounded-full transition-all duration-300 group hover:bg-zinc-900 relative",
								isActive
									? "font-bold text-white"
									: "text-zinc-400 hover:text-white",
							)}
						>
							<div className="relative">
								<span className="inline-flex w-8 h-8 items-center justify-center">
									<item.icon isActive={isActive} />
								</span>
								{item.title === "Messages" && unreadCount > 0 && (
									<span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-[10px] font-bold text-black bg-yellow-500 rounded-full border-2 border-black animate-in zoom-in font-sans">
										{unreadCount > 9 ? "9+" : unreadCount}
									</span>
								)}
							</div>

							<span className="text-base font-medium font-sans tracking-tight">
								{item.title}
							</span>
						</Link>
					);
				})}

				{/* <button className="mt-8 w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-full text-lg shadow-[4px_4px_0px_#fff] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 font-sans transform hover:-translate-y-1">
					<PenSquare className="w-5 h-5" />
					<span className="hidden xl:inline">POST</span>
				</button> */}
			</nav>

			{user && (
				<div className="mb-8 px-2 relative" ref={menuRef}>
					{isMenuOpen && (
						<div className="absolute bottom-full left-0 w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden mb-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
							<button
								type="button"
								className="w-full text-left px-5 py-4 hover:bg-zinc-800 font-bold text-sm text-red-400 font-sans flex items-center gap-3 transition-colors cursor-pointer"
								onClick={() => signOut(() => router.push("/sign-in"))}
							>
								<LogOut className="w-4 h-4" />
								Log out @{user.username}
							</button>
						</div>
					)}

					<button
						type="button"
						onClick={() => setIsMenuOpen(!isMenuOpen)}
						className="w-full flex items-center gap-3 p-3 rounded-full hover:bg-zinc-900 transition-all text-left group cursor-pointer"
					>
						<div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-zinc-700 group-hover:border-yellow-500 transition-colors">
							<Image
								src={user.avatar}
								alt={user.username || "User"}
								fill
								className="object-cover"
							/>
						</div>
						<div className="flex flex-col flex-1 min-w-0">
							<span className="font-bold text-sm text-white truncate font-sans group-hover:text-yellow-500 transition-colors">
								{user.firstName + " " + user.lastName || user.username}
							</span>
							<span className="text-zinc-500 text-xs truncate font-sans">
								@{user.username}
							</span>
						</div>
						<MoreHorizontal className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
					</button>
				</div>
			)}
		</header>
	);
}
