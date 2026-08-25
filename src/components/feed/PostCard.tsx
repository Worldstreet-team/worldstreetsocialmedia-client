import Link from "next/link";
import Image from "next/image";
// 03-icons: `copy` for copy-link, `bar-chart-3` for activity (both in-set).
// Trash2/Ban/Pin have no in-set equivalents — kept as justified deviations.
import {
    Trash2,
    Link2,
    Copy,
    Flag,
    Ban,
    BarChart3,
    Pin,
} from "lucide-react";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
// 03-icons: Phosphor is reserved for the Social post-action row + overflow menu.
import {
    ChatCircle,
    Heart,
    BookmarkSimple,
    Export,
    Check,
    DotsThree,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { useState, useRef, useEffect, memo, useCallback, useMemo } from "react";

import { useAtomValue, useSetAtom } from "jotai";
import { motion, AnimatePresence } from "framer-motion";
import { userAtom } from "@/store/user.atom";
import { bookmarksAtom } from "@/store/bookmarks.atom";
import {
    deletePostAction,
    likePostAction,
    unlikePostAction,
    bookmarkPostAction,
    unbookmarkPostAction,
} from "@/lib/post.actions";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast/ToastContext";
import ImageModal from "@/components/ui/ImageModal";
import { renderRichText } from "@/components/ui/RichText";
import { Radio } from "lucide-react";
import { XSTREAM_WEB_URL } from "@/const";
import { useT } from "@/i18n/client";

export interface PostProps {
    id: string;
    author: {
        id: string;
        name: string;
        username: string;
        avatar: string;
        isVerified?: boolean;
    };
    content: string;
    timestamp: string;
    images?: string[];
    stats: {
        replies: number;
        reposts: number;
        likes: number;
    };
    isLiked?: boolean;
    type?: "post" | "live";
    live?: {
        streamId: string;
        status: "live" | "ended";
        title?: string;
        viewerPeak?: number;
    };
    isBookmarked?: boolean;
    isDetail?: boolean;
    linkPreview?: {
        url: string;
        title: string;
        description: string;
        image: string;
        domain: string;
    };
}

/* Count formatting per 02-typography number rules: full 1,204 below 10K,
   K/M abbreviation from 10K up — tabular-nums keeps rolls steady. */
const formatCount = (n: number) => {
    if (!n) return "";
    if (n < 10_000) return n.toLocaleString();
    if (n < 1_000_000) return `${(n / 1000).toFixed(0)}K`;
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
};

export const PostCard = memo(({ post }: { post: PostProps }) => {
    const t = useT();
    const [isLiked, setIsLiked] = useState(post.isLiked);
    const [likeCount, setLikeCount] = useState(post.stats.likes);
    const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked);

    const currentUser = useAtomValue(userAtom);
    const setUser = useSetAtom(userAtom);
    const setBookmarks = useSetAtom(bookmarksAtom);
    const { toast } = useToast();

    // Menu State
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Delete State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleted, setIsDeleted] = useState(false);

    // Image Modal State
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
        null,
    );

    // Share feedback: Export briefly swaps to a success Check after copying.
    const [linkCopied, setLinkCopied] = useState(false);
    const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(
        () => () => {
            if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        },
        [],
    );

    const isOwnPost = useMemo(
        () =>
            currentUser?.userId === post.author.id ||
            currentUser?._id === post.author.id,
        [currentUser, post.author.id],
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node)
            ) {
                setIsMenuOpen(false);
            }
        };

        if (isMenuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isMenuOpen]);

    const handleLike = useCallback(async () => {
        if (!currentUser) {
            toast("Please login to like posts", { type: "error" });
            return;
        }

        const newIsLiked = !isLiked;
        setIsLiked(newIsLiked);
        setLikeCount((prev: number) =>
            newIsLiked ? prev + 1 : Math.max(0, prev - 1),
        );

        try {
            if (newIsLiked) {
                await likePostAction(post.id);
            } else {
                await unlikePostAction(post.id);
            }
        } catch (error) {
            console.error("Like error:", error);
            setIsLiked(!newIsLiked);
            setLikeCount((prev) => (newIsLiked ? prev - 1 : prev + 1));
            toast("Failed to update like", { type: "error" });
        }
    }, [currentUser, isLiked, post.id, toast]);

    const handleBookmark = useCallback(async () => {
        if (!currentUser) {
            toast("Please login to bookmark posts", { type: "error" });
            return;
        }

        const newIsBookmarked = !isBookmarked;
        setIsBookmarked(newIsBookmarked);

        try {
            if (newIsBookmarked) {
                setUser((prev: any) =>
                    prev
                        ? {
                              ...prev,
                              bookmarks: [...(prev.bookmarks || []), post.id],
                          }
                        : null,
                );
                setBookmarks((prev: any) => [
                    { ...post, isBookmarked: true },
                    ...prev,
                ]);

                await bookmarkPostAction(post.id);
                toast("Post added to bookmarks", { type: "success" });
            } else {
                setUser((prev: any) =>
                    prev
                        ? {
                              ...prev,
                              bookmarks: (prev.bookmarks || []).filter(
                                  (id: string) => id !== post.id,
                              ),
                          }
                        : null,
                );
                setBookmarks((prev: any) =>
                    prev.filter((p: any) => p.id !== post.id),
                );

                await unbookmarkPostAction(post.id);
                toast("Post removed from bookmarks", { type: "success" });
            }
        } catch (error) {
            console.error("Bookmark error:", error);
            setIsBookmarked(!newIsBookmarked);
            toast("Failed to update bookmark", { type: "error" });
        }
    }, [currentUser, isBookmarked, post, setUser, setBookmarks, toast]);

    const handleDelete = useCallback(async () => {
        setIsDeleting(true);
        try {
            const res = await deletePostAction(post.id);
            if (res.success) {
                setIsDeleted(true);
                toast("Post deleted successfully", { type: "success" });
            } else {
                console.error("Failed to delete post");
                toast("Failed to delete post", { type: "error" });
            }
        } catch (err) {
            console.error(err);
            toast("Something went wrong", { type: "error" });
        } finally {
            setIsDeleting(false);
        }
    }, [post.id, toast]);

    const handleMenuAction = useCallback(
        (action: string) => {
            setIsMenuOpen(false);

            if (action === "delete") {
                setIsDeleteModalOpen(true);
            } else if (action === "copy_link") {
                const url = `${window.location.origin}/post/${post.id}`;
                navigator.clipboard
                    .writeText(url)
                    .then(() => {
                        toast("Link copied to clipboard", { type: "success" });
                    })
                    .catch((err) => {
                        console.error("Failed to copy link: ", err);
                        toast("Failed to copy link", { type: "error" });
                    });
            } else {
                // Pin/activity/not-interested/block/report have no gateway
                // support yet — say so instead of silently no-oping.
                toast("Not available yet — coming soon", { type: "info" });
            }
        },
        [post.id, toast],
    );

    const MAX_LENGTH = 280;
    const shouldTruncate = useMemo(
        () => !post.isDetail && post.content.length > MAX_LENGTH,
        [post.isDetail, post.content.length],
    );

    const displayedContent = useMemo(
        () =>
            shouldTruncate ? post.content.slice(0, MAX_LENGTH) : post.content,
        [shouldTruncate, post.content],
    );

    // URLs, $cashtags, #hashtags and @mentions become links (RichText).
    const formattedContent = useMemo(
        () => renderRichText(displayedContent),
        [displayedContent],
    );

    /* Aspect ratios, not a fixed 290px height. At a 620px column 290px is
       roughly 2:1; at 320px it squashed every tile into a letterbox and
       cropped faces out of the frame. Ratios keep the same proportions at
       every width. */
    const getImageGridClass = useCallback((count: number) => {
        switch (count) {
            case 1:
                return "grid-cols-1 grid-rows-1 h-auto aspect-video";
            case 2:
                return "grid-cols-2 grid-rows-1 aspect-[16/9] sm:aspect-[2/1]";
            case 3:
            case 4:
                return "grid-cols-2 grid-rows-2 aspect-square sm:aspect-[16/11]";
            default:
                return "grid-cols-1";
        }
    }, []);

    const getImageStyle = useCallback((index: number, total: number) => {
        if (total === 3 && index === 0) return "row-span-2";
        return "";
    }, []);

    if (isDeleted) return null;

    return (
        // px-4 is the spec's minimum edge gutter on small screens; the old px-3
        // put post text 12px from the viewport edge.
        <article className="relative block px-4 py-3 sm:py-3.5 border-b border-hairline/60 hover:bg-surface/40 transition-colors">
            {/* ... Rest of the component remains the same ... */}
            <Link
                href={`/post/${post.id}`}
                className="absolute inset-0 z-0"
                aria-label="View post"
            />

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Post?"
                message="This can't be undone and it will be removed from your profile, the timeline of any accounts that follow you, and from search results."
                confirmText={isDeleting ? "Deleting..." : "Delete"}
                isDestructive={true}
            />

            <ImageModal
                isOpen={selectedImageIndex !== null}
                onClose={() => setSelectedImageIndex(null)}
                images={post.images || []}
                initialIndex={selectedImageIndex || 0}
            />

            <div className="flex gap-3 sm:gap-4 relative z-10 pointer-events-none">
                <div className="shrink-0 pointer-events-auto mt-1">
                    <Link
                        href={`/profile/${post.author.username}`}
                        className="relative block w-[42px] h-[42px] rounded-pill overflow-hidden border border-hairline hover:border-brand transition-colors"
                    >
                        <Image
                            src={post.author.avatar}
                            alt={post.author.username}
                            fill
                            className="object-cover"
                        />
                    </Link>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                        {/* min-w-0 lets the two truncating links actually shrink;
                            without it the row grows past the card on narrow
                            screens. The badge, dot and timestamp never shrink —
                            the handle gives way first, then the display name. */}
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 overflow-hidden pointer-events-auto">
                            <Link
                                href={`/profile/${post.author.username}`}
                                className="text-[15px] font-semibold leading-5 text-primary truncate font-sans hover:underline decoration-gold underline-offset-4"
                            >
                                {post.author.name}
                            </Link>
                            {/* Gold seal badge — the one VerifiedIcon everywhere. */}
                            {post.author.isVerified && (
                                <span className="shrink-0 flex">
                                    <VerifiedIcon size={{ width: "16", height: "16" }} />
                                </span>
                            )}
                            <Link
                                href={`/profile/${post.author.username}`}
                                className="hidden xs:block text-subtle text-[13px] truncate font-sans hover:text-muted"
                            >
                                @{post.author.username}
                            </Link>
                            <span className="hidden xs:inline text-subtle text-xs shrink-0">
                                •
                            </span>
                            <span className="text-subtle text-[13px] font-sans whitespace-nowrap shrink-0">
                                {post.timestamp}
                            </span>
                            {post.live?.status === "live" && (
                                <span className="shrink-0 flex items-center gap-1 rounded-[4px] bg-danger px-1.5 py-px text-[10px] font-bold tracking-wide text-white font-sans">
                                    <span className="w-1.5 h-1.5 rounded-pill bg-white animate-pulse" />
                                    {t("live.badge")}
                                </span>
                            )}
                        </div>

                        <div
                            className="relative pointer-events-auto shrink-0"
                            ref={menuRef}
                        >
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMenuOpen(!isMenuOpen);
                                }}
                                className={clsx(
                                    "flex h-10 w-10 items-center justify-center text-subtle hover:text-gold transition-colors rounded-pill hover:bg-brand/10 cursor-pointer",
                                    isMenuOpen &&
                                        "text-gold bg-brand/10",
                                )}
                            >
                                <DotsThree size={20} weight="bold" />
                            </button>

                            <AnimatePresence>
                                {isMenuOpen && (
                                    <motion.div
                                        initial={{
                                            opacity: 0,
                                            scale: 0.98,
                                            y: -8,
                                        }}
                                        animate={{
                                            opacity: 1,
                                            scale: 1,
                                            y: 0,
                                        }}
                                        exit={{
                                            opacity: 0,
                                            transition: { duration: 0.12 },
                                        }}
                                        transition={{
                                            duration: 0.2,
                                            ease: [0.2, 0, 0, 1],
                                        }}
                                        className="absolute right-0 top-8 w-[220px] bg-surface rounded-lg border border-hairline shadow-nav z-dropdown overflow-hidden py-1.5"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {isOwnPost ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleMenuAction(
                                                            "copy_link",
                                                        );
                                                    }}
                                                    className="w-full text-left px-3.5 py-2.5 hover:bg-raised flex items-center gap-2.5 text-sm font-medium text-primary transition-colors font-sans"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                    Copy link
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleMenuAction("pin");
                                                    }}
                                                    className="w-full text-left px-3.5 py-2.5 hover:bg-raised flex items-center gap-2.5 text-sm font-medium text-primary transition-colors font-sans"
                                                >
                                                    <Pin className="w-4 h-4" />
                                                    Pin to profile
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleMenuAction(
                                                            "activity",
                                                        );
                                                    }}
                                                    className="w-full text-left px-3.5 py-2.5 hover:bg-raised flex items-center gap-2.5 text-sm font-medium text-primary transition-colors font-sans"
                                                >
                                                    <BarChart3 className="w-4 h-4" />
                                                    View activity
                                                </button>
                                                <div className="my-1 border-t border-hairline" />
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleMenuAction(
                                                            "delete",
                                                        );
                                                    }}
                                                    className="w-full text-left px-3.5 py-2.5 hover:bg-raised text-danger flex items-center gap-2.5 text-sm font-medium transition-colors font-sans"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    Delete post
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleMenuAction(
                                                            "not_interested",
                                                        );
                                                    }}
                                                    className="w-full text-left px-3.5 py-2.5 hover:bg-raised flex items-center gap-2.5 text-sm font-medium text-primary transition-colors font-sans"
                                                >
                                                    <Ban className="w-4 h-4" />
                                                    Not interested
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleMenuAction(
                                                            "copy_link",
                                                        );
                                                    }}
                                                    className="w-full text-left px-3.5 py-2.5 hover:bg-raised flex items-center gap-2.5 text-sm font-medium text-primary transition-colors font-sans"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                    Copy link
                                                </button>
                                                <div className="my-1 border-t border-hairline" />
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleMenuAction(
                                                            "block",
                                                        );
                                                    }}
                                                    className="w-full text-left px-3.5 py-2.5 hover:bg-raised flex items-center gap-2.5 text-sm font-medium text-primary transition-colors font-sans"
                                                >
                                                    <Ban className="w-4 h-4" />
                                                    Block @
                                                    {post.author.username}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleMenuAction(
                                                            "report",
                                                        );
                                                    }}
                                                    className="w-full text-left px-3.5 py-2.5 hover:bg-raised flex items-center gap-2.5 text-sm font-medium text-primary transition-colors font-sans"
                                                >
                                                    <Flag className="w-4 h-4" />
                                                    Report post
                                                </button>
                                            </>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                    {/* Post Content */}
                    {/* UI/Body: Public Sans Regular 15 — post text size per 02-typography. */}
                    {post.live && (
                        <a
                            href={`${XSTREAM_WEB_URL}/stream/${post.live.streamId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="relative z-10 pointer-events-auto mb-2 flex items-center gap-3 rounded-lg border border-hairline bg-raised/40 hover:bg-raised px-3.5 py-3 transition-colors"
                        >
                            <span
                                className={
                                    post.live.status === "live"
                                        ? "flex h-9 w-9 items-center justify-center rounded-pill bg-danger/15 text-danger shrink-0"
                                        : "flex h-9 w-9 items-center justify-center rounded-pill bg-raised text-muted shrink-0"
                                }
                            >
                                <Radio className="w-4.5 h-4.5" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-sm font-semibold text-primary font-sans truncate">
                                    {post.live.title || post.content}
                                </span>
                                <span className="block text-[13px] text-muted font-sans">
                                    {post.live.status === "live"
                                        ? t("live.watch")
                                        : `${t("live.replay")}${post.live.viewerPeak ? ` · ${post.live.viewerPeak} ${t("live.viewers")}` : ""}`}
                                </span>
                            </span>
                        </a>
                    )}
                    <p className="text-primary whitespace-pre-wrap mb-1.5 font-normal leading-[1.55] text-[15px] font-sans tracking-tight pointer-events-none">
                        {formattedContent}
                        {shouldTruncate && (
                            <span className="text-subtle pointer-events-auto">
                                ...{" "}
                                <Link
                                    href={`/post/${post.id}`}
                                    className="text-gold hover:underline font-medium relative z-20"
                                >
                                    See more
                                </Link>
                            </span>
                        )}
                    </p>

                    {/* Link Preview */}
                    {post.linkPreview && !post.images?.length && (
                        <a
                            href={post.linkPreview.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block mt-2 mb-3 rounded-xl border border-hairline overflow-hidden bg-surface/50 hover:bg-surface transition-colors pointer-events-auto group"
                        >
                            {post.linkPreview.image && (
                                <div className="aspect-video relative w-full bg-surface border-b border-hairline/50">
                                    <img
                                        src={post.linkPreview.image}
                                        alt={post.linkPreview.title}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        onError={(e) => {
                                            e.currentTarget.style.display =
                                                "none";
                                        }}
                                    />
                                </div>
                            )}
                            <div className="p-3">
                                <h3 className="text-sm font-bold text-primary line-clamp-1 font-sans mb-0.5 group-hover:text-gold transition-colors">
                                    {post.linkPreview.title}
                                </h3>
                                <p className="text-[13px] text-muted line-clamp-2 font-sans mb-1">
                                    {post.linkPreview.description}
                                </p>
                                <div className="flex items-center gap-1 text-[11px] text-muted font-sans">
                                    <Link2 className="w-3 h-3" />
                                    <span>{post.linkPreview.domain}</span>
                                </div>
                            </div>
                        </a>
                    )}

                    {post.images && post.images.length === 1 && (
                        <div className="mb-3 w-full">
                            <img
                                src={post.images[0]}
                                alt="Post attachment"
                                className="block h-auto w-auto max-w-full max-h-[500px] object-cover rounded-xl border border-hairline cursor-zoom-in hover:opacity-95 transition-opacity relative z-10"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setSelectedImageIndex(0);
                                }}
                            />
                        </div>
                    )}
                    {post.images && post.images.length > 1 && (
                        <div
                            className={clsx(
                                "grid gap-0.5 rounded-xl overflow-hidden mb-3 w-full border border-hairline pointer-events-auto",
                                getImageGridClass(post.images.length),
                            )}
                        >
                            {post.images
                                .slice(0, 4)
                                .map((src: string, i: number) => (
                                    <div
                                        key={i}
                                        className={clsx(
                                            "relative z-10 w-full h-full bg-cover bg-center cursor-zoom-in hover:opacity-95 transition-opacity",
                                            getImageStyle(
                                                i,
                                                post.images!.length,
                                            ),
                                        )}
                                        style={{
                                            backgroundImage: `url('${src}')`,
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setSelectedImageIndex(i);
                                        }}
                                    />
                                ))}
                        </div>
                    )}
                    {/* Post actions. 03-icons: this row is the ONE place Phosphor is
                        used instead of Lucide, matching the mobile app. 15px, text/muted. */}
                    <div className="flex items-center justify-between max-w-[420px] text-muted mt-1 -mb-1.5 pointer-events-auto">
                        <Link
                            href={`/post/${post.id}`}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Reply"
                            className="flex items-center gap-0.5 -ml-2 hover:text-primary transition-colors group cursor-pointer"
                        >
                            <span className="flex h-10 w-10 items-center justify-center rounded-pill group-hover:bg-primary/10 transition group-active:scale-[0.98]">
                                <ChatCircle size={15} />
                            </span>
                            <span className="text-[13px] font-sans tabular-nums">
                                {formatCount(post.stats.replies)}
                            </span>
                        </Link>
                        <button
                            type="button"
                            aria-label={isLiked ? "Unlike" : "Like"}
                            aria-pressed={isLiked}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleLike();
                            }}
                            className={clsx(
                                "flex items-center gap-0.5 transition-colors group cursor-pointer",
                                isLiked ? "text-danger" : "hover:text-danger",
                            )}
                        >
                            <span className="relative flex h-10 w-10 items-center justify-center rounded-pill group-hover:bg-danger/10 transition group-active:scale-[0.98]">
                                {/* One-shot danger wash on like — opacity-only,
                                    fades out over motion-slow and stays gone. */}
                                <AnimatePresence>
                                    {isLiked && (
                                        <motion.span
                                            key="like-wash"
                                            className="absolute inset-0 rounded-pill bg-danger/20"
                                            initial={{ opacity: 0.7 }}
                                            animate={{ opacity: 0 }}
                                            exit={{ opacity: 0 }}
                                            transition={{
                                                duration: 0.32,
                                                ease: [0.2, 0, 0, 1],
                                            }}
                                        />
                                    )}
                                </AnimatePresence>
                                {/* Micro-settle on like: scale stays inside the
                                    spec's 0.98–1 budget; the fill+color swap is
                                    the real feedback. */}
                                <motion.span
                                    animate={{ scale: isLiked ? [0.98, 1] : 1 }}
                                    transition={{
                                        duration: 0.2,
                                        ease: [0.2, 0, 0, 1],
                                    }}
                                    className="flex"
                                >
                                    <Heart
                                        size={15}
                                        weight={isLiked ? "fill" : "regular"}
                                    />
                                </motion.span>
                            </span>
                            <span className="relative overflow-hidden text-[13px] font-sans tabular-nums">
                                <AnimatePresence mode="wait" initial={false}>
                                    {/* Count rolls 8px in the direction of change. */}
                                    <motion.span
                                        key={likeCount}
                                        initial={{ opacity: 0, y: isLiked ? 8 : -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{
                                            opacity: 0,
                                            transition: { duration: 0.12 },
                                        }}
                                        transition={{
                                            duration: 0.2,
                                            ease: [0.2, 0, 0, 1],
                                        }}
                                        className="inline-block"
                                    >
                                        {formatCount(likeCount)}
                                    </motion.span>
                                </AnimatePresence>
                            </span>
                        </button>
                        <button
                            type="button"
                            aria-label={isBookmarked ? "Remove bookmark" : "Bookmark"}
                            aria-pressed={isBookmarked}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleBookmark();
                            }}
                            className={clsx(
                                "flex items-center transition-colors group cursor-pointer",
                                isBookmarked ? "text-gold" : "hover:text-gold",
                            )}
                        >
                            <span className="relative flex h-10 w-10 items-center justify-center rounded-pill group-hover:bg-gold/10 transition group-active:scale-[0.98]">
                                <AnimatePresence>
                                    {isBookmarked && (
                                        <motion.span
                                            key="bookmark-wash"
                                            className="absolute inset-0 rounded-pill bg-gold/20"
                                            initial={{ opacity: 0.7 }}
                                            animate={{ opacity: 0 }}
                                            exit={{ opacity: 0 }}
                                            transition={{
                                                duration: 0.32,
                                                ease: [0.2, 0, 0, 1],
                                            }}
                                        />
                                    )}
                                </AnimatePresence>
                                <motion.span
                                    animate={{ scale: isBookmarked ? [0.98, 1] : 1 }}
                                    transition={{
                                        duration: 0.2,
                                        ease: [0.2, 0, 0, 1],
                                    }}
                                    className="flex"
                                >
                                    <BookmarkSimple
                                        size={15}
                                        weight={isBookmarked ? "fill" : "regular"}
                                    />
                                </motion.span>
                            </span>
                        </button>
                        <button
                            type="button"
                            aria-label="Copy link to post"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleMenuAction("copy_link");
                                setLinkCopied(true);
                                if (copiedTimerRef.current)
                                    clearTimeout(copiedTimerRef.current);
                                copiedTimerRef.current = setTimeout(
                                    () => setLinkCopied(false),
                                    1500,
                                );
                            }}
                            className={clsx(
                                "flex items-center transition-colors group cursor-pointer",
                                linkCopied
                                    ? "text-success"
                                    : "hover:text-primary",
                            )}
                        >
                            <span className="flex h-10 w-10 items-center justify-center rounded-pill group-hover:bg-primary/10 transition group-active:scale-[0.98]">
                                <AnimatePresence mode="wait" initial={false}>
                                    {linkCopied ? (
                                        <motion.span
                                            key="copied"
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{
                                                opacity: 0,
                                                transition: { duration: 0.12 },
                                            }}
                                            transition={{
                                                duration: 0.2,
                                                ease: [0.2, 0, 0, 1],
                                            }}
                                            className="flex"
                                        >
                                            <Check size={15} weight="bold" />
                                        </motion.span>
                                    ) : (
                                        <motion.span
                                            key="share"
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{
                                                opacity: 0,
                                                transition: { duration: 0.12 },
                                            }}
                                            transition={{
                                                duration: 0.2,
                                                ease: [0.2, 0, 0, 1],
                                            }}
                                            className="flex"
                                        >
                                            <Export size={15} />
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </article>
    );
});

PostCard.displayName = "PostCard";
