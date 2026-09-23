import clsx from "clsx";
import { useId } from "react";
import { WORDMARK_BOX, WORDMARK_GLYPHS } from "./wordmark-glyphs";

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

/*
 * The wordmark writes itself (owner 2026-09-23: "the worldspace text changes
 * to svg ... animates the stroke dash array first and fills each word with
 * tight delay"), then grew a drop of brand ink at the pen tip the same day:
 * "the tip of the dash array will have the primary color and fades into the
 * actual stroke, but the tip of it just like a water drop".
 *
 * Real letterforms, not `<text>`: every contour of Poppins 700 is its own
 * path (wordmark-glyphs.ts, cut by scripts/wordmark-glyphs.py) with its own
 * measured length. The first cut dashed `<text>` with one 430-unit dash for
 * every glyph, and the W's outline is 546, so part of the W was already on
 * screen before the draw began: the jump at the start of every loop. Paths
 * also cannot swap font mid-draw, and a drop needs geometry to ride on.
 *
 * Each contour is drawn once in `<defs>` and reused per layer: the line, then
 * the fill (all of the letter's contours, evenodd), then the drop on top.
 * Last comes the glint, a slanted band of brand colour masked to the
 * letters. The keyframes, the timing and the reasoning live with the CSS in
 * globals.css (`.ws-wordmark`).
 */

// Dash units: every contour is measured in thousandths of itself, so the W
// and the full stop close in the same beat.
const PATH_LENGTH = 1000;

// The drop: [length behind the tip, stroke width, opacity] in wordmark units
// (font size 100; the line is 2.4). A bead, then ever narrower and fainter
// lengths behind it, so the brand ink tapers back into the line.
const DROP = [
	[0.25, 6.4, 1],
	[3, 6, 0.95],
	[7, 5.2, 0.8],
	[12, 4.3, 0.6],
	[18, 3.5, 0.42],
	[26, 2.9, 0.26],
	[36, 2.5, 0.14],
] as const;

// The glint: a band this wide, leaning this far (skewX, degrees), whose
// brand colour peaks in the middle and fades out to both edges.
const GLINT = {
	width: 190,
	skew: -20,
	stops: [
		[0, 0],
		[0.3, 0.5],
		[0.5, 1],
		[0.7, 0.5],
		[1, 0],
	],
} as const;

const fixed = (n: number) => n.toFixed(2).replace(/\.?0+$/, "");

