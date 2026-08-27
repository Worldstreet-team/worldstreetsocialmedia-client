"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import { updateMyProfileAction } from "@/lib/user.actions";
import { useSetAtom } from "jotai";
import { userAtom } from "@/store/user.atom";
import { motion, AnimatePresence } from "framer-motion";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import MediaEditor from "@/components/editor/MediaEditor";
import { DEFAULT_AVATAR } from "@/const";
import { useToast } from "@/components/ui/Toast/ToastContext";
import clsx from "clsx";
import { X, Camera, Link as LinkIcon, MapPin } from "lucide-react";
import { CaretDown } from "@phosphor-icons/react";
import { InterestPicker } from "@/components/onboarding/InterestPicker";
import { CATEGORIES, MAX_INTERESTS } from "@/data/categories";
import { normalizeCategoryIds } from "@/lib/categories";
import { cacheKeys, writeCache } from "@/lib/cache";

interface EditProfileModalProps {
	user: any;
	onClose: () => void;
}

/* Field caps. Nothing was bounded before — not on the client, not on the
   gateway — while a story caption was capped at 280. */
const MAX_NAME = 50;
const MAX_BIO = 160;
const MAX_LOCATION = 50;
const MAX_WEBSITE = 100;

const INPUT =
	"w-full rounded-xl glass-input px-3.5 py-3 font-sans text-[15px] glass-ink outline-none placeholder:text-[#fafaf9]/35";

