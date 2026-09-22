import clsx from "clsx";
import Image from "next/image";

/**
 * The W on its own, drawing itself on the same 5.2s track as the full lockup.
 *
 * Split out so the mobile bar's brand tab is the SAME mark as the rail's,
 * rather than the flat wsa-mark PNG standing in for it — the PNG cannot be
 * stroked, so it can never draw on, and it does not follow the brand token
 * when the palette moves.
 */
export function BrandMark({
	size = 22,
	className,
}: {
	size?: number;
	className?: string;
}) {
	return (
		<svg
			className={clsx("ws-brand-mark", className)}
			style={{ width: size }}
			viewBox="0 0 435.32 245.73"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
			focusable="false"
		>
			<polygon pathLength={1} points="0,0 159.68,0 217.66,102.5 139.01,245.73" />
			<polygon
				pathLength={1}
				points="435.32,0 275.64,0 217.66,102.5 296.32,245.73"
			/>
		</svg>
	);
}

/**
 * The WorldSpace lockup: the helmet mark plus the wordmark walking in beside
 * it (`.ws-brand-word`, still on the 5.2s track from globals.css).
 *
 * The mark is the HELMET (2026-09-11; it replaced the cloud), not the bare
 * ecosystem W. They are two different brands: this app is WorldSpace and the
 * helmet is its logo (the W sits on its visor as a nod to the parent), while
 * the bare W belongs to WorldStreet — which is why the mobile bar's
 * WorldStreet tab still renders `BrandMark` and this does not. Mixing them
 * made the app look like it was called WorldStreet.
 *
 * The helmet does not draw itself the way the W does: it is raster artwork,
 * and there is nothing to stroke. The wordmark keeps its entrance.
 */
export function BrandRitual({
	size = 22,
	wordSize = 14,
	word = "WorldSpace",
	eyebrow,
	className,
}: {
	size?: number;
	wordSize?: number;
	/**
	 * The wordmark. This app is WorldSpace, one word. It used to be hardcoded
	 * to "WorldStreet" with the product as a gold eyebrow underneath, which
	 * read as "WorldStreet's Space" rather than as a product name.
	 */
	word?: string;
	/** Optional gold eyebrow under the wordmark. */
	eyebrow?: string;
	className?: string;
}) {
	return (
		<span
			className={clsx("inline-flex items-center gap-2 min-w-0", className)}
		>
			{/* The W, not the astronaut helmet (owner 2026-09-22: "remove the
			    worldstreet austronaut"). It is the same mark the mobile bar
			    already shows, it strokes itself on the lockup's own track, and
			    it follows the brand token when the palette moves, which the
			    two PNGs never could. */}
			<BrandMark size={size} className="shrink-0" />

			{eyebrow ? (
				// One animated wrapper so the name and the eyebrow walk in
				// together rather than on two out-of-step tracks.
				<span className="ws-brand-word flex flex-col leading-tight min-w-0">
					<span
						className="font-display font-semibold text-primary tracking-tight truncate"
						style={{ fontSize: wordSize }}
					>
						{word}
					</span>
					<span className="font-sans text-[calc(10px*var(--ws-fs))] font-semibold uppercase tracking-[2px] text-gold">
						{eyebrow}
					</span>
				</span>
			) : (
				<span
					className="ws-brand-word font-display font-bold tracking-tight text-primary"
					style={{ fontSize: wordSize }}
				>
					{word}
					<i>.</i>
				</span>
			)}
		</span>
	);
}
