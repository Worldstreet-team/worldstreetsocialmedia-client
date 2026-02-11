"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { updateMyProfileAction } from "@/lib/user.actions";
import { useSetAtom } from "jotai";
import { userAtom } from "@/store/user.atom";

interface EditProfileModalProps {
	user: any;
	onClose: () => void;
}

export default function EditProfileModal({
	user,
	onClose,
}: EditProfileModalProps) {
	const setUser = useSetAtom(userAtom);
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
			onClose();
		} else {
			alert(result.message || "Failed to update profile");
		}
		setIsLoading(false);
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
			<div className="bg-white w-full max-w-[600px] h-[90vh] sm:h-auto sm:max-h-[90vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
				<div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
					<div className="flex items-center gap-4">
						<button
							onClick={onClose}
							className="rounded-full hover:bg-gray-100 transition-colors cursor-pointer duration-300 w-10 h-10 flex items-center justify-center"
						>
							<span className="material-symbols-outlined text-[20px] block">
								close
							</span>
						</button>
						<h2 className="text-xl font-bold">Edit Profile</h2>
					</div>
					<button
						onClick={handleSave}
						disabled={isLoading}
						className="bg-black text-white w-24 h-10 rounded-full font-bold text-sm hover:bg-black/80 transition-colors disabled:opacity-50 cursor-pointer"
					>
						{isLoading ? "Saving..." : "Save"}
					</button>
				</div>

				{/* Scrollable Content */}
				<div className="overflow-y-auto flex-1 pb-8">
					{/* Banner */}
					<div className="relative h-[200px] bg-gray-200 w-full group">
						{bannerPreview ? (
							<Image
								src={bannerPreview}
								alt="Banner"
								fill
								className="object-cover"
							/>
						) : (
							<div className="w-full h-full bg-linear-to-r from-gray-300 to-gray-400" />
						)}
						<div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-4">
							<button
								onClick={() => bannerInputRef.current?.click()}
								className="w-12 h-12 flex items-center justify-center cursor-pointer bg-black/50 rounded-full text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
							>
								<span className="material-symbols-outlined block">
									add_a_photo
								</span>
							</button>
							{bannerPreview &&
								bannerPreview !== user.banner && ( // Only show remove if it's a new preview or existing? Usually remove just clears to default or none. skipping remove for now.
									<button
										onClick={() => {
											setBannerFile(null);
											setBannerPreview(""); // Or revert to user.banner? Assuming clearing means remove.
										}}
										className="w-12 h-12 flex items-center justify-center cursor-pointer bg-black/50 rounded-full text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
									>
										<span className="material-symbols-outlined block">
											close
										</span>
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
					<div className="px-4 relative mb-4">
						<div className="w-[112px] h-[112px] rounded-full border-4 border-white -mt-[56px] relative bg-white group overflow-hidden">
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
									className="w-12 h-12 flex items-center justify-center bg-black/50 rounded-full text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
								>
									<span className="material-symbols-outlined block text-[17px]">
										add_a_photo
									</span>
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
					<div className="px-4 space-y-6">
						{/* <div className="grid grid-cols-2 gap-4">
							<div className="relative border border-gray-300 rounded px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
								<label className="block text-xs text-text-light mb-1">
									First Name
								</label>
								<input
									type="text"
									name="firstName"
									value={formData.firstName}
									onChange={handleInputChange}
									className="w-full outline-none text-[17px]"
									placeholder="First Name"
								/>
							</div>
							<div className="relative border border-gray-300 rounded px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
								<label className="block text-xs text-text-light mb-1">
									Last Name
								</label>
								<input
									type="text"
									name="lastName"
									value={formData.lastName}
									onChange={handleInputChange}
									className="w-full outline-none text-[17px]"
									placeholder="Last Name"
								/>
							</div>
						</div> */}

						<div className="relative border border-gray-300 rounded px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
							<label className="block text-xs text-text-light mb-1">Bio</label>
							<textarea
								name="bio"
								value={formData.bio}
								onChange={handleInputChange}
								className="w-full outline-none text-[17px] resize-none min-h-[80px]"
								placeholder="Add a bio"
							/>
						</div>

						<div className="relative border border-gray-300 rounded px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
							<label className="block text-xs text-text-light mb-1">
								Location
							</label>
							<input
								type="text"
								name="location"
								value={formData.location}
								onChange={handleInputChange}
								className="w-full outline-none text-[17px]"
								placeholder="Add your location"
							/>
						</div>

						<div className="relative border border-gray-300 rounded px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
							<label className="block text-xs text-text-light mb-1">
								Website
							</label>
							<input
								type="text"
								name="website"
								value={formData.website}
								onChange={handleInputChange}
								className="w-full outline-none text-[17px]"
								placeholder="Add your website"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
