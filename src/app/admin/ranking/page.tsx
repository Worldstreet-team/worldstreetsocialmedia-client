"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApiGet, adminApiPost, adminApiPut } from "@/lib/admin.actions";
import {
	Btn,
	Card,
	Empty,
	ErrorNote,
	Input,
	Tag,
	fmtDate,
} from "../ui";

/**
 * The feed's knobs, live. The editor works on the OVERRIDE set — what you
 * save replaces it whole, blank fields mean "use the default", and the
 * effective column is what the ranker is multiplying by right now.
 */
export default function RankingDesk() {
	const [cfg, setCfg] = useState<any>(null);
	const [draft, setDraft] = useState<Record<string, string>>({});
	const [weights, setWeights] = useState<any>(null);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [busy, setBusy] = useState(false);

	const refresh = useCallback(async () => {
		const r = await adminApiGet("/ranking");
		if (r.success) {
			setCfg(r.data);
			setDraft(
				Object.fromEntries(
					Object.entries(r.data.overrides ?? {}).map(([k, v]) => [
						k,
						String(v),
					]),
				),
			);
		} else setError(r.message);
	}, []);

	useEffect(() => {
		refresh();
		adminApiGet("/ranking/weights").then((r) => r.success && setWeights(r.data));
	}, [refresh]);

	const save = async () => {
		setBusy(true);
		setNotice("");
		try {
			const overrides: Record<string, number> = {};
			for (const [k, v] of Object.entries(draft)) {
				if (v.trim() !== "") overrides[k] = Number(v);
			}
			const r = await adminApiPut("/ranking", { overrides });
			if (r.success) {
				setNotice("Saved — live within a minute on every instance.");
				setError("");
				await refresh();
			} else setError(r.message);
		} finally {
			setBusy(false);
		}
	};

	if (!cfg)
		return <div className="text-muted text-sm">Loading the tune…</div>;

	const knobs = Object.keys(cfg.defaults);

	return (
		<div className="flex flex-col gap-4">
			<h1 className="font-display text-xl font-semibold text-primary">
				Ranking
			</h1>
			{error && <ErrorNote text={error} />}
			{notice && <div className="text-success text-[13px]">{notice}</div>}

			<Card
				title="Knobs"
				action={
					<div className="flex gap-2">
						<Btn small onClick={() => setDraft({})}>
							Clear all overrides
						</Btn>
						<Btn tone="brand" small busy={busy} onClick={save}>
							Save tune
						</Btn>
					</div>
				}
			>
				<div className="overflow-x-auto">
					<table className="w-full text-[13px]">
						<thead>
							<tr className="text-muted text-left text-[11px] uppercase tracking-wide">
								<th className="py-1.5 pr-3">Knob</th>
								<th className="py-1.5 pr-3">Default</th>
								<th className="py-1.5 pr-3">Effective</th>
								<th className="py-1.5 pr-3">Override</th>
								<th className="py-1.5">Bounds</th>
							</tr>
						</thead>
						<tbody>
							{knobs.map((k) => {
								const overridden =
									draft[k] !== undefined && draft[k].trim() !== "";
								return (
									<tr key={k} className="border-t border-hairline">
										<td className="py-1.5 pr-3 text-primary font-medium">
											{k}
											{overridden && <Tag tone="brand">set</Tag>}
										</td>
										<td className="py-1.5 pr-3 text-muted tabular-nums">
											{cfg.defaults[k]}
										</td>
										<td className="py-1.5 pr-3 text-primary tabular-nums">
											{cfg.effective[k]}
										</td>
										<td className="py-1.5 pr-3">
											<Input
												type="number"
												step="any"
												placeholder="—"
												value={draft[k] ?? ""}
												onChange={(e) =>
													setDraft((d) => ({ ...d, [k]: e.target.value }))
												}
												className="!w-24"
											/>
										</td>
										<td className="py-1.5 text-subtle tabular-nums">
											[{cfg.bounds[k][0]}, {cfg.bounds[k][1]}]
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</Card>

			{weights?.measured && (
				<Card title={`Measured scarcity prices (${weights.pairs} viewed pairs)`}>
					<div className="grid grid-cols-3 gap-3 text-[13px]">
						{(["replyWeight", "repostWeight", "bookmarkWeight"] as const).map(
							(k) => (
								<div key={k} className="bg-sunken rounded-lg p-3">
									<div className="text-muted text-[12px]">{k}</div>
									<div className="text-primary font-display text-lg tabular-nums">
										{weights.measured[k] ?? "—"}
									</div>
									<div className="text-subtle text-[12px]">
										live: {weights.live[k]}
									</div>
								</div>
							),
						)}
					</div>
					<p className="text-subtle text-[12px] mt-3">
						A signal&apos;s scarcity price is how many likes one of it converts
						like, measured from this platform&apos;s own behavior. Paying about
						half the measured price is deliberate — raw counts can be farmed;
						probabilities can&apos;t.
					</p>
				</Card>
			)}

			<Card title="Suppressed trends">
				<SuppressForm
					onDone={async () => {
						await refresh();
					}}
					setError={setError}
				/>
				{cfg.suppressedTags.length === 0 ? (
					<Empty text="Nothing suppressed." />
				) : (
					<div className="flex flex-col divide-y divide-(--ws-hairline) mt-2">
						{cfg.suppressedTags.map((t: any) => (
							<div
								key={t.tag}
								className="py-2 flex items-center gap-3 text-[13px]"
							>
								<span className="text-primary font-medium">#{t.tag}</span>
								<span className="text-muted truncate">“{t.reason}”</span>
								<span className="text-subtle ml-auto">
									until {fmtDate(t.until)}
								</span>
								<Btn
									small
									onClick={async () => {
										const r = await adminApiPost(
											`/trends/${t.tag}/unsuppress`,
										);
										if (!r.success) setError(r.message);
										await refresh();
									}}
								>
									Lift
								</Btn>
							</div>
						))}
					</div>
				)}
			</Card>
		</div>
	);
}

function SuppressForm({
	onDone,
	setError,
}: {
	onDone: () => Promise<void>;
	setError: (s: string) => void;
}) {
	const [tag, setTag] = useState("");
	const [days, setDays] = useState(7);
	const [reason, setReason] = useState("");
	const [busy, setBusy] = useState(false);
	return (
		<div className="flex gap-2 flex-wrap items-center">
			<Input
				placeholder="#tag"
				value={tag}
				onChange={(e) => setTag(e.target.value)}
				className="!w-40"
			/>
			<Input
				type="number"
				min={1}
				max={90}
				value={days}
				onChange={(e) => setDays(Number(e.target.value))}
				className="!w-20"
			/>
			<Input
				placeholder="Reason (required)"
				value={reason}
				onChange={(e) => setReason(e.target.value)}
				className="!w-64"
			/>
			<Btn
				tone="brand"
				small
				busy={busy}
				disabled={!tag.trim() || !reason.trim()}
				onClick={async () => {
					setBusy(true);
					try {
						const r = await adminApiPost(
							`/trends/${encodeURIComponent(tag.trim().replace(/^#/, ""))}/suppress`,
							{ days, reason: reason.trim() },
						);
						if (!r.success) setError(r.message);
						else {
							setTag("");
							setReason("");
						}
						await onDone();
					} finally {
						setBusy(false);
					}
				}}
			>
				Suppress
			</Btn>
		</div>
	);
}
