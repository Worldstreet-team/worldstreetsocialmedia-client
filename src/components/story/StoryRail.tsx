"use client";

import clsx from "clsx";
import { useAtomValue } from "jotai";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import StoryStudio from "@/components/story/StoryStudio";
import StoryViewer from "@/components/story/StoryViewer";
import { DEFAULT_AVATAR } from "@/const";
import { getStoriesAction, type StoryRailEntry } from "@/lib/story.actions";
import { userAtom } from "@/store/user.atom";

/**
 * The stories rail at the top of the feed — the client face of the
 * gateway's already-live /api/stories (ranked self → live → unseen →
 * affinity server-side; render order is the response order).
 *
 * Ring language: gold = unseen, raised = seen; a LIVE label replaces the
 * gold ring's meaning for live entries. "Your story" is always first and
 * doubles as the Story Studio entry point.
 */
export default function StoryRail() {
  const user = useAtomValue(userAtom);
  const [entries, setEntries] = useState<StoryRailEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const refetch = useCallback(() => {
    getStoriesAction().then((res) => {
      if (res.success) {
        setEntries(res.data);
        setFailed(false);
      } else {
        setFailed(true);
      }
    });
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const markSeen = useCallback((storyId: string) => {
    setEntries((prev) => {
      if (!prev) return prev;
      let changed = false;
      const next = prev.map((entry) => {
        if (!entry.stories.some((s) => s.id === storyId && !s.seen)) {
          return entry;
        }
        changed = true;
        const stories = entry.stories.map((s) =>
          s.id === storyId ? { ...s, seen: true } : s,
        );
        return {
          ...entry,
          stories,
          hasUnseen: stories.some((s) => !s.seen),
        };
      });
      return changed ? next : prev;
    });
  }, []);

  // The gateway sleeping (free Render instance) or erroring shouldn't cost
  // the feed anything — the rail simply stays out of the way.
  if (failed) return null;

  const selfEntry = entries?.find((e) => e.isSelf) ?? null;
  const others = entries?.filter((e) => !e.isSelf) ?? [];

  const openViewerAt = (entry: StoryRailEntry) => {
    if (!entries) return;
    const index = entries.indexOf(entry);
    if (index >= 0) setViewerIndex(index);
  };

  return (
    <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 sm:px-6 py-3 border-b border-hairline">
      {/* Your story — opens the Studio, or plays your own stories with the
          + badge still available for adding another. */}
      <div className="relative shrink-0 w-16">
        <button
          type="button"
          onClick={() =>
            selfEntry ? openViewerAt(selfEntry) : setStudioOpen(true)
          }
          className="flex w-16 flex-col items-center gap-1.5 cursor-pointer group"
          aria-label={selfEntry ? "View your story" : "Add to your story"}
        >
          <span
            className={clsx(
              "rounded-pill p-[2px] transition-colors",
              selfEntry?.hasUnseen
                ? "bg-brand"
                : selfEntry
                  ? "bg-raised"
                  : "bg-transparent",
            )}
          >
            <span
              className="block h-14 w-14 rounded-pill bg-raised bg-cover bg-center border-2 border-page"
              style={{
                backgroundImage: `url('${user?.avatar || DEFAULT_AVATAR}')`,
              }}
            />
          </span>
          <span className="w-16 truncate text-center text-[11px] font-sans text-muted">
            Your story
          </span>
        </button>
        <button
          type="button"
          onClick={() => setStudioOpen(true)}
          aria-label="Create a story"
          // 20px glyph on a bigger invisible hit area would collide with the
          // avatar button; the badge itself is the affordance here.
          className="absolute bottom-6 right-0.5 flex h-5 w-5 items-center justify-center rounded-pill bg-brand text-brand-on border-2 border-page cursor-pointer hover:bg-brand-active transition-colors"
        >
          <Plus className="w-3 h-3" strokeWidth={3} />
        </button>
      </div>

      {entries === null
        ? // Loading: quiet placeholder circles, no layout shift.
          [0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex w-16 shrink-0 flex-col items-center gap-1.5"
            >
              <div className="h-14 w-14 rounded-pill skeleton" />
              <div className="h-3 w-12 rounded-sm skeleton" />
            </div>
          ))
        : others.map((entry) => (
            <button
              key={entry.author._id}
              type="button"
              onClick={() => openViewerAt(entry)}
              className="flex w-16 shrink-0 flex-col items-center gap-1.5 cursor-pointer"
              aria-label={`View ${entry.author.username}'s story`}
            >
              <span
                className={clsx(
                  "rounded-pill p-[2px] transition-colors",
                  entry.hasUnseen ? "bg-brand" : "bg-raised",
                )}
              >
                <span
                  className="block h-14 w-14 rounded-pill bg-raised bg-cover bg-center border-2 border-page"
                  style={{
                    backgroundImage: `url('${entry.author.avatar || DEFAULT_AVATAR}')`,
                  }}
                />
              </span>
              <span
                className={clsx(
                  "w-16 truncate text-center text-[11px] font-sans",
                  entry.isLive
                    ? "text-danger font-semibold uppercase tracking-[1px]"
                    : "text-muted",
                )}
              >
                {entry.isLive ? "Live" : entry.author.username}
              </span>
            </button>
          ))}

      {studioOpen && (
        <StoryStudio onClose={() => setStudioOpen(false)} onPosted={refetch} />
      )}
      {viewerIndex !== null && entries && entries[viewerIndex] && (
        <StoryViewer
          entries={entries}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onStoryViewed={markSeen}
        />
      )}
    </div>
  );
}
