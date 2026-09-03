"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getPostByIdAction } from "@/lib/post.actions";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { formatTimeAgo } from "@/lib/utils";
import { DEFAULT_AVATAR } from "@/const";

/**
 * A platform post linked INSIDE a post renders as the post itself, not a
 * bare URL (owner 2026-09-03) — the same embed grammar as a quote card.
 *
 * `firstPlatformPostId` finds the link at render time, so old posts get the
 * embed retroactively; nothing new is stored. Only OUR hosts count — a link
 * to someone else's /post/ path must never render as our content.
 */
const POST_LINK_RE =
	/https?:\/\/(?:www\.)?(?:social\.worldstreetgold\.com|localhost:\d+)\/(?:[a-z]{2}\/)?post\/([a-f0-9]{24})/i;

export function firstPlatformPostId(
	content: string | undefined,
	selfId: string,
): string | null {
	if (!content) return null;
	const m = content.match(POST_LINK_RE);
	// A post linking itself embeds nothing — that way lies recursion.
	return m && m[1] !== selfId ? m[1] : null;
}

interface EmbeddedData {
	authorName: string;
	username: string;
	avatar: string;
	isVerified?: boolean;
	verification?: { tier?: "bronze" | "silver" | "gold" } | null;
	badges?: unknown[];
	content: string;
	image?: string;
	createdAt?: string;
	locked?: boolean;
}

/** One fetch per post id per page — feeds repeat links. */
const cache = new Map<string, Promise<EmbeddedData | null>>();

function fetchEmbedded(id: string): Promise<EmbeddedData | null> {
	let p = cache.get(id);
	if (!p) {
		p = getPostByIdAction(id)
			.then((res: any) => {
				if (!res.success || !res.data) return null;
				const post = res.data;
				const a = post.author ?? {};
				return {
					authorName:
						a.firstName && a.lastName
							? `${a.firstName} ${a.lastName}`
							: a.username || "Unknown",
					username: a.username ?? "",
					avatar: a.avatar || DEFAULT_AVATAR,
					isVerified: a.isVerified,
					verification: a.verification,
					badges: a.badges,
					content: String(post.content ?? ""),
					image: post.images?.[0],
					createdAt: post.createdAt,
					locked: Boolean(post.sale?.locked),
				};
			})
			.catch(() => null);
		cache.set(id, p);
	}
	return p;
}

export function EmbeddedPost({ postId }: { postId: string }) {
	const [data, setData] = useState<EmbeddedData | null | "loading">("loading");

	useEffect(() => {
		let alive = true;
		void fetchEmbedded(postId).then((d) => {
			if (alive) setData(d);
		});
		return () => {
			alive = false;
		};
	}, [postId]);

	// Deleted/unfetchable: the text link in the body still works — show nothing
	// rather than a broken card.
	if (data === null) return null;

	if (data === "loading") {
		return (
			<div className="relative z-10 mt-3 rounded-xl border border-hairline p-3 pointer-events-auto">
				<div className="skeleton mb-2 h-3.5 w-1/3 rounded-sm" />
				<div className="skeleton h-3 w-2/3 rounded-sm" />
			</div>
		);
	}

	return (
		<Link
			href={`/post/${postId}`}
			onClick={(e) => e.stopPropagation()}
			className="relative z-10 mt-3 block overflow-hidden rounded-xl border border-hairline transition-colors hover:bg-surface pointer-events-auto"
		>
			<div className="flex gap-3 p-3">
				<div className="min-w-0 flex-1">
					<span className="flex items-center gap-1 font-sans text-[13.5px] leading-snug">
						<span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-pill bg-raised">
							<SafeAvatar src={data.avatar} />
						</span>
						<span className="ml-0.5 truncate font-semibold text-primary">
							{data.authorName}
						</span>
						<UserBadges
							isVerified={data.isVerified}
							verification={data.verification}
							badges={data.badges as any}
							size={12}
						/>
						{data.username && (
							<span className="truncate text-subtle">
								@{data.username}
							</span>
						)}
						{data.createdAt && (
							<span className="shrink-0 text-subtle">
								· {formatTimeAgo(data.createdAt)}
							</span>
						)}
					</span>
					<p className="mt-1 font-sans text-[13.5px] leading-snug text-primary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden whitespace-pre-line">
						{data.locked && !data.content
							? "Paid post"
							: data.content || (data.image ? "" : "View post")}
					</p>
				</div>
				{data.image && (
					<span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-raised">
						<Image
							src={data.image}
							alt=""
							fill
							sizes="64px"
							className="object-cover"
						/>
					</span>
				)}
			</div>
		</Link>
	);
}
