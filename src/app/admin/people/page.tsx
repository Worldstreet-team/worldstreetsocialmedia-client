"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { adminApiGet, adminApiPost } from "@/lib/admin.actions";
import {
	Btn,
	Card,
	Empty,
	ErrorNote,
	Input,
	ReasonAction,
	Tag,
	fmtDate,
} from "../ui";

/**
 * People desk: search on the left of the flow, one selected person in full
 * below. Every mutation is answered by refetching the detail, so what the
 * screen says is always what the database says.
 */
export default function PeopleDesk() {
	const [q, setQ] = useState("");
	const [users, setUsers] = useState<any[]>([]);
	const [selected, setSelected] = useState<any>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		const t = setTimeout(async () => {
			const r = await adminApiGet("/users", { q: q || undefined, limit: 12 });
			if (r.success) setUsers(r.data.users);
		}, 250);
		return () => clearTimeout(t);
	}, [q]);

	const openDetail = useCallback(async (id: string) => {
		const r = await adminApiGet(`/users/${id}`);
		if (r.success) {
			setSelected(r.data);
			setError("");
		} else setError(r.message);
	}, []);

	const act = async (fn: () => Promise<any>) => {
		const r = await fn();
		if (!r.success) setError(r.message);
		else setError("");
		if (selected) await openDetail(selected.profile._id);
	};

	const p = selected?.profile;

	return (
		<div className="flex flex-col gap-4">
			<h1 className="font-display text-xl font-semibold text-primary">
				People
			</h1>

			<div className="relative">
				<Search
					size={15}
					className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
				/>
				<Input
					placeholder="Search username, email, name, or paste an id…"
					value={q}
					onChange={(e) => setQ(e.target.value)}
					className="!pl-9"
				/>
			</div>

			<div className="flex gap-2 flex-wrap">
				{users.map((u) => (
					<button
						key={u._id}
						type="button"
						onClick={() => openDetail(u._id)}
						className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[13px] ${
							p?._id === u._id
								? "border-brand text-primary bg-chip"
								: "border-hairline text-muted hover:text-primary"
						}`}
					>
						@{u.username}
						{u.staff?.level && <Tag tone="brand">{u.staff.level}</Tag>}
						{u.suspendedAt && <Tag tone="bad">suspended</Tag>}
						{u.isVerified && <Tag tone="good">✓</Tag>}
					</button>
				))}
				{users.length === 0 && <Empty text="No accounts match." />}
			</div>

			{error && <ErrorNote text={error} />}

			{selected && p && (
				<>
					<Card
						title={`@${p.username}`}
						action={
							<span className="text-subtle text-[12px]">{p.email}</span>
						}
					>
						<div className="flex gap-2 flex-wrap text-[13px] mb-3">
							{p.staff?.level && <Tag tone="brand">staff: {p.staff.level}</Tag>}
							{p.isVerified && (
								<Tag tone="good">
									✓ {p.verification?.tier} ({p.verification?.source})
								</Tag>
							)}
							{p.suspendedAt && (
								<Tag tone="bad">suspended: {p.suspensionReason}</Tag>
							)}
							{p.deactivatedAt && <Tag>self-deactivated</Tag>}
							<Tag>quality {Number(p.quality ?? 1).toFixed(2)}</Tag>
							<Tag>{selected.postsCount} posts</Tag>
							{selected.removedPostsCount > 0 && (
								<Tag tone="bad">{selected.removedPostsCount} removed</Tag>
							)}
							<Tag>
								{p.followersCount} followers · {p.followingCount} following
							</Tag>
							{selected.subscription && (
								<Tag tone="brand">
									{selected.subscription.tier} until{" "}
									{fmtDate(selected.subscription.currentPeriodEnd)}
								</Tag>
							)}
						</div>

						<div className="flex gap-2 flex-wrap">
							{p.suspendedAt ? (
								<Btn
									tone="brand"
									small
									onClick={() =>
										act(() => adminApiPost(`/accounts/${p._id}/reinstate`))
									}
								>
									Reinstate
								</Btn>
							) : (
								!p.staff?.level && (
									<ReasonAction
										label="Suspend"
										onConfirm={(reason) =>
											act(() =>
												adminApiPost(`/accounts/${p._id}/suspend`, { reason }),
											)
										}
									/>
								)
							)}
							{p.isVerified && p.verification?.source !== "subscription" ? (
								<Btn
									small
									onClick={() =>
										act(() =>
											adminApiPost(`/users/${p._id}/verification`, {
												op: "revoke",
											}),
										)
									}
								>
									Revoke tick
								</Btn>
							) : (
								!p.isVerified && (
									<Btn
										small
										onClick={() =>
											act(() =>
												adminApiPost(`/users/${p._id}/verification`, {
													op: "grant",
													tier: "bronze",
												}),
											)
										}
									>
										Grant tick
									</Btn>
								)
							)}
							<TierComp
								onComp={(tier, days) =>
									act(() =>
										adminApiPost(`/users/${p._id}/tier`, { tier, days }),
									)
								}
							/>
							<StaffControl
								current={p.staff?.level ?? null}
								onSet={(level) =>
									act(() => adminApiPost(`/staff/${p._id}`, { level }))
								}
							/>
						</div>
					</Card>

					<div className="grid md:grid-cols-2 gap-4">
						<Card title={`Reports against (${selected.reportsAgainst.length})`}>
							{selected.reportsAgainst.length === 0 ? (
								<Empty text="Clean." />
							) : (
								selected.reportsAgainst.map((r: any) => (
									<div key={r._id} className="py-1.5 text-[13px] flex gap-2">
										<Tag tone="bad">{r.reason}</Tag>
										<Tag>{r.status}</Tag>
										<span className="text-muted">
											by @{r.reporter?.username}
										</span>
										<span className="text-subtle ml-auto">
											{fmtDate(r.createdAt)}
										</span>
									</div>
								))
							)}
						</Card>
						<Card title={`Staff history (${selected.auditHistory.length})`}>
							{selected.auditHistory.length === 0 ? (
								<Empty text="Never touched by staff." />
							) : (
								selected.auditHistory.map((e: any) => (
									<div key={e._id} className="py-1.5 text-[13px] flex gap-2">
										<Tag tone="brand">{e.action}</Tag>
										<span className="text-muted">
											by @{e.actor?.username}
										</span>
										{e.reason && (
											<span className="text-muted truncate">“{e.reason}”</span>
										)}
										<span className="text-subtle ml-auto">{fmtDate(e.at)}</span>
									</div>
								))
							)}
						</Card>
					</div>
				</>
			)}
		</div>
	);
}

function TierComp({
	onComp,
}: {
	onComp: (tier: string, days: number) => Promise<void>;
}) {
	const [open, setOpen] = useState(false);
	const [tier, setTier] = useState("bronze");
	const [days, setDays] = useState(30);
	if (!open)
		return (
			<Btn small onClick={() => setOpen(true)}>
				Comp tier
			</Btn>
		);
	return (
		<span className="inline-flex items-center gap-1.5">
			<select
				value={tier}
				onChange={(e) => setTier(e.target.value)}
				className="glass-tile rounded-lg px-2 py-1.5 text-[13px] text-primary"
			>
				<option value="bronze">bronze</option>
				<option value="silver">silver</option>
				<option value="gold">gold</option>
			</select>
			<Input
				type="number"
				value={days}
				onChange={(e) => setDays(Number(e.target.value))}
				className="!w-20"
				min={1}
				max={365}
			/>
			<Btn
				tone="brand"
				small
				onClick={async () => {
					await onComp(tier, days);
					setOpen(false);
				}}
			>
				Comp
			</Btn>
			<Btn small onClick={() => setOpen(false)}>
				Cancel
			</Btn>
		</span>
	);
}

function StaffControl({
	current,
	onSet,
}: {
	current: string | null;
	onSet: (level: string | null) => Promise<void>;
}) {
	const [open, setOpen] = useState(false);
	if (!open)
		return (
			<Btn small onClick={() => setOpen(true)}>
				Staff: {current ?? "none"}
			</Btn>
		);
	return (
		<span className="inline-flex items-center gap-1.5">
			{["moderator", "admin"].map((l) => (
				<Btn
					key={l}
					small
					tone={current === l ? "brand" : "neutral"}
					onClick={async () => {
						await onSet(l);
						setOpen(false);
					}}
				>
					{l}
				</Btn>
			))}
			{current && (
				<Btn
					small
					tone="danger"
					onClick={async () => {
						await onSet(null);
						setOpen(false);
					}}
				>
					Revoke
				</Btn>
			)}
			<Btn small onClick={() => setOpen(false)}>
				Cancel
			</Btn>
		</span>
	);
}
