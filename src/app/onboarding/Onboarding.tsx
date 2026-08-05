"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import clsx from "clsx";
import { INTERESTS } from "@/data/onboarding";
import { followUserAction, getWhoToFollowAction } from "@/lib/user.actions";
import axios from "axios";
import { BACKEND_URL, DEFAULT_AVATAR } from "@/const";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { useSetAtom } from "jotai";
import { userAtom } from "@/store/user.atom";

export default function Onboarding({ initialUser }: { initialUser: any }) {
	const { getToken } = useAuth();
	const [step, setStep] = useState(1);
	const [username, setUsername] = useState("");
	const [bio, setBio] = useState("");
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [_, setError] = useState("");
	const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
	const [loadingSuggestions, setLoadingSuggestions] = useState(false);
	const { toast } = useToast();
	const [followedUsers, setFollowedUsers] = useState<string[]>([]);
	const setActiveUser = useSetAtom(userAtom);

	const [formData, setFormData] = useState({
		id: "",
		firstName: "",
		lastName: "",
		email: "",
		role: "",
		username: "",
		bio: "",
		// Branded fallback — never a third-party stock photo (DEFAULT_AVATAR is
		// the single missing-avatar asset).
		avatar: DEFAULT_AVATAR,
		interests: [] as string[],
	});

	useEffect(() => {
		if (initialUser) {
			setFormData((prev) => ({
				...prev,
				id: initialUser?.id || "",
				avatar: initialUser?.avatar || DEFAULT_AVATAR,
				firstName: initialUser?.firstName || "",
				lastName: initialUser?.lastName || "",
				email: initialUser?.email || "",
				role: "user",
			}));
		}
	}, [initialUser]);

	useEffect(() => {
		const fetchSuggestions = async () => {
			if (step === 3) {
				setLoadingSuggestions(true);
				try {
					const res = await getWhoToFollowAction();
					if (res.success && Array.isArray(res.data)) {
						// Limit to 3 users as requested
						setSuggestedUsers(res.data.slice(0, 3));
					}
				} catch (err) {
					console.error("Failed to fetch suggestions:", err);
				} finally {
					setLoadingSuggestions(false);
				}
			}
		};

		fetchSuggestions();
	}, [step]);

	const toggleInterest = (interest: string) => {
		setFormData((prev) => {
			if (prev.interests.includes(interest)) {
				return {
					...prev,
					interests: prev.interests.filter((i) => i !== interest),
				};
			} else {
				return { ...prev, interests: [...prev.interests, interest] };
			}
		});
	};

	const submitProfile = async (overrideToken?: string) => {
		setLoading(true);
		setError("");

		try {
			const token = await getToken();
			const res = await axios.post(
				`${BACKEND_URL}/api/users/onboard`,
				formData,
				{
					headers: { Authorization: `Bearer ${token}` },
				},
			);

			if (res.data) {
				setActiveUser(res.data);
				toast("Welcome to WorldStreet!", { type: "success" });
			}

			setStep(3); // Move to Step 3 (Connect)
		} catch (err: any) {
			if (err.response?.status === 401 && !overrideToken) {
				// await refreshAndRetry(submitProfile);
			} else {
				const errorMsg =
					err.response?.data?.message ||
					err.message ||
					"Failed to create profile";
				setError(errorMsg);
				toast(errorMsg, { type: "error" });
			}
		} finally {
			setLoading(false);
		}
	};

	const handleFollow = async (userId: string) => {
		// Optimistic UI update
		const isFollowing = followedUsers.includes(userId);

		if (isFollowing) {
			setFollowedUsers((prev) => prev.filter((id) => id !== userId));
			toast("Unfollowed user", { type: "info", position: "bottom-left" });
			// Call unfollow action if needed
		} else {
			setFollowedUsers((prev) => [...prev, userId]);
			await followUserAction(userId);
			toast("Following user", { type: "success", position: "bottom-left" });
		}
	};

	const finishOnboarding = () => {
		router.push("/");
		router.refresh();
	};

	const handleContinue = () => {
		if (step === 1) {
			if (!username) return;

			// Validate username pattern again just in case
			if (!/^[a-zA-Z0-9_]+$/.test(username)) {
				toast("Username can only contain letters, numbers, and underscores", {
					type: "error",
				});
				return;
			}

			// Clean username (remove leading @ just in case, though input prevents it now)
			const cleanedUsername = username.replace(/^@+/, "");
			setFormData((prev) => ({ ...prev, username: cleanedUsername, bio }));
			setStep(2);
		}
	};

	const handleCreateProfile = async () => {
		await submitProfile();
	};

	return (
		<div className="min-h-dvh flex items-center justify-center bg-page p-4 py-8">
			{/* p-8 left only 224px of usable width on a 320px screen; p-6 below sm. */}
			<div className="w-full max-w-md bg-surface rounded-xl p-6 sm:p-8 border border-hairline relative overflow-hidden animate-rise">
				<div className="relative z-10 flex flex-col items-center text-center space-y-8">
					{/* Progress Indicator */}
					<div className="flex gap-2 mb-4">
						{[1, 2, 3].map((s) => (
							<div
								key={s}
								className={clsx(
									"h-1.5 rounded-pill transition-[width,background-color]",
									step >= s ? "w-8 bg-brand" : "w-2 bg-raised",
								)}
							/>
						))}
					</div>

					{/* STEP 1: IDENTITY */}
					{step === 1 && (
						<div className="space-y-8 w-full animate-rise">
							<div className="space-y-2">
								<h1 className="font-display text-2xl font-semibold text-primary">
									Who are you?
								</h1>
								<p className="text-muted text-sm font-sans">
									Pick a username and tell people what you're about.
								</p>
							</div>

							<div className="w-full space-y-6">
								<div className="space-y-2 text-left">
									<label
										htmlFor="username"
										className="font-sans text-[11px] font-medium tracking-[1px] text-muted uppercase ml-1"
									>
										Username
									</label>
									<div className="relative">
										<span className="absolute left-4 top-1/2 -translate-y-1/2 text-subtle font-medium font-sans">
											@
										</span>
										<input
											id="username"
											type="text"
											value={username}
											onChange={(e) => {
												const val = e.target.value;
												// Allow only alphanumeric and underscores
												if (/^[a-zA-Z0-9_]*$/.test(val)) {
													setUsername(val);
												}
											}}
											placeholder="sarah_codes"
											className="w-full bg-sunken text-primary rounded-pill py-3 h-14 pl-8 pr-4 font-medium border border-hairline focus:outline-none focus:border-brand/60 placeholder:text-subtle font-sans text-base transition-colors"
										/>
									</div>
								</div>

								<div className="space-y-2 text-left">
									<label
										htmlFor="bio"
										className="font-sans text-[11px] font-medium tracking-[1px] text-muted uppercase ml-1"
									>
										Bio
									</label>
									<textarea
										id="bio"
										value={bio}
										onChange={(e) => setBio(e.target.value)}
										placeholder="Markets, code, and everything in between"
										rows={3}
										// text-base on mobile — a 14px field makes iOS zoom
										// into the card and the user can't see the CTA.
										className="w-full bg-sunken text-primary rounded-lg p-3.5 font-medium border border-hairline focus:outline-none focus:border-brand/60 placeholder:text-subtle resize-none font-sans text-base sm:text-sm transition-colors"
									/>
								</div>
							</div>

							<button
								onClick={handleContinue}
								className="group w-full bg-brand text-brand-on h-14 cursor-pointer py-3.5 px-6 rounded-pill flex items-center justify-center gap-2 hover:bg-brand-active transition-colors active:scale-[0.98] font-sans text-sm font-semibold"
								type="button"
							>
								<span>Continue</span>
								<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
							</button>
						</div>
					)}

					{/* STEP 2: INTERESTS */}
					{step === 2 && (
						<div className="space-y-8 w-full animate-rise">
							<div className="space-y-2">
								<h1 className="font-display text-2xl font-semibold text-primary">
									What are you into?
								</h1>
								<p className="text-muted text-sm font-sans">
									Select topics to personalize your feed.
								</p>
							</div>

							{/* Capped against the viewport, not a fixed 400px — on a short
							    phone the grid used to push the Back/Continue row off screen. */}
							<div className="grid grid-cols-2 gap-2 sm:gap-3 max-h-[min(400px,45dvh)] overflow-y-auto overscroll-contain pr-1 sm:pr-2">
								{INTERESTS.map((interest) => (
									<button
										key={interest}
										onClick={() => toggleInterest(interest)}
										className={clsx(
											"px-3 sm:px-4 min-h-11 py-3 rounded-lg font-semibold text-xs transition-colors border font-sans cursor-pointer",
											formData.interests.includes(interest)
												? "bg-primary text-page border-transparent"
												: "bg-sunken text-muted border-hairline hover:bg-raised hover:text-primary",
										)}
										type="button"
									>
										{interest}
									</button>
								))}
							</div>

							<div className="flex gap-3 pt-4">
								<button
									onClick={() => setStep(1)}
									className="flex-1 h-14 rounded-pill border border-hairline text-muted font-semibold hover:bg-raised hover:text-primary transition-colors cursor-pointer font-sans text-sm"
									type="button"
								>
									Back
								</button>
								<button
									onClick={handleCreateProfile}
									disabled={loading}
									className="flex-2 bg-brand text-brand-on h-14 cursor-pointer py-3.5 px-6 rounded-pill flex items-center justify-center gap-2 hover:bg-brand-active transition-colors active:scale-[0.98] font-sans text-sm font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
									type="button"
								>
									{loading ? (
										<div className="w-5 h-5 border-2 border-brand-on/30 border-t-brand-on rounded-full animate-spin" />
									) : (
										<span>Create Profile</span>
									)}
								</button>
							</div>
						</div>
					)}

					{/* STEP 3: FOLLOW */}
					{step === 3 && (
						<div className="space-y-8 w-full animate-rise">
							<div className="space-y-2">
								<h1 className="font-display text-2xl font-semibold text-primary">
									Follow people
								</h1>
								<p className="text-muted text-sm font-sans">
									Build your community.
								</p>
							</div>

							<div className="space-y-4">
								{loadingSuggestions
									? Array.from({ length: 3 }).map((_, i) => (
											<div
												key={i}
												className="flex items-center justify-between p-3 rounded-lg bg-sunken border border-hairline"
											>
												<div className="flex items-center gap-3">
													<div className="w-10 h-10 rounded-full skeleton" />
													<div className="space-y-2">
														<div className="h-3 w-24 skeleton rounded-sm" />
														<div className="h-2 w-16 skeleton rounded-sm" />
													</div>
												</div>
												<div className="h-8 w-20 skeleton rounded-pill" />
											</div>
										))
									: suggestedUsers.map((user) => (
											<div
												key={user._id}
												className="flex items-center justify-between p-3 rounded-lg bg-sunken border border-hairline hover:bg-raised transition-colors"
											>
												<div className="flex items-center gap-3 min-w-0">
													<div className="relative w-10 h-10 shrink-0 rounded-full overflow-hidden border border-hairline">
														<Image
															src={user.avatar || DEFAULT_AVATAR}
															alt={user.username}
															fill
															className="object-cover"
														/>
													</div>
													<div className="text-left min-w-0">
														<p className="font-semibold text-primary text-sm font-sans truncate">
															{user.firstName}
														</p>
														<p className="text-xs text-muted font-sans truncate">
															@{user.username}
														</p>
													</div>
												</div>
												<button
													onClick={() => handleFollow(user._id)}
													className={clsx(
														"shrink-0 px-4 h-10 rounded-pill text-xs font-semibold border transition-colors font-sans cursor-pointer",
														followedUsers.includes(user._id)
															? "bg-primary text-page border-transparent"
															: "bg-transparent text-primary border-hairline hover:border-primary",
													)}
													type="button"
												>
													{followedUsers.includes(user._id)
														? "Following"
														: "Follow"}
												</button>
											</div>
										))}
							</div>

							<button
								onClick={finishOnboarding}
								className="group w-full bg-brand text-brand-on h-14 cursor-pointer py-3.5 px-6 rounded-pill flex items-center justify-center gap-2 hover:bg-brand-active transition-colors active:scale-[0.98] font-sans text-sm font-semibold"
								type="button"
							>
								<span>Go to your feed</span>
								<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
