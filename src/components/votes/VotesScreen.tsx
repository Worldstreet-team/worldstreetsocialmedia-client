"use client";

import { useBackWithFallback } from "@/lib/nav";
import clsx from "clsx";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Crown, Lightning } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { VoteCountdown } from "@/components/votes/VoteCountdown";
import { formatCompact } from "@/lib/utils";
import { getVoteLeaderboard } from "@/lib/votes";

interface BoardRow {
	post: {
		id: string;
		content: string;
		image: string | null;
		video: string | null;
		hasAudio: boolean;
		locked: boolean;
	};
	author: {
		id: string;
		username: string;
		name: string;
		avatar?: string;
		isVerified?: boolean;
		verification?: any;
	};
	votes: number;
}

const PRIZE: Record<string, string> = {
	bronze: "$50",
	silver: "$100",
	gold: "$200",
};

/**
 * The stage. Rank 1 is the hero — face, name, count, the post itself —
 * everyone else races beneath, and the gold clock over it all says exactly
 * how long they have to change the order. History rows at the bottom prove
 * the money is real, week after week.
 */
export function VotesScreen() {
	const router = useRouter();
	const goBack = useBackWithFallback();
	const [board, setBoard] = useState<BoardRow[] | null>(null);
	const [history, setHistory] = useState<any[]>([]);

	useEffect(() => {
		// The 60s module cache resolves synchronously-fast on a revisit, so
		// the skeletons only ever show on a genuinely cold stage.
		void getVoteLeaderboard().then((res: any) => {
			setBoard(res?.board ?? []);
			setHistory(res?.history ?? []);
		});
	}, []);

	const leader = board?.[0];
	const rest = board?.slice(1) ?? [];

	return (
		<div className="mx-auto min-h-dvh w-full max-w-[680px] pb-nav md:pb-10">
			<header className="sticky top-0 z-sticky flex items-center gap-3 bg-page px-4 py-3">
				<button
					type="button"
					onClick={() => goBack("/")}
					aria-label="Back"
					className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-raised hover:text-primary"
				>
					<ArrowLeft size={19} />
				</button>
				<div>
					<h1 className="font-display text-lg font-semibold leading-5 text-primary">
						The Weekly Vote
					</h1>
					<p className="font-sans text-[12px] text-subtle">
						Most-voted post wins · paid every Friday night
					</p>
				</div>
			</header>

			<div className="animate-rise flex flex-col items-center gap-2 px-4 pb-6 pt-4 text-center">
				<VoteCountdown size="lg" />
				<p className="shine-pill inline-block rounded-pill px-4 py-2 font-sans text-[13px] font-semibold text-gold">
					Ends Friday 11:59 PM · winner paid by tick — Bronze $50 · Silver
					$100 · Gold $200
				</p>
			</div>

			{board === null ? (
				<div className="flex flex-col gap-3 px-4">
					{[0, 1, 2].map((i) => (
						<div key={i} className="skeleton h-20 w-full rounded-xl" />
					))}
				</div>
			) : board.length === 0 ? (
				<p className="px-6 py-14 text-center font-sans text-[14px] text-muted">
					No votes yet this week — the first free vote starts the race.
				</p>
			) : (
				<div className="flex flex-col gap-1.5 px-3">
					{leader && (
						<Link
							href={`/post/${leader.post.id}`}
							className="animate-rise relative overflow-hidden rounded-xl bg-surface p-5 transition-colors hover:bg-raised"
						>
							<div className="flex items-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-widest text-gold">
								<Crown size={15} weight="fill" />
								Leading this week
							</div>
							<div className="mt-3 flex items-center gap-3">
								<span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-pill bg-raised">
									<SafeAvatar src={leader.author.avatar} />
								</span>
								<div className="min-w-0 flex-1">
									<span className="flex items-center gap-1.5">
										<span className="truncate font-display text-[17px] font-semibold text-primary">
											{leader.author.name}
										</span>
										<UserBadges
											isVerified={leader.author.isVerified}
											verification={leader.author.verification}
							badges={(leader.author as any)?.badges}
											size={15}
										/>
									</span>
									<span className="font-sans text-[13px] text-muted">
										@{leader.author.username}
									</span>
								</div>
								<div className="flex flex-col items-end">
									<span className="flex items-center gap-1.5 font-display text-[30px] font-semibold leading-none tabular-nums text-gold">
										<Lightning size={20} weight="fill" />
										{formatCompact(leader.votes)}
									</span>
									<span className="font-sans text-[11px] uppercase tracking-widest text-subtle">
										votes
									</span>
								</div>
							</div>
							{(leader.post.content || leader.post.image) && (
								<div className="mt-3 flex items-center gap-3">
									{leader.post.image && (
										<span className="block h-14 w-14 shrink-0 overflow-hidden rounded-[7px] bg-raised">
											{/* eslint-disable-next-line @next/next/no-img-element */}
											<img
												src={leader.post.image}
												alt=""
												className="h-full w-full object-cover"
											/>
										</span>
									)}
									<p className="line-clamp-2 font-sans text-[14px] text-muted">
										{leader.post.content ||
											(leader.post.video
												? "Video post"
												: leader.post.hasAudio
													? "Voice post"
													: "")}
									</p>
								</div>
							)}
						</Link>
					)}

					{rest.map((row, i) => (
						<Link
							key={row.post.id}
							href={`/post/${row.post.id}`}
							className="animate-rise flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-surface"
							style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
						>
							<span className="w-7 shrink-0 text-center font-display text-[15px] font-semibold tabular-nums text-subtle">
								{i + 2}
							</span>
							<span className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-pill bg-raised">
								<SafeAvatar src={row.author.avatar} />
							</span>
							<div className="min-w-0 flex-1">
								<span className="flex items-center gap-1.5">
									<span className="truncate font-sans text-[14.5px] font-semibold text-primary">
										{row.author.name}
									</span>
									<UserBadges
										isVerified={row.author.isVerified}
										verification={row.author.verification}
							badges={(row.author as any)?.badges}
										size={13}
									/>
									<span className="min-w-0 truncate font-sans text-[12.5px] text-subtle">
										@{row.author.username}
									</span>
								</span>
								<p className="truncate font-sans text-[13px] text-muted">
									{row.post.content ||
										(row.post.video
											? "Video post"
											: row.post.hasAudio
												? "Voice post"
												: "")}
								</p>
							</div>
							<span className="flex shrink-0 items-center gap-1 font-display text-[16px] font-semibold tabular-nums text-gold">
								<Lightning size={13} weight="fill" />
								{formatCompact(row.votes)}
							</span>
						</Link>
					))}
				</div>
			)}

			{history.length > 0 && (
				<div className="mt-10 px-4">
					<h2 className="font-sans text-[12px] font-semibold uppercase tracking-widest text-subtle">
						Past winners
					</h2>
					<div className="mt-2 flex flex-col">
						{history.map((h: any) => (
							<div
								key={h.cycle}
								className="flex items-center gap-3 py-2.5"
							>
								<span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-pill bg-raised">
									<SafeAvatar src={h.winnerAuthor?.avatar} />
								</span>
								<div className="min-w-0 flex-1">
									<span className="flex items-center gap-1.5 font-sans text-[13.5px] font-semibold text-primary">
										{h.winnerAuthor
											? [
													h.winnerAuthor.firstName,
													h.winnerAuthor.lastName,
												]
													.filter(Boolean)
													.join(" ") || h.winnerAuthor.username
											: "No verified winner"}
										{h.winnerAuthor && (
											<UserBadges
												isVerified={h.winnerAuthor.isVerified}
												verification={h.winnerAuthor.verification}
							badges={(h.winnerAuthor as any)?.badges}
												size={13}
											/>
										)}
									</span>
									<span className="font-sans text-[12px] text-subtle">
										Week of {h.cycle}
										{h.passedDown ? " · highest verified" : ""}
									</span>
								</div>
								<div className="flex flex-col items-end">
									{h.prizeMinor ? (
										<span className="font-display text-[15px] font-semibold tabular-nums text-credit">
											${(h.prizeMinor / 100).toFixed(0)}
										</span>
									) : null}
									{h.winnerVotes ? (
										<span
											className={clsx(
												"font-sans text-[11.5px] tabular-nums text-subtle",
											)}
										>
											{formatCompact(h.winnerVotes)} votes
										</span>
									) : null}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
