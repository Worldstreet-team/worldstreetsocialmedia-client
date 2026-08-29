"use client";

import axios from "axios";
import { useEffect, useState } from "react";
import { ArrowUpRight, X } from "@phosphor-icons/react";
import { BACKEND_URL } from "@/const";

const API_URL = process.env.NEXT_PUBLIC_API_URL || BACKEND_URL;

interface LiveSlot {
	_id: string;
	format: "image" | "video" | "audio";
	creative: { url?: string; linkUrl?: string; coverUrl?: string };
	advertiser?: { username?: string };
}

/**
 * The broadcaster's running profile campaign, carried onto their live
 * stream — YouTube's pattern: a quiet banner over the player, dismissible,
 * never blocking the stage. Serving here counts under source "live"
 * (impressions on fetch, clicks on Visit), so both parties can see which
 * surface actually earns.
 *
 * Fixed-dark glass on purpose: this sits over video, the one place that
 * family is sanctioned. Shows ~4s after the slide becomes active — a
 * banner that beats the stream to the screen reads as a takeover.
 */
export function LiveAdBanner({
	creatorProfileId,
	active,
}: {
	creatorProfileId?: string;
	active: boolean;
}) {
	const [slot, setSlot] = useState<LiveSlot | null>(null);
	const [shown, setShown] = useState(false);
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		if (!active || !creatorProfileId) return;
		let cancelled = false;
		const t = setTimeout(async () => {
			try {
				const token = await (window as any).Clerk?.session?.getToken();
				if (!token) return;
				// source=live: the gateway logs this serve against the live
				// surface (deduped per viewer-hour like every ad serve).
				const res = await axios.get(
					`${API_URL}/api/ads/slot/${creatorProfileId}?source=live`,
					{ headers: { Authorization: `Bearer ${token}` } },
				);
				const first = res.data?.slots?.[0] ?? null;
				if (!cancelled && first?.creative) {
					setSlot(first);
					setShown(true);
				}
			} catch {
				/* no campaign is the quiet default */
			}
		}, 4000);
		return () => {
			cancelled = true;
			clearTimeout(t);
		};
	}, [active, creatorProfileId]);

	// A new slide is a new audience: the dismissal is per broadcast.
	useEffect(() => {
		setDismissed(false);
		setShown(false);
		setSlot(null);
	}, [creatorProfileId]);

	if (!slot || !shown || dismissed) return null;

	const href = slot.creative.linkUrl;
	const thumb =
		slot.format === "image" ? slot.creative.url : slot.creative.coverUrl;

	const visit = () => {
		const token = (window as any).Clerk?.session?.getToken?.();
		void Promise.resolve(token).then((tok: string | null) => {
			if (!tok) return;
			void axios
				.post(
					`${API_URL}/api/ads/slot/${slot._id}/click`,
					{ source: "live" },
					{ headers: { Authorization: `Bearer ${tok}` } },
				)
				.catch(() => {});
		});
	};

	return (
		<div className="pointer-events-auto animate-rise absolute bottom-[132px] left-4 z-20 flex w-[290px] max-w-[calc(100%-96px)] items-center gap-2.5 rounded-xl glass-dock backdrop-blur-xl backdrop-saturate-150 p-2 pr-1.5">
			{thumb && (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={thumb}
					alt=""
					className="h-10 w-10 shrink-0 rounded-lg object-cover"
				/>
			)}
			<span className="min-w-0 flex-1">
				<span className="block font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
					Sponsored
				</span>
				<span className="block truncate font-sans text-[12.5px] font-medium text-white/90">
					@{slot.advertiser?.username ?? "advertiser"}
				</span>
			</span>
			{href && (
				<a
					href={href}
					onClick={visit}
					target="_blank"
					rel="sponsored noopener noreferrer"
					className="flex h-8 shrink-0 items-center gap-1 rounded-pill bg-white px-3 font-sans text-[12px] font-semibold text-black transition-colors hover:bg-white/85"
				>
					Visit
					<ArrowUpRight size={12} weight="bold" />
				</a>
			)}
			<button
				type="button"
				aria-label="Dismiss ad"
				onClick={() => setDismissed(true)}
				className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-pill text-white/60 transition-colors hover:text-white"
			>
				<X size={14} weight="bold" />
			</button>
		</div>
	);
}
