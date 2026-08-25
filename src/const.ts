export const BACKEND_URL =
    process.env.NEXT_PUBLIC_API_URL ??
    "https://worldstreetsocialmedia-gateway-f55k.onrender.com";
export const DEFAULT_AVATAR =
    "https://image2url.com/r2/default/images/1771539178659-93406255-32fe-4dfe-b214-0a284e3499d9.jpeg";

// Xstream (live streaming) — same Clerk instance, separate services.
export const XSTREAM_API_URL =
    process.env.NEXT_PUBLIC_XSTREAM_API_URL ?? "http://localhost:3001";
export const XSTREAM_WEB_URL =
    process.env.NEXT_PUBLIC_XSTREAM_WEB_URL ?? "http://localhost:3010";

// The one 280 budget: post composer, PostCard truncation, story captions.
export const POST_CHAR_BUDGET = 280;
