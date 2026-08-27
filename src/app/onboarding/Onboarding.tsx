"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import {
	Broadcast,
	Camera,
	Faders,
	Microphone,
	MonitorPlay,
	UsersThree,
} from "@phosphor-icons/react";
import Image from "next/image";
import clsx from "clsx";
import { REGIONS, MIN_INTERESTS, MAX_INTERESTS } from "@/data/categories";
import { InterestPicker } from "@/components/onboarding/InterestPicker";
import { BrandRitual } from "@/components/layout/BrandRitual";
import {
	checkUsernameAction,
	followUserAction,
	getWhoToFollowAction,
} from "@/lib/user.actions";
import { USERNAME_RE } from "@/lib/username";
import axios from "axios";
import { BACKEND_URL, DEFAULT_AVATAR } from "@/const";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { useSetAtom } from "jotai";
import { userAtom } from "@/store/user.atom";

const TOTAL_STEPS = 5;

/* What the tour announces. Order is deliberate: the surfaces someone can
   consume come before the ones that ask them to create. */
const WHATS_NEW = [
	{
		icon: MonitorPlay,
		title: "The Space",
		blurb: "A full-screen video feed. Swipe it like a reel, not a timeline.",
	},
	{
		icon: Microphone,
		title: "Space Voice",
		blurb: "Live audio rooms — drop in, listen, or ask for the mic.",
	},
	{
		icon: UsersThree,
		title: "Communities",
		blurb: "Rooms around one subject, with their own feed.",
	},
	{
		icon: Camera,
		title: "Stories",
		blurb: "24-hour posts, with a studio for text, photo and voice.",
	},
	{
		icon: Broadcast,
		title: "Go live",
		blurb: "Broadcast straight from the app; replays land on your profile.",
	},
	{
		icon: Faders,
		title: "Studio",
		blurb: "Your numbers: posts, reach and what's actually landing.",
	},
];

