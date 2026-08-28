"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { getAdminOverviewAction } from "@/lib/admin.actions";
import { Pane, PaneHead } from "@/components/admin/AdminShell";
import {
	AdminSkeleton,
	Caveat,
	DayBars,
	Delta,
	Stat,
	compact,
} from "@/components/admin/admin-ui";

const WINDOWS = [7, 30, 90];

export default function AdminOverviewPage() {
	const [days, setDays] = useState(30);
	const [data, setData] = useState<any>(null);
	const [state, setState] = useState<"loading" | "ready" | "denied" | "error">(
		"loading",
	);

	const load = useCallback(async (d: number) => {
		const res = await getAdminOverviewAction(d);
		if (res.success) {
			setData(res.data);
			setState("ready");
		} else {
			setState((res as any).forbidden ? "denied" : "error");
		}
	}, []);

	useEffect(() => {
		void load(days);
	}, [days, load]);

	if (state === "denied") {
		return (
			<Pane>
				<PaneHead
					title="Not permitted"
					caption="This console is staff-only. Nothing was loaded."
				/>
			</Pane>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<Pane>
				<PaneHead
					title="Overview"
					caption={`Last ${days} days, against the ${days} before it`}
					trailing={
						<div className="flex gap-1">
							{WINDOWS.map((w) => (
								<button
									key={w}
									type="button"
									onClick={() => setDays(w)}
									className={clsx(
										"glass-tile h-7 rounded-pill px-3 font-sans text-[12px] transition-colors",
										w === days
											? "glass-tile-on font-semibold text-primary"
											: "text-muted hover:text-primary",
									)}
								>
									{w}d
								</button>
							))}
						</div>
					}
				/>

				{state === "loading" ? (
					<AdminSkeleton />
				) : state === "error" ? (
					<p className="font-sans text-[13px] text-danger">
						Could not load. The gateway may be unreachable.
					</p>
				) : (
					<>
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							<Stat
								label="Members"
								value={compact(data.members.total)}
								sub={`+${compact(data.members.added)} this window`}
							/>
							<Stat
								label="Active people"
								value={compact(data.active.people)}
								sub={`${Math.round(
									(data.active.people / Math.max(1, data.members.total)) * 100,
								)}% of members`}
							/>
							<Stat
								label="Posts"
								value={compact(data.posts.added)}
								sub={`${Math.round(data.posts.added / days)}/day average`}
							/>
							<Stat
								label="Reports waiting"
								value={String(data.pendingReports)}
								tone={data.pendingReports > 0 ? "danger" : undefined}
								sub={
									data.pendingReports > 0
										? "no queue to work them yet"
										: "nothing filed"
								}
							/>
						</div>

						<div className="mt-3 grid gap-3 lg:grid-cols-2">
							<div className="glass-tile rounded-lg p-3.5">
								<div className="mb-2 flex items-baseline">
									<span className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">
										Signups
									</span>
									<Delta
										now={data.members.added}
										prev={data.members.previous}
									/>
								</div>
								<DayBars series={data.series.signups} label="Signups per day" />
							</div>
							<div className="glass-tile rounded-lg p-3.5">
								<div className="mb-2 flex items-baseline">
									<span className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">
										Posts
									</span>
									<Delta now={data.posts.added} prev={data.posts.previous} />
								</div>
								<DayBars series={data.series.posts} label="Posts per day" />
							</div>
						</div>

						{data.staffCount === 0 && (
							<Caveat>
								<strong className="text-primary">No staff accounts exist.</strong>{" "}
								You are seeing this because the gateway found a staff record for
								you — grant others explicitly rather than by adding a role, which
								is self-assignable at signup.
							</Caveat>
						)}
						<Caveat>
							Behavioural numbers come from an event store with a{" "}
							<strong className="text-primary">90-day retention</strong>, so
							nothing older can be asked. Deletes are permanent and uncounted, so
							a past window recomputed later returns a smaller number than it
							does today.
						</Caveat>
					</>
				)}
			</Pane>
		</div>
	);
}
