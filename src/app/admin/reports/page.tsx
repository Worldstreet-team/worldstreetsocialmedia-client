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
	fmtDate,
} from "../ui";

const STATUSES = ["pending", "reviewing", "actioned", "dismissed"] as const;

/**
 * The queue, oldest first — every report is a promise to whoever filed it.
 * Resolving and acting live on the same card: the moderator judges the live
 * post beside the file-time evidence and closes the loop without leaving.
 */
export default function ReportsDesk() {
	const [status, setStatus] = useState<string>("pending");
	const [reports, setReports] = useState<any[]>([]);
	const [total, setTotal] = useState(0);
	const [error, setError] = useState("");
	const [loaded, setLoaded] = useState(false);

	const refresh = useCallback(async () => {
		const r = await adminApiGet("/reports", { status, limit: 50 });
		if (r.success) {
			setReports(r.data.reports);
			setTotal(r.data.total);
			setError("");
		} else setError(r.message);
		setLoaded(true);
	}, [status]);

	useEffect(() => {
		setLoaded(false);
		refresh();
	}, [refresh]);

	const act = async (fn: () => Promise<any>) => {
		const r = await fn();
		if (!r.success) setError(r.message);
		await refresh();
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center gap-3 flex-wrap">
				<h1 className="font-display text-xl font-semibold text-primary">
					Reports
				</h1>
				<span className="text-muted text-[13px]">{total} in view</span>
				<div className="flex gap-1 ml-auto">
					{STATUSES.map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => setStatus(s)}
							className={`px-3 py-1 rounded-full text-[12px] font-medium ${
								status === s ? "bg-chip text-primary" : "text-muted"
							}`}
						>
							{s}
						</button>
					))}
				</div>
			</div>

			{error && <ErrorNote text={error} />}
			{loaded && reports.length === 0 && (
				<Empty text={`No ${status} reports. That's the good outcome.`} />
			)}

			{reports.map((r) => (
				<Card key={r._id}>
					<div className="flex items-center gap-2 flex-wrap text-[13px]">
						<Tag tone="bad">{r.reason}</Tag>
						<Tag>{r.targetType}</Tag>
						<span className="text-muted">
							by <b className="text-primary">@{r.reporter?.username}</b>
						</span>
						{r.targetOwner && (
							<span className="text-muted">
								against{" "}
								<b className="text-primary">@{r.targetOwner.username}</b>
							</span>
						)}
						<span className="text-subtle ml-auto">{fmtDate(r.createdAt)}</span>
					</div>

					{r.details && (
						<p className="text-primary text-[13px] mt-2">“{r.details}”</p>
					)}

					{r.targetType === "post" && (
						<div className="mt-3 glass-tile rounded-lg p-3 text-[13px]">
							{r.livePost ? (
								<>
									<div className="text-muted text-[12px] mb-1">
										Live post by @{r.livePost.author?.username}
										{r.livePost.removedAt && (
											<Tag tone="bad">already removed</Tag>
										)}
									</div>
									<div className="text-primary whitespace-pre-wrap break-words">
										{r.livePost.content || "(media post)"}
									</div>
								</>
							) : (
								<div className="text-subtle">
									Post is gone — file-time evidence:{" "}
									{JSON.stringify(r.evidence ?? {}).slice(0, 300)}
								</div>
							)}
						</div>
					)}

					{(r.status === "pending" || r.status === "reviewing") && (
						<div className="flex items-center gap-2 flex-wrap mt-3">
							<ResolveControl
								onResolve={(s, note) =>
									act(() =>
										adminApiPost(`/reports/${r._id}/resolve`, {
											status: s,
											resolution: note,
										}),
									)
								}
							/>
							{r.targetType === "post" &&
								r.livePost &&
								!r.livePost.removedAt && (
									<ReasonAction
										label="Remove post"
										onConfirm={(reason) =>
											act(() =>
												adminApiPost(`/posts/${r.livePost._id}/remove`, {
													reason,
												}),
											)
										}
									/>
								)}
							{r.targetOwner && !r.targetOwner.suspendedAt && (
								<ReasonAction
									label={`Suspend @${r.targetOwner.username}`}
									onConfirm={(reason) =>
										act(() =>
											adminApiPost(`/accounts/${r.targetOwner._id}/suspend`, {
												reason,
											}),
										)
									}
								/>
							)}
						</div>
					)}

					{(r.status === "actioned" || r.status === "dismissed") && (
						<div className="text-muted text-[12px] mt-2">
							Resolved {fmtDate(r.reviewedAt)}
							{r.resolution && <> — “{r.resolution}”</>}
						</div>
					)}
				</Card>
			))}
		</div>
	);
}

function ResolveControl({
	onResolve,
}: {
	onResolve: (status: "actioned" | "dismissed", note: string) => Promise<void>;
}) {
	const [open, setOpen] = useState<null | "actioned" | "dismissed">(null);
	const [note, setNote] = useState("");
	const [busy, setBusy] = useState(false);

	if (!open) {
		return (
			<>
				<Btn tone="brand" small onClick={() => setOpen("actioned")}>
					Action taken
				</Btn>
				<Btn small onClick={() => setOpen("dismissed")}>
					Dismiss
				</Btn>
			</>
		);
	}
	return (
		<span className="inline-flex items-center gap-1.5 flex-wrap">
			<Input
				autoFocus
				placeholder={`Resolution note (${open})`}
				value={note}
				onChange={(e) => setNote(e.target.value)}
				className="!w-64"
			/>
			<Btn
				tone="brand"
				small
				busy={busy}
				onClick={async () => {
					setBusy(true);
					try {
						await onResolve(open, note.trim());
						setOpen(null);
						setNote("");
					} finally {
						setBusy(false);
					}
				}}
			>
				Resolve as {open}
			</Btn>
			<Btn small onClick={() => setOpen(null)}>
				Cancel
			</Btn>
		</span>
	);
}
