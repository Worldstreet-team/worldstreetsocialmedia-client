"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { getAdminHealthAction } from "@/lib/admin.actions";
import { Pane, PaneHead } from "@/components/admin/AdminShell";
import { AdminSkeleton, Caveat, Row, Stat, compact } from "@/components/admin/admin-ui";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

/**
 * Where content is coming from and whether it is wanted.
 *
 * The number that matters here is concentration: what share of everything
 * published came from the ten busiest accounts. It is the signal that would
 * have surfaced the flooding episode on the day it happened rather than a
 * week later.
 */
export default function AdminHealthPage() {
	const [data, setData] = useState<any>(null);
	const [state, setState] = useState<"loading" | "ready" | "denied" | "error">(
		"loading",
	);

	const load = useCallback(async () => {
		const res = await getAdminHealthAction(30);
		if (res.success) {
			setData(res.data);
			setState("ready");
		} else setState((res as any).forbidden ? "denied" : "error");
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	if (state === "denied")
		return (
			<Pane>
				<PaneHead title="Not permitted" caption="This console is staff-only." />
			</Pane>
		);
	if (state === "loading" || !data)
		return (
			<Pane>
				<PaneHead title="Health" />
				<AdminSkeleton />
			</Pane>
		);
	if (state === "error")
		return (
			<Pane>
				<PaneHead title="Health" />
				<p className="font-sans text-[13px] text-danger">Could not load.</p>
			</Pane>
		);

	const conc = Math.round(data.concentration * 100);

	return (
		<div className="flex flex-col gap-4">
			<Pane>
				<PaneHead
					title="Where the content comes from"
					caption={`${compact(data.totalPosts)} posts in the last ${data.windowDays} days`}
				/>
				<div className="grid gap-3 sm:grid-cols-3">
					<Stat
						label="Top 10 share"
						value={`${conc}%`}
						tone={conc > 35 ? "danger" : undefined}
						sub={conc > 35 ? "a handful of accounts dominate" : "healthy spread"}
					/>
					<Stat
						label="Busiest account"
						value={`${Math.round((data.topAuthors[0]?.share ?? 0) * 100)}%`}
						sub={data.topAuthors[0] ? `@${data.topAuthors[0].username}` : "—"}
					/>
					<Stat
						label="Posts / day"
						value={String(Math.round(data.totalPosts / data.windowDays))}
					/>
				</div>
			</Pane>

			<Pane>
				<PaneHead
					title="Busiest authors"
					caption="Quality is engagement earned per post — 1.0 is typical"
				/>
				{data.topAuthors.map((a: any) => (
					<div
						key={a.id}
						className="flex items-center gap-3 border-t border-hairline py-2.5 first:border-t-0"
					>
						<span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-pill bg-raised">
							<SafeAvatar src={a.avatar} />
						</span>
						<div className="min-w-0">
							<Link
								href={`/profile/${a.username}`}
								className="block truncate font-sans text-[13.5px] font-semibold text-primary hover:underline"
							>
								{a.name || a.username}
							</Link>
							<div className="font-sans text-[12px] text-subtle">
								{a.accountAgeDays === 0
									? "joined today"
									: `${a.accountAgeDays}d old`}
							</div>
						</div>
						<div className="ml-auto flex shrink-0 items-baseline gap-3">
							<span
								className={clsx(
									"font-sans text-[12.5px] font-semibold tabular-nums",
									a.quality < 0.7 ? "text-danger" : "text-muted",
								)}
								title="Engagement earned per post"
							>
								{a.quality.toFixed(2)}
							</span>
							<span className="font-sans text-[13.5px] font-semibold tabular-nums text-primary">
								{a.posts}
							</span>
							<span className="w-11 text-right font-sans text-[12px] tabular-nums text-subtle">
								{(a.share * 100).toFixed(1)}%
							</span>
						</div>
					</div>
				))}
			</Pane>

			<Pane>
				<PaneHead
					title="What the telemetry records"
					caption="Only what actually fires — the rest is declared and never written"
				/>
				<div className="grid gap-4 lg:grid-cols-2">
					<div>
						{data.actionMix.map((a: any) => (
							<Row key={a.action} label={a.action} value={compact(a.n)} />
						))}
					</div>
					<div>
						{data.surfaceMix.map((s: any) => (
							<Row
								key={s.surface}
								label={s.surface}
								caption={
									s.surface === "unknown"
										? "server-recorded actions carry no surface"
										: undefined
								}
								value={compact(s.n)}
							/>
						))}
					</div>
				</div>
				<Caveat>
					Twelve of the nineteen declared engagement actions have never been
					written — including every video quartile and every click-through — so
					there is no view-completion or CTR anywhere on this platform yet. What
					you see above is the whole instrument.
				</Caveat>
			</Pane>
		</div>
	);
}
