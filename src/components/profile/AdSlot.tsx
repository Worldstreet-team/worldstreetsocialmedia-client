"use client";

import { useAuth } from "@clerk/nextjs";
import axios from "axios";
import clsx from "clsx";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	ArrowUpRight,
	ImageSquare,
	Megaphone,
	Pause,
	Play,
	SpeakerHigh,
	VideoCamera,
} from "@phosphor-icons/react";
import { BACKEND_URL } from "@/const";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { getSubscriptionAction } from "@/lib/subscription.actions";

/**
 * The profile ad slot — the space where Topics sits, sold by Gold creators.
 *
 * Three states, and only one is ever visible:
 *  - a LIVE campaign: the creative, always under a Sponsored label the
 *    advertiser cannot style away (FTC: paid placement must read as paid at
 *    a glance). The profile owner gets a quiet End control — takedown is
 *    the creator's right on their own page, and it settles pro-rata.
 *  - the OWNER with selling rights and no campaign: a ghost card inviting
 *    them to set rates. Invisible to everyone else — a profile never shows
 *    an empty advertising hole.
 *  - anyone else, no campaign: nothing. Topics render as they always did.
 *
 * Reads and writes go browser → gateway directly (the post-audit pattern);
 * the one server action here is the entitlement read, which is cached
 * app-side already.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || BACKEND_URL;

interface SlotCampaign {
	_id: string;
	format: "image" | "video" | "audio";
	creative: { url?: string; linkUrl?: string; coverUrl?: string };
	startAt: string;
	endAt: string;
	impressions?: number;
	clicks?: number;
	advertiser?: { username?: string; firstName?: string; lastName?: string };
}

interface RateRow {
	format: "image" | "video" | "audio";
	priceUsdMinor: number;
	enabled: boolean;
	/** Shortest run this creator will take — the volume valve: price/day ×
	 *  minDays is the real floor on how small an offer can be. */
	minDays: number;
}

