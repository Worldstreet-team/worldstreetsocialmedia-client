"use client";

import {
	ArrowsClockwise,
	BookmarkSimple,
	ChatCircle,
	ChatTeardrop,
	ChartLineUp,
	Export,
	Heart,
	PaperPlaneTilt,
	Repeat,
	ShareFat,
} from "@phosphor-icons/react";
import clsx from "clsx";

/**
 * A scratch surface for picking the post action-row style.
 *
 * Renders the REAL Phosphor components at every candidate weight and glyph
 * choice, on the real tokens, at the real sizes — so what gets picked is
 * exactly what ships. Deleted once a choice is made.
 */

type Row = {
	name: string;
	note: string;
	weight: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
	size: number;
	glyphs?: "alt";
};

const OPTIONS: Row[] = [
	{ name: "A — Duotone", note: "shipped now; filled body, darker outline", weight: "duotone", size: 18 },
	{ name: "B — Regular", note: "thin even stroke, most air (X / Threads)", weight: "regular", size: 19 },
	{ name: "C — Light", note: "lighter still; quiet, almost hairline", weight: "light", size: 20 },
	{ name: "D — Bold", note: "heavy stroke, reads loud at a glance", weight: "bold", size: 18 },
	{ name: "E — Fill", note: "solid glyphs; the most 'app' of the set", weight: "fill", size: 17 },
	{ name: "F — Regular, alt glyphs", note: "teardrop bubble, circular repost, fat share", weight: "regular", size: 19, glyphs: "alt" },
];

function ActionRow({ weight, size, glyphs }: Row) {
	const Chat = glyphs === "alt" ? ChatTeardrop : ChatCircle;
	const Boost = glyphs === "alt" ? ArrowsClockwise : Repeat;
	const Share = glyphs === "alt" ? ShareFat : PaperPlaneTilt;
	const items = [
		{ Icon: Chat, count: "12", tint: "hover:text-primary" },
		{ Icon: Boost, count: "4", tint: "hover:text-success" },
		{ Icon: Heart, count: "128", tint: "hover:text-danger" },
		{ Icon: BookmarkSimple, count: "", tint: "hover:text-gold" },
		{ Icon: Share, count: "", tint: "hover:text-primary" },
	];
	return (
		<div className="flex items-center justify-between text-muted">
			<div className="flex max-w-[425px] flex-1 items-center justify-between -ml-2">
				{items.map(({ Icon, count, tint }, i) => (
					<button
						// biome-ignore lint/suspicious/noArrayIndexKey: static demo row
						key={i}
						type="button"
						className={clsx(
							"flex h-10 min-w-10 cursor-pointer items-center gap-1.5 rounded-pill px-2 transition-colors",
							tint,
						)}
					>
						<Icon size={size} weight={weight} />
						{count && (
							<span className="font-sans text-[13px] tabular-nums">{count}</span>
						)}
					</button>
				))}
			</div>
			<span className="hidden items-center gap-1.5 sm:flex">
				<ChartLineUp size={15} weight={weight} />
				<span className="font-sans text-[13px] tabular-nums">2.4K</span>
			</span>
		</div>
	);
}

export default function IconLab() {
	return (
		<div className="mx-auto max-w-[600px] px-4 py-8">
			<h1 className="font-display text-[22px] font-semibold text-primary">
				Action row — pick a style
			</h1>
			<p className="mt-1 font-sans text-[13px] text-muted">
				Real glyphs, real tokens, real sizes. Active states use fill in every
				option, so a liked heart looks the same either way.
			</p>
			<div className="mt-6 flex flex-col gap-3">
				{OPTIONS.map((o) => (
					<section key={o.name} className="rounded-xl bg-surface p-4">
						<div className="mb-3">
							<span className="font-sans text-[13.5px] font-semibold text-primary">
								{o.name}
							</span>
							<span className="ml-2 font-sans text-[12px] text-subtle">
								{o.note}
							</span>
						</div>
						<ActionRow {...o} />
					</section>
				))}
			</div>
		</div>
	);
}
