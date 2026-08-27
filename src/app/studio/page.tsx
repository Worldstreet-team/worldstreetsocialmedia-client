"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import {
	ArrowUpRight,
	CaretRight,
	ChartLineUp,
	Eye,
	Faders,
	HandHeart,
	UsersThree,
} from "@phosphor-icons/react";
import { useT } from "@/i18n/client";
import {
	becomeCreatorAction,
	getCreatorPostsAction,
	getCreatorStatsAction,
} from "@/lib/creator.actions";
import { useToast } from "@/components/ui/Toast/ToastContext";
import {
	CARD,
	Cell,
	CellEmpty,
	CellHead,
	MetricRow,
	StatCard,
	WindowSwitch,
	fmt,
} from "@/components/studio/studio-ui";
import {
	DonutChart,
	MiniBars,
	TrendChart,
	countryFlag,
	countryLabel,
} from "@/components/studio/charts";
import { XSTREAM_WEB_URL } from "@/const";
import { formatTimeAgo } from "@/lib/utils";
import { userAtom } from "@/store/user.atom";

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

/** Change as a fraction vs the previous window; null when there is no
 *  honest baseline (prev window empty, or the double-window fetch failed). */
function fraction(cur: number, prev: number | null) {
	if (prev === null || prev <= 0) return null;
	return (cur - prev) / prev;
}

/** Seconds → "3m 46s" — "225.9s" is a stopwatch reading, not a dwell time. */
function dwellLabel(ms: number) {
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	return `${Math.floor(s / 60)}m ${s % 60}s`;
}

const ECOSYSTEM_APPS = [
	{ name: "Xstream", href: XSTREAM_WEB_URL },
	{ name: "Academy", href: "https://academy.worldstreetgold.com" },
	{ name: "e-Commerce", href: "https://shop.worldstreetgold.com" },
	{ name: "Prediction", href: "https://prediction.worldstreetgold.com" },
	{ name: "Arcade", href: "https://arcade.worldstreetgold.com" },
	{ name: "Vision", href: "https://vision.worldstreetgold.com" },
];

/**
 * Overview — the daily check-in, one screen.
 *
 * Every count that can carry an honest comparison does: a second fetch at
 * twice the window yields the previous period by subtraction, so the delta
 * chips are real arithmetic, not decoration. At 90d the server clamps the
 * double window, so the baseline vanishes and the chips honestly disappear.
 */
