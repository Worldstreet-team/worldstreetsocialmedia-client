import { DEFAULT_AVATAR } from "@/const";
import type { PostProps } from "@/components/feed/PostCard";
import { formatTimeAgo } from "@/lib/utils";

/**
 * Gateway post -> PostProps. THE mapper — every surface that renders a
 * `PostCard` maps through this one function.
 *
 * It used to live inside `Feed.tsx`, and six other surfaces had each grown
 * their own hand-rolled copy. The copies drifted, and the drift was invisible
 * until a field only one of them carried actually mattered: `repostOf` was
 * mapped in the feed and dropped everywhere else, so a repost opened from a
 * profile, explore, a community or its own permalink rendered as an empty
 * card that read like a broken normal post.
 *
 * So: don't inline a mapping at a new call site. Add the field here.
 *
 * Every read is defensive because the shape isn't uniform — the author may
 * arrive populated or as a bare id depending on which endpoint served it.
 */
export function mapApiPost(post: any): PostProps {
	return {
		id: post._id,
		author: {
			id: post.author?._id || post.author,
			name:
				post.author?.firstName && post.author?.lastName
					? `${post.author.firstName} ${post.author.lastName}`
					: post.author?.username || "Unknown",
			username: post.author?.username || "unknown",
			avatar: post.author?.avatar || DEFAULT_AVATAR,
			isVerified: post.author?.isVerified || false,
			verification: post.author?.verification,
			badges: post.author?.badges,
		},
		content: post.content,
		mentions: post.mentions,
		sale: post.sale,
		// Pre-translated by the gateway during feed assembly, so the post can
		// paint in the reader's language on the FIRST render — no request, no
		// visible rewrite a beat later.
		translation: post.translation,
		timestamp: formatTimeAgo(post.createdAt),
		// The instant itself, so the card can format at render rather than
		// wearing a label frozen at whatever moment it was mapped.
		createdAt: post.createdAt,
		images: post.images,
		videos: post.videos,
		videoPlays: post.videoPlays,
		votes: post.votes ?? 0,
		audio: post.audio?.url ? post.audio : undefined,
		stats: post.stats || { replies: 0, reposts: 0, likes: 0, bookmarks: 0, views: 0 },
		isLiked: post.isLiked,
		isBookmarked: post.isBookmarked,
		type: post.type,
		live: post.live,
		promoted: Boolean(post.promoted),
		community: post.community
			? {
					id: String(post.community._id ?? post.community),
					name: post.community.name,
					slug: post.community.slug,
				}
			: undefined,
		// `enrichPosts` on the gateway resolves this for every read path now.
		// The object guard stays because a repost of a since-deleted post
		// resolves to null, and older cached payloads may still hold a bare id.
		repostOf:
			post.repostOf && typeof post.repostOf === "object" && post.repostOf._id
				? {
						id: post.repostOf._id,
						authorName:
							post.repostOf.author?.firstName && post.repostOf.author?.lastName
								? `${post.repostOf.author.firstName} ${post.repostOf.author.lastName}`
								: (post.repostOf.author?.username ?? ""),
						username: post.repostOf.author?.username ?? "",
						avatar: post.repostOf.author?.avatar || DEFAULT_AVATAR,
						isVerified: post.repostOf.author?.isVerified,
						tier: post.repostOf.author?.verification?.tier,
						badges: post.repostOf.author?.badges ?? [],
						content: post.repostOf.content ?? "",
						image: post.repostOf.images?.[0],
						timestamp: formatTimeAgo(post.repostOf.createdAt),
						createdAt: post.repostOf.createdAt,
					}
				: undefined,
	};
}
