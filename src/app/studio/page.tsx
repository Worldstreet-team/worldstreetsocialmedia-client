"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
	ArrowUpRight,
	CaretRight,
	Faders,
	PlugsConnected,
} from "@phosphor-icons/react";
import { useT } from "@/i18n/client";
import {
	becomeCreatorAction,
	getCreatorPostsAction,
	getCreatorStatsAction,
} from "@/lib/creator.actions";
import { useToast } from "@/components/ui/Toast/ToastContext";
import {
	CellEmpty,
	CellHead,
	GlassCell,
	MetricRow,
	StatTile,
	WindowSwitch,
	fmt,
} from "@/components/studio/studio-ui";
import {
	BarList,
	RadialRate,
	Sparkline,
	TrendChart,
	countryLabel,
} from "@/components/studio/charts";
import { XSTREAM_WEB_URL } from "@/const";
import { formatTimeAgo } from "@/lib/utils";

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

interface TopPost {
	id: string;
	content: string;
	createdAt: string;
	hasMedia: boolean;
	stats: { views?: number; likes: number; replies: number; reposts: number };
}

/**
 * Studio overview — one bento screen that answers "how is it going?".
 * Hero number with its pulse, the rate as a dial, the trend, the audience,
 * the posts doing the work, and the ecosystem — no second click needed for
 * the daily check-in.
 */
