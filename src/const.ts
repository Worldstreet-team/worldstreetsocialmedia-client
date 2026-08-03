// Reverted 2026-08-03: pinned back to the gateway host. The env-var override
// (`process.env.NEXT_PUBLIC_API_URL ?? ...`) is deliberately NOT here — a stale
// or wrong NEXT_PUBLIC_API_URL on the deployment repoints every auth call at
// the wrong gateway, and the JWT only verifies against the one it trusts.
export const BACKEND_URL =
    "https://worldstreetsocialmedia-gateway-f55k.onrender.com";
// The one missing-avatar fallback for the whole app: locally hosted brand mark
// on the bg/surface stone (no third-party hosts, no random-hue tiles).
export const DEFAULT_AVATAR = "/images/default-avatar.png";
