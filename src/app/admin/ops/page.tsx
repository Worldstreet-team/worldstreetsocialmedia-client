"use client";

import { useEffect, useState } from "react";
import { adminApiGet } from "@/lib/admin.actions";
import { Card, Empty, Stat, Tag, fmtDate } from "../ui";

export default function OpsDesk() {
	const [mod, setMod] = useState<any>(null);
	const [latency, setLatency] = useState<any[]>([]);
	const [health, setHealth] = useState<any>(null);

	useEffect(() => {
		adminApiGet("/ops/moderation", { days: 30 }).then(
			(r) => r.success && setMod(r.data),
		);
		adminApiGet("/ops/latency").then(
			(r) => r.success && setLatency(r.data.surfaces),
		);
		adminApiGet("/health", { days: 30 }).then(
			(r) => r.success && setHealth(r.data),
		);
	}, []);

	return (
		<div className="flex flex-col gap-4">
			<h1 className="font-display text-xl font-semibold text-primary">Ops</h1>

			<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
				<Stat label="Pending" value={mod?.queue?.pending ?? 0} sub="reports" />
				<Stat
					label="Resolved (30d)"
					value={mod?.resolution?.resolved ?? 0}
					sub={
						mod?.resolution?.avgHours != null
							? `avg ${mod.resolution.avgHours.toFixed(1)}h to resolve`
							: "no resolutions yet"
					}
				/>
				<Stat
					label="Oldest pending"
					value={
						mod?.oldestPending
							? `${Math.round((Date.now() - new Date(mod.oldestPending.createdAt).getTime()) / 3_600_000)}h`
							: "—"
					}
					sub={mod?.oldestPending ? mod.oldestPending.reason : "queue clear"}
				/>
				<Stat
					label="Feed p95"
					value={
						latency.length
							? `${Math.max(...latency.map((l) => l.p95))}ms`
							: "—"
					}
					sub="this instance, recent"
				/>
			</div>

			<div className="grid md:grid-cols-2 gap-4">
				<Card title="Latency by surface">
					{latency.length === 0 ? (
						<Empty text="No samples yet — the ring fills as feeds get served after this deploy." />
					) : (
						<table className="w-full text-[13px]">
							<thead>
								<tr className="text-muted text-left text-[11px] uppercase tracking-wide">
									<th className="py-1.5">Surface</th>
									<th className="py-1.5 text-right">n</th>
									<th className="py-1.5 text-right">p50</th>
									<th className="py-1.5 text-right">p95</th>
									<th className="py-1.5 text-right">max</th>
								</tr>
							</thead>
							<tbody>
								{latency.map((l) => (
									<tr key={l.surface} className="border-t border-hairline">
										<td className="py-1.5 text-primary">{l.surface}</td>
										<td className="py-1.5 text-right text-muted tabular-nums">
											{l.count}
										</td>
										<td className="py-1.5 text-right text-primary tabular-nums">
											{l.p50}ms
										</td>
										<td className="py-1.5 text-right text-primary tabular-nums">
											{l.p95}ms
										</td>
										<td className="py-1.5 text-right text-muted tabular-nums">
											{l.max}ms
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</Card>

				<Card title="Staff activity (30d)">
					{!mod?.perActor?.length ? (
						<Empty text="No staff actions in the window." />
					) : (
						mod.perActor.map((a: any) => (
							<div key={a._id} className="py-2 text-[13px]">
								<div className="flex items-center gap-2">
									<span className="text-primary font-medium">
										@{a.actor?.username}
									</span>
									<span className="text-muted">{a.total} actions</span>
								</div>
								<div className="flex gap-1.5 flex-wrap mt-1">
									{a.actions.map((x: any) => (
										<Tag key={x.action}>
											{x.action} ×{x.n}
										</Tag>
									))}
								</div>
							</div>
						))
					)}
				</Card>
			</div>

			{health?.topAuthors && (
				<Card title="Heaviest publishers (30d)">
					{health.topAuthors.map((a: any) => (
						<div
							key={a._id}
							className="py-1.5 flex items-center gap-3 text-[13px]"
						>
							<span className="text-primary font-medium">
								@{a.author?.username}
							</span>
							<Tag
								tone={(a.author?.quality ?? 1) < 0.8 ? "bad" : "neutral"}
							>
								quality {(a.author?.quality ?? 1).toFixed(2)}
							</Tag>
							<span className="text-muted ml-auto tabular-nums">
								{a.posts} posts
							</span>
							<span className="text-subtle text-[12px]">
								joined {fmtDate(a.author?.createdAt).split(",")[0]}
							</span>
						</div>
					))}
				</Card>
			)}
		</div>
	);
}
