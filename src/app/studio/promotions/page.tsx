"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Megaphone } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";
import {
	getMyCampaignsAction,
	updateCampaignAction,
} from "@/lib/campaign.actions";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { fmt } from "@/components/studio/studio-ui";

interface Campaign {
	_id: string;
	status: "active" | "paused" | "exhausted";
	budgetUsdMinor: number;
	spentUsdMinor: number;
	bidUsdMinor: number;
	stats: { impressions: number; engagements: number };
	post?: { content?: string };
	createdAt: string;
}

const usd = (minor: number) => `$${(minor / 100).toFixed(2)}`;

/** Promotions manager: every campaign with its spend bar, CPE, and the
 *  pause/resume + top-up controls the gateway now supports. */
export default function StudioPromotions() {
	const t = useT();
	const { toast } = useToast();
	const [campaigns, setCampaigns] = useState<Campaign[]>([]);
	const [loading, setLoading] = useState(true);
	const [busyId, setBusyId] = useState<string | null>(null);

	const load = async () => {
		const res = await getMyCampaignsAction();
		if (res.success) setCampaigns(res.campaigns);
		setLoading(false);
	};

	useEffect(() => {
		void load();
	}, []);

	const mutate = async (
		id: string,
		body: { status?: "active" | "paused"; addBudgetUsdMinor?: number },
	) => {
		setBusyId(id);
		const res = await updateCampaignAction(id, body);
		if (res.success) await load();
		else toast(res.message ?? t("promo.failed"), { type: "error" });
		setBusyId(null);
	};

	return (
		<div>
			<p className="font-sans text-[13px] text-muted mb-3 max-w-[68ch]">
				{t("studio.promo.caption")}
			</p>

			{loading ? (
				<div className="space-y-3">
					{[1, 2].map((i) => (
						<div key={i} className="rounded-xl h-24 skeleton" />
					))}
				</div>
			) : campaigns.length === 0 ? (
				<div className="rounded-xl border border-hairline bg-surface/60 p-8 text-center">
					<span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-pill bg-raised text-subtle">
						<Megaphone size={22} />
					</span>
					<p className="font-sans text-sm text-muted">
						{t("studio.promo.empty")}
					</p>
					<p className="font-sans text-[12.5px] text-subtle mt-1">
						{t("studio.promo.emptyHint")}
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-2.5">
					{campaigns.map((c) => {
						const pct = Math.min(
							100,
							(c.spentUsdMinor / Math.max(1, c.budgetUsdMinor)) * 100,
						);
						const cpe =
							c.stats.engagements > 0
								? usd(c.spentUsdMinor / c.stats.engagements)
 : "";
						return (
							<div key={c._id} className="rounded-xl border border-hairline bg-surface/60 p-3.5">
								<div className="flex items-start justify-between gap-3">
									<p className="font-sans text-[14px] text-primary line-clamp-1 min-w-0">
										{c.post?.content || t("studio.mediaPost")}
									</p>
									<span
										className={clsx(
											"shrink-0 rounded-pill px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide font-sans",
											c.status === "active" &&
												"bg-success/10 text-success",
											c.status === "paused" &&
												"bg-raised text-muted",
											c.status === "exhausted" &&
												"bg-danger/10 text-danger",
										)}
									>
										{t(`studio.promo.${c.status}`)}
									</span>
								</div>

								<div className="mt-3">
									<div className="flex items-center justify-between font-sans text-[12.5px] text-muted mb-1 tabular-nums">
										<span>
											{usd(c.spentUsdMinor)} / {usd(c.budgetUsdMinor)}
										</span>
										<span>
											{t("studio.promo.bid")} {usd(c.bidUsdMinor)}
										</span>
									</div>
									<div className="h-1.5 rounded-pill bg-raised overflow-hidden">
										<div
											className={clsx(
												"h-full rounded-pill",
												c.status === "exhausted"
													? "bg-danger/70"
													: "bg-brand/80",
											)}
											style={{ width: `${pct}%` }}
										/>
									</div>
								</div>

								<div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
									<div className="flex items-center gap-4 font-sans text-[12.5px] text-muted tabular-nums">
										<span>
											{fmt(c.stats.impressions)}{" "}
											{t("studio.impressions").toLowerCase()}
										</span>
										<span>
											{fmt(c.stats.engagements)}{" "}
											{t("studio.engagements").toLowerCase()}
										</span>
										<span>
											{t("studio.promo.cpe")} {cpe}
										</span>
									</div>
									<div className="flex items-center gap-2">
										{c.status !== "exhausted" && (
											<button
												type="button"
												disabled={busyId === c._id}
												onClick={() =>
													mutate(c._id, {
														status:
															c.status === "active"
																? "paused"
																: "active",
													})
												}
												className="h-8 px-3.5 rounded-pill bg-raised/70 text-primary font-sans text-[12.5px] font-semibold hover:bg-raised transition-colors cursor-pointer disabled:opacity-50"
											>
												{c.status === "active"
													? t("studio.promo.pause")
													: t("studio.promo.resume")}
											</button>
										)}
										<button
											type="button"
											disabled={busyId === c._id}
											onClick={() =>
												mutate(c._id, { addBudgetUsdMinor: 500 })
											}
											className="h-8 px-3.5 rounded-pill bg-primary text-page font-sans text-[12.5px] font-semibold hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
										>
											{t("studio.promo.topUp")}
										</button>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
