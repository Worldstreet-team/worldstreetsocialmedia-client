"use client";

import { useCallback, useEffect, useState } from "react";
import { getAuditTrailAction } from "@/lib/admin.actions";
import { Pane, PaneHead } from "@/components/admin/AdminShell";
import { AdminSkeleton, Caveat } from "@/components/admin/admin-ui";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { TimeAgo } from "@/components/ui/TimeAgo";

/**
 * Every privileged action, newest first.
 *
 * Empty is the correct and expected state right now: the console is read-only,
 * so nothing has been done that could be recorded. The log exists first on
 * purpose — an audit trail added after the write endpoints is an audit trail
 * with a hole at the start.
 */
export default function AdminAuditPage() {
	const [rows, setRows] = useState<any[] | null>(null);
	const [state, setState] = useState<"loading" | "ready" | "denied" | "error">(
		"loading",
	);

	const load = useCallback(async () => {
		const res = await getAuditTrailAction();
		if (res.success) {
			setRows(res.data.entries ?? []);
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
	if (state === "loading")
		return (
			<Pane>
				<PaneHead title="Audit trail" />
				<AdminSkeleton />
			</Pane>
		);
	if (state === "error")
		return (
			<Pane>
				<PaneHead title="Audit trail" />
				<p className="font-sans text-[13px] text-danger">Could not load.</p>
			</Pane>
		);

	return (
		<Pane>
			<PaneHead
				title="Audit trail"
				caption="Who did what, and why. Append-only."
			/>
			{rows && rows.length > 0 ? (
				rows.map((r: any) => (
					<div
						key={r._id}
						className="flex items-center gap-3 border-t border-hairline py-2.5 first:border-t-0"
					>
						<span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-pill bg-raised">
							<SafeAvatar src={r.actor?.avatar} />
						</span>
						<div className="min-w-0">
							<div className="font-sans text-[13.5px] text-primary">
								<span className="font-semibold">
									{r.actor?.username ?? "unknown"}
								</span>{" "}
								<span className="text-muted">{r.action}</span>
							</div>
							{r.reason && (
								<div className="truncate font-sans text-[12px] text-subtle">
									{r.reason}
								</div>
							)}
						</div>
						<span className="ml-auto shrink-0 font-sans text-[12px] text-subtle">
							<TimeAgo date={r.at} />
						</span>
					</div>
				))
			) : (
				<>
					<p className="font-sans text-[13px] text-subtle">
						Nothing recorded yet.
					</p>
					<Caveat>
						Expected — the console is read-only today, so there is nothing to
						record. The log ships before the first write endpoint rather than
						after it, so the trail has no gap at the beginning.
					</Caveat>
				</>
			)}
		</Pane>
	);
}
