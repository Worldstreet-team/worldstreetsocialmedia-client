"use client";

import type { ProfileBadge } from "@/components/ui/UserBadges";

import Link from "next/link";
import { Search } from "lucide-react";
import { PostCard, type PostProps } from "@/components/feed/PostCard";
import { PostSkeleton } from "@/components/feed/PostSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import { CATEGORIES } from "@/data/categories";
import { useT } from "@/i18n/client";

export interface UserResult {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  avatar: string;
  isVerified: boolean;
  isFollowing: boolean;
  badges?: ProfileBadge[];
}

export type SearchTab = "top" | "users" | "posts";

function UserRow({ user }: { user: UserResult }) {
  return (
    <Link
      href={`/profile/${user.username}`}
      className="flex items-center gap-3 border-b border-hairline/50 px-4 py-3.5 transition-colors hover:bg-surface"
    >
      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-pill bg-raised">
        <SafeAvatar src={user.avatar} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate font-sans text-[15px] font-semibold text-primary hover:underline">
            {`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.username}
          </span>
          {user.isVerified && (
            <span className="shrink-0">
              <UserBadges isVerified badges={user.badges} size={14} />
            </span>
          )}
        </span>
        <span className="truncate font-sans text-[13.5px] text-muted">
          @{user.username}
        </span>
      </span>
    </Link>
  );
}

function UserRowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-hairline/50 px-4 py-3.5">
      <div className="skeleton h-10 w-10 shrink-0 rounded-pill" />
      <div className="flex-1">
        <div className="skeleton mb-1.5 h-3.5 w-32 rounded-sm" />
        <div className="skeleton h-3 w-24 rounded-sm" />
      </div>
    </div>
  );
}

/**
 * Search replaces the whole discovery stack rather than interleaving with it.
 *
 * Topic hits are matched locally against the taxonomy, so they cost nothing
 * and appear before either network result lands.
 */
export function SearchResults({
  query,
  tab,
  users,
  usersLoading,
  posts,
  postsLoading,
  onPickTopic,
}: {
  query: string;
  tab: SearchTab;
  users: UserResult[];
  usersLoading: boolean;
  posts: PostProps[];
  postsLoading: boolean;
  onPickTopic: (label: string) => void;
}) {
  const t = useT();
  const q = query.trim().toLowerCase();

  const topicHits = CATEGORIES.filter(
    (c) => c.label.toLowerCase().includes(q) || c.keywords.some((k) => k.includes(q)),
  ).slice(0, 6);

  const topics = topicHits.length > 0 && (
    <div className="flex flex-wrap gap-2 border-b border-hairline px-4 py-3">
      {topicHits.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPickTopic(c.label)}
          className="flex h-9 cursor-pointer items-center rounded-pill bg-raised px-3.5 font-sans text-[12.5px] font-medium text-muted transition-colors hover:bg-chip hover:text-primary"
        >
          {c.label}
        </button>
      ))}
    </div>
  );

  const userList = usersLoading
    ? [0, 1, 2].map((i) => <UserRowSkeleton key={i} />)
    : users.map((u) => <UserRow key={u.userId} user={u} />);

  const postList = postsLoading
    ? [0, 1, 2].map((i) => <PostSkeleton key={i} />)
    : posts.map((post) => (
        <div key={post.id} className="border-b border-hairline">
          <PostCard post={post} />
        </div>
      ));

  if (tab === "users") {
    return (
      <div className="flex flex-col">
        {!usersLoading && users.length === 0 ? (
          <EmptyState
            icon={Search}
            title={`No people match "${query.trim()}"`}
            caption="Check the spelling, or try a name or username."
          />
        ) : (
          userList
        )}
      </div>
    );
  }

  if (tab === "posts") {
    return (
      <div className="flex flex-col">
        {topics}
        {!postsLoading && posts.length === 0 ? (
          <EmptyState
            icon={Search}
            title={`No posts match "${query.trim()}"`}
            caption="Try a different word, a $cashtag or a #hashtag."
          />
        ) : (
          postList
        )}
      </div>
    );
  }

  // Top: topics, then the first three people, then every post.
  const topPeople = usersLoading ? userList : users.slice(0, 3).map((u) => (
    <UserRow key={u.userId} user={u} />
  ));
  const nothing =
    !usersLoading && !postsLoading && users.length === 0 && posts.length === 0 && topicHits.length === 0;

  return (
    <div className="flex flex-col">
      {topics}
      {nothing ? (
        <EmptyState
          icon={Search}
          title={`Nothing matches "${query.trim()}"`}
          caption="Check the spelling, or try a name, a $cashtag or a #hashtag."
        />
      ) : (
        <>
          {(usersLoading || users.length > 0) && (
            <>
              <h2 className="px-4 pb-2 pt-4 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
                {t("explore.tab.users")}
              </h2>
              {topPeople}
            </>
          )}
          {(postsLoading || posts.length > 0) && (
            <>
              <h2 className="px-4 pb-2 pt-4 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
                {t("explore.tab.posts")}
              </h2>
              {postList}
            </>
          )}
        </>
      )}
    </div>
  );
}
