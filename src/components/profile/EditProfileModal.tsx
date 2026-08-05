"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { updateMyProfileAction } from "@/lib/user.actions";
import { useSetAtom } from "jotai";
import { userAtom } from "@/store/user.atom";
import { motion, AnimatePresence } from "framer-motion";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import { DEFAULT_AVATAR } from "@/const";
import { useToast } from "@/components/ui/Toast/ToastContext";
import {
	X,
	Camera,
	Link as LinkIcon,
	MapPin,
	User as UserIcon,
} from "lucide-react";

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
				<div className="fixed inset-0 z-modal flex items-center justify-center p-3 sm:p-4">
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className="absolute inset-0 bg-scrim"
					/>
					<motion.div
						initial={{ opacity: 0, scale: 0.98, y: 8 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.98, y: 8 }}
						transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
						// max-h-[90dvh]: with 100vh the panel was taller than the real
						// viewport on mobile and the Save button fell off the top.
						className="relative w-full max-w-lg bg-surface border border-hairline rounded-xl shadow-nav overflow-hidden flex flex-col max-h-[90dvh] text-primary"
					>
						{/* Header */}
						<div className="flex shrink-0 items-center justify-between gap-2 px-2 sm:px-4 py-2 sm:py-3 border-b border-hairline">
							<div className="flex items-center gap-2 sm:gap-4 min-w-0">
								<button
									type="button"
									onClick={onClose}
									aria-label="Close"
									className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill hover:bg-raised transition-colors text-muted hover:text-primary cursor-pointer"
								>
									<X className="w-5 h-5" />
								</button>
								<h2 className="font-display text-lg font-semibold tracking-tight truncate">
									Edit Profile
								</h2>
							</div>
							<button
								type="button"
								onClick={handleSave}
								disabled={isLoading}
								className="shrink-0 bg-primary text-page px-5 sm:px-6 h-11 sm:h-9 rounded-pill font-semibold text-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-sans"
							>
								{isLoading ? "Saving..." : "Save"}
							</button>
						</div>

						{/* Scrollable Content */}
						<div className="overflow-y-auto overscroll-contain flex-1 min-h-0">
							{/* Banner */}
							<div className="relative h-32 sm:h-48 bg-sunken w-full group">
								{bannerPreview ? (
									<Image
										src={bannerPreview}
										alt="Banner"
										fill
										className="object-cover"
									/>
								) : (
									// Flat sunken band — gradient placeholders are off-system.
									<div className="w-full h-full bg-sunken" />
								)}
								{/* Reveal-on-hover made the banner and avatar pickers
								    literally unusable on touch — there is no hover to
								    enter, so you could not change either on a phone.
								    Below sm the controls are always visible and the
								    scrim is dropped so the image still reads. */}
								<div className="absolute inset-0 bg-transparent sm:bg-page/40 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity gap-4">
									<button
										type="button"
										onClick={() => bannerInputRef.current?.click()}
										aria-label="Change banner image"
										className="h-11 w-11 sm:h-10 sm:w-10 flex items-center justify-center cursor-pointer bg-page/70 sm:bg-page/60 rounded-pill text-primary hover:bg-raised transition-colors"
									>
										<Camera className="w-5 h-5" />
									</button>
									{bannerPreview && bannerPreview !== user.banner && (
										<button
											type="button"
											onClick={() => {
												setBannerFile(null);
												setBannerPreview(user.banner || "");
											}}
											aria-label="Undo banner change"
											className="h-11 w-11 sm:h-10 sm:w-10 flex items-center justify-center cursor-pointer bg-page/70 sm:bg-page/60 rounded-pill text-primary hover:bg-raised transition-colors"
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
								<div className="w-[80px] sm:w-[112px] h-[80px] sm:h-[112px] rounded-full border-4 border-surface -mt-[40px] sm:-mt-[56px] relative bg-sunken group overflow-hidden">
									<Image
										src={avatarPreview || DEFAULT_AVATAR}
										alt="Avatar"
										fill
										className="object-cover"
									/>
									<div className="absolute inset-0 bg-page/30 sm:bg-page/40 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
										<button
											type="button"
											onClick={() => avatarInputRef.current?.click()}
											aria-label="Change profile photo"
											className="h-11 w-11 sm:h-10 sm:w-10 flex items-center justify-center bg-page/70 sm:bg-page/60 rounded-pill text-primary hover:bg-raised transition-colors"
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
								<div className="grid sm:grid-cols-2 gap-4">
									{/* First Name */}
									<div className="relative rounded-md border border-hairline focus-within:border-brand/60 transition-colors p-3">
										<label className="block text-[11px] uppercase tracking-[1px] font-medium text-muted mb-1 font-sans">
											First Name
										</label>
										<div className="flex items-center gap-2">
											<UserIcon className="w-4 h-4 text-subtle" />
											<input
												type="text"
												name="firstName"
												value={formData.firstName}
												onChange={handleInputChange}
												className="w-full outline-none text-base sm:text-sm font-sans bg-transparent placeholder:text-subtle text-primary"
												placeholder="First Name"
											/>
										</div>
									</div>
									{/* Last Name */}
									<div className="relative rounded-md border border-hairline focus-within:border-brand/60 transition-colors p-3">
										<label className="block text-[11px] uppercase tracking-[1px] font-medium text-muted mb-1 font-sans">
											Last Name
										</label>
										<div className="flex items-center gap-2">
											<UserIcon className="w-4 h-4 text-subtle" />
											<input
												type="text"
												name="lastName"
												value={formData.lastName}
												onChange={handleInputChange}
												className="w-full outline-none text-base sm:text-sm font-sans bg-transparent placeholder:text-subtle text-primary"
												placeholder="Last Name"
											/>
										</div>
									</div>
								</div>

								<div className="relative rounded-md border border-hairline focus-within:border-brand/60 transition-colors p-3">
									<label className="block text-[11px] uppercase tracking-[1px] font-medium text-muted mb-1 font-sans">
										Bio
									</label>
									<textarea
										name="bio"
										value={formData.bio}
										onChange={handleInputChange}
										className="w-full outline-none text-base sm:text-sm font-sans resize-none min-h-[80px] bg-transparent placeholder:text-subtle text-primary"
										placeholder="Tell us about yourself"
									/>
								</div>

								<div className="relative rounded-md border border-hairline focus-within:border-brand/60 transition-colors p-3">
									<label className="block text-[11px] uppercase tracking-[1px] font-medium text-muted mb-1 font-sans">
										Location
									</label>
									<div className="flex items-center gap-2">
										<MapPin className="w-4 h-4 text-subtle" />
										<input
											type="text"
											name="location"
											value={formData.location}
											onChange={handleInputChange}
											className="w-full outline-none text-base sm:text-sm font-sans bg-transparent placeholder:text-subtle text-primary"
											placeholder="Add your location"
										/>
									</div>
								</div>

								<div className="relative rounded-md border border-hairline focus-within:border-brand/60 transition-colors p-3">
									<label className="block text-[11px] uppercase tracking-[1px] font-medium text-muted mb-1 font-sans">
										Website
									</label>
									<div className="flex items-center gap-2">
										<LinkIcon className="w-4 h-4 text-subtle" />
										<input
											type="text"
											name="website"
											value={formData.website}
											onChange={handleInputChange}
											className="w-full outline-none text-base sm:text-sm font-sans bg-transparent placeholder:text-subtle text-primary"
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
