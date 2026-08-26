"use client";

import { useCallback, useEffect, useState } from "react";
import { Faders } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";
import {
	becomeCreatorAction,
	getCreatorStatsAction,
} from "@/lib/creator.actions";
import { useToast } from "@/components/ui/Toast/ToastContext";
import {
	MetricRow,
	Panel,
	StatTile,
	WindowSwitch,
	fmt,
} from "@/components/studio/studio-ui";
import {
	BarList,
	TrendChart,
	countryLabel,
} from "@/components/studio/charts";

interface Stats {
	windowDays: number;
	impressions: number;
	engagements: number;
	engagementRate: number;
	reach: number;
	avgDwellMs: number;
	daily: { date: string; impressions: number; engagements: number }[];
	byCountry: { country: string; impressions: number }[];
	followers: number;
	posts: number;
}

/** Studio overview — headline numbers, the trend, and the audience rail,
 *  laid out tight so the whole picture fits one screen. */
export default function StudioOverview() {
	const t = useT();
	const { toast } = useToast();
	const [stats, setStats] = useState<Stats | null>(null);
	const [days, setDays] = useState(28);
	const [notCreator, setNotCreator] = useState(false);
	const [busy, setBusy] = useState(false);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async (windowDays: number) => {
		setLoading(true);
		const res = await getCreatorStatsAction(windowDays);
		if (res.success && res.data) {
			setStats(res.data);
			setNotCreator(false);
		} else if ((res as any).notCreator) {
			setNotCreator(true);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		void load(days);
	}, [days, load]);

	const activate = async () => {
		setBusy(true);
		try {
			const res = await becomeCreatorAction();
			if (res.success) await load(days);
			else if (res.message) toast(res.message, { type: "error" });
		} finally {
			setBusy(false);
		}
	};

	if (notCreator) {
		return (
			<div className="max-w-sm mx-auto mt-16 rounded-xl border border-hairline bg-surface/60 p-7 text-center">
				<span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-pill bg-brand/10 text-gold">
					<Faders size={22} />
				</span>
				<h2 className="font-display text-lg font-semibold text-primary mb-1.5">
					{t("studio.become.title")}
				</h2>
				<p className="font-sans text-[13px] text-muted mb-5">
					{t("studio.become.caption")}
				</p>
				<button
					type="button"
					onClick={activate}
					disabled={busy}
					className="h-10 px-5 rounded-pill bg-brand text-brand-on font-semibold text-[13px] font-sans hover:bg-brand-active transition-colors cursor-pointer disabled:opacity-50"
				>
					{t("studio.become.cta")}
				</button>
			</div>
		);
	}

	if (loading && !stats) {
		return (
			<div className="grid xl:grid-cols-[1fr_296px] gap-3">
				<div className="flex flex-col gap-3">
					<div className="grid grid-cols-3 gap-3">
						{[1, 2, 3].map((i) => (
							<div key={i} className="h-[76px] rounded-xl skeleton" />
						))}
					</div>
					<div className="h-[300px] rounded-xl skeleton" />
				</div>
				<div className="h-[200px] rounded-xl skeleton" />
			</div>
		);
	}
	if (!stats) return null;

	return (
		<div className="grid xl:grid-cols-[1fr_296px] gap-3 items-start">
			{/* main column */}
			<div className="flex flex-col gap-3 min-w-0">
				<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
					<StatTile
						label={t("studio.impressions")}
						value={fmt(stats.impressions)}
					/>
					<StatTile
						label={t("studio.engagements")}
						value={fmt(stats.engagements)}
					/>
					<StatTile
						label={t("studio.engagementRate")}
						value={`${stats.engagementRate}%`}
					/>
				</div>

				<Panel
					title={t("studio.daily")}
					action={<WindowSwitch value={days} onChange={setDays} />}
				>
					{stats.daily.length > 0 ? (
						<TrendChart
							daily={stats.daily}
							impressionsLabel={t("studio.impressions")}
							engagementsLabel={t("studio.engagements")}
						/>
					) : (
						<p className="font-sans text-[13px] text-subtle py-12 text-center">
							{t("studio.noData")}
						</p>
					)}
				</Panel>
			</div>

			{/* rail */}
			<div className="flex flex-col gap-3 min-w-0">
				<Panel title={t("studio.audience")}>
					<MetricRow
						label={t("studio.reach")}
						value={fmt(stats.reach)}
						hint={t("studio.reachHint")}
					/>
					<MetricRow
						label={t("studio.avgDwell")}
						value={`${(stats.avgDwellMs / 1000).toFixed(1)}s`}
					/>
					<MetricRow
						label={t("studio.followers")}
						value={fmt(stats.followers)}
					/>
					<MetricRow label={t("studio.posts")} value={fmt(stats.posts)} />
				</Panel>

				<Panel title={t("studio.topCountries")}>
					{stats.byCountry.length > 0 ? (
						<BarList
							unknownLabel={t("studio.unknownCountry")}
							items={stats.byCountry.map((c) => ({
								key: c.country,
								label: countryLabel(c.country, t.locale),
								value: c.impressions,
							}))}
						/>
					) : (
						<p className="font-sans text-[13px] text-subtle py-6 text-center">
							{t("studio.noData")}
						</p>
					)}
				</Panel>
			</div>
		</div>
	);
}
