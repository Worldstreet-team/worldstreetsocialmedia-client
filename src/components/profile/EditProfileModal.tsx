"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { updateMyProfileAction } from "@/lib/user.actions";
import { useSetAtom } from "jotai";
import { userAtom } from "@/store/user.atom";
import { motion, AnimatePresence } from "framer-motion";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import { useToast } from "@/components/ui/Toast/ToastContext";
import {
	X,
	Camera,
	Link as LinkIcon,
	MapPin,
	User as UserIcon,
} from "lucide-react";
import clsx from "clsx";

interface EditProfileModalProps {
	user: any;
	onClose: () => void;
}

export default function EditProfileModal({
	user,
	onClose,
}: EditProfileModalProps) {
	const setUser = useSetAtom(userAtom);
	const { toast } = useToast();
	const [isLoading, setIsLoading] = useState(false);

	const [formData, setFormData] = useState({
		firstName: user.firstName || "",
		lastName: user.lastName || "",
		bio: user.bio || "",
		location: user.location || "",
		website: user.website || "",
	});

	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [avatarPreview, setAvatarPreview] = useState<string>(user.avatar || "");

	const [bannerFile, setBannerFile] = useState<File | null>(null);
	const [bannerPreview, setBannerPreview] = useState<string>(user.banner || "");

	const avatarInputRef = useRef<HTMLInputElement>(null);
	const bannerInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "unset";
		};
	}, []);

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleFileChange = (
		e: React.ChangeEvent<HTMLInputElement>,
		type: "avatar" | "banner",
	) => {
		const file = e.target.files?.[0];
		if (file) {
			const previewUrl = URL.createObjectURL(file);
			if (type === "avatar") {
				setAvatarFile(file);
				setAvatarPreview(previewUrl);
			} else {
				setBannerFile(file);
				setBannerPreview(previewUrl);
			}
		}
	};

	const handleSave = async () => {
		setIsLoading(true);
		const data = new FormData();
		data.append("firstName", formData.firstName);
		data.append("lastName", formData.lastName);
		data.append("bio", formData.bio);
		data.append("location", formData.location);
		data.append("website", formData.website);

		if (avatarFile) data.append("avatar", avatarFile);
		if (bannerFile) data.append("banner", bannerFile);

		const result = await updateMyProfileAction(data);

		if (result.success) {
			// Update local atom
			setUser(result.data);
			toast("Profile updated successfully", { type: "success" });
			onClose();
		} else {
			toast(result.message || "Failed to update profile", { type: "error" });
		}
		setIsLoading(false);
	};

	return (
		<ConfirmModalPortal>
			<AnimatePresence>
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm"
					/>
					<motion.div
						initial={{ opacity: 0, scale: 0.95, y: 10 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 10 }}
						className="relative w-full max-w-lg bg-black border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-50 text-white"
					>
						{/* Header */}
						<div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
							<div className="flex items-center gap-4">
								<button
									onClick={onClose}
									className="p-2 -ml-2 rounded-full hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-white cursor-pointer"
								>
									<X className="w-5 h-5" />
								</button>
								<h2 className="text-xl font-bold font-space-mono tracking-tight">
									Edit Profile
								</h2>
							</div>
							<button
								onClick={handleSave}
								disabled={isLoading}
								className="bg-white text-black px-6 py-2 rounded-full font-bold text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-space-mono"
							>
								{isLoading ? "Saving..." : "Save"}
							</button>
						</div>

						{/* Scrollable Content */}
						<div className="overflow-y-auto flex-1 bg-black">
							{/* Banner */}
							<div className="relative h-32 sm:h-48 bg-zinc-900 w-full group">
								{bannerPreview ? (
									<Image
										src={bannerPreview}
										alt="Banner"
										fill
										className="object-cover"
									/>
								) : (
									<div className="w-full h-full bg-linear-to-r from-zinc-900 to-zinc-800" />
								)}
								<div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-4">
									<button
										onClick={() => bannerInputRef.current?.click()}
										className="w-10 h-10 flex items-center justify-center cursor-pointer bg-black/50 rounded-full text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
									>
										<Camera className="w-5 h-5" />
									</button>
									{bannerPreview && bannerPreview !== user.banner && (
										<button
											onClick={() => {
												setBannerFile(null);
												setBannerPreview(user.banner || "");
											}}
											className="w-10 h-10 flex items-center justify-center cursor-pointer bg-black/50 rounded-full text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
										>
											<X className="w-5 h-5" />
										</button>
									)}
								</div>
								<input
									type="file"
									ref={bannerInputRef}
									onChange={(e) => handleFileChange(e, "banner")}
									accept="image/*"
									className="hidden"
								/>
							</div>

							{/* Avatar */}
							<div className="px-4 relative mb-6">
								<div className="w-[80px] sm:w-[112px] h-[80px] sm:h-[112px] rounded-full border-4 border-black -mt-[40px] sm:-mt-[56px] relative bg-black group overflow-hidden shadow-sm">
									<Image
										src={
											avatarPreview ||
											"https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"
										}
										alt="Avatar"
										fill
										className="object-cover"
									/>
									<div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
										<button
											onClick={() => avatarInputRef.current?.click()}
											className="w-10 h-10 flex items-center justify-center bg-black/50 rounded-full text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
										>
											<Camera className="w-5 h-5" />
										</button>
									</div>
								</div>
								<input
									type="file"
									ref={avatarInputRef}
									onChange={(e) => handleFileChange(e, "avatar")}
									accept="image/*"
									className="hidden"
								/>
							</div>

							{/* Form Fields */}
							<div className="px-4 pb-8 space-y-5">
								<div className="grid grid-cols-2 gap-4">
									{/* First Name */}
									<div className="relative border border-zinc-800 focus-within:border-white focus-within:ring-1 focus-within:ring-white transition-all p-3">
										<label className="block text-xs uppercase font-bold text-zinc-500 mb-1 font-space-mono">
											First Name
										</label>
										<div className="flex items-center gap-2">
											<UserIcon className="w-4 h-4 text-zinc-500" />
											<input
												type="text"
												name="firstName"
												value={formData.firstName}
												onChange={handleInputChange}
												className="w-full outline-none text-sm font-space-mono bg-transparent placeholder:text-zinc-700 text-white"
												placeholder="First Name"
											/>
										</div>
									</div>
									{/* Last Name */}
									<div className="relative border border-zinc-800 focus-within:border-white focus-within:ring-1 focus-within:ring-white transition-all p-3">
										<label className="block text-xs uppercase font-bold text-zinc-500 mb-1 font-space-mono">
											Last Name
										</label>
										<div className="flex items-center gap-2">
											<UserIcon className="w-4 h-4 text-zinc-500" />
											<input
												type="text"
												name="lastName"
												value={formData.lastName}
												onChange={handleInputChange}
												className="w-full outline-none text-sm font-space-mono bg-transparent placeholder:text-zinc-700 text-white"
												placeholder="Last Name"
											/>
										</div>
									</div>
								</div>

								<div className="relative border border-zinc-800 focus-within:border-white focus-within:ring-1 focus-within:ring-white transition-all p-3">
									<label className="block text-xs uppercase font-bold text-zinc-500 mb-1 font-space-mono">
										Bio
									</label>
									<textarea
										name="bio"
										value={formData.bio}
										onChange={handleInputChange}
										className="w-full outline-none text-sm font-space-mono resize-none min-h-[80px] bg-transparent placeholder:text-zinc-700 text-white"
										placeholder="Tell us about yourself"
									/>
								</div>

								<div className="relative border border-zinc-800 focus-within:border-white focus-within:ring-1 focus-within:ring-white transition-all p-3">
									<label className="block text-xs uppercase font-bold text-zinc-500 mb-1 font-space-mono">
										Location
									</label>
									<div className="flex items-center gap-2">
										<MapPin className="w-4 h-4 text-zinc-500" />
										<input
											type="text"
											name="location"
											value={formData.location}
											onChange={handleInputChange}
											className="w-full outline-none text-sm font-space-mono bg-transparent placeholder:text-zinc-700 text-white"
											placeholder="Add your location"
										/>
									</div>
								</div>

								<div className="relative border border-zinc-800 focus-within:border-white focus-within:ring-1 focus-within:ring-white transition-all p-3">
									<label className="block text-xs uppercase font-bold text-zinc-500 mb-1 font-space-mono">
										Website
									</label>
									<div className="flex items-center gap-2">
										<LinkIcon className="w-4 h-4 text-zinc-500" />
										<input
											type="text"
											name="website"
											value={formData.website}
											onChange={handleInputChange}
											className="w-full outline-none text-sm font-space-mono bg-transparent placeholder:text-zinc-700 text-white"
											placeholder="Add your website"
										/>
									</div>
								</div>
							</div>
						</div>
					</motion.div>
				</div>
			</AnimatePresence>
		</ConfirmModalPortal>
	);
}
