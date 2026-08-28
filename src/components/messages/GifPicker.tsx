"use client";

import { AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import {
	OverlayHeader,
	OverlayPanel,
	OverlayScrim,
	useOverlayDismiss,
} from "@/components/ui/Overlay";

/**
 * GIFs, via GIPHY's free tier.
 *
 * Gated on `NEXT_PUBLIC_GIPHY_KEY`: with no key the entry point simply does
 * not render, because a picker that opens and then apologises is worse than
 * no picker. The key is a public client key by design (GIPHY rate-limits per
 * key) — putting it in NEXT_PUBLIC is how their web SDK works too.
 *
 * A picked GIF is sent as a plain image message whose mediaUrl is GIPHY's
 * CDN URL — no upload, no new message type, nothing for the gateway to learn.
 */
export const GIPHY_KEY = process.env.NEXT_PUBLIC_GIPHY_KEY ?? "";

interface Gif {
	id: string;
	preview: string;
	full: string;
	alt: string;
}

export function GifPicker({
	open,
	onClose,
	onPick,
}: {
	open: boolean;
	onClose: () => void;
	onPick: (url: string) => void;
}) {
	const [query, setQuery] = useState("");
	const [gifs, setGifs] = useState<Gif[]>([]);
	const [loading, setLoading] = useState(false);
	const abortRef = useRef<AbortController | null>(null);

	useOverlayDismiss(open, onClose);

	useEffect(() => {
		if (!open || !GIPHY_KEY) return;
		abortRef.current?.abort();
		const ac = new AbortController();
		abortRef.current = ac;
		setLoading(true);
		const q = query.trim();
		const url = q
			? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=pg-13`
			: `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=24&rating=pg-13`;
		const id = window.setTimeout(async () => {
			try {
				const res = await fetch(url, { signal: ac.signal });
				const body = await res.json();
				if (ac.signal.aborted) return;
				setGifs(
					(body?.data ?? []).map((g: any) => ({
						id: g.id,
						preview: g.images?.fixed_width_small?.url ?? g.images?.fixed_width?.url,
						full: g.images?.original?.url ?? g.images?.fixed_width?.url,
						alt: g.title ?? "GIF",
					})),
				);
			} catch {
				/* aborted or offline — the grid just stays as it was */
			} finally {
				if (!ac.signal.aborted) setLoading(false);
			}
		}, 300);
		return () => {
			window.clearTimeout(id);
			ac.abort();
		};
	}, [open, query]);

	if (!GIPHY_KEY) return null;

	return (
		<AnimatePresence>
			{open && (
				<>
					<OverlayScrim onClose={onClose} dim={false} />
					<OverlayPanel variant="anchored" label="GIFs">
						<OverlayHeader onClose={onClose}>
							<input
								// biome-ignore lint/a11y/noAutofocus: search is the whole point of opening it
								autoFocus
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Search GIPHY"
								className="min-w-0 flex-1 bg-transparent font-sans text-[14px] text-primary outline-none placeholder:text-subtle"
							/>
						</OverlayHeader>
						<div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
							{loading && gifs.length === 0 ? (
								<div className="grid grid-cols-3 gap-1.5">
									{[...Array(9)].map((_, i) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
										<span key={i} className="skeleton aspect-square rounded-[7px]" />
									))}
								</div>
							) : (
								<div className="grid grid-cols-3 gap-1.5">
									{gifs.map((g) => (
										<button
											key={g.id}
											type="button"
											onClick={() => {
												onPick(g.full);
												onClose();
											}}
											className="aspect-square cursor-pointer overflow-hidden rounded-[7px] bg-sunken transition-opacity hover:opacity-85"
										>
											{/* eslint-disable-next-line @next/next/no-img-element */}
											<img
												src={g.preview}
												alt={g.alt}
												loading="lazy"
												className="h-full w-full object-cover"
											/>
										</button>
									))}
								</div>
							)}
						</div>
					</OverlayPanel>
				</>
			)}
		</AnimatePresence>
	);
}
