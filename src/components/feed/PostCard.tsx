import Link from "next/link";
import type { ProfileBadge } from "@/components/ui/UserBadges";
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
import { UserBadges } from "@/components/ui/UserBadges";
// 03-icons: Phosphor is reserved for the Social post-action row + overflow menu.
import {
    BookmarkSimple,
    Eye,
    EyeSlash,
    LockSimple,
    Pulse,
    ChatCircle,
    Check,
    CircleNotch,
    DotsThree,
    Heart,
    PaperPlaneTilt,
    Repeat,
    Translate,
    UsersThree,
} from "@phosphor-icons/react";
import clsx from "clsx";
import {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { motion, AnimatePresence } from "framer-motion";
import { userAtom } from "@/store/user.atom";
import { bookmarksAtom } from "@/store/bookmarks.atom";
import {
    deletePostAction,
    unlockPostAction,
    likePostAction,
    unlikePostAction,
    bookmarkPostAction,
    unbookmarkPostAction,
} from "@/lib/post.actions";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast/ToastContext";
import ImageModal from "@/components/ui/ImageModal";
import { FeedImage } from "@/components/ui/FeedImage";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
import { recordVideoPlayAction } from "@/lib/beacons";
import { LikersModal } from "@/components/feed/LikersModal";
import { AudioCard } from "@/components/feed/AudioCard";
import { Image as ImageGlyph, VideoCamera, MicrophoneStage } from "@phosphor-icons/react";
import { renderRichText } from "@/components/ui/RichText";
import {
    applyStats,
	applyMyEngagement,
	getMyEngagement,
	subscribeMyEngagement,
    getStats,
    seedStats,
    subscribeStats,
} from "@/lib/engagementStore";
import { VideoPlayer } from "@/components/ui/VideoPlayer";
import { Radio } from "lucide-react";
import { promotePostAction } from "@/lib/campaign.actions";
import { getSubscriptionAction } from "@/lib/subscription.actions";
import { repostPostAction } from "@/lib/post.actions";
import { QuoteModal } from "@/components/feed/QuoteModal";
import { Megaphone } from "lucide-react";
import { useT } from "@/i18n/client";
import { useLiveEvents } from "@/hooks/useLiveNow";
import { translatePostAction } from "@/lib/translate.actions";
import { autoTranslateAtom, translationsAtom } from "@/store/translate.atom";
import { TranslatePanel } from "@/components/ui/TranslatePanel";
import ReportSheet from "@/components/safety/ReportSheet";
import { blockUserAction } from "@/lib/user.actions";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

/**
 * Does this post have anything to show?
 *
 * A card whose body is blank still paints its avatar, name, timestamp and the
 * whole action row, so it reads as a post someone made by accident — the
 * timeline looks broken rather than empty. Rows the gateway sends with no
 * substance are dropped by the LIST, not by the card: returning null from
 * PostCard would leave the wrapper's hairline behind as a stray divider.
 *
 * Media counts as substance on its own — a photo post has no text by design —
 * and so does a live block or a quoted post.
 */
export function hasRenderableBody(post: PostProps): boolean {
    return Boolean(
        post.content?.trim() ||
            post.images?.length ||
            post.videos?.length ||
            post.live ||
            post.repostOf ||
            // A locked paid post is empty ON PURPOSE — the gateway strips its
            // body for anyone who has not bought it, which is exactly the
            // shape this guard was written to discard. Without this line the
            // paywall card was filtered out of every feed and profile, so a
            // seller's post simply did not exist for anyone else: the wall
            // worked perfectly and nobody could find the door.
            post.sale?.locked,
    );
}

export interface PostProps {
    id: string;
    author: {
        id: string;
        name: string;
        username: string;
        avatar: string;
        isVerified?: boolean;
        /** Membership tier behind the tick, so it renders in its own metal. */
        verification?: { tier?: "bronze" | "silver" | "gold" } | null;
        /** Earned marks rendered after the name, alongside the tick. */
        badges?: ProfileBadge[];
    };
    content: string;
    /**
     * Pre-formatted age. Kept for callers that only ever had a label, but
     * `createdAt` wins when present — see below.
     */
    timestamp: string;
    /**
     * The raw publish time.
     *
     * `timestamp` is a STRING formatted once, wherever the post was mapped,
     * and it never updates. A post held before being shown — the new-posts
     * pill batches for two minutes — kept saying "1s" long after it stopped
     * being true, and the post page disagreed with the card because it
     * formatted at its own moment. Carrying the instant and formatting at
     * render makes every surface agree, and makes the label correct whenever
     * the card next paints.
     */
    createdAt?: string;
    /** Server-side translation resolved before the page was sent. Present
     *  only when the post is not already in the reader's language. */
    translation?: { text: string; source?: string | null; target?: string };
    /** Denormalized @mention metadata (verified ticks on mention chips). */
    mentions?: { username: string; isVerified?: boolean }[];
    /** Paid post. When locked, the gateway has already stripped content and
     *  media — the glass layer here is presentation over an empty body, not
     *  the thing standing between a reader and the words. */
    sale?: {
        priceUsdMinor: number;
        locked: boolean;
        isSeller?: boolean;
        salesCount?: number;
        /** Storefront fields the gateway serves to non-buyers. */
        title?: string;
        teaser?: string;
        teaserTruncated?: boolean;
        media?: {
            imageCount?: number;
            hasVideo?: boolean;
            videoDurationSec?: number;
            audioDurationSec?: number;
            previewThumb?: string;
            audio?: { durationSec: number; peaks: number[] };
            previewAudioUrl?: string;
        };
    };
    images?: string[];
    videos?: string[];
    videoPlays?: number;
    /** Voice-note post: peaks are 64 ints (0-127) stored with the post. */
    audio?: {
        url: string;
        durationSec: number;
        peaks: number[];
        blurBg: boolean;
    };
    stats: {
        replies: number;
        reposts: number;
        likes: number;
        views?: number;
    };
    isLiked?: boolean;
    type?: "post" | "live";
    promoted?: boolean;
    repostOf?: {
        id: string;
        authorName: string;
        username: string;
        avatar: string;
        isVerified?: boolean;
        tier?: "bronze" | "silver" | "gold";
        content: string;
        image?: string;
        timestamp: string;
        /** Same reasoning as the parent's — the instant, not a frozen label. */
        createdAt?: string;
    };
    live?: {
        streamId: string;
        status: "live" | "ended";
        title?: string;
        viewerPeak?: number;
    };
    isBookmarked?: boolean;
    isDetail?: boolean;
    /** Set when the post was written into a community, so the card can say so. */
    community?: {
        id: string;
        name: string;
        slug: string;
    };
    linkPreview?: {
        url: string;
        title: string;
        description: string;
        image: string;
        domain: string;
    };
}

/* Count formatting per 02-typography number rules: full 1,204 below 10K,
   K/M abbreviation from 10K up tabular-nums keeps rolls steady. */
const formatCount = (n: number) => {
    if (!n) return "";
    if (n < 10_000) return n.toLocaleString();
    if (n < 1_000_000) return `${(n / 1000).toFixed(0)}K`;
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
};

/**
 * Can this account promote a post? One request per page load, shared by every
 * card, cached at module scope.
 *
 * Promotion is a membership perk and the gateway enforces that — but the menu
 * item was offered to everyone, so free accounts were invited to promote and
 * only found out it was not for them from a failed toast.
 */
let canPromotePromise: Promise<boolean> | null = null;
function fetchCanPromote(): Promise<boolean> {
	canPromotePromise ??= getSubscriptionAction()
		.then((res) =>
			res.success ? Boolean(res.data.entitlements?.subscriber) : false,
		)
		.catch(() => false);
	return canPromotePromise;
}

export const PostCard = memo(
    ({
        post: postProp,
        replyingTo,
    }: {
        post: PostProps;
        /** Handle this card answers — renders the "Replying to @x" cue that
         *  turns a card sitting under a post into a visible reply to it. */
        replyingTo?: string;
    }) => {
    const t = useT();
    // A paid unlock swaps the stripped post for the revealed one in place —
    // no refetch of the page, no scroll jump. Shadowing the prop means every
    // reference below sees the unlocked body the instant it lands.
    const [revealed, setRevealed] = useState<PostProps | null>(null);
    const post = revealed ?? postProp;
    const [unlocking, setUnlocking] = useState(false);
    const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
    // Set when an unlock bounced on balance — opens the fund-your-account
    // dialog with the gateway's balance-aware explanation.
    const [topUpMessage, setTopUpMessage] = useState<string | null>(null);
    const [likersOpen, setLikersOpen] = useState(false);
    const [canPromote, setCanPromote] = useState(false);
    const [repostMenuOpen, setRepostMenuOpen] = useState(false);
    const [quoteOpen, setQuoteOpen] = useState(false);
    const [reposted, setReposted] = useState(false);
    const [repostDelta, setRepostDelta] = useState(0);
    const [isLiked, setIsLiked] = useState(post.isLiked);
    const [likeCount, setLikeCount] = useState(post.stats.likes);

    // The viewer's own toggles, shared session-wide. A recorded action beats
    // any payload: a cached profile-tab copy from before the tap used to
    // reset the heart to empty here — and one honest tap on that lying heart
    // UNLIKED the post, feeding the ranker a corrupted signal.
    const myEng = useSyncExternalStore(
        useCallback(
            (fn: () => void) => subscribeMyEngagement(post.id, fn),
            [post.id],
        ),
        useCallback(() => getMyEngagement(post.id), [post.id]),
        () => undefined,
    );

    // useState(prop) only reads its argument on the FIRST render, so a refetch
    // that returned a newer count left the card showing the old one forever.
    // Re-sync whenever the server's numbers actually change — but the
    // viewer's own recorded action always wins over the payload.
    useEffect(() => {
        setIsLiked(myEng?.liked ?? post.isLiked);
    }, [myEng?.liked, post.isLiked, post.id]);
    useEffect(() => {
        setIsBookmarked(myEng?.bookmarked ?? post.isBookmarked);
    }, [myEng?.bookmarked, post.isBookmarked, post.id]);
    useEffect(() => {
        if (myEng?.reposted !== undefined) setReposted(myEng.reposted);
    }, [myEng?.reposted, post.id]);
    useEffect(() => {
        setLikeCount(post.stats.likes);
        seedStats(post.id, {
            likes: post.stats.likes,
            replies: post.stats.replies,
            reposts: post.stats.reposts,
        });
    }, [post.id, post.stats.likes, post.stats.replies, post.stats.reposts]);

    // Live counts for THIS post, off the one shared feed subscription.
    const live = useSyncExternalStore(
        useCallback((fn: () => void) => subscribeStats(post.id, fn), [post.id]),
        useCallback(() => getStats(post.id), [post.id]),
        () => undefined,
    );

    // The optimistic local count wins for the viewer's own like, so their tap
    // never appears to bounce when their own event arrives back.
    const shownLikes = live?.likes ?? likeCount;
    const shownReplies = live?.replies ?? post.stats.replies;
    const shownReposts = live?.reposts ?? post.stats.reposts;
    const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked);

    // Translation (X-style): tap to translate, or automatic when the
    // preference is on. The gateway caches by text-hash + target, so repeat
    // views of a translated post cost one indexed read.
    const [autoTranslate, setAutoTranslate] = useAtom(autoTranslateAtom);
    const translations = useAtomValue(translationsAtom);
    // Seeded from the server's pre-translation: initial state, not an effect,
    // so the very first render is already in the reader's language. Without
    // this the post would paint in its original language and swap after a
    // round trip — the flicker this whole path exists to avoid.
    const [translation, setTranslation] = useState<string | null>(
        postProp.translation?.text ?? null,
    );
    const [translationSource, setTranslationSource] = useState<string | null>(
        postProp.translation?.source ?? null,
    );
    const [translating, setTranslating] = useState(false);
    const [showOriginal, setShowOriginal] = useState(false);
    const [translateChecked, setTranslateChecked] = useState(
        Boolean(postProp.translation?.text),
    );
    const [translateOpen, setTranslateOpen] = useState(false);
    // A live card that keeps its LIVE badge after the broadcast ends is the
    // most visible kind of stale state. Listen and flip it.
    const [liveEnded, setLiveEnded] = useState(false);
    useLiveEvents((event, data) => {
        if (
            event === "ended" &&
            post.live?.streamId &&
            data.streamId === post.live.streamId
        ) {
            setLiveEnded(true);
        }
    });
    const isLiveNow = post.live?.status === "live" && !liveEnded;

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
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);

    // Image Modal State
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
        null,
    );

    // Share feedback: the paper plane briefly swaps to a success Check after copying.
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
            // Asked only when a menu actually opens, not once per card on
            // mount. The promise is module-scoped, so however many cards ask,
            // one request goes out per page load.
            void fetchCanPromote().then(setCanPromote);
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
        // Optimistic, and written THROUGH to the shared store. Without that,
        // a like that had already arrived from someone else would keep winning
        // and the viewer's own tap would look like it did nothing.
        const optimistic = newIsLiked ? shownLikes + 1 : Math.max(0, shownLikes - 1);
        setIsLiked(newIsLiked);
        setLikeCount(optimistic);
        applyStats(post.id, { likes: optimistic });
        applyMyEngagement(post.id, { liked: newIsLiked });

        try {
            const res = newIsLiked
                ? await likePostAction(post.id)
                : await unlikePostAction(post.id);
            // Reconcile against the server's own number rather than trusting
            // the arithmetic: two devices liking at once would otherwise drift.
            const server = (res as any)?.likes;
            if (typeof server === "number") {
                setLikeCount(server);
                applyStats(post.id, { likes: server });
            }
        } catch (error) {
            console.error("Like error:", error);
            setIsLiked(!newIsLiked);
            setLikeCount(shownLikes);
            applyStats(post.id, { likes: shownLikes });
            applyMyEngagement(post.id, { liked: !newIsLiked });
            toast("Failed to update like", { type: "error" });
        }
    }, [currentUser, isLiked, post.id, shownLikes, toast]);

    const handleBookmark = useCallback(async () => {
        if (!currentUser) {
            toast("Please login to bookmark posts", { type: "error" });
            return;
        }

        const newIsBookmarked = !isBookmarked;
        setIsBookmarked(newIsBookmarked);
        applyMyEngagement(post.id, { bookmarked: newIsBookmarked });

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
            applyMyEngagement(post.id, { bookmarked: !newIsBookmarked });
            toast("Failed to update bookmark", { type: "error" });
        }
    }, [currentUser, isBookmarked, post, setUser, setBookmarks, toast]);

    const handleTranslate = useCallback(
        async (silent = false) => {
        if (translating || !post.content) return;
        if (!silent) setTranslating(true);
        try {
            const res = await translatePostAction(post.content);
            setTranslateChecked(true);
            if (res.success && res.translated && !res.sameLanguage) {
                setTranslation(res.translated);
                setTranslationSource(res.source ?? null);
                setShowOriginal(false);
            }
        } finally {
            if (!silent) setTranslating(false);
        }
    },
        [translating, post.content],
    );

    // The feed translates a page in the background as it loads, so by the
    // time a card is on screen its translation is usually already here —
    // adopt it and render translated on first paint, no spinner, no request.
    const cachedTranslation = translations[post.id];
    useEffect(() => {
        if (!cachedTranslation) return;
        setTranslateChecked(true);
        if (cachedTranslation.translated && !cachedTranslation.sameLanguage) {
            setTranslation(cachedTranslation.translated);
            setTranslationSource(cachedTranslation.source ?? null);
        }
    }, [cachedTranslation]);

    // Fallback for surfaces with no prefetch (post detail, profile). Runs
    // SILENTLY: an automatic translation the reader didn't ask for has no
    // business showing them a loading state.
    useEffect(() => {
        if (
            autoTranslate &&
            !translateChecked &&
            !translating &&
            !cachedTranslation &&
            post.content
        ) {
            handleTranslate(true);
        }
    }, [
        autoTranslate,
        translateChecked,
        translating,
        cachedTranslation,
        post.content,
        handleTranslate,
    ]);

    // "Translated from Spanish" in the reader's own language.
    const translatedFromLabel = useMemo(() => {
        if (!translationSource) return null;
        const code = translationSource.split("-")[0].toLowerCase();
        try {
            return (
                new Intl.DisplayNames([t.locale], { type: "language" }).of(
                    code,
                ) ?? code.toUpperCase()
            );
        } catch {
            return code.toUpperCase();
        }
    }, [translationSource, t.locale]);

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
            } else if (action === "report") {
                setIsReportOpen(true);
            } else if (action === "block") {
                setIsBlockModalOpen(true);
            } else {
                // Pin, activity and not-interested still have no gateway
                // support — say so instead of silently no-oping.
                toast("Not available yet coming soon", { type: "info" });
            }
        },
        [post.id, toast],
    );

    /** Block from the post menu, without leaving the feed. */
    const handleBlockAuthor = useCallback(async () => {
        const res = await blockUserAction(post.author.id);
        if (!res.success) {
            toast(res.message ?? "Could not block", { type: "error" });
            return;
        }
        toast(t("safety.blocked.toast"));
        // The post is now hidden server-side; drop it from this render too so
        // the feed doesn't keep showing what it just agreed to hide.
        setIsDeleted(true);
    }, [post.author.id, toast, t]);

    const MAX_LENGTH = 280;
    const shouldTruncate = useMemo(
        () => !post.isDetail && post.content.length > MAX_LENGTH,
        [post.isDetail, post.content.length],
    );

    // Paid post plumbing. `locked` drives the glass layer; the handler swaps
    // in the gateway's revealed copy on success. Errors speak in toasts, and
    // an empty wallet gets pointed at the wallet rather than a dead retry.
    // A seller always sees their own post unlocked — correct, but it leaves
    // them no way to confirm the paywall is actually up. This flips their view
    // to the buyer's, which is the difference between trusting a label and
    // seeing the wall.
    const [previewAsBuyer, setPreviewAsBuyer] = useState(false);
    const isSeller = Boolean(post.sale?.isSeller);
    const saleLocked = Boolean(post.sale?.locked) || (isSeller && previewAsBuyer);
    const salePriceLabel = post.sale
        ? `$${(post.sale.priceUsdMinor / 100).toFixed(2).replace(/\.00$/, "")}`
        : "";

    const handleUnlock = useCallback(async () => {
        if (unlocking) return;
        setUnlocking(true);
        try {
            const res = await unlockPostAction(post.id);
            if (res.success && res.data) {
                const d: any = res.data;
                setRevealed({
                    ...postProp,
                    content: d.content ?? "",
                    images: d.images,
                    videos: d.videos,
                    mentions: d.mentions,
                    linkPreview: d.linkPreview,
                    sale: d.sale,
                });
                toast(t("post.unlocked.toast"), { type: "success" });
            } else if (!res.success && res.code === "INSUFFICIENT_BALANCE") {
                // The gateway names the real gap (Dollar Account vs naira).
                // A toast alone strands them — the dialog carries the one
                // action that fixes it: funding the Dollar Account on the hub.
                setTopUpMessage(res.message ?? t("post.locked.insufficient"));
            } else {
                toast(t("post.locked.failed"), { type: "error" });
            }
        } finally {
            setUnlocking(false);
        }
    }, [unlocking, post.id, postProp, toast, t]);

    const displayedContent = useMemo(
        () =>
            shouldTruncate ? post.content.slice(0, MAX_LENGTH) : post.content,
        [shouldTruncate, post.content],
    );

    // URLs, $cashtags, #hashtags and @mentions become links (RichText).
    const formattedContent = useMemo(
        () => renderRichText(displayedContent, { mentions: post.mentions }),
        [displayedContent, post.mentions],
    );
    const formattedTranslation = useMemo(
        () =>
            translation
                ? renderRichText(translation, { mentions: post.mentions })
                : null,
        [translation, post.mentions],
    );
    const showingTranslation = Boolean(translation) && !showOriginal;

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
        <article className="relative block px-4 py-3 sm:py-3.5 hover:bg-surface/40 transition-colors">
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
                message="This can't be undone and it will be removed from your profile, your Allies' timelines, and search results."
                confirmText={isDeleting ? "Deleting..." : "Delete"}
                isDestructive={true}
            />

            {/* Money leaves the wallet here, so it asks first. The confirm
                names the price and the seller — a dialog that only says "are
                you sure" gives the reader nothing to check, which is exactly
                how people confirm the wrong purchase. */}
            <ConfirmModal
                isOpen={isBuyModalOpen}
                onClose={() => setIsBuyModalOpen(false)}
                onConfirm={() => {
                    setIsBuyModalOpen(false);
                    void handleUnlock();
                }}
                title={t("post.buy.confirmTitle")}
                message={t("post.buy.confirmBody")
                    .replace("{price}", salePriceLabel)
                    .replace("{seller}", `@${post.author.username}`)}
                confirmText={t("post.buy.confirmCta")}
            />

            <ConfirmModal
                isOpen={topUpMessage !== null}
                onClose={() => setTopUpMessage(null)}
                onConfirm={() => {
                    setTopUpMessage(null);
                    window.open(
                        "https://worldstreetgold.com/welcome",
                        "_blank",
                        "noopener",
                    );
                }}
                title="Fund your Dollar Account"
                message={topUpMessage ?? ""}
                confirmText="Fund Dollar Account"
            />

            <ConfirmModal
                isOpen={isBlockModalOpen}
                onClose={() => setIsBlockModalOpen(false)}
                onConfirm={handleBlockAuthor}
                title={`${t("safety.block")} @${post.author.username}?`}
                message="They will not be able to message you or see your posts, and you will not see theirs."
                confirmText={t("safety.block")}
                isDestructive
            />

            {isReportOpen && (
                <ReportSheet
                    /* The gateway derives comment-vs-post from `parentPost`,
                       so the client does not have to know which this is. */
                    targetType="post"
                    targetId={post.id}
                    canBlock={!isOwnPost}
                    onBlock={handleBlockAuthor}
                    onClose={() => setIsReportOpen(false)}
                />
            )}

            <ImageModal
                isOpen={selectedImageIndex !== null}
                onClose={() => setSelectedImageIndex(null)}
                images={post.images || []}
                initialIndex={selectedImageIndex || 0}
            />

            {/* Which community this came from, above the author row. In an
                aggregated feed the community is the first thing you need,
                not the last. z-10 + pointer-events-auto so it stays clickable
                above the card's overlay link. */}
            {post.community && (
                <Link
                    href={`/communities/${post.community.slug}`}
                    onClick={(e) => e.stopPropagation()}
                    className="relative z-10 mb-1.5 ml-[54px] sm:ml-[58px] flex w-fit items-center gap-1.5 pointer-events-auto font-sans text-[12.5px] font-semibold text-muted transition-colors hover:text-primary"
                >
                    <UsersThree size={13} weight="duotone" className="text-gold" />
                    <span className="truncate">{post.community.name}</span>
                </Link>
            )}

            <div className="flex gap-3 sm:gap-4 relative z-10 pointer-events-none">
                <div className="shrink-0 pointer-events-auto mt-1">
                    <Link
                        href={`/profile/${post.author.username}`}
                        className="relative block w-[42px] h-[42px] rounded-pill overflow-hidden border border-hairline hover:border-brand transition-colors"
                    >
                        <SafeAvatar src={post.author.avatar} className="object-cover" alt={post.author.username} />
                    </Link>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                        {/* min-w-0 lets the two truncating links actually shrink;
                            without it the row grows past the card on narrow
                            screens. The badge, dot and timestamp never shrink 
                            the handle gives way first, then the display name. */}
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 overflow-hidden pointer-events-auto">
                            <Link
                                href={`/profile/${post.author.username}`}
                                className="text-[17px] sm:text-[16px] font-semibold leading-5 text-primary truncate font-sans hover:underline decoration-gold underline-offset-4"
                            >
                                {post.author.name}
                            </Link>
                            {/* The one seal everywhere; its metal is the author's
                                membership tier (bronze / silver / gold). */}
                            {/* Not gated on isVerified: UserBadges already
                                returns null for someone with neither a tick nor
                                an earned mark. Gating the block on the tick
                                meant an account with a W and no tick — every
                                brand account — showed nothing beside its name
                                anywhere except its own profile. */}
                            <span className="shrink-0 flex">
                                <UserBadges
                                    isVerified={post.author.isVerified}
                                    verification={post.author.verification}
                                    badges={post.author.badges}
                                    size={16}
                                />
                            </span>
                            <Link
                                href={`/profile/${post.author.username}`}
                                className="hidden xs:block text-subtle text-[13.5px] truncate font-sans hover:text-muted"
                            >
                                @{post.author.username}
                            </Link>
                            <span className="hidden xs:inline text-subtle text-xs shrink-0">
                                •
                            </span>
                            <span className="text-subtle text-[13.5px] font-sans whitespace-nowrap shrink-0">
                                <TimeAgo
                                    date={post.createdAt}
                                    fallback={post.timestamp}
                                />
                            </span>
                            {post.promoted && (
                                <span className="shrink-0 rounded-[4px] bg-raised px-1.5 py-px text-[10px] font-semibold tracking-wide text-subtle font-sans">
                                    {t("promo.label")}
                                </span>
                            )}
                            {isLiveNow && (
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
                                                        setIsMenuOpen(false);
                                                        setAutoTranslate(
                                                            (v) => !v,
                                                        );
                                                    }}
                                                    className="w-full text-left px-3.5 py-2.5 hover:bg-raised flex items-center gap-2.5 text-sm font-medium text-primary transition-colors font-sans"
                                                >
                                                    <Translate size={16} />
                                                    {autoTranslate
                                                        ? t("post.autoTranslateOff")
                                                        : t("post.autoTranslateOn")}
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
                                                {canPromote && (
                                                    <button
                                                        type="button"
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            setIsMenuOpen(false);
                                                            const res =
                                                                await promotePostAction(
                                                                    post.id,
                                                                );
                                                            toast(
                                                                res.success
                                                                    ? t("promo.created")
                                                                    : (res.message ??
                                                                            t("promo.failed")),
                                                                {
                                                                    type: res.success
                                                                        ? "success"
                                                                        : "error",
                                                                },
                                                            );
                                                        }}
                                                        className="w-full text-left px-3.5 py-2.5 hover:bg-raised flex items-center gap-2.5 text-sm font-medium text-primary transition-colors font-sans"
                                                    >
                                                        <Megaphone className="w-4 h-4" />
                                                        {t("promo.menu")}
                                                    </button>
                                                )}
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
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsMenuOpen(false);
                                                        setAutoTranslate(
                                                            (v) => !v,
                                                        );
                                                    }}
                                                    className="w-full text-left px-3.5 py-2.5 hover:bg-raised flex items-center gap-2.5 text-sm font-medium text-primary transition-colors font-sans"
                                                >
                                                    <Translate size={16} />
                                                    {autoTranslate
                                                        ? t("post.autoTranslateOff")
                                                        : t("post.autoTranslateOn")}
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
                    {/* UI/Body: Public Sans Regular 15 post text size per 02-typography. */}
                    {post.repostOf && !post.content && (
                        <span className="flex items-center gap-1.5 text-subtle text-[12px] font-sans mb-1">
                            <Repeat size={12} />
                            {t("post.reposted")}
                        </span>
                    )}
                    {post.live && (
                        <Link
                            href={`/live?tab=live&s=${post.live.streamId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="relative z-10 pointer-events-auto mb-2 flex items-center gap-3 rounded-lg border border-hairline bg-raised/40 hover:bg-raised px-3.5 py-3 transition-colors"
                        >
                            <span
                                className={
                                    isLiveNow
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
                                    {isLiveNow
                                        ? t("live.watch")
                                        : `${t("live.replay")}${post.live.viewerPeak ? ` · ${post.live.viewerPeak} ${t("live.viewers")}` : ""}`}
                                </span>
                            </span>
                        </Link>
                    )}
                    {/* The paywall. The gateway already stripped the body for
                        non-buyers, so the "blurred post" behind the glass is
                        staged — skeleton lines standing in for text nobody has
                        paid to see. The glass panel carries the ask; the 60/40
                        split is seller-facing copy in the composer, never shown
                        to the buyer here. */}
                    {saleLocked && (
                        /* The storefront (owner ruling): a paid post sells on
                           its title and a real taste, never an anonymous
                           "Paid post". Everything shown here was decided
                           server-side — teaser slice, 24px thumb, audio
                           peaks + 15s preview. No real asset is in the page. */
                        <SaleStorefront
                            sale={post.sale!}
                            priceLabel={salePriceLabel}
                            unlocking={unlocking}
                            isSeller={isSeller}
                            onUnlock={() => setIsBuyModalOpen(true)}
                        />
                    )}

                    {/* Seller's own view: the listing state, quietly. */}
                    {post.sale && isSeller && (
                        <div className="mb-1 flex items-center gap-2">
                            <span className="font-sans text-[11.5px] font-semibold text-credit">
                                {t("post.forSale.selling").replace("{price}", salePriceLabel)}
                                {post.sale.salesCount
                                    ? ` · ${t("post.forSale.sold").replace("{count}", String(post.sale.salesCount))}`
                                    : ""}
                            </span>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewAsBuyer((v) => !v);
                                }}
                                className="relative z-10 pointer-events-auto flex h-7 items-center gap-1 rounded-pill bg-raised px-2 font-sans text-[11px] font-medium text-muted transition-colors hover:text-primary cursor-pointer"
                            >
                                {previewAsBuyer ? (
                                    <EyeSlash size={12} weight="regular" />
                                ) : (
                                    <Eye size={12} weight="regular" />
                                )}
                                {previewAsBuyer
                                    ? t("post.forSale.exitPreview")
                                    : t("post.forSale.preview")}
                            </button>
                        </div>
                    )}

                    {/* overflow-wrap:anywhere, not break-words: a caption like
                        "Worldstreet#SouthSouthRegion#BeninRepublicZone#TogosubZone"
                        is ONE unbreakable run, and break-word only breaks a word
                        that alone cannot fit. Without this the run pinned the line
                        and made the whole column scroll sideways. */}
                    {replyingTo && (
                        <p className="mb-1 font-sans text-[13px] text-muted pointer-events-auto">
                            Replying to{" "}
                            <Link
                                href={`/profile/${replyingTo}`}
                                onClick={(e) => e.stopPropagation()}
                                className="relative z-10 font-medium text-gold hover:underline"
                            >
                                @{replyingTo}
                            </Link>
                        </p>
                    )}
                    <p className="text-primary whitespace-pre-wrap [overflow-wrap:anywhere] mb-1.5 font-normal leading-[1.55] text-[18px] sm:text-[16.5px] font-sans tracking-tight pointer-events-none">
                        {showingTranslation
                            ? formattedTranslation
                            : formattedContent}
                        {shouldTruncate && !showingTranslation && (
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
                    {post.content &&
                        (translation || translating || !translateChecked) && (
                            <div className="relative z-10 pointer-events-auto -mt-0.5 mb-1.5">
                                {translation ? (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowOriginal((v) => !v);
                                        }}
                                        className="flex items-center gap-1.5 text-[12.5px] font-sans text-subtle hover:text-gold transition-colors cursor-pointer"
                                    >
                                        <Translate size={13} />
                                        {showOriginal ? (
                                            t("post.showTranslation")
                                        ) : (
                                            <>
                                                {/* "Translated from Spanish"
                                                    when the source is known;
                                                    plain "Translated" when it
                                                    is not — never a dangling
                                                    "Translated from ·". */}
                                                {translatedFromLabel
                                                    ? `${t("post.translatedFrom")} ${translatedFromLabel}`
                                                    : t("post.translated")}
                                                {" · "}
                                                {t("post.showOriginal")}
                                            </>
                                        )}
                                    </button>
                                ) : translating ? (
                                    <span className="flex items-center gap-1.5 text-[12.5px] font-sans text-subtle">
                                        <CircleNotch
                                            size={13}
                                            className="animate-spin"
                                        />
                                        {t("post.translating")}
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setTranslateOpen(true);
                                        }}
                                        className="flex items-center gap-1.5 text-[12.5px] font-sans text-subtle hover:text-gold transition-colors cursor-pointer"
                                    >
                                        <Translate size={13} />
                                        {t("post.translate")}
                                    </button>
                                )}
                            </div>
                        )}
                    {post.repostOf && (
                        <Link
                            href={`/post/${post.repostOf.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="relative z-10 pointer-events-auto block mt-2 mb-1.5 rounded-xl border border-hairline/70 p-3 hover:bg-raised/30 transition-colors"
                        >
                            <span className="flex items-center gap-2 mb-1 min-w-0">
                                <span className="relative w-5 h-5 rounded-pill overflow-hidden shrink-0 bg-raised">
                                    <SafeAvatar src={post.repostOf.avatar} className="object-cover" />
                                </span>
                                <span className="text-[13px] font-semibold text-primary font-sans truncate">
                                    {post.repostOf.authorName}
                                </span>
                                {/* The tick travels with the repost — a
                                    verified author quoted wholesale must not
                                    arrive stripped of their mark. */}
                                {post.repostOf.isVerified && (
                                    <VerifiedIcon
                                        size={{ width: "13", height: "13" }}
                                        tier={post.repostOf.tier}
                                    />
                                )}
                                <span className="text-[12px] text-subtle font-sans truncate shrink-0">
                                    @{post.repostOf.username} · {post.repostOf.timestamp}
                                </span>
                            </span>
                            {post.repostOf.content && (
                                <span className="block text-[14px] text-muted font-sans line-clamp-4 whitespace-pre-wrap">
                                    {post.repostOf.content}
                                </span>
                            )}
                            {post.repostOf.image && (
                                <span className="relative block mt-2 h-44 rounded-lg overflow-hidden bg-sunken">
                                    <Image
                                        src={post.repostOf.image}
                                        alt=""
                                        fill
                                        className="object-cover"
                                    />
                                </span>
                            )}
                        </Link>
                    )}

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

                    {post.videos && post.videos.length > 0 && (
                        <div
                            className="relative z-10 pointer-events-auto mt-2 mb-1.5 rounded-xl overflow-hidden border border-hairline bg-sunken"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                            {/* aspect-video is only the placeholder that holds
                                the space until the metadata lands; fitToMedia
                                then swaps in the clip's real shape, so portrait
                                video stops sitting between two black bars. */}
                            <VideoPlayer
                                src={post.videos[0]}
                                fitToMedia
                                plays={post.videoPlays}
                                onFirstPlay={() => {
                                    void recordVideoPlayAction(post.id).catch(
                                        () => {},
                                    );
                                }}
                                className="w-full max-h-[600px] aspect-video"
                            />
                        </div>
                    )}
                    {likersOpen && (
                        <LikersModal
                            postId={post.id}
                            onClose={() => setLikersOpen(false)}
                        />
                    )}
                    {post.audio && (
                        <AudioCard
                            audio={post.audio}
                            avatar={post.author.avatar}
                        />
                    )}
                    {post.images && post.images.length === 1 && (
                        // pointer-events-auto: the card body is
                        // pointer-events-none so the card-wide overlay link
                        // catches taps, and every interactive child has to opt
                        // back in. The multi-image grid and the video block
                        // already did; this one didn't, so single-image posts
                        // silently could not be tapped to zoom.
                        <div className="mb-3 w-full pointer-events-auto">
                            <FeedImage
                                src={post.images[0]}
                                alt="Post attachment"
                                className="relative z-10 w-fit max-w-full rounded-xl border border-hairline"
                                // object-contain, not cover: the box is already
                                // sized by the image itself, so cover only ever
                                // risked shaving an edge off a tall photo.
                                imgClassName="block h-auto w-auto max-w-full max-h-[600px] object-contain cursor-zoom-in hover:opacity-95"
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
                                    <FeedImage
                                        key={i}
                                        src={src}
                                        className={clsx(
                                            "relative z-10 w-full h-full",
                                            getImageStyle(
                                                i,
                                                post.images!.length,
                                            ),
                                        )}
                                        imgClassName="absolute inset-0 h-full w-full object-cover cursor-zoom-in hover:opacity-95"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setSelectedImageIndex(i);
                                        }}
                                    />
                                ))}
                        </div>
                    )}
                    {/* Post actions the interaction cluster distributes across
                        the row like X: flex-1 + max-w + justify-between puts
                        reply/repost/like/bookmark/share at even intervals, each
                        count riding beside its glyph; impressions ride the right
                        edge, isolated (a metric, not a button). Idle glyphs are
                        regular weight — duotone's inner fill sits so close to
                        bg-surface that the row muted itself — and active stays
                        fill. 03-icons: this row is the ONE place Phosphor is
                        used instead of Lucide, matching mobile. */}
                    <div className="flex items-center justify-between text-muted mt-1.5 -mb-1.5 pointer-events-auto">
                        <div className="flex min-w-0 flex-1 max-w-[425px] items-center justify-between -ml-2 sm:mr-6">
                        <Link
                            href={`/post/${post.id}`}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Reply"
                            className="flex items-center gap-0.5 hover:text-primary transition-colors group cursor-pointer"
                        >
                            <span className="flex h-10 w-[34px] shrink-0 items-center justify-center rounded-pill sm:w-10 group-hover:bg-primary/10 transition group-active:scale-[0.98]">
                                <ChatCircle size={21} weight="bold" />
                            </span>
                            <span className="text-[13px] font-sans tabular-nums sm:text-[13.5px]">
                                {formatCount(shownReplies)}
                            </span>
                        </Link>
                        <div className="relative">
                            <button
                                type="button"
                                aria-label={t("post.repost")}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setRepostMenuOpen((v) => !v);
                                }}
                                className={clsx(
                                    "flex items-center gap-0.5 transition-colors group cursor-pointer",
                                    reposted ? "text-success" : "hover:text-success",
                                )}
                            >
                                <span className="flex h-10 w-[34px] shrink-0 items-center justify-center rounded-pill sm:w-10 group-hover:bg-success/10 transition group-active:scale-[0.98]">
                                    <Repeat
                                        size={21}
                                        weight={reposted ? "fill" : "bold"}
                                    />
                                </span>
                                <span className="text-[13px] font-medium font-sans tabular-nums sm:text-[14px]">
                                    {formatCount(
                                        (shownReposts ?? 0) + repostDelta,
                                    )}
                                </span>
                            </button>
                            {repostMenuOpen && (
                                <div
                                    className="absolute bottom-11 left-0 z-dropdown card-depth rounded-xl overflow-hidden py-1 w-40 animate-rise"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            setRepostMenuOpen(false);
                                            const res = await repostPostAction(
                                                post.id,
                                            );
                                            if (res.success) {
                                                setReposted(
                                                    Boolean(res.reposted),
                                                );
                                                applyMyEngagement(post.id, {
                                                    reposted: Boolean(
                                                        res.reposted,
                                                    ),
                                                });
                                                setRepostDelta(
                                                    res.reposted ? 1 : 0,
                                                );
                                                toast(
                                                    res.reposted
                                                        ? t("post.reposted")
                                                        : t("post.unreposted"),
                                                    { type: "success" },
                                                );
                                            }
                                        }}
                                        className="w-full text-left px-3.5 py-2.5 hover:bg-raised flex items-center gap-2.5 text-sm font-medium text-primary transition-colors font-sans cursor-pointer"
                                    >
                                        <Repeat size={16} weight="bold" />
                                        {t("post.repost")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRepostMenuOpen(false);
                                            setQuoteOpen(true);
                                        }}
                                        className="w-full text-left px-3.5 py-2.5 hover:bg-raised flex items-center gap-2.5 text-sm font-medium text-primary transition-colors font-sans cursor-pointer"
                                    >
                                        <ChatCircle size={16} weight="bold" />
                                        {t("post.quote")}
                                    </button>
                                </div>
                            )}
                        </div>
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
                            <span className="relative flex h-10 w-[34px] shrink-0 items-center justify-center rounded-pill sm:w-10 group-hover:bg-danger/10 transition group-active:scale-[0.98]">
                                {/* One-shot danger wash on like opacity-only,
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
                                        size={21}
                                        weight={isLiked ? "fill" : "bold"}
                                    />
                                </motion.span>
                            </span>
                            {/* The number is a door: who liked this is general
                                info (owner ruling) — tap the count, not the
                                heart, to see them. */}
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    if ((shownLikes ?? 0) > 0) setLikersOpen(true);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && (shownLikes ?? 0) > 0)
                                        setLikersOpen(true);
                                }}
                                className="relative cursor-pointer overflow-hidden text-[13px] font-medium font-sans tabular-nums hover:underline sm:text-[14px]"
                            >
                                <AnimatePresence mode="wait" initial={false}>
                                    {/* Count rolls 8px in the direction of change. */}
                                    <motion.span
                                        key={shownLikes}
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
                                        {formatCount(shownLikes)}
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
                            <span className="relative flex h-10 w-[34px] shrink-0 items-center justify-center rounded-pill sm:w-10 group-hover:bg-gold/10 transition group-active:scale-[0.98]">
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
                                        size={21}
                                        weight={isBookmarked ? "fill" : "bold"}
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
                            <span className="flex h-10 w-[34px] shrink-0 items-center justify-center rounded-pill sm:w-10 group-hover:bg-primary/10 transition group-active:scale-[0.98]">
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
                                            <Check size={16} weight="bold" />
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
                                            <PaperPlaneTilt
                                                size={21}
                                                weight="bold"
                                            />
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </span>
                        </button>
                        </div>

                        <div
                            // Impressions belong at the end of this row, beside
                            // the other numbers, the way every timeline shows
                            // them — they used to be exiled to the meta line on
                            // phones because five 40px buttons plus their counts
                            // overflowed a 343px card.
                            //
                            // This is a metric, not a button: nothing taps it,
                            // so it carries no hit target and costs only its own
                            // glyph and digits. The room came from the buttons
                            // narrowing to 36px below sm (they keep the full
                            // 40px height, and 40px at every width from sm up).
                            className="flex shrink-0 cursor-default select-none items-center gap-1 pr-0.5 text-subtle sm:gap-1.5"
                            title={t("post.views")}
                            aria-label={t("post.views")}
                        >
                            <Pulse size={17} weight="bold" className="sm:hidden" />
                            <Pulse size={18} weight="bold" className="hidden sm:block" />
                            <span className="text-[13px] font-medium font-sans tabular-nums sm:text-[13.5px]">
                                {formatCount(post.stats.views ?? 0) || "0"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            {translateOpen && (
                <TranslatePanel
                    content={post.content}
                    onClose={() => setTranslateOpen(false)}
                />
            )}
            {quoteOpen && (
                <QuoteModal
                    target={{
                        id: post.id,
                        authorName: post.author.name,
                        username: post.author.username,
                        avatar: post.author.avatar,
                        content: post.content || post.repostOf?.content || "",
                        timestamp: post.timestamp,
                    }}
                    onClose={() => setQuoteOpen(false)}
                />
            )}
        </article>
    );
});

