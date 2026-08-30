export const BACKEND_URL =
    process.env.NEXT_PUBLIC_API_URL ??
    "https://social-api.worldstreetgold.com";
/**
 * The gateway ORIGIN — the same value as BACKEND_URL with a trailing `/api`
 * stripped. Ably and the socket/call transports address the host, not the REST
 * mount point. This used to be re-derived with the same regex in three files,
 * each also re-reading NEXT_PUBLIC_API_URL, so a change to the base URL had
 * five places to reach instead of one.
 */
export const BACKEND_ORIGIN = BACKEND_URL.replace(/\/api\/?$/, "");

/**
 * The fallback face, served from our own /public.
 *
 * It used to point at image2url.com — a third-party host, for the one image
 * whose entire job is to render when something else has failed. It also
 * answers with `Content-Type: application/octet-stream`; Next sniffs the
 * bytes and optimizes it anyway, so this was not broken, but a fallback that
 * depends on an unrelated company staying up (and on a content-type sniff)
 * is a fallback with its own failure modes.
 *
 * public/images/default-avatar.png was already in the repo, unused. Local
 * means it cannot 404, cannot be rate-limited, and cannot be blocked.
 */
export const DEFAULT_AVATAR = "/images/default-avatar.png";

// Xstream (live streaming) — same Clerk instance, separate services.
//
// The fallbacks are the PRODUCTION hosts, not localhost. They used to be
// localhost:3001/3010, which meant a deploy that forgot these env vars sent
// every browser to the viewer's own machine: live chat, likes, gifts and the
// wallet balance all failed with nothing on screen to say why. Local dev sets
// them in .env.local; production is correct by default. Same shape as
// BACKEND_URL above.
// NOTE: livestream-api, NOT api.worldstreetgold.com. The latter is a
// different (currently suspended) service; the Fastify live API that owns
// streams, chat, likes, gifts and the wallet proxy is livestream-api. The
// README's "suggested domain" line is stale.
export const XSTREAM_API_URL =
    process.env.NEXT_PUBLIC_XSTREAM_API_URL ??
    "https://livestream-api.worldstreetgold.com";
export const XSTREAM_WEB_URL =
    process.env.NEXT_PUBLIC_XSTREAM_WEB_URL ??
    "https://xtreme.worldstreetgold.com";

// The one 280 budget: post composer, PostCard truncation, story captions.
export const POST_CHAR_BUDGET = 280;
