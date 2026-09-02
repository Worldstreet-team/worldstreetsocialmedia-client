"use client";

import { formatCompact } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { Heart, Play } from "@phosphor-icons/react";
import type { PostProps } from "@/components/feed/PostCard";

/**
 * Media and Street tabs render as a grid, not a post list. Both are
 * image-first, and a full PostCard per photo buries the thing you came to
 * look at under three lines of chrome.
 */
export function ProfileGrid({
  posts,
  kind,
}: {
  posts: PostProps[];
  kind: "media" | "street";
}) {
  return (
    <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
      {posts.map((post) => {
        const video = post.videos?.[0];
        const image = post.images?.[0];
        const href = kind === "street" && video ? `/live?v=${post.id}` : `/post/${post.id}`;

        return (
          <Link
            key={post.id}
            href={href}
            className="group relative block aspect-square overflow-hidden bg-raised sm:rounded-sm"
          >
            {video ? (
              <video
                src={`${video}#t=0.1`}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
            ) : image ? (
              <Image
                src={image}
                alt=""
                fill
                sizes="(max-width: 620px) 33vw, 206px"
                className="object-cover"
              />
            ) : null}

            {video && (
              <span className="absolute right-1.5 top-1.5">
                <Play size={13} weight="fill" className="text-[#fafaf9] drop-shadow" />
              </span>
            )}

            <span className="absolute inset-0 flex items-end bg-gradient-to-t from-[#0c0a09]/70 to-transparent px-2 pb-1.5 pt-6 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="flex items-center gap-1 font-sans text-[11px] font-semibold tabular-nums text-[#fafaf9]">
                <Heart size={11} weight="fill" />
                {formatCompact(post.stats?.likes ?? 0)}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
