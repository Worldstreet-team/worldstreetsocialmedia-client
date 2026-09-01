"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye } from "@phosphor-icons/react";
import { Radio } from "lucide-react";
import { listLiveStreamsAction } from "@/lib/live.actions";

import { useT } from "@/i18n/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

interface Row {
	id: string;
	title: string;
	category: string;
	viewers: number;
	username: string;
	avatar: string;
}

/** The live directory: everything broadcasting right now, watchable in-app. */
export default function LiveNowPage() {
	const t = useT();
	const [rows, setRows] = useState<Row[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			const res = await listLiveStreamsAction();
			if (cancelled) return;
			setRows(res.streams);
			setLoading(false);
		};
		void load();
		const poll = setInterval(() => {
			if (document.visibilityState !== "hidden") load();
		}, 20_000);
		return () => {
			cancelled = true;
			clearInterval(poll);
		};
	}, []);

	return (
		// pb-nav: clear the fixed bottom tab bar, like every (main) sibling.
		<div className="pb-nav md:pb-10">
			<header className="sticky top-0 z-sticky h-14 border-b border-hairline bg-page flex items-center px-4">
				<h1 className="font-display text-[17px] font-semibold tracking-tight">
					{t("liveNow.title")}
				</h1>
			</header>

			{loading ? (
				<div className="p-4 space-y-3">
					{[1, 2, 3].map((i) => (
						<div key={i} className="h-20 skeleton rounded-xl" />
					))}
				</div>
			) : rows.length === 0 ? (
				<EmptyState
					icon={Radio}
					title={t("liveNow.emptyTitle")}
					caption={t("liveNow.emptyCaption")}
				/>
			) : (
				<div className="p-3 flex flex-col gap-2.5">
					{rows.map((row) => (
						<Link
							key={row.id}
							href={`/live?tab=live&s=${row.id}`}
							className="flex items-center gap-3.5 rounded-xl border border-hairline bg-surface/60 px-4 py-3 hover:bg-raised/40 transition-colors"
						>
							<span className="relative w-12 h-12 rounded-pill p-[2px] bg-danger shrink-0">
								<span className="relative block w-full h-full rounded-pill overflow-hidden border-2 border-page bg-raised">
									<SafeAvatar src={row.avatar} className="object-cover" />
								</span>
							</span>
							<span className="min-w-0 flex-1">
								<span className="block font-sans text-[14.5px] font-semibold text-primary truncate">
									{row.title}
								</span>
								<span className="block font-sans text-[12.5px] text-subtle truncate">
									@{row.username}
									{row.category ? ` · ${row.category}` : ""}
								</span>
							</span>
							<span className="flex items-center gap-1.5 font-sans text-[12.5px] text-muted tabular-nums shrink-0">
								<Eye size={14} />
								{row.viewers}
							</span>
							<span className="shrink-0 flex items-center gap-1 rounded-[4px] bg-danger px-1.5 py-px text-[10px] font-bold tracking-wide text-white font-sans">
								{t("live.badge")}
							</span>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
