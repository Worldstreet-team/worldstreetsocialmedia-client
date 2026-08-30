"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApiGet, adminApiPost } from "@/lib/admin.actions";
import {
	Btn,
	Card,
	Empty,
	ErrorNote,
	Input,
	ReasonAction,
	Tag,
	usd,
} from "../ui";

/**
 * The money desk. Adjustments and refunds mint an idempotency key when the
 * form opens, and reuse it for every retry of that intent — a double-click
 * or a flaky network replays the same money movement instead of repeating it.
 */
export default function MoneyDesk() {
	const [campaigns, setCampaigns] = useState<any[]>([]);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");

	const refresh = useCallback(async () => {
		const r = await adminApiGet("/campaigns", { limit: 50 });
		if (r.success) setCampaigns(r.data.campaigns);
		else setError(r.message);
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const act = async (fn: () => Promise<any>, done?: string) => {
		setNotice("");
		const r = await fn();
		if (!r.success) setError(r.message);
		else {
			setError("");
			if (done) setNotice(done);
		}
		await refresh();
		return r;
	};

	return (
		<div className="flex flex-col gap-4">
			<h1 className="font-display text-xl font-semibold text-primary">
				Money
			</h1>
			{error && <ErrorNote text={error} />}
			{notice && <div className="text-success text-[13px]">{notice}</div>}

			<Card title={`Campaigns (${campaigns.length})`}>
				{campaigns.length === 0 ? (
					<Empty text="No campaigns." />
				) : (
					<div className="flex flex-col divide-y divide-(--ws-hairline)">
						{campaigns.map((c) => (
							<div
								key={c._id}
								className="py-2.5 flex items-center gap-3 text-[13px] flex-wrap"
							>
								<Tag
									tone={
										c.status === "active"
											? "good"
											: c.status === "paused"
												? "bad"
												: "neutral"
									}
								>
									{c.status}
								</Tag>
								<span className="text-primary font-medium">
									@{c.owner?.username}
								</span>
								<span className="text-muted truncate max-w-60">
									{c.post?.content?.slice(0, 60) || "(media)"}
								</span>
								<span className="text-muted ml-auto tabular-nums">
									{usd(c.spentUsdMinor)} / {usd(c.budgetUsdMinor)} · bid{" "}
									{usd(c.bidUsdMinor)}
								</span>
								{c.status === "active" && (
									<ReasonAction
										label="Pause"
										onConfirm={(reason) =>
											act(
												() =>
													adminApiPost(`/campaigns/${c._id}/pause`, { reason }),
												"Campaign paused.",
											).then(() => {})
										}
									/>
								)}
								{c.status === "paused" && (
									<Btn
										small
										onClick={() =>
											act(
												() => adminApiPost(`/campaigns/${c._id}/resume`),
												"Campaign resumed.",
											)
										}
									>
										Resume
									</Btn>
								)}
							</div>
						))}
					</div>
				)}
			</Card>

			<div className="grid md:grid-cols-2 gap-4">
				<AdjustCard act={act} />
				<RefundCard act={act} />
			</div>
		</div>
	);
}

function AdjustCard({
	act,
}: {
	act: (fn: () => Promise<any>, done?: string) => Promise<any>;
}) {
	const [user, setUser] = useState("");
	const [direction, setDirection] = useState("credit");
	const [amount, setAmount] = useState("");
	const [reason, setReason] = useState("");
	// Minted when the intent is formed; survives retries of the same intent.
	const [key, setKey] = useState(() => crypto.randomUUID());
	const [busy, setBusy] = useState(false);

	const amountMinor = Math.round(Number(amount) * 100);
	const valid = user.trim() && reason.trim() && amountMinor > 0;

	return (
		<Card title="Wallet adjustment">
			<div className="flex flex-col gap-2">
				<Input
					placeholder="@username or id"
					value={user}
					onChange={(e) => setUser(e.target.value)}
				/>
				<div className="flex gap-2">
					<select
						value={direction}
						onChange={(e) => setDirection(e.target.value)}
						className="glass-tile rounded-lg px-2 py-1.5 text-[13px] text-primary"
					>
						<option value="credit">credit</option>
						<option value="debit">debit</option>
					</select>
					<Input
						placeholder="Amount (USD)"
						type="number"
						min="0.01"
						step="0.01"
						value={amount}
						onChange={(e) => setAmount(e.target.value)}
					/>
				</div>
				<Input
					placeholder="Reason (lands in the audit trail)"
					value={reason}
					onChange={(e) => setReason(e.target.value)}
				/>
				<div>
					<Btn
						tone="brand"
						busy={busy}
						disabled={!valid}
						onClick={async () => {
							setBusy(true);
							try {
								const r = await act(
									() =>
										adminApiPost(
											`/wallet/${encodeURIComponent(user.trim().replace(/^@/, ""))}/adjust`,
											{
												direction,
												amountMinor,
												reason: reason.trim(),
												idempotencyKey: key,
											},
										),
									`${direction === "credit" ? "Credited" : "Debited"} $${amount}.`,
								);
								if (r.success) {
									setUser("");
									setAmount("");
									setReason("");
									setKey(crypto.randomUUID());
								}
							} finally {
								setBusy(false);
							}
						}}
					>
						{direction === "credit" ? "Credit wallet" : "Debit wallet"}
					</Btn>
				</div>
				<p className="text-subtle text-[12px]">
					Capped at $5,000 per move. Retries reuse the same idempotency key,
					so a double-click cannot pay twice.
				</p>
			</div>
		</Card>
	);
}

function RefundCard({
	act,
}: {
	act: (fn: () => Promise<any>, done?: string) => Promise<any>;
}) {
	const [kind, setKind] = useState("subscription");
	const [user, setUser] = useState("");
	const [post, setPost] = useState("");
	const [reason, setReason] = useState("");
	const [busy, setBusy] = useState(false);

	const valid =
		user.trim() && reason.trim() && (kind === "subscription" || post.trim());

	return (
		<Card title="Refund">
			<div className="flex flex-col gap-2">
				<select
					value={kind}
					onChange={(e) => setKind(e.target.value)}
					className="glass-tile rounded-lg px-2 py-1.5 text-[13px] text-primary"
				>
					<option value="subscription">Subscription (current period)</option>
					<option value="post_unlock">Paid-post unlock</option>
				</select>
				<Input
					placeholder="Buyer: @username or id"
					value={user}
					onChange={(e) => setUser(e.target.value)}
				/>
				{kind === "post_unlock" && (
					<Input
						placeholder="Post id"
						value={post}
						onChange={(e) => setPost(e.target.value)}
					/>
				)}
				<Input
					placeholder="Reason (required)"
					value={reason}
					onChange={(e) => setReason(e.target.value)}
				/>
				<div>
					<Btn
						tone="brand"
						busy={busy}
						disabled={!valid}
						onClick={async () => {
							setBusy(true);
							try {
								const r = await act(
									() =>
										adminApiPost("/refunds", {
											kind,
											user: user.trim().replace(/^@/, ""),
											...(kind === "post_unlock"
												? { post: post.trim() }
												: {}),
											reason: reason.trim(),
										}),
									"Refund issued.",
								);
								if (r.success) {
									setUser("");
									setPost("");
									setReason("");
								}
							} finally {
								setBusy(false);
							}
						}}
					>
						Issue refund
					</Btn>
				</div>
				<p className="text-subtle text-[12px]">
					A subscription refund cancels the period and takes back the mark it
					paid for. A post refund also revokes the buyer&apos;s access.
				</p>
			</div>
		</Card>
	);
}