export default function Onboarding({ initialUser }: { initialUser: any }) {
	const { getToken } = useAuth();
	const [step, setStep] = useState(1);
	const [username, setUsername] = useState("");
	const [bio, setBio] = useState("");
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	/**
	 * Handle availability, resolved as they type. `idle` before they have typed
	 * anything legal — an empty field is not an error, it is just empty.
	 */
	const [handleState, setHandleState] = useState<
		"idle" | "checking" | "ok" | "taken" | "invalid"
	>("idle");
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
		// Ids, never labels: both are permanent algorithm keys the ranking
		// service stores against. Region is a SEPARATE axis from interests —
		// a post is `football-soccer` + `africa`, never "African football".
		region: "worldwide",
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
			if (step === TOTAL_STEPS) {
				setLoadingSuggestions(true);
				try {
					const res = await getWhoToFollowAction();
					if (res.success && Array.isArray(res.data)) {
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

	// Debounced: 400ms after they stop typing, not per keystroke. The response
	// is discarded if the field moved on while it was in flight, so a slow
	// answer for "sara" can never label "sarah_codes" as taken.
	useEffect(() => {
		const handle = username.replace(/^@+/, "");
		if (!handle) {
			setHandleState("idle");
			return;
		}
		if (!USERNAME_RE.test(handle)) {
			setHandleState("invalid");
			return;
		}
		setHandleState("checking");
		let cancelled = false;
		const timer = setTimeout(async () => {
			const res = await checkUsernameAction(handle);
			if (cancelled) return;
			setHandleState(
				res.reason === "taken"
					? "taken"
					: res.reason === "invalid"
						? "invalid"
						: "ok",
			);
		}, 400);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [username]);

	const toggleInterest = (id: string) => {
		setFormData((prev) => ({
			...prev,
			interests: prev.interests.includes(id)
				? prev.interests.filter((i) => i !== id)
				: prev.interests.length >= MAX_INTERESTS
					? prev.interests
					: [...prev.interests, id],
		}));
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

			setStep(4); // → what's new
		} catch (err: any) {
			// A 401 used to hit an empty branch (the retry was commented out), so
			// an expired token showed NOTHING: no toast, no message, loading off,
			// and a Continue button that did nothing forever. Every failure now
			// says something, and a stale session says what to do about it.
			const status = err.response?.status;
			const errorMsg =
				status === 401
					? "Your session expired. Refresh the page and try again."
					: status === 409
						? "That username was just taken. Go back and pick another."
						: err.response?.data?.message ||
							err.message ||
							"Failed to create profile";
			setError(errorMsg);
			toast(errorMsg, { type: "error" });
			// Send them back to the field that is actually wrong.
			if (status === 409) setStep(1);
		} finally {
			setLoading(false);
		}
	};

	const handleFollow = async (userId: string) => {
		const isFollowing = followedUsers.includes(userId);

		if (isFollowing) {
			setFollowedUsers((prev) => prev.filter((id) => id !== userId));
			toast("Unfollowed user", { type: "info", position: "bottom-left" });
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
			if (!USERNAME_RE.test(username)) {
				toast("Username must be 3-20 letters, numbers or underscores", {
					type: "error",
				});
				return;
			}
			if (handleState === "taken") {
				toast("That username is taken", { type: "error" });
				return;
			}
			const cleanedUsername = username.replace(/^@+/, "");
			setFormData((prev) => ({ ...prev, username: cleanedUsername, bio }));
			setStep(2);
		}
	};

	const primaryBtn =
		"group w-full bg-brand text-brand-on h-14 cursor-pointer py-3.5 px-6 rounded-pill flex items-center justify-center gap-2 hover:bg-brand-active transition-colors active:scale-[0.98] font-sans text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed";
	const backBtn =
		"glass-tile flex-1 h-14 rounded-pill text-muted font-semibold hover:text-primary transition-colors cursor-pointer font-sans text-sm";

	return (
		// ambient-field gives the glass something to refract; over a flat page
		// colour a blurred pane is just a grey box.
		<div className="min-h-dvh ambient-field flex items-center justify-center p-4 py-8">
			<div className="w-full max-w-md glass-card backdrop-blur-2xl backdrop-saturate-150 rounded-xl p-6 sm:p-8 relative overflow-hidden animate-rise">
				<div className="relative z-10 flex flex-col items-center text-center space-y-8">
					<BrandRitual size={34} wordSize={18} />

					{/* Progress */}
					<div className="flex gap-2" aria-hidden="true">
						{Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
							<div
								key={s}
								className={clsx(
									"h-1.5 rounded-pill transition-[width,background-color]",
									step >= s ? "w-7 bg-brand" : "w-2 bg-raised",
								)}
							/>
						))}
					</div>

					{/* The error was stored and never rendered — every failure relied
					    on a toast, which is exactly the wrong surface for a blocked
					    submit: it disappears, and it can be missed entirely. This
					    stays until the next attempt. */}
					{error && (
						<p
							role="alert"
							className="w-full rounded-lg bg-danger/10 px-4 py-3 text-left font-sans text-[13px] text-danger"
						>
							{error}
						</p>
					)}

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
												if (/^[a-zA-Z0-9_]*$/.test(val)) setUsername(val);
											}}
											placeholder="sarah_codes"
											aria-describedby="username-status"
											aria-invalid={
												handleState === "taken" || handleState === "invalid"
											}
											className="glass-tile w-full text-primary rounded-pill py-3 h-14 pl-8 pr-4 font-medium outline-none focus:ring-2 focus:ring-brand/40 placeholder:text-subtle font-sans text-base transition-colors"
										/>
									</div>
									{/* Says WHY Continue is disabled. aria-live because this is
									    the one field that can block the whole flow, and
									    min-h-4 so the card does not jump as it changes. */}
									<p
										id="username-status"
										aria-live="polite"
										className={clsx(
											"min-h-4 pl-4 font-sans text-[12px]",
											handleState === "taken" || handleState === "invalid"
												? "text-danger"
												: handleState === "ok"
													? "text-success"
													: "text-subtle",
										)}
									>
										{handleState === "checking" && "Checking…"}
										{handleState === "ok" && "Available"}
										{handleState === "taken" && "That username is taken"}
										{handleState === "invalid" &&
											"3-20 letters, numbers or underscores"}
									</p>
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
										className="glass-tile w-full text-primary rounded-lg p-3.5 font-medium outline-none focus:ring-2 focus:ring-brand/40 placeholder:text-subtle resize-none font-sans text-base sm:text-sm transition-colors"
									/>
								</div>
							</div>

							<button
								onClick={handleContinue}
								disabled={
									!username ||
									handleState === "taken" ||
									handleState === "invalid" ||
									handleState === "checking"
								}
								className={primaryBtn}
								type="button"
							>
								<span>Continue</span>
								<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
							</button>
						</div>
					)}

					{/* STEP 2: REGION */}
					{step === 2 && (
						<div className="space-y-8 w-full animate-rise">
							<div className="space-y-2">
								<h1 className="font-display text-2xl font-semibold text-primary">
									Where are you?
								</h1>
								<p className="text-muted text-sm font-sans">
									We surface what's happening near you. This is separate from
									your topics — you'll still see the world.
								</p>
							</div>

							<div className="grid grid-cols-2 gap-2 max-h-[min(360px,42dvh)] overflow-y-auto overscroll-contain pr-1">
								{REGIONS.map((r) => {
									const on = formData.region === r.id;
									return (
										<button
											key={r.id}
											type="button"
											onClick={() =>
												setFormData((prev) => ({ ...prev, region: r.id }))
											}
											aria-pressed={on}
											className={clsx(
												"min-h-12 px-3 rounded-lg font-sans text-[13px] font-semibold transition-colors cursor-pointer",
												on
													? "glass-tile glass-tile-on text-primary"
													: "glass-tile text-muted hover:text-primary",
											)}
										>
											{r.label}
										</button>
									);
								})}
							</div>

							<div className="flex gap-3">
								<button
									onClick={() => setStep(1)}
									className={backBtn}
									type="button"
								>
									Back
								</button>
								<button
									onClick={() => setStep(3)}
									className={clsx(primaryBtn, "flex-[2] w-auto")}
									type="button"
								>
									<span>Continue</span>
									<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
								</button>
							</div>
						</div>
					)}

					{/* STEP 3: INTERESTS */}
					{step === 3 && (
						<div className="space-y-6 w-full animate-rise">
							<div className="space-y-2">
								<h1 className="font-display text-2xl font-semibold text-primary">
									What are you into?
								</h1>
								<p className="text-muted text-sm font-sans">
									Pick at least {MIN_INTERESTS}. These tune your feed and you
									can change them any time.
								</p>
							</div>

							<InterestPicker
								selected={formData.interests}
								onToggle={toggleInterest}
							/>

							<p className="font-sans text-[12px] text-subtle tabular-nums">
								{formData.interests.length} / {MAX_INTERESTS} selected
							</p>

							<div className="flex gap-3">
								<button
									onClick={() => setStep(2)}
									className={backBtn}
									type="button"
								>
									Back
								</button>
								<button
									onClick={() => submitProfile()}
									disabled={
										loading || formData.interests.length < MIN_INTERESTS
									}
									className={clsx(primaryBtn, "flex-[2] w-auto")}
									type="button"
								>
									{loading ? (
										<div className="w-5 h-5 border-2 border-brand-on/30 border-t-brand-on rounded-full animate-spin" />
									) : (
										<span>Create profile</span>
									)}
								</button>
							</div>
						</div>
					)}

					{/* STEP 4: WHAT'S NEW */}
					{step === 4 && (
						<div className="space-y-6 w-full animate-rise">
							<div className="space-y-2">
								<h1 className="font-display text-2xl font-semibold text-primary">
									The Space has a new look
								</h1>
								<p className="text-muted text-sm font-sans">
									WorldStreet is more than a timeline now. Here's what's
									waiting for you.
								</p>
							</div>

							<div className="space-y-2 text-left max-h-[min(360px,42dvh)] overflow-y-auto overscroll-contain pr-1">
								{WHATS_NEW.map((f, i) => (
									<div
										key={f.title}
										className="glass-tile rounded-lg p-3 flex items-start gap-3 animate-rise"
										style={{ animationDelay: `${60 + i * 45}ms` }}
									>
										<span className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-brand/[0.13] text-gold">
											<f.icon size={18} weight="duotone" />
										</span>
										<div className="min-w-0">
											<p className="font-sans text-[14px] font-semibold text-primary">
												{f.title}
											</p>
											<p className="font-sans text-[12.5px] text-muted leading-snug">
												{f.blurb}
											</p>
										</div>
									</div>
								))}
							</div>

							<button
								onClick={() => setStep(5)}
								className={primaryBtn}
								type="button"
							>
								<span>Nice — who should I follow?</span>
								<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
							</button>
						</div>
					)}

					{/* STEP 5: FOLLOW */}
					{step === 5 && (
						<div className="space-y-8 w-full animate-rise">
							<div className="space-y-2">
								<h1 className="font-display text-2xl font-semibold text-primary">
									Follow people
								</h1>
								<p className="text-muted text-sm font-sans">
									Build your community.
								</p>
							</div>

							<div className="space-y-3">
								{loadingSuggestions
									? Array.from({ length: 3 }).map((_, i) => (
											<div
												key={i}
												className="glass-tile flex items-center justify-between p-3 rounded-lg"
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
												className="glass-tile flex items-center justify-between p-3 rounded-lg transition-colors"
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
														"shrink-0 px-4 h-10 rounded-pill text-xs font-semibold transition-colors font-sans cursor-pointer",
														followedUsers.includes(user._id)
															? "bg-primary text-page"
															: "glass-tile text-primary",
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
								className={primaryBtn}
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
