import clsx from "clsx";

/**
 * The animated brand lockup: the W draws itself, floods gold, and the
 * wordmark walks in beside it — the same 5.2s ritual the hub plays in its
 * sidebar (components/system/SidebarBrand), so the mark reads as one brand
 * across the ecosystem. The keyframes live in globals.css
 * (`.ws-brand-mark` / `.ws-brand-word`).
 *
 * The geometry is the hub's exact polygon pair, not the wsa-mark PNG: the
 * draw-on effect needs real paths to stroke.
 *
 * Two shapes, both animated on the same track:
 *  - inline (mobile top bar) — mark + "WorldStreet."
 *  - stacked (desktop rail)  — mark + "WorldStreet" over a gold eyebrow,
 *    which is the ratified ecosystem lockup (04-components → TopNav).
 */
export function BrandRitual({
	size = 22,
	wordSize = 14,
	eyebrow,
	className,
}: {
	size?: number;
	wordSize?: number;
	/** Renders the stacked lockup with this word as the gold eyebrow. */
	eyebrow?: string;
	className?: string;
}) {
	return (
		<span
			className={clsx("inline-flex items-center gap-2 min-w-0", className)}
		>
			<svg
				className="ws-brand-mark"
				style={{ width: size }}
				viewBox="0 0 435.32 245.73"
				xmlns="http://www.w3.org/2000/svg"
				aria-hidden="true"
				focusable="false"
			>
				<polygon
					pathLength={1}
					points="0,0 159.68,0 217.66,102.5 139.01,245.73"
				/>
				<polygon
					pathLength={1}
					points="435.32,0 275.64,0 217.66,102.5 296.32,245.73"
				/>
			</svg>

			{eyebrow ? (
				// One animated wrapper so the name and the eyebrow walk in
				// together rather than on two out-of-step tracks.
				<span className="ws-brand-word flex flex-col leading-tight min-w-0">
					<span
						className="font-display font-semibold text-primary tracking-tight truncate"
						style={{ fontSize: wordSize }}
					>
						WorldStreet
					</span>
					<span className="font-sans text-[10px] font-semibold uppercase tracking-[2px] text-gold">
						{eyebrow}
					</span>
				</span>
			) : (
				<span
					className="ws-brand-word font-display font-bold tracking-tight text-primary"
					style={{ fontSize: wordSize }}
				>
					WorldStreet<i>.</i>
				</span>
			)}
		</span>
	);
}
