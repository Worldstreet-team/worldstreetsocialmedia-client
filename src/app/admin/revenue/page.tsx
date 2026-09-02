"use client";

import { formatCompact } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { getAdminRevenueAction } from "@/lib/admin.actions";
import { Pane, PaneHead } from "@/components/admin/AdminShell";
import {
	AdminSkeleton,
	Caveat,
	Row,
	Stat,
	money,
} from "@/components/admin/admin-ui";

const TIER_LABEL: Record<string, string> = {
	bronze: "Bronze",
	silver: "Silver",
	gold: "Gold",
};

/**
 * What the social platform earns — and, just as deliberately, what it does
 * not. Promoted-post spend is a counter that never debits a wallet, so it
 * sits in its own section rather than in the total. A dashboard that adds it
 * to revenue is inventing money.
 */
export default function AdminRevenuePage() {
	const [data, setData] = useState<any>(null);
	const [state, setState] = useState<"loading" | "ready" | "denied" | "error">(
		"loading",
	);

	const load = useCallback(async () => {
		const res = await getAdminRevenueAction(30);
		if (res.success) {
			setData(res.data);
			setState("ready");
		} else {
			setState((res as any).forbidden ? "denied" : "error");
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	if (state === "denied") {
		return (
			<Pane>
				<PaneHead title="Not permitted" caption="This console is staff-only." />
			</Pane>
		);
	}
	if (state === "error") {
		return (
			<Pane>
				<PaneHead title="Revenue" />
				<p className="font-sans text-[13px] text-danger">Could not load.</p>
			</Pane>
		);
	}
	if (state === "loading" || !data) {
		return (
			<Pane>
				<PaneHead title="Revenue" />
				<AdminSkeleton />
			</Pane>
		);
	}

	const m = data.memberships;
	const p = data.paidPosts;
	const c = data.campaigns;
	const untiered = m.byTier.find((t: any) => !t.tier);

	return (
		<div className="flex flex-col gap-4">
			<Pane>
				<PaneHead
					title="Revenue"
					caption="Social only — memberships and paid posts. Wallet and shop earn separately."
				/>
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<Stat
						label="Recurring monthly"
						value={money(m.mrrMinor)}
						tone="gold"
						sub={`${m.byTier.reduce((s: number, t: any) => s + t.count, 0)} active memberships`}
					/>
					<Stat
						label="Platform share of sales"
						value={money(p.platformMinor)}
						sub={`${p.unitsSold} unlocked · lifetime`}
					/>
					<Stat
						label="Paid out to authors"
						value={money(p.authorMinor)}
						sub="60% of every sale"
					/>
					<Stat
						label="Past due"
						value={String(m.pastDue)}
						tone={m.pastDue > 0 ? "danger" : undefined}
						sub="inside the 3-day window"
					/>
				</div>
			</Pane>

			<div className="grid gap-4 lg:grid-cols-2">
				<Pane>
					<PaneHead
						title="Memberships"
						caption="The whole charge is the platform's"
					/>
					{m.byTier.length === 0 ? (
						<p className="font-sans text-[13px] text-subtle">
							No active memberships.
						</p>
					) : (
						m.byTier.map((t: any) => (
							<Row
								key={String(t.tier)}
								label={TIER_LABEL[t.tier] ?? "No tier set"}
								caption={
									t.tier
										? `${t.count} × ${money(t.priceMinor)}`
										: "malformed subscription — see below"
								}
								value={money(t.minor)}
								tone={t.tier ? undefined : "muted"}
							/>
						))
					)}
					<Row
						label="New this month"
						value={String(m.newInWindow)}
						tone="muted"
					/>
					<Row
						label="Cancelled this month"
						value={String(m.churnedInWindow)}
						tone="muted"
					/>
					{untiered && (
						<Caveat>
							<strong className="text-primary">
								{untiered.count} active membership
								{untiered.count === 1 ? " has" : "s have"} no tier
							</strong>{" "}
							and therefore no price. They contribute nothing to the figure
							above, so recurring revenue is understated by whatever they should
							be charged. Worth fixing at the source.
						</Caveat>
					)}
				</Pane>

				<Pane>
					<PaneHead title="Paid posts" caption="Split 60% author / 40% platform" />
					<Row label="Listings" value={String(p.listings)} />
					<Row label="Units sold" value={String(p.unitsSold)} />
					<Row label="Gross" value={money(p.grossMinor)} />
					<Row label="Platform keeps" value={money(p.platformMinor)} />
					<Caveat>
						A purchase records only <em>who</em> unlocked, never <em>when</em> —
						so this is a running total and cannot be charted over time until
						purchases carry a date. {data.stories.note}
					</Caveat>
				</Pane>
			</div>

			<Pane>
				<PaneHead
					title="Promoted posts"
					caption="Committed budget, not revenue"
				/>
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<Stat label="Campaigns" value={String(c.count)} />
					<Stat label="Budget committed" value={money(c.budgetMinor)} />
					<Stat label="Recorded spend" value={money(c.committedMinor)} />
					<Stat
						label="Engagements"
						value={formatCompact(c.engagements)}
						sub={`${formatCompact(c.impressions)} impressions`}
					/>
				</div>
				<Caveat>
					<strong className="text-primary">
						None of this money has been collected.
					</strong>{" "}
					Campaign spend increments a counter and never debits a wallet, so it is
					shown apart from revenue and excluded from every total on this page.
					Either wire the charge or treat promotion as free — reporting it as
					income would be the one dishonest number in this console.
				</Caveat>
			</Pane>
		</div>
	);
}