PostCard.displayName = "PostCard";

/**
 * The locked paid post as a STOREFRONT — Option B from owner review.
 * Title first, then the truest tease the medium allows: the text's own
 * opening lines fading into the wall, a 24px-thumb peek for visuals, the
 * waveform plus a 15-second listen for voice, chips when a post mixes.
 * Everything rendered here arrived from the gateway's gate — the real
 * content is not in the page.
 */
function SaleStorefront({
    sale,
    priceLabel,
    unlocking,
    isSeller,
    onUnlock,
}: {
    sale: NonNullable<PostProps["sale"]>;
    priceLabel: string;
    unlocking: boolean;
    isSeller: boolean;
    onUnlock: () => void;
}) {
    const media = sale.media ?? {};
    const hasText = Boolean(sale.teaser?.trim());
    const imageCount = media.imageCount ?? 0;
    const hasVisual = imageCount > 0 || media.hasVideo;
    const hasAudio =
        Boolean(media.audio) || Boolean(media.audioDurationSec);
    // Mixed post: text leads, media collapses to chips. Media-only post:
    // the visual/audio tease IS the body.
    const mixed = hasText && (hasVisual || hasAudio);
    const vidClock = media.videoDurationSec
        ? `${Math.floor(media.videoDurationSec / 60)}:${String(media.videoDurationSec % 60).padStart(2, "0")}`
        : null;

    return (
        <div className="relative z-10 mb-2 overflow-hidden rounded-xl border border-hairline pointer-events-auto">
            <div className="px-4 pt-3.5">
                {sale.title && (
                    <p className="font-sans text-[15.5px] font-semibold leading-snug text-primary">
                        {sale.title}
                    </p>
                )}
                {hasText && (
                    <div className="relative mt-1.5">
                        <p className="font-sans text-[13.5px] leading-relaxed text-muted">
                            {sale.teaser}
                            {sale.teaserTruncated ? "…" : ""}
                        </p>
                        {/* the fade into the wall */}
                        <span
                            aria-hidden
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent"
                        />
                    </div>
                )}
            </div>

            {mixed ? (
                <div className="flex gap-1.5 px-4 pt-2.5">
                    {imageCount > 0 && (
                        <span className="flex items-center gap-1 rounded-pill bg-raised px-2.5 py-1 font-sans text-[11px] text-muted">
                            <ImageGlyph size={12} /> {imageCount}{" "}
                            {imageCount === 1 ? "image" : "images"}
                        </span>
                    )}
                    {media.hasVideo && (
                        <span className="flex items-center gap-1 rounded-pill bg-raised px-2.5 py-1 font-sans text-[11px] text-muted">
                            <VideoCamera size={12} /> {vidClock ?? "video"}
                        </span>
                    )}
                    {hasAudio && (
                        <span className="flex items-center gap-1 rounded-pill bg-raised px-2.5 py-1 font-sans text-[11px] text-muted">
                            <MicrophoneStage size={12} />{" "}
                            {Math.floor(((media.audio?.durationSec ?? media.audioDurationSec) ?? 0) / 60)}:
                            {String(((media.audio?.durationSec ?? media.audioDurationSec) ?? 0) % 60).padStart(2, "0")}{" "}
                            voice
                        </span>
                    )}
                </div>
            ) : hasVisual ? (
                <div className="relative mt-2.5 h-44 w-full overflow-hidden">
                    {media.previewThumb ? (
                        // The 24px thumb stretched: real colours, detail that
                        // never existed at this size. NOT a blurred original.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={media.previewThumb}
                            alt=""
                            aria-hidden
                            draggable={false}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="h-full w-full bg-gradient-to-br from-brand/15 via-raised to-sunken" />
                    )}
                    <span aria-hidden className="absolute inset-0 bg-page/25" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                        <span className="flex h-11 w-11 items-center justify-center rounded-pill bg-primary text-page">
                            <LockSimple size={17} weight="fill" />
                        </span>
                        <span className="font-sans text-[11.5px] font-medium text-white [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">
                            {media.hasVideo
                                ? vidClock
                                    ? `Video · ${vidClock}`
                                    : "Video inside"
                                : `${imageCount} ${imageCount === 1 ? "image" : "images"} inside`}
                        </span>
                    </div>
                </div>
            ) : media.audio || media.previewAudioUrl ? (
                <div className="px-4 pt-2.5">
                    {media.previewAudioUrl ? (
                        <>
                            <AudioCard
                                audio={{
                                    url: media.previewAudioUrl,
                                    durationSec: media.audio?.durationSec ?? 0,
                                    peaks: media.audio?.peaks ?? [],
                                    blurBg: false,
                                }}
                            />
                            <p className="-mt-1.5 mb-1 font-sans text-[11px] text-subtle">
                                First 15 seconds — unlock for the rest
                            </p>
                        </>
                    ) : (
                        <div className="flex h-12 items-center gap-[2px] rounded-lg bg-sunken px-3">
                            {(media.audio?.peaks ?? []).map((v, i) => (
                                <span
                                    key={i}
                                    className="w-full flex-1 rounded-pill bg-primary/30"
                                    style={{ height: `${Math.max(8, (v / 127) * 100)}%` }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            ) : hasAudio ? (
                <div className="px-4 pt-2.5">
                    <span className="flex w-fit items-center gap-1 rounded-pill bg-raised px-2.5 py-1 font-sans text-[11px] text-muted">
                        <MicrophoneStage size={12} />{" "}
                        {Math.floor((media.audioDurationSec ?? 0) / 60)}:
                        {String((media.audioDurationSec ?? 0) % 60).padStart(2, "0")}{" "}
                        voice inside
                    </span>
                </div>
            ) : null}

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-hairline px-4 py-2.5">
                <span className="flex items-center gap-1.5 font-sans text-[11.5px] text-subtle tabular-nums">
                    <LockSimple size={13} weight="fill" className="text-credit" />
                    {(sale.salesCount ?? 0) > 0
                        ? `${(sale.salesCount ?? 0).toLocaleString()} unlocked`
                        : "Locked"}
                </span>
                <button
                    type="button"
                    disabled={unlocking || isSeller}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (isSeller) return;
                        onUnlock();
                    }}
                    // Money CTA in money green; text-page flips with the theme
                    // (near-black on the bright dark-mode green, white-ish on
                    // the deep light-mode green) so it reads on both.
                    className="h-9 cursor-pointer rounded-pill bg-credit px-4 font-sans text-[12.5px] font-semibold text-page transition-colors hover:opacity-90 disabled:opacity-60"
                >
                    {unlocking ? "Unlocking…" : `Unlock for ${priceLabel}`}
                </button>
            </div>
        </div>
    );
}
