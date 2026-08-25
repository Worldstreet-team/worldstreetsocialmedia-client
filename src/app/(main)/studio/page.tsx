"use client";

import { useEffect, useState } from "react";
import { BarChart3, Radio } from "lucide-react";
import { useT } from "@/i18n/client";
import {
	becomeCreatorAction,
	getCreatorStatsAction,
} from "@/lib/creator.actions";
import { useToast } from "@/components/ui/Toast/ToastContext";

interface Stats {
	windowDays: number;
	impressions: number;
	engagements: number;
	engagementRate: number;
	daily: { date: string; impressions: number }[];
	followers: number;
	posts: number;
}

/**
 * Creator studio v1: the become-a-creator gate, then the dashboard tiles and
 * a daily-impressions bar chart fed straight from engagement_events. Numbers
 * use tabular-nums; the chart is pure CSS on the surface ladder.
 */
export default function StudioPage() {
	const t = useT();
	const { toast } = useToast();
	const [stats, setStats] = useState<Stats | null>(null);
	const [notCreator, setNotCreator] = useState(false);
	const [busy, setBusy] = useState(false);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		const res = await getCreatorStatsAction();
		if (res.success && res.data) {
			setStats(res.data);
			setNotCreator(false);
		} else if ((res as any).notCreator) {
			setNotCreator(true);
		}
		setLoading(false);
	};

	useEffect(() => {
		void load();
	}, []);

	const activate = async () => {
		setBusy(true);
		try {
			const res = await becomeCreatorAction();
			if (res.success) await load();
			else if (res.message) toast(res.message, { type: "error" });
		} finally {
			setBusy(false);
		}
	};

	const maxDaily = Math.max(1, ...(stats?.daily ?? []).map((d) => d.impressions));

	return (
		<div className="w-full min-w-0 px-4 py-6 pb-nav md:pb-10">
			<h1 className="flex items-center gap-2.5 font-display font-semibold text-xl text-primary mb-6">
				<BarChart3 className="w-5 h-5 text-gold" />
				{t("studio.title")}
			</h1>

			{loading && (
				<div className="h-40 rounded-lg skeleton" aria-hidden="true" />
			)}

			{!loading && notCreator && (
				<div className="rounded-xl border border-hairline bg-surface p-6 max-w-md">
					<span className="flex h-11 w-11 items-center justify-center rounded-pill bg-brand/10 text-gold mb-4">
						<Radio className="w-5 h-5" />
					</span>
					<h2 className="font-display font-semibold text-lg text-primary mb-2">
						{t("studio.become.title")}
					</h2>
					<p className="text-sm text-muted font-sans mb-5">
						{t("studio.become.caption")}
					</p>
					<button
						type="button"
						onClick={activate}
						disabled={busy}
						className="rounded-pill bg-brand text-brand-on font-semibold text-sm font-sans px-5 py-2.5 transition-colors hover:bg-brand/90 disabled:opacity-50 cursor-pointer"
					>
						{t("studio.become.cta")}
					</button>
				</div>
			)}

			{!loading && stats && (
				<>
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
						{(
							[
								["studio.impressions", stats.impressions.toLocaleString()],
								["studio.engagements", stats.engagements.toLocaleString()],
								["studio.engagementRate", `${stats.engagementRate}%`],
								["studio.followers", stats.followers.toLocaleString()],
							] as const
						).map(([key, value]) => (
							<div
								key={key}
								className="rounded-lg border border-hairline bg-surface p-4"
							>
								<div className="text-[11px] font-semibold uppercase tracking-wider text-subtle font-sans mb-1">
									{t(key)}
								</div>
								<div className="text-xl font-semibold text-primary font-sans tabular-nums">
									{value}
								</div>
							</div>
						))}
					</div>

					<div className="rounded-lg border border-hairline bg-surface p-4">
						<div className="flex items-baseline justify-between mb-4">
							<h2 className="text-sm font-semibold text-primary font-sans">
								{t("studio.daily")}
							</h2>
							<span className="text-[11px] text-subtle font-sans">
								{t("studio.window")}
							</span>
						</div>
						{stats.daily.length === 0 ? (
							<p className="text-sm text-muted font-sans py-6 text-center">
								—
							</p>
						) : (
							<div className="flex items-end gap-1 h-28">
								{stats.daily.map((d) => (
									<div
										key={d.date}
										title={`${d.date}: ${d.impressions}`}
										className="flex-1 rounded-t-[4px] bg-brand/70 hover:bg-brand transition-colors min-w-0"
										style={{
											height: `${Math.max(4, (d.impressions / maxDaily) * 100)}%`,
										}}
									/>
								))}
							</div>
						)}
					</div>
				</>
			)}
		</div>
	);
}