/** Label + optional counter above a borderless glass control. */
function Field({
	label,
	counter,
	counterWarn,
	children,
}: {
	label: string;
	counter?: string;
	counterWarn?: boolean;
	children: React.ReactNode;
}) {
	return (
		<div>
			<div className="flex items-baseline justify-between gap-3">
				<span className="glass-eyebrow">{label}</span>
				{counter && (
					<span
						className={clsx(
							"font-sans text-[11px] tabular-nums",
							counterWarn ? "glass-ink" : "glass-ink-faint",
						)}
					>
						{counter}
					</span>
				)}
			</div>
			<div className="mt-1.5">{children}</div>
		</div>
	);
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

	// Interests live here too now. "Edit topics" on the profile opened this
	// modal, which had no topics field — a visible control that could not do
	// the thing it named.
	const [interests, setInterests] = useState<string[]>(() =>
		normalizeCategoryIds(user.interests ?? []),
	);

	const [topicsOpen, setTopicsOpen] = useState(false);

	/** "AI & Machine Learning, Crypto Markets +1" — labels, not ids. */
	const topicSummary = useMemo(() => {
		if (interests.length === 0) return "Choose what shapes your feed";
		const labels = interests
			.map((id) => CATEGORIES.find((c) => c.id === id)?.label)
			.filter(Boolean) as string[];
		const shown = labels.slice(0, 2).join(", ");
		const rest = labels.length - 2;
		return rest > 0 ? `${shown} +${rest}` : shown;
	}, [interests]);

	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [avatarPreview, setAvatarPreview] = useState<string>(user.avatar || "");

	const [bannerFile, setBannerFile] = useState<File | null>(null);
	const [bannerPreview, setBannerPreview] = useState<string>(user.banner || "");

	// A freshly picked file goes through the Studio sheet (locked aspect)
	// before it lands in avatarFile/bannerFile — avatars shipped un-cropped
	// before this.
	const [cropTarget, setCropTarget] = useState<{
		kind: "avatar" | "banner";
		file: File;
	} | null>(null);

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
			// Animated GIFs bypass the crop sheet — canvas re-encode would
			// flatten them to one frame (the gateway stores files as-is).
			if (file.type === "image/gif") {
				applyPickedFile(type, file);
			} else {
				setCropTarget({ kind: type, file });
			}
		}
		// Reset so re-picking the same file re-fires onChange.
		e.target.value = "";
	};

	// Direct-set path: GIF picks and decode-failure fallbacks (e.g. HEIC on
	// Chrome) keep the old upload-the-original behavior instead of
	// dead-ending the pick.
	const applyPickedFile = (kind: "avatar" | "banner", file: File) => {
		const previewUrl = URL.createObjectURL(file);
		if (kind === "avatar") {
			if (avatarPreview.startsWith("blob:")) {
				URL.revokeObjectURL(avatarPreview);
			}
			setAvatarFile(file);
			setAvatarPreview(previewUrl);
		} else {
			if (bannerPreview.startsWith("blob:")) {
				URL.revokeObjectURL(bannerPreview);
			}
			setBannerFile(file);
			setBannerPreview(previewUrl);
		}
	};

	const handleCropSave = (file: File) => {
		if (!cropTarget) return;
		const previewUrl = URL.createObjectURL(file);
		if (cropTarget.kind === "avatar") {
			if (avatarPreview.startsWith("blob:")) {
				URL.revokeObjectURL(avatarPreview);
			}
			setAvatarFile(file);
			setAvatarPreview(previewUrl);
		} else {
			if (bannerPreview.startsWith("blob:")) {
				URL.revokeObjectURL(bannerPreview);
			}
			setBannerFile(file);
			setBannerPreview(previewUrl);
		}
		setCropTarget(null);
	};

	const handleSave = async () => {
		setIsLoading(true);
		const data = new FormData();
		data.append("firstName", formData.firstName);
		data.append("lastName", formData.lastName);
		data.append("bio", formData.bio);
		data.append("location", formData.location);
		data.append("website", formData.website);
		// Ids only, JSON-encoded — labels never cross the wire.
		data.append("interests", JSON.stringify(interests));

		if (avatarFile) data.append("avatar", avatarFile);
		if (bannerFile) data.append("banner", bannerFile);

		const result = await updateMyProfileAction(data);

		if (result.success) {
			// Update local atom
			setUser(result.data);
			// The edited profile is cached under its handle and may be on
			// screen behind this modal; write the fresh copy in so it updates
			// without waiting for the TTL to lapse.
			if (result.data?.username) {
				writeCache(cacheKeys.profile(result.data.username), result.data);
			}
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
				<div className="fixed inset-0 z-modal flex items-end justify-center sm:items-center sm:p-4">
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className="absolute inset-0 glass-veil-sheer backdrop-blur-md backdrop-saturate-150"
					/>
					<motion.div
						initial={{ opacity: 0, scale: 0.985, y: 20 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.985, y: 20 }}
						transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
						// max-h-[92dvh]: with 100vh the panel was taller than the real
						// viewport on mobile and the Save button fell off the top.
						className="relative flex max-h-[92dvh] w-full max-w-[460px] flex-col overflow-hidden rounded-t-2xl glass-dock backdrop-blur-xl backdrop-saturate-150 glass-ink sm:rounded-2xl"
					>
						{/* Header */}
						<div className="flex shrink-0 items-start justify-between gap-3 p-5 pb-4 sm:p-6 sm:pb-4">
							<div className="min-w-0">
								<h2 className="font-display text-[19px] font-semibold leading-tight">
									Edit profile
								</h2>
								<p className="mt-1 font-sans text-[13px] glass-ink-dim">
									How you appear across WorldStreet.
								</p>
							</div>
							<div className="flex shrink-0 items-center gap-2">
								<button
									type="button"
									onClick={handleSave}
									disabled={isLoading}
									className="h-9 cursor-pointer rounded-pill glass-cta px-5 font-sans text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
								>
									{isLoading ? "Saving…" : "Save"}
								</button>
								<button
									type="button"
									onClick={onClose}
									aria-label="Close"
									className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill glass-chip transition-colors"
								>
									<X className="h-[15px] w-[15px]" />
								</button>
							</div>
						</div>

						{/* Scrollable Content */}
						<div className="overflow-y-auto overscroll-contain flex-1 min-h-0">
							{/* Banner. `glass-well` is the video well — pure black,
							    which reads as a hole when no banner is set. A card
							    fill sits in the same ladder without punching through. */}
							<div className="group relative mx-5 h-28 overflow-hidden rounded-xl glass-card sm:mx-6 sm:h-36">
								{bannerPreview ? (
									<Image
										src={bannerPreview}
										alt="Banner"
										fill
										className="object-cover"
									/>
								) : (
									// Flat well — gradient placeholders are off-system.
									<div className="h-full w-full" />
								)}
								{/* Reveal-on-hover made the banner and avatar pickers
								    literally unusable on touch there is no hover to
								    enter, so you could not change either on a phone.
								    Below sm the controls are always visible and the
								    scrim is dropped so the image still reads. */}
								<div className="absolute inset-0 bg-transparent sm:bg-page/40 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity gap-4">
									<button
										type="button"
										onClick={() => bannerInputRef.current?.click()}
										aria-label="Change banner image"
										className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-pill glass-chip-canvas transition-colors sm:h-10 sm:w-10"
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
											className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-pill glass-chip-canvas transition-colors sm:h-10 sm:w-10"
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
							<div className="relative mb-5 px-5 sm:px-6">
								<div className="group relative -mt-[38px] h-[76px] w-[76px] overflow-hidden rounded-full glass-card ring-4 ring-[#161412] sm:-mt-[46px] sm:h-[92px] sm:w-[92px]">
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
											className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill glass-chip-canvas transition-colors"
										>
											<Camera className="h-[18px] w-[18px]" />
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
							<div className="flex flex-col gap-4 px-5 pb-8 sm:px-6">
								<div className="grid gap-3 sm:grid-cols-2">
									<Field label="First name">
										<input
											type="text"
											name="firstName"
											value={formData.firstName}
											onChange={handleInputChange}
											maxLength={MAX_NAME}
											className={INPUT}
											placeholder="First name"
										/>
									</Field>
									<Field label="Last name">
										<input
											type="text"
											name="lastName"
											value={formData.lastName}
											onChange={handleInputChange}
											maxLength={MAX_NAME}
											className={INPUT}
											placeholder="Last name"
										/>
									</Field>
								</div>

								<Field
									label="Bio"
									counter={`${formData.bio.length}/${MAX_BIO}`}
									counterWarn={formData.bio.length > MAX_BIO - 20}
								>
									<textarea
										name="bio"
										value={formData.bio}
										onChange={handleInputChange}
										maxLength={MAX_BIO}
										rows={3}
										className={`${INPUT} resize-none`}
										placeholder="Say what you're about"
									/>
								</Field>

								<Field label="Location">
									<div className="flex items-center gap-2 rounded-xl glass-input px-3.5">
										<MapPin className="h-4 w-4 shrink-0 glass-ink-faint" />
										<input
											type="text"
											name="location"
											value={formData.location}
											onChange={handleInputChange}
											maxLength={MAX_LOCATION}
											className="w-full bg-transparent py-3 font-sans text-[15px] glass-ink outline-none placeholder:text-[#fafaf9]/35"
											placeholder="Where you're based"
										/>
									</div>
								</Field>

								<Field label="Website">
									<div className="flex items-center gap-2 rounded-xl glass-input px-3.5">
										<LinkIcon className="h-4 w-4 shrink-0 glass-ink-faint" />
										<input
											type="text"
											name="website"
											value={formData.website}
											onChange={handleInputChange}
											maxLength={MAX_WEBSITE}
											className="w-full bg-transparent py-3 font-sans text-[15px] glass-ink outline-none placeholder:text-[#fafaf9]/35"
											placeholder="yoursite.com"
										/>
									</div>
								</Field>

								{/* Topics — the thing "Edit topics" always promised.
								    Collapsed by default: a hundred category chips
								    inlined under four text fields made the whole
								    sheet read as one undifferentiated pile. */}
								<div>
									<button
										type="button"
										onClick={() => setTopicsOpen((v) => !v)}
										aria-expanded={topicsOpen}
										className="flex w-full items-center justify-between gap-3 rounded-xl glass-card px-3.5 py-3 text-left transition-colors"
									>
										<span className="min-w-0">
											<span className="glass-eyebrow block">Topics</span>
											<span className="mt-1 block truncate font-sans text-[13.5px] glass-ink">
												{topicSummary}
											</span>
										</span>
										<span className="flex shrink-0 items-center gap-2">
											<span
												className={clsx(
													"font-sans text-[11px] tabular-nums",
													interests.length >= MAX_INTERESTS
														? "glass-ink"
														: "glass-ink-faint",
												)}
											>
												{interests.length}/{MAX_INTERESTS}
											</span>
											<CaretDown
												size={14}
												weight="bold"
												className={clsx(
													"transition-transform",
													topicsOpen && "rotate-180",
												)}
											/>
										</span>
									</button>

									{topicsOpen && (
										<div className="mt-2.5">
											<InterestPicker
												selected={interests}
												onToggle={(id) =>
													setInterests((prev) =>
														prev.includes(id)
															? prev.filter((x) => x !== id)
															: prev.length >= MAX_INTERESTS
																? prev
																: [...prev, id],
													)
												}
											/>
										</div>
									)}
								</div>
							</div>
						</div>
					</motion.div>
				</div>
			</AnimatePresence>

			{/* Studio sheet portalled later in <body>, so it stacks above this
			    modal at the same z-modal tier. */}
			{cropTarget && (
				<MediaEditor
					file={cropTarget.file}
					lockAspect={cropTarget.kind === "avatar" ? 1 : 3}
					round={cropTarget.kind === "avatar"}
					title={
						cropTarget.kind === "avatar" ? "Crop profile photo" : "Crop banner"
					}
					onClose={() => setCropTarget(null)}
					onSave={({ file }) => handleCropSave(file)}
					onDecodeError={(file) => {
						if (cropTarget) applyPickedFile(cropTarget.kind, file);
					}}
				/>
			)}
		</ConfirmModalPortal>
	);
}
