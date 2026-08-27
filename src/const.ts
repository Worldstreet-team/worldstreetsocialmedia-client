export const BACKEND_URL =
    process.env.NEXT_PUBLIC_API_URL ??
    "https://worldstreetsocialmedia-gateway-f55k.onrender.com";
export const DEFAULT_AVATAR =
    "https://image2url.com/r2/default/images/1771539178659-93406255-32fe-4dfe-b214-0a284e3499d9.jpeg";

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
