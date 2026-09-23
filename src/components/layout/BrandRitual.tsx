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
/*
 * The wordmark, as letterforms rather than a run of text (owner 2026-09-23:
 * "the worldspace text changes to svg the same way and animates the stroke
 * dash array first and fills each word with tight delay").
 *
 * It is SVG `<text>`, not converted paths: the glyphs stay Poppins, so the
 * wordmark cannot drift from the rest of the display type, and there are no
 * path data to re-cut when the face changes. Stroke properties apply to
 * `<tspan>`, so each letter carries its own dash, its own fill and its own
 * delay, which is what makes the word write itself left to right.
 *
 * The box comes from MEASURING Poppins 700 in the browser at 100px:
 * "WorldSpace." advances 657 units, with 74 above the baseline and 27 below.
 * `textLength` pins the run to that measurement, so the lockup keeps its
 * width through a font swap instead of reflowing the rail when Poppins
 * lands.
 */
const WORD_BOX = { w: 657, h: 101, baseline: 74, size: 100 } as const;

function BrandWord({ word, wordSize }: { word: string; wordSize: number }) {
	const letters = [...word, "."];
	// The svg is sized in the same units the HTML text used, so nothing
	// around it moves: height is the full em box, width follows the measure.
	const height = wordSize * (WORD_BOX.h / WORD_BOX.size);
	return (
		<svg
			className="ws-brand-letters"
			viewBox={`0 0 ${WORD_BOX.w} ${WORD_BOX.h}`}
			width={height * (WORD_BOX.w / WORD_BOX.h)}
			height={height}
			role="img"
			aria-label={`${word}.`}
		>
			<text
				x={0}
				y={WORD_BOX.baseline}
				textLength={WORD_BOX.w}
				lengthAdjust="spacing"
				fontSize={WORD_BOX.size}
				fontWeight={700}
				fontFamily="var(--ws-font-display)"
			>
				{letters.map((ch, i) => (
					<tspan
						// biome-ignore lint/suspicious/noArrayIndexKey: letters are positional
						key={i}
						// The delay rides the index, so the word writes itself
						// rather than every letter drawing at once.
						style={{ "--i": i } as React.CSSProperties}
						className={i === letters.length - 1 ? "ws-brand-dot" : undefined}
					>
						{ch}
					</tspan>
				))}
			</text>
		</svg>
	);
}

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
		<span className={clsx("inline-flex items-center min-w-0", className)}>
			{/* No mark at all (owner 2026-09-23: "remove the w in the worldspace
			    header"). The lockup is the word, animating on its own. The W
			    lives on as `BrandMark` for the places that need an icon: the
			    mobile bar's brand tab and the welcome card. */}
			{eyebrow ? (
				<span className="flex flex-col leading-tight min-w-0">
					<BrandWord word={word} wordSize={wordSize} />
					<span className="ws-brand-word font-sans text-[calc(10px*var(--ws-fs))] font-semibold uppercase tracking-[2px] text-gold">
						{eyebrow}
					</span>
				</span>
			) : (
				<BrandWord word={word} wordSize={wordSize} />
			)}
		</span>
	);
}