export default function StudioOverview() {
	const t = useT();
	const { toast } = useToast();
	const user = useAtomValue(userAtom);
	const [stats, setStats] = useState<Stats | null>(null);
	const [prev, setPrev] = useState<Stats | null>(null);
	const [topPosts, setTopPosts] = useState<TopPost[]>([]);
	// Next serialises server actions, so this one lands after the two stats
	// calls. Without its own flag the card showed "you haven't posted yet"
	// while the request was still in flight — an empty state that lies.
	const [postsLoading, setPostsLoading] = useState(true);
	const [days, setDays] = useState(28);
	const [notCreator, setNotCreator] = useState(false);
	const [busy, setBusy] = useState(false);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async (windowDays: number) => {
		setLoading(true);
		const wantBaseline = windowDays * 2 <= 90;
		const [curRes, doubleRes] = await Promise.all([
			getCreatorStatsAction(windowDays),
			wantBaseline ? getCreatorStatsAction(windowDays * 2) : null,
		]);
		if (curRes.success && curRes.data) {
			setStats(curRes.data);
			setNotCreator(false);
			if (doubleRes?.success && doubleRes.data) {
				// prev period = double window minus current window.
				const d = doubleRes.data as Stats;
				const c = curRes.data as Stats;
				setPrev({
					...d,
					impressions: d.impressions - c.impressions,
					engagements: d.engagements - c.engagements,
					engagementRate:
						d.impressions - c.impressions > 0
							? Math.round(
									((d.engagements - c.engagements) /
										(d.impressions - c.impressions)) *
										1000,
								) / 10
							: 0,
				});
			} else {
				setPrev(null);
			}
		} else if ((curRes as any).notCreator) {
			setNotCreator(true);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		void load(days);
	}, [days, load]);

	useEffect(() => {
		void getCreatorPostsAction()
			.then((res) => {
				if (res.success && Array.isArray(res.posts)) {
					setTopPosts(
						[...(res.posts as TopPost[])]
							.sort((a, b) => (b.stats.views ?? 0) - (a.stats.views ?? 0))
							.slice(0, 5),
					);
				}
			})
			.finally(() => setPostsLoading(false));
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
				<div className={`${CARD} p-8 text-center`}>
					<span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-pill bg-[var(--ws-brand-primary)] text-[#0c0a09]">
						<Faders size={24} weight="bold" />
					</span>
					<h2 className="mb-2 font-display text-[20px] font-semibold glass-ink">
						{t("studio.become.title")}
					</h2>
					<p className="mb-6 font-sans text-[13.5px] leading-relaxed glass-ink-dim">
						{t("studio.become.caption")}
					</p>
					<button
						type="button"
						onClick={activate}
						disabled={busy}
						className="h-11 cursor-pointer rounded-pill bg-[#fafaf9] px-6 font-sans text-[14px] font-semibold text-[#0c0a09] transition-colors hover:bg-white disabled:opacity-50"
					>
						{t("studio.become.cta")}
					</button>
				</div>
			</div>
		);
	}

	if (loading && !stats) {
		return (
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
				{[3, 3, 3, 3].map((n, i) => (
					<div
						key={`a${i}`}
						className="h-[132px] animate-pulse rounded-2xl bg-[#fafaf9]/[0.04] xl:col-span-3"
					/>
				))}
				<div className="h-[330px] animate-pulse rounded-2xl bg-[#fafaf9]/[0.04] sm:col-span-2 xl:col-span-8" />
				<div className="h-[330px] animate-pulse rounded-2xl bg-[#fafaf9]/[0.04] xl:col-span-4" />
			</div>
		);
	}
	if (!stats) return null;

	const vsPrev = t("studio.vsPrev").replace("{d}", String(days));
	// A rate delta against a window with no impressions is "+10.9pp vs
	// nothing" — technically arithmetic, actually a lie. Baseline required.
	const rateDeltaPp =
		prev !== null && prev.impressions > 0
			? stats.engagementRate - prev.engagementRate
			: null;

	return (
		<div>
			{/* header */}
			<div className="mb-5 flex flex-wrap items-end justify-between gap-3">
				<div className="min-w-0">
					<h1 className="font-display text-[22px] font-semibold tracking-tight glass-ink">
						{t("studio.welcome").replace(
							"{name}",
							user?.firstName || user?.username || "",
						)}
					</h1>
					<p className="mt-1 font-sans text-[13px] glass-ink-dim">
						{t("studio.welcomeSub").replace("{d}", String(days))}
					</p>
				</div>
				<WindowSwitch value={days} onChange={setDays} />
			</div>

			<div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-12">
				<Cell span={3}>
					<StatCard
						icon={Eye}
						label={t("studio.impressions")}
						value={fmt(stats.impressions)}
						delta={fraction(stats.impressions, prev?.impressions ?? null)}
						deltaCaption={vsPrev}
						chart={<MiniBars values={stats.daily.map((d) => d.impressions)} />}
					/>
				</Cell>
				<Cell span={3}>
					<StatCard
						icon={HandHeart}
						label={t("studio.engagements")}
						value={fmt(stats.engagements)}
						delta={fraction(stats.engagements, prev?.engagements ?? null)}
						deltaCaption={vsPrev}
						chart={<MiniBars values={stats.daily.map((d) => d.engagements)} />}
					/>
				</Cell>
				<Cell span={3}>
					<StatCard
						icon={ChartLineUp}
						label={t("studio.engagementRate")}
						value={`${stats.engagementRate}%`}
						delta={rateDeltaPp}
						deltaSuffix="pp"
						deltaCaption={rateDeltaPp !== null ? vsPrev : undefined}
						sub={t("studio.rateHint")}
					/>
				</Cell>
				<Cell span={3}>
					<StatCard
						icon={UsersThree}
						label={t("studio.followers")}
						value={fmt(stats.followers)}
						sub={`${fmt(stats.posts)} ${t("studio.posts").toLowerCase()}`}
					/>
				</Cell>

				<Cell span={8} className="sm:col-span-2 xl:col-auto">
					<CellHead label={t("studio.daily")} />
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
				</Cell>

				<Cell span={4}>
					<CellHead label={t("studio.audience")} />
					<div className="px-5 pb-4">
						<MetricRow
							label={t("studio.reach")}
							value={fmt(stats.reach)}
							hint={t("studio.reachHint")}
						/>
						<MetricRow
							label={t("studio.avgDwell")}
							value={dwellLabel(stats.avgDwellMs)}
						/>
						<MetricRow
							label={t("studio.followers")}
							value={fmt(stats.followers)}
						/>
						<MetricRow label={t("studio.posts")} value={fmt(stats.posts)} />
					</div>

					{/* the ecosystem, as three quiet rows — was a whole page */}
					<CellHead label={t("studio.nav.apps")} />
					<div className="px-2 pb-3">
						{ECOSYSTEM_APPS.slice(0, 3).map((app) => (
							<a
								key={app.name}
								href={app.href}
								target="_blank"
								rel="noreferrer"
								className="group flex items-center gap-2.5 rounded-xl px-3 py-2 transition-colors hover:bg-[#fafaf9]/[0.05]"
							>
								<span className="font-sans text-[13px] font-medium glass-ink-dim group-hover:glass-ink">
									{app.name}
								</span>
								<ArrowUpRight
									size={12}
									className="ml-auto glass-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
								/>
							</a>
						))}
					</div>
				</Cell>

				<Cell span={7} className="sm:col-span-2 xl:col-auto">
					<CellHead
						label={t("studio.topPosts")}
						action={
							<Link
								href="/studio/posts"
								className="flex items-center gap-1 font-sans text-[12px] font-semibold text-[var(--ws-brand-primary)] hover:underline"
							>
								{t("rail.seeAll")}
								<CaretRight size={11} weight="bold" />
							</Link>
						}
					/>
					{postsLoading ? (
						<div className="flex flex-col gap-2 px-5 pb-4 pt-2">
							{[1, 2, 3, 4].map((i) => (
								<div
									key={i}
									className="h-11 animate-pulse rounded-lg bg-[#fafaf9]/[0.04]"
								/>
							))}
						</div>
					) : topPosts.length === 0 ? (
						<CellEmpty>{t("studio.noPosts")}</CellEmpty>
					) : (
						<div className="px-2 pb-3 pt-1">
							{/* column heads */}
							<div className="grid grid-cols-[24px_1fr_64px_56px_56px] items-center gap-2 px-3 pb-2">
								<span />
								<span className="glass-eyebrow font-sans">
									{t("studio.col.post")}
								</span>
								<span className="glass-eyebrow text-right font-sans">
									{t("studio.impressions")}
								</span>
								<span className="glass-eyebrow text-right font-sans">
									{t("post.like")}
								</span>
								<span className="glass-eyebrow text-right font-sans">
									{t("post.reply")}
								</span>
							</div>
							{topPosts.map((p, i) => (
								<Link
									key={p.id}
									href={`/studio/posts/${p.id}`}
									className="grid grid-cols-[24px_1fr_64px_56px_56px] items-center gap-2 rounded-xl px-3 py-2.5 transition-colors hover:bg-[#fafaf9]/[0.05]"
								>
									<span className="text-center font-display text-[13px] font-semibold glass-ink-faint tabular-nums">
										{i + 1}
									</span>
									<span className="min-w-0">
										<span className="block truncate font-sans text-[13.5px] glass-ink">
											{p.content || t("studio.mediaPost")}
										</span>
										<span className="block font-sans text-[11.5px] glass-ink-faint tabular-nums">
											{formatTimeAgo(p.createdAt)}
										</span>
									</span>
									<span className="text-right font-sans text-[13px] font-semibold glass-ink tabular-nums">
										{fmt(p.stats.views ?? 0)}
									</span>
									<span className="text-right font-sans text-[13px] glass-ink-dim tabular-nums">
										{fmt(p.stats.likes)}
									</span>
									<span className="text-right font-sans text-[13px] glass-ink-dim tabular-nums">
										{fmt(p.stats.replies)}
									</span>
								</Link>
							))}
						</div>
					)}
				</Cell>

				<Cell span={5}>
					<CellHead label={t("studio.topCountries")} />
					<div className="px-5 pb-5 pt-2">
						{stats.byCountry.length > 0 ? (
							<DonutChart
								centerLabel={t("studio.impressions")}
								unknownLabel={t("studio.unknownCountry")}
								items={stats.byCountry.map((c) => ({
									key: c.country,
									label: countryLabel(c.country, t.locale),
									glyph: countryFlag(c.country),
									value: c.impressions,
								}))}
							/>
						) : (
							<CellEmpty>{t("studio.noData")}</CellEmpty>
						)}
					</div>
				</Cell>
			</div>
		</div>
	);
}
