"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";
import { getCreatorPostStatsAction } from "@/lib/creator.actions";
import {
	StatTile,
	WindowSwitch,
	fmt,
} from "@/components/studio/studio-ui";
import {
	BarList,
	TrendChart,
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

/** One post, opened up: totals, the daily series, every action, and which
 *  surfaces the impressions came from. */
export default function StudioPostDrilldown({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
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
			}
			setLoading(false);
		},
		[id],
	);

	useEffect(() => {
		void load(days);
	}, [days, load]);

	return (
		<div>
			<div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
				<div className="flex items-center gap-2 min-w-0">
					<Link
						href="/studio/posts"
						aria-label={t("studio.back")}
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill text-muted hover:text-primary hover:bg-raised transition-colors"
					>
						<ArrowLeft size={16} />
					</Link>
					<h1 className="font-sans text-[15px] font-semibold text-primary truncate max-w-[48ch]">
						{data?.post.content || t("studio.mediaPost")}
					</h1>
				</div>
				<WindowSwitch value={days} onChange={setDays} />
			</div>

			{loading && !data ? (
				<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
					{[1, 2, 3, 4].map((i) => (
						<div key={i} className="rounded-xl h-[76px] skeleton" />
					))}
				</div>
			) : data ? (
				<>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
						<StatTile
							label={t("studio.impressions")}
							value={fmt(data.stats.impressions)}
						/>
						<StatTile
							label={t("studio.engagements")}
							value={fmt(data.stats.engagements)}
						/>
						<StatTile
							label={t("studio.engagementRate")}
							value={`${data.stats.engagementRate}%`}
						/>
						<StatTile
							label={t("studio.avgDwell")}
							value={`${(data.stats.avgDwellMs / 1000).toFixed(1)}s`}
						/>
					</div>

					<div className="grid md:grid-cols-2 gap-3 mt-3">
						<section className="rounded-xl border border-hairline bg-surface/60 p-3.5">
							<h2 className="font-sans text-[13px] font-semibold text-muted mb-4">
								{t("studio.daily")}
							</h2>
							{data.stats.daily.length > 0 ? (
								<TrendChart
									daily={data.stats.daily}
									impressionsLabel={t("studio.impressions")}
									engagementsLabel={t("studio.engagements")}
								/>
							) : (
								<p className="font-sans text-sm text-subtle py-8 text-center">
									{t("studio.noData")}
								</p>
							)}
						</section>

						<div className="flex flex-col gap-4">
							<section className="rounded-xl border border-hairline bg-surface/60 p-3.5">
								<h2 className="font-sans text-[13px] font-semibold text-muted mb-3">
									{t("studio.byAction")}
								</h2>
								<div className="flex flex-col gap-2">
									{ACTION_ORDER.map((a) => (
										<div
											key={a}
											className="flex items-center justify-between font-sans text-[13.5px]"
										>
											<span className="text-muted capitalize">
												{t(`post.${a}` as string) !== `post.${a}`
													? t(`post.${a}`)
													: a.replace("_", " ")}
											</span>
											<span className="text-primary tabular-nums font-medium">
												{fmt(data.stats.actions[a] ?? 0)}
											</span>
										</div>
									))}
								</div>
							</section>

							<section className="rounded-xl border border-hairline bg-surface/60 p-3.5">
								<h2 className="font-sans text-[13px] font-semibold text-muted mb-3">
									{t("studio.bySurface")}
								</h2>
								{data.stats.surfaces.length === 0 ? (
									<p className="font-sans text-sm text-subtle">
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

							<section className="rounded-xl border border-hairline bg-surface/60 p-3.5">
								<h2 className="font-sans text-[13px] font-semibold text-muted mb-3">
									{t("studio.topCountries")}
								</h2>
								{data.stats.byCountry.length === 0 ? (
									<p className="font-sans text-sm text-subtle">
										{t("studio.noData")}
									</p>
								) : (
									<BarList
										unknownLabel={t("studio.unknownCountry")}
										items={data.stats.byCountry.map((c) => ({
											key: c.country,
											label: countryLabel(c.country, t.locale),
											value: c.impressions,
										}))}
									/>
								)}
							</section>
						</div>
					</div>
				</>
			) : (
				<p className="font-sans text-sm text-subtle py-10 text-center">
					{t("studio.noData")}
				</p>
			)}
		</div>
	);
}