export function AdSlot({
	profileId,
	username,
	isMe,
}: {
	profileId: string;
	username: string;
	isMe: boolean;
}) {
	const { getToken } = useAuth();
	const { toast } = useToast();
	const [slots, setSlots] = useState<SlotCampaign[]>([]);
	/** Which campaign the carousel is showing. Advances on a timer — the
	 *  rotation is deliberately not user-controllable (admin ruling): every
	 *  paying advertiser gets their turn, and nobody can park it. */
	const [slotIndex, setSlotIndex] = useState(0);
	const [canSell, setCanSell] = useState(false);
	const [ratesOpen, setRatesOpen] = useState(false);
	const [confirmEnd, setConfirmEnd] = useState(false);

	const authed = useCallback(
		async (method: "get" | "post" | "put", path: string, body?: unknown) => {
			const token = await getToken();
			const res = await axios.request({
				method,
				url: `${API_URL}${path}`,
				data: body,
				headers: { Authorization: `Bearer ${token}` },
			});
			return res.data;
		},
		[getToken],
	);

	useEffect(() => {
		if (!profileId) return;
		let cancelled = false;
		void authed("get", `/api/ads/slot/${profileId}`)
			.then((d) => {
				if (cancelled) return;
				setSlots(d.slots ?? (d.slot ? [d.slot] : []));
				setSlotIndex(0);
			})
			.catch(() => {
				/* no slot is the quiet default */
			});
		return () => {
			cancelled = true;
		};
	}, [profileId, authed]);

	// A visitor with no campaign on screen still deserves to KNOW the space
	// is for sale — this is the discovery the marketplace was missing: the
	// creator published rates and the other account saw nothing anywhere.
	const [publicRates, setPublicRates] = useState<RateRow[]>([]);
	useEffect(() => {
		if (isMe || !username) return;
		let cancelled = false;
		void authed("get", `/api/ads/rates/${encodeURIComponent(username)}`)
			.then((d) => {
				if (!cancelled) setPublicRates(d.rates ?? []);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [isMe, username, authed]);

	// Selling rights are only worth asking about on your own profile.
	useEffect(() => {
		if (!isMe) return;
		let cancelled = false;
		void getSubscriptionAction()
			.then((res: any) => {
				if (!cancelled && res?.success) {
					setCanSell(Boolean(res.data?.entitlements?.canSellAdSpace));
				}
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [isMe]);

	// The rotation clock. 7s per creative: long enough to read a banner,
	// short enough that three campaigns all serve within one profile visit.
	useEffect(() => {
		if (slots.length < 2) return;
		const t = setInterval(
			() => setSlotIndex((i) => (i + 1) % slots.length),
			7000,
		);
		return () => clearInterval(t);
	}, [slots.length]);

	const endCampaign = async () => {
		const slot = slots[slotIndex];
		if (!slot) return;
		try {
			await authed("post", `/api/ads/bookings/${slot._id}/cancel`);
			setSlots((prev) => prev.filter((s) => s._id !== slot._id));
			setSlotIndex(0);
			toast("Campaign ended — served days settle, the rest is returned", {
				type: "success",
			});
		} catch (err: any) {
			toast(err?.response?.data?.message ?? "Could not end the campaign", {
				type: "error",
			});
		}
	};

	const current = slots[slotIndex % Math.max(1, slots.length)];
	if (current) {
		return (
			<>
				{/* Keyed by campaign: each rotation remounts the card through the
				    house rise — a clean hand-off, not a slideshow of controls. */}
				<div key={current._id} className="animate-rise">
					<SponsoredCard
						slot={current}
						isOwner={isMe}
						onEnd={() => setConfirmEnd(true)}
						onVisit={() =>
							void authed(
								"post",
								`/api/ads/slot/${current._id}/click`,
							).catch(() => {})
						}
					/>
					{slots.length > 1 && (
						<div
							aria-hidden
							className="mt-1.5 flex justify-center gap-1.5"
						>
							{slots.map((s, i) => (
								<span
									key={s._id}
									className={clsx(
										"h-1 w-1 rounded-pill transition-colors",
										i === slotIndex % slots.length
											? "bg-gold"
											: "bg-raised",
									)}
								/>
							))}
						</div>
					)}
				</div>
				<ConfirmModal
					isOpen={confirmEnd}
					onClose={() => setConfirmEnd(false)}
					onConfirm={() => {
						setConfirmEnd(false);
						void endCampaign();
					}}
					title="End this campaign?"
					message="Days already served are settled and paid out; the advertiser gets the rest back. This can't be undone."
					confirmText="End campaign"
					isDestructive
				/>
			</>
		);
	}

	if (isMe && canSell) {
		return (
			<>
				<button
					type="button"
					onClick={() => setRatesOpen(true)}
					className="group/slot relative mt-2 flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-xl px-4 py-3.5 text-left"
				>
					{/* The onboarding backdrop, blurred into a ground — the same
					    image that welcomed them, now underneath the thing their
					    membership unlocked. Scaled past the edges so the blur
					    never shows a hard border. Theme-aware via the same
					    arbitrary variant WelcomeTour uses. */}
					<span
						aria-hidden
						className="absolute inset-0 scale-110 bg-[url('/images/onboarding/backdrop-dark.webp')] bg-cover bg-center blur-[5px] [[data-ws-theme='platform-light']_&]:bg-[url('/images/onboarding/backdrop-light.webp')]"
					/>
					{/* Legibility wash: the image is atmosphere, the words are the
					    point. */}
					<span aria-hidden className="absolute inset-0 bg-page/70" />
					{/* The shine — a diagonal gloss that sweeps across on hover.
					    Transform-only, token ease, slow tier. */}
					<span
						aria-hidden
						className="absolute inset-y-0 left-0 w-1/2 -translate-x-full bg-gradient-to-r from-transparent via-gold/15 to-transparent transition-transform duration-[320ms] group-hover/slot:translate-x-[220%]"
					/>
					<span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-gold/15 text-gold">
						<Megaphone size={16} weight="fill" />
					</span>
					<span className="relative min-w-0 flex-1">
						<span className="block font-sans text-[13.5px] font-semibold text-primary">
							Your ad space
						</span>
						<span className="block font-sans text-[12px] text-muted">
							Set your rates and let advertisers book this spot
						</span>
					</span>
					<span className="relative shrink-0 rounded-pill bg-gold/15 px-3 py-1.5 font-sans text-[12px] font-semibold text-gold">
						Set rates
					</span>
				</button>
				<AnimatePresence>
					{ratesOpen && (
						<RatesSheet
							username={username}
							authed={authed}
							onClose={() => setRatesOpen(false)}
						/>
					)}
				</AnimatePresence>
			</>
		);
	}

	if (!isMe && publicRates.length > 0) {
		const from = Math.min(...publicRates.map((r) => r.priceUsdMinor));
		return (
			<Link
				href={`/bm?book=${encodeURIComponent(username)}`}
				className="group/slot relative mt-2 flex w-full items-center gap-3 overflow-hidden rounded-xl px-4 py-3.5"
			>
				{/* Same ground as the owner's card — the space should look like
				    the same product from both sides of the counter. */}
				<span
					aria-hidden
					className="absolute inset-0 scale-110 bg-[url('/images/onboarding/backdrop-dark.webp')] bg-cover bg-center blur-[5px] [[data-ws-theme='platform-light']_&]:bg-[url('/images/onboarding/backdrop-light.webp')]"
				/>
				<span aria-hidden className="absolute inset-0 bg-page/70" />
				<span
					aria-hidden
					className="absolute inset-y-0 left-0 w-1/2 -translate-x-full bg-gradient-to-r from-transparent via-gold/15 to-transparent transition-transform duration-[320ms] group-hover/slot:translate-x-[220%]"
				/>
				<span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-gold/15 text-gold">
					<Megaphone size={16} weight="fill" />
				</span>
				<span className="relative min-w-0 flex-1">
					<span className="block font-sans text-[13.5px] font-semibold text-primary">
						Ad space available
					</span>
					<span className="block font-sans text-[12px] text-muted tabular-nums">
						from ${(from / 100).toFixed(0)}/day ·{" "}
						{publicRates.map((r) => r.format).join(" · ")}
					</span>
				</span>
				<span className="relative shrink-0 rounded-pill bg-primary px-3.5 py-1.5 font-sans text-[12.5px] font-semibold text-page">
					Book
				</span>
			</Link>
		);
	}

	return null;
}

/* ── the served creative ────────────────────────────────────────── */

function SponsoredCard({
	slot,
	isOwner,
	onEnd,
	onVisit,
}: {
	slot: SlotCampaign;
	isOwner: boolean;
	onEnd: () => void;
	onVisit: () => void;
}) {
	const who =
		slot.advertiser?.firstName || slot.advertiser?.username || "an advertiser";

	return (
		<div className="mt-2">
			<div className="mb-2 flex items-center gap-2">
				{/* The label is part of the slot, not the creative — it cannot be
				    designed away, which is the entire point of it. */}
				<h3 className="flex-1 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
					Sponsored
					{slot.advertiser?.username && (
						<>
							{" · "}
							<Link
								href={`/profile/${slot.advertiser.username}`}
								className="normal-case tracking-normal text-muted hover:text-primary hover:underline"
							>
								@{slot.advertiser.username}
							</Link>
						</>
					)}
				</h3>
				{isOwner && (
					<>
						<span className="shrink-0 font-sans text-[11px] text-subtle tabular-nums">
							{(slot.impressions ?? 0).toLocaleString()} views ·{" "}
							{(slot.clicks ?? 0).toLocaleString()} clicks
						</span>
						<button
							type="button"
							onClick={onEnd}
							className="shrink-0 cursor-pointer font-sans text-[11px] font-semibold text-danger hover:underline"
						>
							End
						</button>
					</>
				)}
			</div>

			<div className="overflow-hidden rounded-xl bg-sunken">
				<CreativeMedia slot={slot} />
				{slot.creative.linkUrl && (
					<div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
						<span className="min-w-0 truncate font-sans text-[12.5px] text-muted">
							{who} ·{" "}
							<span className="text-subtle">
								{safeHost(slot.creative.linkUrl)}
							</span>
						</span>
						<a
							href={slot.creative.linkUrl}
							onClick={onVisit}
							target="_blank"
							// `sponsored` is the honest rel for paid placement; noopener
							// because the destination is someone else's site.
							rel="sponsored noopener noreferrer"
							className="flex h-8 shrink-0 items-center gap-1 rounded-pill bg-primary px-3.5 font-sans text-[12.5px] font-semibold text-page transition-colors hover:opacity-90"
						>
							Visit
							<ArrowUpRight size={13} weight="bold" />
						</a>
					</div>
				)}
			</div>
		</div>
	);
}

/**
 * The creative exactly as the profile will serve it — Sponsored label, media
 * chrome, Visit row — with nothing interactive behind it. The booking sheet
 * shows this before the request is sent, so what the advertiser previews,
 * the creator approves, and the profile renders are one and the same thing.
 */
export function AdSlotPreview({
	format,
	creative,
	advertiserUsername,
}: {
	format: "image" | "video" | "audio";
	creative: { url?: string; linkUrl?: string; coverUrl?: string };
	advertiserUsername?: string;
}) {
	return (
		<div>
			<div className="mb-2 flex items-center gap-2">
				<h3 className="flex-1 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
					Sponsored
					{advertiserUsername && (
						<span className="normal-case tracking-normal text-muted">
							{" · @"}
							{advertiserUsername}
						</span>
					)}
				</h3>
			</div>
			<div className="overflow-hidden rounded-xl bg-sunken">
				<CreativeMedia
					slot={{ _id: "preview", format, creative, startAt: "", endAt: "" }}
				/>
				{creative.linkUrl && (
					<div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
						<span className="min-w-0 truncate font-sans text-[12.5px] text-subtle">
							{safeHost(creative.linkUrl)}
						</span>
						<span className="flex h-8 shrink-0 items-center gap-1 rounded-pill bg-primary px-3.5 font-sans text-[12.5px] font-semibold text-page">
							Visit
							<ArrowUpRight size={13} weight="bold" />
						</span>
					</div>
				)}
			</div>
		</div>
	);
}

function safeHost(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return "";
	}
}

function CreativeMedia({ slot }: { slot: SlotCampaign }) {
	const { format, creative } = slot;

	if (format === "video" && creative.url) {
		return (
			// Muted until the reader chooses otherwise — an ad never gets to
			// make sound uninvited.
			// biome-ignore lint/a11y/useMediaCaption: advertiser-supplied media
			<video
				src={creative.url}
				poster={creative.coverUrl}
				controls
				muted
				playsInline
				preload="metadata"
				className="max-h-[240px] w-full bg-black object-contain"
			/>
		);
	}

	if (format === "audio" && creative.url) {
		return <AudioBanner creative={creative} />;
	}

	if (creative.url) {
		return (
			// eslint-disable-next-line @next/next/no-img-element
			<img
				src={creative.url}
				alt="Sponsored"
				className="max-h-[220px] w-full object-cover"
			/>
		);
	}

	// A live booking with no creative yet: hold the label, show nothing loud.
	return (
		<div className="flex h-20 items-center justify-center font-sans text-[12.5px] text-subtle">
			Creative pending
		</div>
	);
}

/** Audio rides a banner: the cover is the visual, one control plays it. */
function AudioBanner({
	creative,
}: {
	creative: { url?: string; coverUrl?: string };
}) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const [playing, setPlaying] = useState(false);

	const toggle = () => {
		const el = audioRef.current;
		if (!el) return;
		if (playing) el.pause();
		else void el.play().catch(() => {});
	};

	return (
		<div className="relative h-[132px] w-full overflow-hidden">
			{creative.coverUrl ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={creative.coverUrl}
					alt=""
					className="absolute inset-0 h-full w-full object-cover"
				/>
			) : (
				<div className="absolute inset-0 flex items-center justify-center bg-raised">
					<SpeakerHigh size={28} className="text-subtle" />
				</div>
			)}
			<button
				type="button"
				onClick={toggle}
				aria-label={playing ? "Pause ad audio" : "Play ad audio"}
				className="absolute bottom-3 left-3 flex h-11 w-11 cursor-pointer items-center justify-center rounded-pill bg-page/85 text-primary transition-colors hover:bg-page"
			>
				{playing ? (
					<Pause size={17} weight="fill" />
				) : (
					<Play size={17} weight="fill" className="translate-x-[1px]" />
				)}
			</button>
			<audio
				ref={audioRef}
				src={creative.url}
				preload="none"
				onPlay={() => setPlaying(true)}
				onPause={() => setPlaying(false)}
				onEnded={() => setPlaying(false)}
			/>
		</div>
	);
}

/* ── the rate card editor ───────────────────────────────────────── */

const FORMAT_META: Record<
	RateRow["format"],
	{ label: string; hint: string; Icon: typeof ImageSquare }
> = {
	image: {
		label: "Image",
		hint: "A banner with a tap-through link",
		Icon: ImageSquare,
	},
	video: {
		label: "Video",
		hint: "Muted until played, never autoplays sound",
		Icon: VideoCamera,
	},
	audio: {
		label: "Audio",
		hint: "A banner with a play control",
		Icon: SpeakerHigh,
	},
};

/** The one switch. `left-0` is the fix: without an inline offset an absolute
 *  knob keeps its static position, which made the thumb sit wherever the
 *  browser felt like and the toggle read as broken. */
function Switch({
	on,
	label,
	onToggle,
}: {
	on: boolean;
	label: string;
	onToggle: () => void;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={on}
			aria-label={label}
			onClick={onToggle}
			className={clsx(
				"relative h-7 w-12 shrink-0 cursor-pointer rounded-pill transition-colors",
				on ? "bg-gold" : "bg-chip",
			)}
		>
			<span
				className={clsx(
					"absolute left-0 top-1 h-5 w-5 rounded-pill bg-page shadow-nav transition-transform",
					on ? "translate-x-[26px]" : "translate-x-1",
				)}
			/>
		</button>
	);
}

function RatesSheet({
	username,
	authed,
	onClose,
}: {
	username: string;
	authed: (m: "get" | "post" | "put", p: string, b?: unknown) => Promise<any>;
	onClose: () => void;
}) {
	const { toast } = useToast();
	useOverlayDismiss(true, onClose);

	const [rows, setRows] = useState<RateRow[]>([
		{ format: "image", priceUsdMinor: 2000, enabled: true, minDays: 1 },
		{ format: "video", priceUsdMinor: 3500, enabled: false, minDays: 1 },
		{ format: "audio", priceUsdMinor: 2500, enabled: false, minDays: 1 },
	]);
	const [saving, setSaving] = useState(false);
	/**
	 * What is IN the field, as text. Clamping inside onChange is why the
	 * field was stuck at $1: clearing it parsed to NaN, the clamp snapped it
	 * to the minimum, and the keystroke was eaten. While editing, anything
	 * goes — validation happens once, at save, where an error can actually
	 * be explained.
	 */
	const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});

	// Prefill from what is already published.
	useEffect(() => {
		void authed("get", `/api/ads/rates/${encodeURIComponent(username)}`)
			.then((d) => {
				const current: any[] = d.rates ?? [];
				if (current.length === 0) return;
				setRows((prev) =>
					prev.map((row) => {
						const hit = current.find((c) => c.format === row.format);
						// The owner's read includes switched-off rows now, so a
						// reopened editor remembers a disabled format's price
						// instead of forgetting it ever had one.
						return hit
							? {
									...row,
									priceUsdMinor: hit.priceUsdMinor,
									enabled: hit.enabled !== false,
									minDays: hit.minDays ?? 1,
								}
							: { ...row, enabled: false };
					}),
				);
			})
			.catch(() => {});
	}, [authed, username]);

	const save = async () => {
		if (saving) return;
		// The one place a price is judged: an enabled format whose field is
		// empty or zero blocks the save with a message naming it, instead of
		// being silently rewritten under the seller's cursor.
		for (const row of rows) {
			if (!row.enabled) continue;
			const draft = priceDrafts[row.format];
			const n = draft !== undefined ? Number(draft) : row.priceUsdMinor / 100;
			if (!Number.isFinite(n) || n < 1) {
				toast(`Set a daily price for ${FORMAT_META[row.format].label} (min $1)`, {
					type: "error",
				});
				return;
			}
		}
		setSaving(true);
		try {
			await authed(
				"put",
				"/api/ads/rates",
				rows.map((r) => ({
					format: r.format,
					priceUsdMinor: r.priceUsdMinor,
					enabled: r.enabled,
					minDays: Math.max(1, r.minDays),
				})),
			);
			toast("Rates published", { type: "success" });
			onClose();
		} catch (err: any) {
			toast(err?.response?.data?.message ?? "Could not save your rates", {
				type: "error",
			});
		} finally {
			setSaving(false);
		}
	};

	const update = (format: RateRow["format"], patch: Partial<RateRow>) =>
		setRows((prev) =>
			prev.map((r) => (r.format === format ? { ...r, ...patch } : r)),
		);

	return (
		<>
			<OverlayScrim onClose={onClose} />
			<OverlayPanel variant="sheet" label="Your ad rates">
				<OverlayHeader title="Your ad space" onClose={onClose} />
				<div className="flex flex-col gap-3 overflow-y-auto px-5 pb-5">
					<p className="font-sans text-[13px] leading-relaxed text-muted">
						Advertisers book by the day at your price. Money sits in escrow
						and you're paid every few days as the campaign runs — 60% of every
						settlement is yours.
					</p>

					{rows.map((row) => {
						const meta = FORMAT_META[row.format];
						const Icon = meta.Icon;
						return (
							<div
								key={row.format}
								className={clsx(
									"overflow-hidden rounded-xl transition-colors",
									row.enabled ? "bg-raised" : "bg-surface/60 opacity-75",
								)}
							>
								<div className="flex items-center gap-3 px-4 py-3">
									<span
										className={clsx(
											"flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
											row.enabled
												? "bg-gold/15 text-gold"
												: "bg-raised text-subtle",
										)}
									>
										<Icon size={18} weight={row.enabled ? "fill" : "regular"} />
									</span>
									<div className="min-w-0 flex-1">
										<p className="font-sans text-[14px] font-semibold text-primary">
											{meta.label}
										</p>
										<p className="truncate font-sans text-[12px] text-subtle">
											{meta.hint}
										</p>
									</div>
									<Switch
										on={row.enabled}
										label={`Sell ${meta.label.toLowerCase()} ads`}
										onToggle={() =>
											update(row.format, { enabled: !row.enabled })
										}
									/>
								</div>
								{row.enabled && (
									<div className="flex items-center justify-between gap-3 border-t border-hairline/60 bg-sunken/60 px-4 py-2.5">
										<label className="flex items-baseline gap-1.5">
											<span className="font-display text-[20px] font-semibold text-primary tabular-nums">
												$
												<input
													type="text"
													inputMode="decimal"
													placeholder="20"
													value={
														priceDrafts[row.format] ??
														(row.priceUsdMinor / 100).toString()
													}
													onChange={(e) => {
														// digits and one dot; everything else
														// never enters the field
														const clean = e.target.value
															.replace(/[^0-9.]/g, "")
															.replace(/(\..*)\./g, "$1");
														setPriceDrafts((prev) => ({
															...prev,
															[row.format]: clean,
														}));
														const n = Number(clean);
														if (Number.isFinite(n) && n > 0) {
															update(row.format, {
																priceUsdMinor: Math.round(n * 100),
															});
														}
													}}
													className="w-20 bg-transparent font-display text-[20px] font-semibold text-primary outline-none tabular-nums placeholder:text-subtle"
												/>
											</span>
											<span className="font-sans text-[12px] text-muted">
												/ day
											</span>
										</label>
										{/* the volume valve: nobody can book below this */}
										<label className="flex items-center gap-1.5 font-sans text-[11.5px] text-subtle">
											min run
											<input
												type="text"
												inputMode="numeric"
												// 0 is the "field is empty" sentinel, so the
												// value can actually be cleared while typing —
												// clamping keystrokes is the stuck-at-$1 bug
												// all over again. Save treats 0 as 1.
												value={row.minDays === 0 ? "" : String(row.minDays)}
												onChange={(e) => {
													const n = Number(
														e.target.value.replace(/[^0-9]/g, "") || 0,
													);
													update(row.format, {
														minDays: Math.min(30, n),
													});
												}}
												className="h-8 w-10 rounded-lg bg-page/60 text-center font-sans text-[13px] text-primary outline-none tabular-nums transition-colors focus:bg-page"
											/>
											d
										</label>
										<span className="text-right font-sans text-[11.5px] leading-tight text-subtle tabular-nums">
											floor $
											{(
												(row.priceUsdMinor * Math.max(1, row.minDays)) /
												100
											).toFixed(0)}
											<br />
											<span className="text-gold">
												you keep $
												{(
													(row.priceUsdMinor *
														Math.max(1, row.minDays) *
														0.6) /
													100
												).toFixed(0)}
											</span>
										</span>
									</div>
								)}
							</div>
						);
					})}

					<button
						type="button"
						disabled={saving || rows.every((r) => !r.enabled)}
						onClick={save}
						className="mt-1 h-11 shrink-0 cursor-pointer rounded-pill bg-brand font-sans text-[14px] font-semibold text-brand-on transition-colors hover:opacity-90 disabled:opacity-50"
					>
						{saving ? "Publishing…" : "Publish rates"}
					</button>
				</div>
			</OverlayPanel>
		</>
	);
}
