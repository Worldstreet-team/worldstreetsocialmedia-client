"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { getCreatorPostStatsAction } from "@/lib/creator.actions";
import { WindowSwitch, fmt } from "@/components/studio/studio-ui";
import {
	BarList,
	TrendChart,
	countryFlag,
	countryLabel,
} from "@/components/studio/charts";

interface Drill {
	post: { id: string; content: string; createdAt: string };
	stats: {
		windowDays: number;
		impressions: number;
		engagements: number;
		engagementRate: number;
		avgDwellMs: number;
		actions: Record<string, number>;
		daily: { date: string; impressions: number; engagements: number }[];
		surfaces: { surface: string; impressions: number }[];
		byCountry: { country: string; impressions: number }[];
	};
}

const ACTION_ORDER = ["like", "reply", "repost", "bookmark", "share_dm"];

/** Seconds → "3m 46s" — "225.9s" is a stopwatch reading, not a dwell time. */
function dwellLabel(ms: number) {
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	return `${Math.floor(s / 60)}m ${s % 60}s`;
}

/** The drilldown's four-up header tile: eyebrow + number, nothing else. */
function StatTileCell({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl bg-[#171614] px-5 py-4">
			<span className="glass-eyebrow font-sans">{label}</span>
			<span className="mt-2 block font-display text-[26px] font-semibold leading-none tracking-tight glass-ink tabular-nums">
				{value}
			</span>
		</div>
	);
}

/**
 * One post, opened up: totals, the daily series, every action, and which
 * surfaces the impressions came from. Hosted by the posts list as a modal
 * (a drilldown is "see more", not a destination) and by /studio/posts/[id]
 * for deep links — same view either way.
 *
 * `onTitle` hands the post's text up to whatever chrome is hosting this.
 */
export function PostStats({
	id,
	onTitle,
}: {
	id: string;
	onTitle?: (title: string) => void;
}) {
	const t = useT();
	const [data, setData] = useState<Drill | null>(null);
	const [days, setDays] = useState(28);
	const [loading, setLoading] = useState(true);

	const load = useCallback(
		async (windowDays: number) => {
			setLoading(true);
			const res = await getCreatorPostStatsAction(id, windowDays);
			if (res.success && res.stats) {
				setData({ post: res.post, stats: res.stats });
				onTitle?.(res.post?.content || "");
			}
			setLoading(false);
		},
		[id, onTitle],
	);

	useEffect(() => {
		void load(days);
	}, [days, load]);

	return (
		<div>
			<div className="mb-4 flex justify-end">
				<WindowSwitch value={days} onChange={setDays} />
			</div>

			{loading && !data ? (
				<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
					{[1, 2, 3, 4].map((i) => (
						<div
							key={i}
							className="h-[96px] animate-pulse rounded-2xl bg-[#fafaf9]/[0.04]"
						/>
					))}
				</div>
			) : data ? (
				<>
					<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
						<StatTileCell
							label={t("studio.impressions")}
							value={fmt(data.stats.impressions)}
						/>
						<StatTileCell
							label={t("studio.engagements")}
							value={fmt(data.stats.engagements)}
						/>
						<StatTileCell
							label={t("studio.engagementRate")}
							value={`${data.stats.engagementRate}%`}
						/>
						<StatTileCell
							label={t("studio.avgDwell")}
							value={dwellLabel(data.stats.avgDwellMs)}
						/>
					</div>

					<div className="mt-3 grid gap-3 md:grid-cols-2">
						<section className="rounded-2xl bg-[#171614] p-4">
							<h2 className="glass-eyebrow mb-4 font-sans">
								{t("studio.daily")}
							</h2>
							{data.stats.daily.length > 0 ? (
								<TrendChart
									daily={data.stats.daily}
									impressionsLabel={t("studio.impressions")}
									engagementsLabel={t("studio.engagements")}
								/>
							) : (
								<p className="py-8 text-center font-sans text-sm glass-ink-faint">
									{t("studio.noData")}
								</p>
							)}
						</section>

						<div className="flex flex-col gap-3">
							<section className="rounded-2xl bg-[#171614] p-4">
								<h2 className="glass-eyebrow mb-3 font-sans">
									{t("studio.byAction")}
								</h2>
								<div className="flex flex-col gap-2">
									{ACTION_ORDER.map((a) => (
										<div
											key={a}
											className="flex items-center justify-between font-sans text-[13.5px]"
										>
											<span className="glass-ink-dim capitalize">
												{t(`post.${a}` as string) !== `post.${a}`
													? t(`post.${a}`)
													: a.replace("_", " ")}
											</span>
											<span className="font-medium glass-ink tabular-nums">
												{fmt(data.stats.actions[a] ?? 0)}
											</span>
										</div>
									))}
								</div>
							</section>

							<section className="rounded-2xl bg-[#171614] p-4">
								<h2 className="glass-eyebrow mb-3 font-sans">
									{t("studio.bySurface")}
								</h2>
								{data.stats.surfaces.length === 0 ? (
									<p className="font-sans text-sm glass-ink-faint">
										{t("studio.noData")}
									</p>
								) : (
									<BarList
										items={data.stats.surfaces.map((s) => ({
											key: s.surface,
											label: s.surface.replace(/_/g, " "),
											value: s.impressions,
										}))}
									/>
								)}
							</section>

							<section className="rounded-2xl bg-[#171614] p-4">
								<h2 className="glass-eyebrow mb-3 font-sans">
									{t("studio.topCountries")}
								</h2>
								{data.stats.byCountry.length === 0 ? (
									<p className="font-sans text-sm glass-ink-faint">
										{t("studio.noData")}
									</p>
								) : (
									<BarList
										unknownLabel={t("studio.unknownCountry")}
										items={data.stats.byCountry.map((c) => ({
											key: c.country,
											label: countryLabel(c.country, t.locale),
											glyph: countryFlag(c.country),
											value: c.impressions,
										}))}
									/>
								)}
							</section>
						</div>
					</div>
				</>
			) : (
				<p className="py-10 text-center font-sans text-sm glass-ink-faint">
					{t("studio.noData")}
				</p>
			)}
		</div>
	);
}
