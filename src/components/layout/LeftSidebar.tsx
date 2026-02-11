"use client";

import { sidebarList } from "@/app/data/sidebarlist";
import { userAtom } from "@/store/user.atom";
import { useAtomValue } from "jotai";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/Skeleton";
import { logoutAction } from "@/lib/auth.actions";
import { useState, useRef, useEffect } from "react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useRouter } from "next/navigation";
import { useSetAtom } from "jotai";

export function LeftSidebar() {
	const pathname = usePathname();
	const user = useAtomValue(userAtom);

	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const router = useRouter();
	const setUser = useSetAtom(userAtom);

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

	const handleLogout = async () => {
		await logoutAction();
		setUser(null);
		router.push("/login"); // Or wherever your login page is
	};

	return (
		<header className="w-[275px] hidden md:flex flex-col sticky top-0 h-screen px-2 overflow-y-auto">
			<ConfirmModal
				isOpen={isLogoutModalOpen}
				onClose={() => setIsLogoutModalOpen(false)}
				onConfirm={handleLogout}
				title="Log out of WorldStreet?"
				message="You can always log back in at any time. If you just want to switch accounts, you can do that by adding an existing account."
				confirmText="Log out"
			/>
			<div className="py-1 mb-1">
				<div className="flex items-center justify-center cursor-pointer transition-colors py-4">
					<h1 className="text-2xl font-semibold font-cuturila">WorldStreet</h1>
				</div>
			</div>
			<nav className="flex flex-col gap-5">
				{sidebarList.map((item, index) => {
					const isActive = pathname === item.link;
					return (
						<Link
							key={index}
							className={`flex items-center gap-2 px-3.5 py-2 rounded-full nav-item w-fit hover:bg-black/10 border-none transition-all duration-500 ease-in-out ${isActive ? "font-bold" : "font-semibold"}`}
							href={item.link}
						>
							<span className="inline-flex w-10 h-10 items-center justify-center">
								<item.icon isActive={isActive} />
							</span>
							<span
								className={`text-lg pr-4 ${isActive ? "font-bold" : "font-semibold"}`}
							>
								{item.title}
							</span>
						</Link>
					);
				})}
				{/* <button className="flex items-center gap-4 px-3 py-3 rounded-full nav-item w-fit">
                    <MoreIcon />
                    <span className="text-xl pr-4">More</span>
                </button> */}
			</nav>
			{/* <button
				className="mt-8 cursor-pointer bg-black text-white font-bold py-3.5 rounded-full text-[17px] shadow-sm transition-all mt-4 w-[85%]"
				type="button"
			>
				Post
			</button> */}
			{user ? (
				<div className="mt-auto mb-4 relative" ref={menuRef}>
					{isMenuOpen && (
						<div className="absolute bottom-full left-0 w-[230px] bg-white rounded-2xl shadow-[0_0_15px_rgba(0,0,0,0.1)] border border-black/5 overflow-hidden mb-4 z-50 py-3">
							<button
								type="button"
								className="w-full text-left px-4 py-3 hover:bg-gray-50 font-bold text-[15px] flex items-center justify-between"
								onClick={() => {
									setIsMenuOpen(false);
									// Add functionality for 'Add an existing account' later
								}}
							>
								<span>Add an existing account</span>
							</button>
							<button
								type="button"
								className="w-full text-left px-4 py-3 hover:bg-gray-50 font-bold text-[15px]"
								onClick={() => {
									setIsMenuOpen(false);
									setIsLogoutModalOpen(true);
								}}
							>
								Log out @{user.username}
							</button>
						</div>
					)}
					<button
						type="button"
						onClick={() => setIsMenuOpen(!isMenuOpen)}
						className="w-full flex items-center gap-3 p-3 rounded-full nav-item cursor-pointer hover:bg-black/10 transition-colors text-left"
					>
						<div
							className="w-10 h-10 rounded-full bg-cover bg-center"
							style={{
								backgroundImage: `url('${user.avatar || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"}')`,
							}}
						/>
						<div className="flex flex-col flex-1 min-w-0">
							<span className="font-bold truncate text-[15px]">
								{user.firstName} {user.lastName}
							</span>
							<span className="text-text-light truncate text-[15px]">
								@{user.username}
							</span>
						</div>
						<span className="material-symbols-outlined text-sm">
							more_horiz
						</span>
					</button>
				</div>
			) : (
				<div className="mt-auto mb-4 flex items-center gap-3 p-3 rounded-full nav-item">
					<Skeleton className="w-10 h-10 rounded-full" />
					<div className="flex flex-col flex-1 min-w-0 gap-1">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-3 w-16" />
					</div>
				</div>
			)}
			{/* <div className="mt-auto mb-4 flex items-center gap-3 p-3 rounded-full nav-item cursor-pointer">
				<div
					className="w-10 h-10 rounded-full bg-cover bg-center"
					style={{
						backgroundImage:
							"url('https://lh3.googleusercontent.com/aida-public/AB6AXuCVh8p3iIVB6V8SmlrlYhTYWcYKtbi1qAwIQl3p699QnBtz2ery9QBZekmokbzjOXzYF5frjM8R7ARMtmQB6nxSZi64f7NerLQ7qGEcIt2yl8HmIOmElLD9vvPsDgz-rHHV64QlGEJ_EV4xpBfyYCx1qBycp3FL959LShnq007ra5467_vkjYyUqisNvZKv3m86lX1dZoj63dTuvEzUFto3QRrPkMAK8WMEZAxi0JbbFowvF9pBwhC7djdOs5EkUd44L02u8cE66tM0')",
					}}
				/>
				<div className="flex flex-col flex-1 min-w-0">
					<span className="font-bold truncate text-[15px]">Alex Rivera</span>
					<span className="text-text-light truncate text-[15px]">@arivera</span>
				</div>
				<span className="material-symbols-outlined text-sm">more_horiz</span>
			</div> */}
		</header>
	);
}
