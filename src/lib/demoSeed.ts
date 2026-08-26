import type { SpaceRow } from "@/components/voice/SpaceCard";

/**
 * DESIGN-REVIEW SEED DATA — never shown by default.
 *
 * `/voice?demo=1` and `/live?demo=1` mix these rows in so the surfaces can
 * be judged with content in them, per the owner's request. Every id is
 * `demo-` prefixed, mutation paths skip them, and the page shows a "Demo
 * data" chip while they're visible. Do NOT wire these into a default path:
 * the Market Pulse rule (no fake data shipped as real) still stands.
 */

const avatar = (seed: string) =>
  `https://api.dicebear.com/9.x/notionists/png?seed=${seed}&size=96&backgroundColor=1c1917`;

// Anchored ONCE per session. Regenerating on every poll kept pushing the
// scheduled times forward, so the countdown reset instead of counting down.
const SESSION_START = Date.now();
const inMinutes = (mins: number) =>
  new Date(SESSION_START + mins * 60_000).toISOString();

export const isDemoId = (id: string) => id.startsWith("demo-");

let liveCache: SpaceRow[] | null = null;
let upcomingCache: SpaceRow[] | null = null;

function buildLive(): SpaceRow[] {
  return [
    {
      id: "demo-live-1",
      title: "Gold at all-time highs — who's still buying?",
      description:
        "XAU just printed a new record. Miners, ETFs and the physical premium — where the smart entries are now.",
      status: "live",
      startedAt: inMinutes(-42),
      host: {
        username: "aurelia_fx",
        firstName: "Aurelia",
        lastName: "Mba",
        avatar: avatar("aurelia"),
        isVerified: true,
      },
      community: { name: "Gold Desk", slug: "gold-desk" },
      membersCount: 128,
      joined: false,
      isHost: false,
    },
    {
      id: "demo-live-2",
      title: "Lagos startup checkin — Friday wins",
      description:
        "Founders drop this week's numbers. No pitches, receipts only.",
      status: "live",
      startedAt: inMinutes(-15),
      host: {
        username: "tundebuilds",
        firstName: "Tunde",
        avatar: avatar("tunde"),
      },
      community: null,
      membersCount: 54,
      joined: true,
      isHost: false,
    },
    {
      id: "demo-live-3",
      title: "Charting hour: BTC weekly close",
      description:
        "Live markup of the weekly candle with the desk's levels for next week.",
      status: "live",
      startedAt: inMinutes(-71),
      host: {
        username: "chartsbyada",
        firstName: "Ada",
        lastName: "Eze",
        avatar: avatar("ada"),
        isVerified: true,
      },
      community: { name: "Crypto Floor", slug: "crypto-floor" },
      membersCount: 342,
      joined: false,
      isHost: false,
    },
  ];
}

function buildUpcoming(): SpaceRow[] {
  return [
    {
      id: "demo-up-1",
      title: "NFP preview: the only number that matters",
      description:
        "Positioning before Friday's jobs print, with a look at how the last six releases moved the dollar.",
      status: "scheduled",
      scheduledFor: inMinutes(95),
      host: {
        username: "macromara",
        firstName: "Mara",
        avatar: avatar("mara"),
        isVerified: true,
      },
      community: { name: "Macro Desk", slug: "macro-desk" },
      membersCount: 86,
      joined: false,
      isHost: false,
    },
    {
      id: "demo-up-2",
      title: "Earnings season postmortem",
      description: "What beat, what broke, and the guidance that mattered.",
      status: "scheduled",
      scheduledFor: inMinutes(60 * 26),
      host: {
        username: "quietcapital",
        firstName: "Kofi",
        lastName: "Mensah",
        avatar: avatar("kofi"),
      },
      community: null,
      membersCount: 41,
      joined: true,
      isHost: false,
    },
    {
      id: "demo-up-3",
      title: "Women in trading — office hours",
      description: "Open Q&A. Bring your blotter.",
      status: "scheduled",
      scheduledFor: inMinutes(60 * 74),
      host: {
        username: "zaraonrates",
        firstName: "Zara",
        avatar: avatar("zara"),
        isVerified: true,
      },
      community: { name: "The Floor", slug: "the-floor" },
      membersCount: 210,
      joined: false,
      isHost: false,
    },
  ];
}

/** Street slides — Google's public sample clips, view-only (no postId, so
 *  the like/comment/follow paths never fire against real endpoints). */
export interface DemoSlide {
  key: string;
  videoUrl: string;
  username: string;
  avatar: string;
  content: string;
  likes: number;
  replies: number;
}

const SAMPLE =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample";

export function demoStreetSlides(): DemoSlide[] {
  return [
    {
      key: "demo-street-1",
      videoUrl: `${SAMPLE}/ForBiggerFun.mp4`,
      username: "aurelia_fx",
      avatar: avatar("aurelia"),
      content:
        "Walked the floor at the bullion expo — premiums are wild right now. Full breakdown tonight.",
      likes: 1284,
      replies: 96,
    },
    {
      key: "demo-street-2",
      videoUrl: `${SAMPLE}/ForBiggerJoyrides.mp4`,
      username: "tundebuilds",
      avatar: avatar("tunde"),
      content:
        "Shipping week: the payments dashboard is live. 0 → 1 in 12 days.",
      likes: 342,
      replies: 41,
    },
    {
      key: "demo-street-3",
      videoUrl: `${SAMPLE}/ForBiggerEscapes.mp4`,
      username: "chartsbyada",
      avatar: avatar("ada"),
      content: "Three charts before the open. The third one pays the rent.",
      likes: 2210,
      replies: 187,
    },
  ];
}

/** Stable across polls — a fresh array each call would reset the countdown
 *  and re-key every card. */
export function demoLiveSpaces(): SpaceRow[] {
  liveCache ??= buildLive();
  return liveCache;
}

export function demoUpcomingSpaces(): SpaceRow[] {
  upcomingCache ??= buildUpcoming();
  return upcomingCache;
}