export default function StudioOverview() {
	const t = useT();
	const { toast } = useToast();
	const [stats, setStats] = useState<Stats | null>(null);
	const [topPosts, setTopPosts] = useState<TopPost[]>([]);
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

	// The "top posts" cell ranks the first page by views — a directory
	// preview, not a full analytics query; the Posts page has the rest.
	useEffect(() => {
		void getCreatorPostsAction().then((res) => {
			if (res.success && Array.isArray(res.posts)) {
				setTopPosts(
					[...(res.posts as TopPost[])]
						.sort((a, b) => (b.stats.views ?? 0) - (a.stats.views ?? 0))
						.slice(0, 4),
				);
			}
		});
	}, []);

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
			<div className="mx-auto mt-14 max-w-md">
				<div className="glass-panel backdrop-blur-xl backdrop-saturate-150 border glass-divider rounded-2xl p-8 text-center">
					<span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-pill bg-gold text-[#0c0a09]">
						<Faders size={24} weight="bold" />
					</span>
					<h2 className="font-display text-[20px] font-semibold glass-ink mb-2">
						{t("studio.become.title")}
					</h2>
					<p className="font-sans text-[13.5px] leading-relaxed glass-ink-dim mb-6">
						{t("studio.become.caption")}
					</p>
					<button
						type="button"
						onClick={activate}
						disabled={busy}
						className="h-11 px-6 rounded-pill glass-cta font-sans font-semibold text-[14px] transition-colors cursor-pointer disabled:opacity-50 active:brightness-95"
					>
						{t("studio.become.cta")}
					</button>
				</div>
			</div>
		);
	}

	if (loading && !stats) {
		return (
			<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-3">
				{[5, 3, 4, 8, 4].map((span, i) => (
					<div
						key={`${span}-${i}`}
						className={`rounded-2xl bg-[#fafaf9]/[0.04] animate-pulse xl:col-span-${span} ${i < 3 ? "h-[132px]" : "h-[320px]"}`}
					/>
				))}
			</div>
		);
	}
	if (!stats) return null;

	const ECOSYSTEM_APPS = [
		{ name: "Academy", href: "https://academy.worldstreetgold.com" },
		{ name: "e-Commerce", href: "https://shop.worldstreetgold.com" },
		{ name: "Prediction", href: "https://prediction.worldstreetgold.com" },
		{ name: "Arcade", href: "https://arcade.worldstreetgold.com" },
		{ name: "Vision", href: "https://vision.worldstreetgold.com" },
	];

	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-3 items-stretch">
			{/* hero: impressions + pulse */}
			<GlassCell span={5} className="sm:col-span-2 xl:col-auto">
				<StatTile
					label={t("studio.impressions")}
					value={fmt(stats.impressions)}
					sub={t("studio.windowSub").replace("{d}", String(stats.windowDays))}
				>
					<Sparkline values={stats.daily.map((d) => d.impressions)} />
				</StatTile>
			</GlassCell>

			<GlassCell span={3}>
				<StatTile
					label={t("studio.engagements")}
					value={fmt(stats.engagements)}
				>
					<Sparkline
						values={stats.daily.map((d) => d.engagements)}
						className="block h-11 w-full text-[#fafaf9]/60"
					/>
				</StatTile>
			</GlassCell>

			{/* the rate as a dial */}
			<GlassCell span={4} className="flex items-center justify-between px-5 py-4">
				<div className="min-w-0">
					<span className="glass-eyebrow font-sans">
						{t("studio.engagementRate")}
					</span>
					<p className="mt-2 font-sans text-[12px] leading-relaxed glass-ink-faint max-w-[18ch]">
						{t("studio.rateHint")}
					</p>
				</div>
				<RadialRate
					value={stats.engagementRate}
					label={t("studio.engagementRate")}
					size={116}
				/>
			</GlassCell>

			{/* trend */}
			<GlassCell span={8} className="sm:col-span-2 xl:col-auto">
				<CellHead
					label={t("studio.daily")}
					action={<WindowSwitch value={days} onChange={setDays} />}
				/>
				<div className="px-5 pb-4 pt-2">
					{stats.daily.length > 0 ? (
						<TrendChart
							daily={stats.daily}
							impressionsLabel={t("studio.impressions")}
							engagementsLabel={t("studio.engagements")}
						/>
					) : (
						<CellEmpty>{t("studio.noData")}</CellEmpty>
					)}
				</div>
			</GlassCell>

			{/* audience */}
			<GlassCell span={4}>
				<CellHead label={t("studio.audience")} />
				<div className="px-5 pb-4">
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
				</div>
			</GlassCell>

			{/* top posts */}
			<GlassCell span={7} className="sm:col-span-2 xl:col-auto">
				<CellHead
					label={t("studio.topPosts")}
					action={
						<Link
							href="/studio/posts"
							className="flex items-center gap-1 font-sans text-[12px] font-semibold text-gold hover:underline"
						>
							{t("rail.seeAll")}
							<CaretRight size={11} weight="bold" />
						</Link>
					}
				/>
				{topPosts.length === 0 ? (
					<CellEmpty>{t("studio.noPosts")}</CellEmpty>
				) : (
					<div className="px-2 pb-2">
						{topPosts.map((p, i) => (
							<Link
								key={p.id}
								href={`/studio/posts/${p.id}`}
								className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#fafaf9]/[0.06] transition-colors"
							>
								<span className="w-5 shrink-0 text-center font-display text-[13px] font-semibold text-gold/80 tabular-nums">
									{i + 1}
								</span>
								<span className="min-w-0 flex-1">
									<span className="block font-sans text-[13.5px] glass-ink truncate">
										{p.content || t("studio.mediaPost")}
									</span>
									<span className="block font-sans text-[11.5px] glass-ink-faint tabular-nums">
										{formatTimeAgo(p.createdAt)}
									</span>
								</span>
								<span className="shrink-0 font-sans text-[13px] font-semibold glass-ink-dim tabular-nums">
									{fmt(p.stats.views ?? 0)}
								</span>
							</Link>
						))}
					</div>
				)}
			</GlassCell>

			{/* countries */}
			<GlassCell span={5}>
				<CellHead label={t("studio.topCountries")} />
				<div className="px-5 pb-5">
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
						<CellEmpty>{t("studio.noData")}</CellEmpty>
					)}
				</div>
			</GlassCell>

			{/* ecosystem strip — was a whole page; it's a card's worth of links */}
			<GlassCell span={12} className="sm:col-span-2 xl:col-auto">
				<CellHead label={t("studio.nav.apps")} />
				<div className="flex flex-wrap items-stretch gap-2 px-4 pb-4 pt-1">
					{[
						{ name: "Xstream", href: XSTREAM_WEB_URL, connected: true },
						{
							name: "WorldStreet ID",
							href: "https://dashboard.worldstreetgold.com",
							connected: true,
						},
						...ECOSYSTEM_APPS.map((a) => ({ ...a, connected: false })),
					].map((app) => (
						<a
							key={app.name}
							href={app.href}
							target="_blank"
							rel="noreferrer"
							className="group flex items-center gap-2.5 rounded-xl glass-card px-3.5 py-2.5"
						>
							<span
								className={
									app.connected
										? "flex h-7 w-7 items-center justify-center rounded-[8px] bg-gold/15 text-gold"
										: "flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#fafaf9]/[0.07] glass-ink-faint"
								}
							>
								<PlugsConnected size={14} weight="bold" />
							</span>
							<span className="min-w-0">
								<span className="block font-sans text-[13px] font-semibold glass-ink leading-tight">
									{app.name}
								</span>
								<span className="block font-sans text-[10.5px] glass-ink-faint">
									{app.connected
										? t("studio.apps.connected")
										: t("studio.apps.open")}
								</span>
							</span>
							<ArrowUpRight
								size={13}
								className="ml-1 glass-ink-faint opacity-0 group-hover:opacity-100 transition-opacity"
							/>
						</a>
					))}
				</div>
			</GlassCell>
		</div>
	);
}
