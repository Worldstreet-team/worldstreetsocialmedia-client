"use client";

/**
 * The hinged ballot box.
 *
 * Not a glyph swap: the lid flaps are separate strokes hinged at the rim
 * corners, and `open` swings them ~125° outward around those hinges (CSS
 * transform with a px-anchored origin — SVG rotates around exact points).
 * When a vote lands the chip also drops a little ballot through the mouth
 * (`ballotKey` retriggers the fall). Everything is transform/opacity, so
 * reduced-motion stills it globally.
 *
 * Geometry is front-view carton in the Lucide grid (24 box, stroke 2,
 * round caps) so it sits beside the real icon set without looking foreign.
 */
export function VoteBox({
	open,
	ballotKey = 0,
	size = 17,
	className,
}: {
	open: boolean;
	/** Bump to drop a ballot through the mouth (0 = never dropped). */
	ballotKey?: number;
	size?: number;
	className?: string;
}) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden
		>
			{ballotKey > 0 && (
				<g key={ballotKey} className="ws-ballot">
					<rect
						x="9.2"
						y="1.5"
						width="5.6"
						height="3.6"
						rx="1"
						strokeWidth="1.7"
					/>
				</g>
			)}
			<path d="M4 10 v9.2 l7.4 2.1 q0.6 0.17 1.2 0 L20 19.2 V10" />
			<path d="M12 12.6 V21.4" strokeWidth="1.6" opacity="0.55" />
			<path d="M4 10 L12 12.6 L20 10" strokeWidth="1.7" />
			<g
				style={{
					transform: open ? "rotate(-125deg)" : "rotate(-6deg)",
					transformOrigin: "4px 10px",
					transition: "transform 300ms var(--ws-ease)",
				}}
			>
				<path d="M4 10 L11.2 9.4" />
			</g>
			<g
				style={{
					transform: open ? "rotate(125deg)" : "rotate(6deg)",
					transformOrigin: "20px 10px",
					transition: "transform 300ms var(--ws-ease)",
				}}
			>
				<path d="M20 10 L12.8 9.4" />
			</g>
		</svg>
	);
}
