"use client";

import type { ReactNode } from "react";
import {
	ArtCanvas,
	Badge,
	Bar,
	Card,
	Clock,
	Dot,
	Enter,
	Figure,
	Ground,
	Idle,
	Lens,
	Mic,
	motion,
	offset,
	paint,
} from "@/components/ui/art/primitives";
import { cn } from "@/lib/utils";

/**
 * Space Voice's empty-state drawings, composed from the house art kit
 * (components/ui/art), the way Xtream draws its own (owner 2026-10-14:
 * "the svg morphs aren't looking nice for the empty states ... check how
 * the xtream did theirs"). The first version bent the Signal's one wire
 * into each symbol; at 200px it read as a scribble. These are objects you
 * recognise, standing on the kit's disc, each with one accent, one
 * entrance and one slow idle; still under reduced motion, paused off
 * screen.
 *
 * A new `kind` replays the entrance (the scene is keyed), which is the
 * change people notice: a search that finds nothing, then a filter cleared.
 */

export const SPACE_EMPTY_KINDS = ["live", "upcoming", "search", "offline"] as const;
export type SpaceEmptyKind = (typeof SPACE_EMPTY_KINDS)[number];

/** Nobody live: a studio mic waiting to go on air, its sound arcs reaching out, two seats waiting for people. */
function Live() {
	/* Arcs either side of the capsule's middle (120, 54), 50 degrees of a circle each. */
	const arc = (r: number, side: 1 | -1) => {
		const x = 120 + side * r * 0.906;
		return `M${x} ${54 - r * 0.423}A${r} ${r} 0 0 ${side === 1 ? 1 : 0} ${x} ${54 + r * 0.423}`;
	};
	return (
		<>
			<Enter kind="fade" delay={300}>
				{([1, -1] as const).map((side) => (
					<g key={side}>
						<path
							className={cn(paint.line, motion.search)}
							style={{ strokeWidth: 2.5 }}
							d={arc(34, side)}
						/>
						<path
							className={cn(paint.soft, motion.search)}
							style={{ strokeWidth: 2.5, ...offset(0.4) }}
							d={arc(45, side)}
						/>
					</g>
				))}
			</Enter>
			<Enter>
				<Idle kind="float">
					<Mic cx={120} top={30} />
				</Idle>
			</Enter>
			<Enter kind="pop" delay={420}>
				<Card x={148} y={26} w={40} h={16} r={8} />
				<Dot cx={157} cy={34} r={3} paint="live" className={motion.blink} />
				<Bar x={163} y={32.25} w={17} h={3.5} />
			</Enter>
			{[
				{ cx: 64, t: 0.8, d: 120 },
				{ cx: 176, t: 2.4, d: 200 },
			].map((seat) => (
				<Enter key={seat.cx} delay={seat.d}>
					<Idle kind="float" offset={seat.t}>
						<Figure cx={seat.cx} cy={108} r={14} ring="dashed" />
						<Bar x={seat.cx - 9} y={128} w={18} h={4} />
					</Idle>
				</Enter>
			))}
		</>
	);
}

/** Nothing scheduled: a week with one day ringed in the brand colour, and a clock that keeps going. */
function Upcoming() {
	const cols = [76, 94, 112, 130, 148];
	const rows = [82, 102, 122];
	return (
		<>
			<Enter>
				<Card x={56} y={40} w={112} h={100} />
				<path className={paint.soft} d="M57 64h110" />
				<Card x={80} y={33} w={6} h={14} r={3} paint="card2" />
				<Card x={138} y={33} w={6} h={14} r={3} paint="card2" />
				<Bar x={68} y={50} w={34} h={5} />
				{rows.map((y) =>
					cols.map((x) =>
						x === 130 && y === 102 ? null : (
							<Dot key={`${x}-${y}`} cx={x} cy={y} r={3} paint="bar" />
						),
					),
				)}
			</Enter>
			<Enter kind="pop" delay={420}>
				<Idle kind="breathe">
					<circle className={paint.accentLine} cx={130} cy={102} r={10} />
				</Idle>
				<Dot cx={130} cy={102} r={4} paint="accent" />
			</Enter>
			<Enter kind="pop" delay={260}>
				<Clock cx={172} cy={128} />
			</Enter>
		</>
	);
}

/** No matches: empty room rows, and a lens that looks around and finds nothing. */
function Search() {
	return (
		<>
			{[0, 1, 2].map((k) => (
				<Enter key={k} delay={k * 70}>
					<Card x={48} y={44 + k * 30} w={112} h={22} r={9} paint="soft" dashed />
					<Card x={56} y={49 + k * 30} w={12} h={12} r={4} paint="bar" />
					<Bar x={74} y={53 + k * 30} w={k === 1 ? 36 : 50} h={4} />
				</Enter>
			))}
			<Enter kind="pop" delay={260}>
				<Idle kind="seek">
					<Lens cx={160} cy={100} />
				</Idle>
			</Enter>
		</>
	);
}

/** Couldn't load: the signal looks for a way through, the far arc broken. */
function Offline() {
	const arc = { strokeWidth: 5 };
	return (
		<>
			<Enter>
				<path
					className={paint.line}
					style={{ ...arc, strokeDasharray: "7 10" }}
					d="M83.2 81.2a52 52 0 0 1 73.5 0"
				/>
				<path
					className={cn(paint.line, motion.search)}
					style={{ ...arc, ...offset(0.3) }}
					d="M94.5 92.5a36 36 0 0 1 50.9 0"
				/>
				<path
					className={cn(paint.line, motion.search)}
					style={arc}
					d="M105.9 103.9a20 20 0 0 1 28.3 0"
				/>
				<Dot cx={120} cy={118} r={5.5} />
			</Enter>
			<Enter kind="pop" delay={380}>
				<Idle kind="breathe">
					<Badge cx={162} cy={124} r={13} glyph="alert" />
				</Idle>
			</Enter>
		</>
	);
}

const DRAW = {
	live: Live,
	upcoming: Upcoming,
	search: Search,
	offline: Offline,
} satisfies Record<SpaceEmptyKind, () => ReactNode>;

/** One drawing. Decorative: the empty state's title says what it means. */
export function SpaceEmptyArt({ kind, className }: { kind: SpaceEmptyKind; className?: string }) {
	const Draw = DRAW[kind] ?? Live;
	return (
		<ArtCanvas className={cn("w-full", className)}>
			<Ground key={`ground-${kind}`} />
			<g key={kind}>
				<Draw />
			</g>
		</ArtCanvas>
	);
}
