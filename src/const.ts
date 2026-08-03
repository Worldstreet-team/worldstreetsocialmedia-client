// Single source of truth for the gateway URL. Every API module (actions and
// providers alike) resolves through this, so NEXT_PUBLIC_API_URL repoints the
// whole app — e.g. to a local backend — with no code edits.
export const BACKEND_URL =
    process.env.NEXT_PUBLIC_API_URL ??
    "https://worldstreetsocialmedia-gateway-f55k.onrender.com";
// The one missing-avatar fallback for the whole app: locally hosted brand mark
// on the bg/surface stone (no third-party hosts, no random-hue tiles).
export const DEFAULT_AVATAR = "/images/default-avatar.png";