function BrandWord({ wordSize }: { wordSize: number }) {
	// Ids for <use>; two lockups can share a page (the rail and a drawer).
	const uid = useId().replace(/[^\w-]/g, "");
	// Sized in the units the HTML text used, so nothing around it moves:
	// height is the word's ink height, width follows the advance.
	const height = wordSize * (WORDMARK_BOX.h / 100);
	let n = 0;
	const letters = WORDMARK_GLYPHS.map((glyph, i) => ({
		...glyph,
		id: `${uid}-wl${i}`,
		d: glyph.contours.map((c) => c.d).join(""),
		contours: glyph.contours.map((c) => ({ ...c, id: `${uid}-wm${n++}` })),
	}));
	return (
		<svg
			className="ws-wordmark"
			viewBox={`0 0 ${WORDMARK_BOX.w} ${WORDMARK_BOX.h}`}
			width={height * (WORDMARK_BOX.w / WORDMARK_BOX.h)}
			height={height}
			role="img"
			aria-label="WorldSpace"
		>
			<defs>
				{letters.flatMap((l) =>
					l.contours.map((c) => (
						<path key={c.id} id={c.id} d={c.d} pathLength={PATH_LENGTH} />
					)),
				)}
				{letters.map((l) => (
					<path key={l.id} id={l.id} d={l.d} fillRule="evenodd" />
				))}
				<linearGradient id={`${uid}-glint`} x1="0" x2="1" y1="0" y2="0">
					{GLINT.stops.map(([offset, alpha]) => (
						<stop
							key={offset}
							className="ws-wm-glint-stop"
							offset={offset}
							stopOpacity={alpha}
						/>
					))}
				</linearGradient>
				{/* The letters in white, outline included, so the glint shows
				    on the letterforms and nowhere else. */}
				<mask
					id={`${uid}-mask`}
					maskUnits="userSpaceOnUse"
					x={-10}
					y={-10}
					width={WORDMARK_BOX.w + 20}
					height={WORDMARK_BOX.h + 20}
				>
					{letters.map((l) => (
						<use
							key={l.id}
							href={`#${l.id}`}
							fill="#fff"
							stroke="#fff"
							strokeWidth={2.4}
							strokeLinejoin="round"
						/>
					))}
				</mask>
			</defs>
			{letters.map((l, i) => (
				<g
					// biome-ignore lint/suspicious/noArrayIndexKey: letters are positional
					key={i}
					// The delay rides the index, both ways round the loop.
					style={{ "--i": i } as React.CSSProperties}
					className={clsx("ws-wm-letter", l.ch === "." && "is-dot")}
				>
					{l.contours.map((c) => (
						<use key={c.id} href={`#${c.id}`} className="ws-wm-line" />
					))}
					<use href={`#${l.id}`} className="ws-wm-fill" />
					{l.contours.flatMap((c) =>
						DROP.map(([behind, width, alpha], j) => {
							// A short contour (a counter, the full stop) keeps its
							// drop under a third of its own length.
							const t = Math.min(300, (behind * PATH_LENGTH) / c.len);
							return (
								<use
									key={`${c.id}-${j}`}
									href={`#${c.id}`}
									className="ws-wm-drop"
									strokeWidth={width}
									strokeOpacity={alpha}
									// Visible for t right behind the tip, at the SAME
									// offset as the line: see globals.css.
									strokeDasharray={`0 ${fixed(PATH_LENGTH - t)} ${fixed(t)} 2000`}
								/>
							);
						}),
					)}
				</g>
			))}
			<g mask={`url(#${uid}-mask)`}>
				<g className="ws-wm-glint">
					<rect
						x={-GLINT.width / 2}
						y={-30}
						width={GLINT.width}
						height={WORDMARK_BOX.h + 60}
						transform={`skewX(${GLINT.skew})`}
						fill={`url(#${uid}-glint)`}
					/>
				</g>
			</g>
		</svg>
	);
}

/**
 * The WorldSpace lockup: the wordmark, writing itself, with an optional gold
 * eyebrow under it. The helmet (2026-09-22) and then the W (2026-09-23) were
 * taken out of it by the owner; the W lives on as `BrandMark`.
 *
 * The word is fixed: it is cut from Poppins as paths, so it spells
 * WorldSpace and nothing else. It used to take a `word` prop, from when it
 * was hardcoded to "WorldStreet" with the product as the eyebrow; nothing
 * passed one.
 */
export function BrandRitual({
	wordSize = 14,
	eyebrow,
	className,
}: {
	/** Unused since the mark left the lockup; kept so callers need not change. */
	size?: number;
	wordSize?: number;
	/** Optional gold eyebrow under the wordmark. */
	eyebrow?: string;
	className?: string;
}) {
	return (
		<span className={clsx("inline-flex items-center min-w-0", className)}>
			{/* No mark at all (owner 2026-09-23: "remove the w in the worldspace
			    header"). The lockup is the word, animating on its own. The W
			    lives on as `BrandMark` for the places that need an icon: the
			    mobile bar's brand tab and the welcome card. */}
			{eyebrow ? (
				<span className="flex flex-col leading-tight min-w-0">
					<BrandWord wordSize={wordSize} />
					<span className="ws-brand-word font-sans text-[calc(10px*var(--ws-fs))] font-semibold uppercase tracking-[2px] text-gold">
						{eyebrow}
					</span>
				</span>
			) : (
				<BrandWord wordSize={wordSize} />
			)}
		</span>
	);
}
