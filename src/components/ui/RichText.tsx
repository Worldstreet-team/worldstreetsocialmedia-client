"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Mention } from "@/components/ui/Mention";
import { seedHandles } from "@/lib/mentionCache";

/**
 * Entity-aware post text. Turns URLs, $cashtags, #hashtags and @mentions into
 * links. All entity links are gold (the palette has no blue); cashtags
 * additionally get the money/convert-chip wash so tradable symbols read as
 * first-class objects in the feed, and @mentions get the brand wash so a
 * tagged person reads as a tag rather than as underlined body text.
 *
 * Anchors carry `relative z-10 pointer-events-auto` + stopPropagation so they
 * stay clickable above PostCard's full-card overlay link.
 */

const ENTITY_SOURCE =
  "(https?:\\/\\/[^\\s]+)|(\\$[A-Za-z]{1,6})\\b|(#[\\p{L}\\p{N}_]+)|(@[A-Za-z0-9_]+)";

const stop = (e: React.MouseEvent) => e.stopPropagation();

/** Denormalized mention metadata stored on the post at write time. */
export interface MentionMeta {
  username: string;
  isVerified?: boolean;
}

export function renderRichText(
  text: string,
  opts?: { mentions?: MentionMeta[] },
): ReactNode[] {
  // Seed the shared cache from what the post stored at write time, so those
  // chips need no lookup at all.
  if (opts?.mentions?.length) seedHandles(opts.mentions);
  const entity = new RegExp(ENTITY_SOURCE, "gu");
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let match = entity.exec(text);

  while (match !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const [full, url, cashtag, hashtag, mention] = match;
    key += 1;

    if (url) {
      nodes.push(
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={stop}
          className="text-gold hover:underline relative z-10 pointer-events-auto break-words"
        >
          {url}
        </a>,
      );
    } else if (cashtag) {
      nodes.push(
        <Link
          key={key}
          href={`/explore?q=${encodeURIComponent(cashtag.slice(1))}`}
          onClick={stop}
          className="relative z-10 pointer-events-auto rounded-sm bg-convert/[0.13] px-1.5 py-px text-[13px] font-semibold tracking-tight text-gold hover:bg-convert/20 transition-colors break-words"
        >
          {cashtag}
        </Link>,
      );
    } else if (hashtag) {
      nodes.push(
        <Link
          key={key}
          href={`/explore?q=${encodeURIComponent(hashtag.slice(1))}`}
          onClick={stop}
          className="text-gold hover:underline relative z-10 pointer-events-auto break-words"
        >
          {hashtag}
        </Link>,
      );
    } else if (mention) {
      // Mention resolves itself: it only becomes a chip once the account is
      // known to exist, and carries that person's avatar and marks when it
      // does. Anything the post already knows was seeded above, so stored
      // mentions paint correctly on the first render with no request.
      nodes.push(<Mention key={key} handle={mention.slice(1)} />);
    }

    last = match.index + full.length;
    match = entity.exec(text);
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
