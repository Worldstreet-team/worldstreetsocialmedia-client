"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import clsx from "clsx";
import { AVATARS, INTERESTS } from "@/data/onboarding";
import { followUserAction, getWhoToFollowAction } from "@/lib/user.actions";
import axios from "axios";
import { BACKEND_URL } from "@/const";
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
		avatar: AVATARS[0],
		interests: [] as string[],
	});

	useEffect(() => {
		if (initialUser) {
			setFormData((prev) => ({
				...prev,
				id: initialUser?.id || "",
				avatar: initialUser?.avatar || "",
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
				console.log("ONBOARDED: ", res.data);
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
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			<div className="w-full max-w-md bg-zinc-900 rounded-3xl p-8 shadow-2xl border border-zinc-800 relative overflow-hidden">
				{/* Decorative background blur */}
				<div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

				<div className="relative z-10 flex flex-col items-center text-center space-y-8">
					{/* Progress Indicator */}
					<div className="flex gap-2 mb-4">
						{[1, 2, 3].map((s) => (
							<div
								key={s}
								className={clsx(
									"h-1.5 rounded-full transition-all duration-300",
									step >= s ? "w-8 bg-yellow-500" : "w-2 bg-zinc-800",
								)}
							/>
						))}
					</div>

					{/* STEP 1: IDENTITY */}
					{step === 1 && (
						<div className="space-y-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
							<div className="space-y-2">
								<h1 className="text-3xl font-black text-white font-space-mono">
									Who are you?
								</h1>
								<p className="text-zinc-400 text-sm font-space-mono tracking-tight">
									Choose an avatar and set up your identity.
								</p>
							</div>

							<div className="flex gap-4 justify-center">
								{AVATARS.map((avatar: string, index) => (
									<button
										key={index}
										onClick={() => setFormData({ ...formData, avatar })}
										className={clsx(
											"relative w-20 h-20 rounded-full overflow-hidden transition-all duration-300 border-dotted border-3 cursor-pointer",
											formData.avatar === avatar
												? "border-yellow-500 scale-110 shadow-[0_0_20px_rgba(234,179,8,0.3)]"
												: "border-transparent opacity-60 hover:opacity-100 hover:scale-105",
										)}
										type="button"
									>
										<Image
											src={avatar}
											alt={`Avatar ${index + 1}`}
											fill
											className="object-cover"
										/>
									</button>
								))}
							</div>

							<div className="w-full space-y-6">
								<div className="space-y-2 text-left">
									<label
										htmlFor="username"
										className="font-space-mono text-xs font-bold tracking-wider text-zinc-500 uppercase ml-1"
									>
										Username
									</label>
									<div className="relative">
										<span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium font-space-mono">
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
											className="w-full bg-white text-zinc-900 rounded-full py-3 h-14 pl-8 pr-4 font-medium focus:outline-none placeholder:text-zinc-300 font-space-mono text-base"
										/>
									</div>
								</div>

								<div className="space-y-2 text-left">
									<label
										htmlFor="bio"
										className="font-space-mono text-xs font-bold tracking-wider text-zinc-500 uppercase ml-1"
									>
										Bio
									</label>
									<textarea
										id="bio"
										value={bio}
										onChange={(e) => setBio(e.target.value)}
										placeholder="Frontend wizard. Pixel perfectionist. Coffee addict ☕"
										rows={3}
										className="w-full bg-zinc-800/50 text-white rounded-2xl p-3.5 font-medium focus:outline-none focus:ring-2 focus:ring-yellow-500/50 placeholder:text-zinc-500 resize-none border border-zinc-700/50 font-space-mono text-sm"
										style={{
											boxShadow: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.3)",
										}}
									/>
								</div>
							</div>

							<button
								onClick={handleContinue}
								className="group relative w-full bg-white text-black h-14 cursor-pointer py-3.5 px-6 rounded-full flex items-center justify-center gap-2 hover:bg-zinc-100 transition-all active:scale-[0.98] font-space-mono text-sm tracking-tight font-bold"
								style={{
									boxShadow: "0 0 0 2px #eab308",
								}}
								type="button"
							>
								<span className="absolute inset-x-0 bottom-0 h-full rounded-full bg-yellow-500 translate-y-1 -z-10 group-hover:translate-y-1.5 transition-transform" />
								<span>Continue</span>
								<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
							</button>
						</div>
					)}

					{/* STEP 2: INTERESTS */}
					{step === 2 && (
						<div className="space-y-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
							<div className="space-y-2">
								<h1 className="text-3xl font-black text-white font-space-mono">
									What are you into?
								</h1>
								<p className="text-zinc-400 text-sm font-space-mono tracking-tight">
									Select topics to personalize your feed.
								</p>
							</div>

							<div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
								{INTERESTS.map((interest) => (
									<button
										key={interest}
										onClick={() => toggleInterest(interest)}
										className={clsx(
											"px-4 py-3 rounded-xl font-bold text-xs transition-all duration-300 border font-space-mono cursor-pointer",
											formData.interests.includes(interest)
												? "bg-white text-black border-yellow-500 shadow-[2px_2px_0px_#eab308]"
												: "bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:bg-zinc-800 hover:border-zinc-600",
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
									className="flex-1 py-3.5 rounded-full bg-zinc-800 text-zinc-400 font-bold hover:bg-zinc-700 transition-all cursor-pointer font-space-mono text-sm"
								>
									Back
								</button>
								<button
									onClick={handleCreateProfile}
									disabled={loading}
									className="flex-2 group relative bg-white text-black h-14 cursor-pointer py-3.5 px-6 rounded-full flex items-center justify-center gap-2 hover:bg-zinc-100 transition-all active:scale-[0.98] font-space-mono text-sm tracking-tight font-bold disabled:opacity-70 disabled:cursor-not-allowed"
									style={{
										boxShadow: "0 0 0 2px #eab308",
									}}
									type="button"
								>
									<span className="absolute inset-x-0 bottom-0 h-full rounded-full bg-yellow-500 translate-y-1 -z-10 group-hover:translate-y-1.5 transition-transform" />
									{loading ? (
										<div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
									) : (
										<span>Create Profile</span>
									)}
								</button>
							</div>
						</div>
					)}

					{/* STEP 3: FOLLOW */}
					{step === 3 && (
						<div className="space-y-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
							<div className="space-y-2">
								<h1 className="text-3xl font-black text-white font-space-mono">
									Follow People
								</h1>
								<p className="text-zinc-400 text-sm font-space-mono tracking-tight">
									Build your community.
								</p>
							</div>

							<div className="space-y-4">
								{loadingSuggestions
									? Array.from({ length: 3 }).map((_, i) => (
											<div
												key={i}
												className="flex items-center justify-between p-3 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 animate-pulse"
											>
												<div className="flex items-center gap-3">
													<div className="w-10 h-10 rounded-full bg-zinc-700" />
													<div className="space-y-2">
														<div className="h-3 w-24 bg-zinc-700 rounded" />
														<div className="h-2 w-16 bg-zinc-700 rounded" />
													</div>
												</div>
												<div className="h-8 w-20 bg-zinc-700 rounded-full" />
											</div>
										))
									: suggestedUsers.map((user) => (
											<div
												key={user._id}
												className="flex items-center justify-between p-3 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800 transition-all"
											>
												<div className="flex items-center gap-3">
													<div className="relative w-10 h-10 rounded-full overflow-hidden border border-zinc-600">
														<Image
															src={user.avatar || AVATARS[0]}
															alt={user.username}
															fill
															className="object-cover"
														/>
													</div>
													<div className="text-left">
														<p className="font-bold text-white text-sm font-space-mono">
															{user.firstName}
														</p>
														<p className="text-xs text-zinc-500 font-space-mono">
															@{user.username}
														</p>
													</div>
												</div>
												<button
													onClick={() => handleFollow(user._id)}
													className={clsx(
														"px-4 py-1.5 rounded-full text-xs font-bold border transition-all font-space-mono cursor-pointer",
														followedUsers.includes(user._id)
															? "bg-white text-black border-white"
															: "bg-transparent text-white border-zinc-600 hover:border-yellow-500 hover:text-yellow-500",
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
								className="group relative w-full bg-white text-black h-14 cursor-pointer py-3.5 px-6 rounded-full flex items-center justify-center gap-2 hover:bg-zinc-100 transition-all active:scale-[0.98] font-space-mono text-sm tracking-tight font-bold"
								style={{
									boxShadow: "0 0 0 2px #eab308",
								}}
								type="button"
							>
								<span className="absolute inset-x-0 bottom-0 h-full rounded-full bg-yellow-500 translate-y-1 -z-10 group-hover:translate-y-1.5 transition-transform" />
								<span>All Done! 🚀</span>
								<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
