# WorldStreet Social — Web Client

Next.js 16 (App Router, Turbopack) frontend for the WorldStreet social platform:
feed/posts, explore, profiles, bookmarks, notifications, DMs, and WebRTC calls.
Frontend only — no API routes, no database. All data comes from a remote gateway.

Workspace-level design rules live in `../CLAUDE.md` (WorldStreet Design System).

## Commands

```bash
npm run dev      # dev server, port 3000 (falls back if occupied)
npm run build    # production build
npm run start    # serve production build
npm run lint     # biome check
npm run format   # biome format --write
```

Package name is `web-v2`. Both `package-lock.json` and `yarn.lock` are committed;
npm is what's currently installed — pick one and stick with it.

## Stack

- **Next.js 16.1.6** + React 19.2 + TypeScript, Turbopack dev
- **Clerk** (`@clerk/nextjs`) — auth, satellite of the `worldstreetgold.com` hub
- **Jotai** — client state (`src/store/*.atom.ts`)
- **Ably** — realtime messaging
- **Cloudflare Realtime (Calls)** — WebRTC audio/video
- **Tailwind v4** (PostCSS plugin, no `tailwind.config`) + `next-themes` dark mode
- **Biome** — lint + format (tabs, not Prettier/ESLint)
- Import alias: `@/*` → `./src/*`

## Architecture

```
src/
  app/            routes; (main) group = feed/bookmarks/notifications/post/profile
                  explore, messages, onboarding are OUTSIDE (main)
  components/     feed/ messages/ profile/ layout/ ui/ skeletons/ providers/
  lib/            *.actions.ts — all backend I/O ("use server" server actions)
  store/          Jotai atoms + cache modules
  providers/      CallProvider (WebRTC)
  hooks/          useCloudflareCalls
  const.ts        BACKEND_URL, DEFAULT_AVATAR
  proxy.ts        middleware (see below)
```

### `src/proxy.ts` is the middleware

Next 16 renamed `middleware.ts` → **`proxy.ts`**. Don't create a `middleware.ts`;
edit `proxy.ts`. It runs `clerkMiddleware` and does a lot per request:

1. `createRouteMatcher(["/(.*)"])` — **every** route is protected, `auth.protect()`.
   There is no public route, not even a landing page.
2. Calls `syncUser(token)` → `GET /api/users/sync` on the backend **on every
   matched request**. A 404 from that endpoint redirects to `/onboarding`.
3. Sets a non-httpOnly `has_profile` cookie to skip re-onboarding.
4. On success, stringifies the profile into an **`x-user-data` request header**,
   which `app/layout.tsx` reads via `headers()` and feeds to `JotaiHydrator`.

That header hand-off is how server-side auth state reaches client Jotai atoms —
it's the load-bearing, non-obvious part of the boot sequence.

### Auth → data flow

Every server action mints a fresh Clerk JWT and forwards it:

```ts
const { getToken } = await auth();
const accessToken = await getToken();
// -> Authorization: Bearer <jwt>  to the gateway
```

The gateway **verifies that JWT against a specific Clerk instance**. Consequence:
frontend-only auth mocking cannot produce real data — the Clerk keys must match
the instance the backend trusts. There is no offline/fixture mode in this repo.

## Design system

**Read `<workspace>/design-system/` first** — six markdown files that are the
full spec, no Figma access needed: `01-foundations` (color/spacing/radius/
elevation), `02-typography` (the 8-style ramp), `03-icons` (the 74-icon set +
library split), `04-components` (exact measurements for all 20 components),
`05-screens-and-patterns` (the Social 3-column web layout, do/don't),
`06-motion-accessibility` (motion tokens, z-index scale, a11y, data-viz).

The folder is edited over time. When it changes, re-sync the tokens first —
`cp ../design-tokens/tokens.css src/styles/ws-tokens.css` — then re-read the
docs; `tokens.css` usually carries the new values already.

**DS v2 (2026-08-05):** the ecosystem collapsed to ONE stone+gold look adopted
from `<workspace>/dashboard-revamp/` (the hub). `data-ws-theme="platform"` now
resolves to the stone ladder — page `#0C0A09`, surface `#1C1917`, gold
`#EAB308`; `platform-light` → the paper light mode. The attribute wiring below
is unchanged; any `#0B0B0F`/`#FFCC29` values quoted in this file predate v2 —
the vendored token file wins. `<html data-ws-theme="platform">` is set in
`app/layout.tsx` and drives every color.

- `src/styles/ws-tokens.css` — vendored copy of `<workspace>/design-tokens/tokens.css`.
  **Do not hand-edit**; re-sync with
  `cp ../design-tokens/tokens.css src/styles/ws-tokens.css`. It's vendored because
  Next/PostCSS can't import CSS from outside the project root.
- `app/globals.css` maps those vars onto Tailwind v4 utilities via `@theme inline`.
  `inline` matters: it keeps the `var()` in the output, so flipping
  `data-ws-theme` re-themes at runtime with no rebuild.

Use the semantic classes, never a raw palette color:

| Use | Class | platform value |
| --- | --- | --- |
| page background | `bg-page` | `#0B0B0F` |
| card / panel | `bg-surface` | `#15151A` |
| hover / chip | `bg-raised` | `#1F1F26` |
| body text | `text-primary` | `#FAFAFA` |
| secondary text | `text-muted` | `#8E8E97` |
| tertiary text | `text-subtle` | `#64646C` |
| primary CTA | `bg-brand` + `text-brand-on` | `#FFCC29` on `#0B0B0F` |
| gold text/icon | `text-gold` | `#FFCC29` |
| dividers | `border-hairline` | `#26262E` |
| destructive | `text-danger` | `#EF4444` |
| positive | `text-success` | `#10B981` |

Rules that bite:

- **Gold is reserved** — primary CTAs, active nav, brand moments. Never a large
  fill. The composer's Post button is the one gold CTA on the feed; repeated
  actions (Follow) use `bg-primary text-page` so gold keeps its meaning.
- **The palette has no blue or pink.** Post actions map to what exists: reply =
  neutral `text-primary` hover, like = `text-danger`, bookmark = `text-gold`.
- Fonts: Poppins (display) + Public Sans (UI), both loaded via `next/font` in
  `layout.tsx`. `globals.css` re-points `--ws-font-*` at the hashed families
  next/font generates, otherwise the literal `"Poppins"` in the token file never
  matches anything.

Non-obvious rules the spec enforces, all of which this page now follows:

- **Radii are tight.** 4 / 7 / 10 / 13 / pill. `rounded-2xl` and `rounded-3xl`
  are explicitly banned ("never use 16/20/24 rounded-everything").
- **Never scale on hover.** Rows and cards lighten one ladder step
  (`bg-surface` → `bg-raised`); pressed adds an overlay. No `hover:scale-*`.
- **Only two shadows exist**, `shadow-nav` and `shadow-sheet` (defined in
  `globals.css`). Cards get **no** shadow — the surface ladder does depth.
- **Icon libraries are split.** Lucide everywhere, **except** the Social post
  action row + overflow menu, which use Phosphor (`ChatCircle`, `Heart`,
  `BookmarkSimple`, `Export`, `DotsThree`) to match the mobile app. Don't
  "simplify" these back to Lucide.
- **No emoji as icons**, ever. Stay inside the 74-icon set. Known justified
  deviations (the set has no equivalent): `Trash2` (delete post), `Ban`
  (block/not-interested), `Pin` (pin to profile), `AlertTriangle` (toast
  warning), `Link2` (link-preview domain glyph). The command palette's Profile
  row shows the user's avatar because the set has no plain `user` icon.
- **Tabular numerals** on any number that changes (`tabular-nums` on counts).
- **One easing, three durations.** `--ws-ease` is the only easing; 120/200/320ms
  are the only durations. They're wired as Tailwind's *defaults* in
  `globals.css`, so a plain `transition-colors` is already on-token — don't add
  `duration-*` unless you mean the base or slow tier. Animate opacity and
  transform only; `prefers-reduced-motion` is handled globally.
- **Four z-index values, nothing else**: `z-sticky` 100, `z-dropdown` 400,
  `z-modal` 800, `z-toast` 1200 (custom utilities in `globals.css`). The
  `z-0/10/20` inside PostCard are intra-card stacking that predate this and sit
  far below the 100 floor, so they can't fight app chrome — left alone
  deliberately.
- **`text/subtle` fails AA.** It's for timestamps, separators, placeholders, and
  decorative icons only, and never under 13px. Real content is `text/muted` or
  better.
- **Hit targets are ≥40×40** even when the glyph is 15px — the action-row icons
  are 15px inside 40px flex-centered targets. Don't shrink the target to match
  the glyph.
- **Never block pinch-zoom.** `viewport` in `layout.tsx` deliberately omits
  `maximumScale`/`userScalable`; the spec calls this repo out by name for having
  had `user-scalable=no`.

**The Figma file itself is empty.** `DOkdLhK3pJ9fEwglOwSJfN` contains only a
Cover page — no variables, components, or screens, and no published library
(verified via the Figma MCP). `design-system/` + `design-tokens/` are the real
source of truth; don't burn time trying to pull screens out of Figma.

**Light mode is the canonical `platform-light` token block** (in ws-tokens.css,
synced from design-tokens 2026-08-03). `next-themes` drives `data-ws-theme`
directly via `attribute="data-ws-theme"` + `value={{ dark: "platform", light:
"platform-light" }}` in the root ThemeProvider — there is no app-level light
palette anymore (the old `html.light[data-ws-theme="platform"]` fork in
globals.css was deleted; don't reintroduce it).

## Finance-native feed layer (added 2026-08-02)

The feed's signature features, all driven by the `money/*` tokens
(`--ws-money-credit/debit/convert` → Tailwind `text-credit`, `text-debit`,
`bg-convert/10` via `globals.css`):

- **Market Pulse was removed 2026-08-03** — the old right-rail ticker card
  (`components/market/MarketPulse.tsx` + `src/data/market.ts`) was a
  hardcoded fixture and no market endpoint exists on the gateway, so it was
  deleted rather than ship fake data. Reintroduce only against a real
  `GET /api/markets/summary`.
- **Rich post text** (`components/ui/RichText.tsx`) — `renderRichText()` links
  URLs, `$cashtags` (convert-chip wash), `#hashtags` and `@mentions`. Used by
  PostCard; entity links carry `relative z-10 pointer-events-auto` +
  stopPropagation to stay clickable above the card's overlay link.
- **For You / Following tabs** (`components/feed/FeedTabs.tsx`) — gold
  underline slides via framer-motion `layoutId`. State in
  `store/ui.atom.ts:feedTabAtom`. "Following" filters client-side by
  `followingIdsAtom`, which RightSidebar's Follow buttons populate — so
  following someone immediately fills the tab.
- **Ctrl/Cmd+K command palette** (`components/ui/CommandPalette.tsx`,
  mounted in `app/layout.tsx`) — navigation, New post, and explore search.
  The right-rail "search box" is actually its trigger button.
  Keyboard order is sorted to match rendered group order — don't remove the
  `GROUP_ORDER` sort or arrowing jumps visually. Its global listener also
  handles `/` (open palette) and `n` (focus composer), both guarded so they
  never fire while an input/textarea/contentEditable has focus.
- **Composer character ring** (in `PostComposer.tsx`) — 280 budget shared
  with PostCard's truncation. Gold → `status/warning` at ≤28 remaining →
  `status/danger` over; Post disables when over.
- **Verified badge** — `shield-check` in gold next to author names
  (`post.author.isVerified`).
- **Back-to-top pill** (in `Feed.tsx`) — appears past 800px scroll,
  `z-sticky`, `bg-raised` pill.
- **ConfirmModal / ImageModal are on-token now** (scrim, z-modal, radius 13,
  shadow-nav, no scale hovers, tabular counter) — don't reintroduce raw
  zinc/black classes from git history.
- **Intro animation** — the `animate-rise` utility (globals.css: opacity +
  8px rise, motion-slow, `backwards` fill) orchestrates page load: left rail
  cascades (logo → nav items 30ms apart → Post → profile), header at 40ms,
  composer 100ms, posts 160ms + 60ms/post (first paint only —
  `introPlayedRef` in Feed.tsx zeroes delays afterward), right rail
  60→300ms. Stagger with inline `animationDelay`; goes
  instant under prefers-reduced-motion via the global block. Micro-motion:
  like = 0.98→1 settle + count rolls 8px (framer), tab switch re-keys the
  post container so it rises, back-to-top pill enters at base / exits
  fast-fade.
- **Nav icons come from the lucide set via `src/data/sidebar.tsx`** (renamed
  from .ts; MobileBottomNav has its own copies). The old
  `src/assets/icons/*` vectors are unused by nav — don't wire them back;
  03-icons says web nav uses lucide, mobile app vectors are the mobile
  exception. Active nav = strokeWidth 2.5, same glyph.
- Trend rows use the 03-icons accent-chip rule: `trending-up` in
  `accent/social` on a 13% wash (`bg-accent-social/[0.13]`).

`/explore` `searchParams` is now correctly awaited (the Next 16 violation
noted below is fixed).

## Platform-wide UX layer (added 2026-08-03)

- **Route transitions**: `app/template.tsx` remounts per navigation and
  replays `animate-rise` — the page-transition mechanism. Fixed/portal UI
  must stay in `app/layout.tsx` (outside the template's transient transform).
- **Welcome tour** (`components/ui/WelcomeTour.tsx`, mounted in root layout):
  4-step first-run modal, gated by localStorage `ws-social-welcome-v1`,
  replayable via the palette action "Replay the welcome tour"
  (`welcomeTourOpenAtom`).
- **Verified badge**: `src/assets/icons/VerifiedIcon.tsx` is now Phosphor
  `SealCheck` filled in gold (never blue) and is THE badge everywhere —
  PostCard, Profile, explore, modals all route through it. Its `color` prop
  is accepted-and-ignored on purpose.
- **Theme toggle**: sidebar Sun/Moon button via next-themes
  (`attribute="data-ws-theme"`, `value={{ dark: "platform", light:
  "platform-light" }}`, default dark, no system). Light mode is the canonical
  `platform-light` block in ws-tokens.css (gold text `#8A6C00` for AA);
  shadows soften via `--ws-shadow-nav/-sheet` indirection in globals.css.
  **The switch cross-fades** (added 2026-08-03): always call `setTheme`
  through `withThemeTransition()` from `src/lib/theme-transition.ts` — it
  uses the View Transitions API (flushSync inside the snapshot) or the
  `.theme-switching` CSS fallback in globals.css, one motion-slow beat with
  the token ease, instant under prefers-reduced-motion. A bare `setTheme`
  call snaps.
- **Sidebar brand = the unified ecosystem lockup** (ratified 2026-08-03, see
  design-system 04-components → TopNav): gold wsa-mark 26px unboxed
  (`/images/wsa-mark.png`) + "WorldStreet" Poppins SemiBold 15 + gold
  uppercase "SOCIAL" eyebrow — identical structure to Academy/Shop. The
  mobile header uses the same mark. "More" opens a rich "More from
  WorldStreet" panel (icon chips + descriptions for
  Dashboard/Academy/Xstream/Shop — DS labels, never "XTreme").
- **No backdrop-blur anywhere** (ecosystem glass ruling 2026-08-03): sticky
  headers/bottom nav are solid `bg-page` + hairline, drawer/modal backdrops
  are flat `bg-scrim`. Don't reintroduce `backdrop-blur-*`.
- **NextTopLoader is gold** (`var(--ws-brand-primary)`, 2px, no spinner) —
  don't revert to the default blue or a raw hex.
- Bookmarks/notifications/profile pages are on-token (no zinc/raw palette).
  Notification icon colors map to tokens: like=danger, follow=primary,
  reply=muted, repost=success, mention=gold.

## Full retoken sweep (2026-08-03) — the whole app is on-token now

Every remaining raw-palette surface was converted to semantic classes:
**Messages** (MessageBox, NewConversationModal, CallModal, VoiceMessage,
MediaModal, `app/messages/layout.tsx`), **Explore** (ExploreClient),
**Onboarding** (full rewrite: gold `bg-brand` CTAs, `bg-sunken` fields,
no more white-button/yellow-offset-shadow style), **post detail**
(PostPageScreen), **EditProfileModal / FollowsModal**, **Skeleton /
ProfileSkeleton** (both use the `skeleton` utility now), and
`(main)/layout.tsx`. A grep for
`zinc-|gray-|slate-|blue-|yellow-|red-|green-|purple-|pink-|bg-white|bg-black|text-white|text-black|rounded-2xl|rounded-3xl|hover:scale`
across `src/` returns only `translate-*` false positives — keep it that way.

Details that were fixed in the same pass (don't reintroduce):

- **DM bubbles**: mine = `bg-brand text-brand-on`, theirs = `bg-raised
  text-primary`, radius `rounded-xl` (13px). VoiceMessage inherits via
  `text-brand-on`/`text-primary`.
- **FollowsModal imported lucide's `VerifiedIcon`** (blue check) — now routes
  through `@/assets/icons/VerifiedIcon` (gold seal) like everywhere else.
- **Explore defends with `?? []`** around `res.data.popularTweets` /
  `trendsForYou` — keep those guards; the gateway shape isn't guaranteed.
  Explore's inert "Show more" div was removed.
- **Empty states** use the `EmptyState` component: explore no-results (users +
  posts), post-not-found. Messages' cartoon-PNG empty state was replaced with
  the on-token icon-circle pattern; the conversation list has a proper empty
  note.
- **Hit targets**: the chat header's Phone/Video/Info icons are wrapped in
  40×40 buttons with aria-labels.
- **Modal motion** is normalized: scrim `bg-scrim`, panel `bg-surface border-
  hairline rounded-xl shadow-nav`, enter/exit `scale 0.98 / y 8`, 0.2s token
  ease, `z-modal` (no more `z-[9999]`/`z-200`).
- `.bak`/`.bak2`, `Explore.dac` (stale explore copy) and the never-imported
  `theme-toggle.tsx` were deleted. `proxy.ts` no longer logs the JWT.
- Onboarding's `animate-in fade-in ...` classes (tailwindcss-animate, not
  installed) were replaced with `animate-rise`.

Not fixed on purpose: pre-existing lint noise in these files (array-index
keys, `any` types) — only dead imports were removed.

## Standard-platform UX layer (added 2026-08-03, second pass)

Benchmarked against X/Threads-class clients; these are now in place:

- **`app/not-found.tsx` + `app/error.tsx`** — branded 404 and route error
  boundary (EmptyState language, gold CTA, `animate-rise`). The error page
  shows `error.digest` and offers `reset()`.
- **Unread badges** on Notifications *and* Messages in all three navs
  (LeftSidebar, MobileNavigation drawer, MobileBottomNav).
  `unreadNotificationsCountAtom` (ui.atom) is seeded once per app load by
  `components/providers/NotificationCountSync.tsx` (mounted in root layout);
  the notifications page zeroes it when it marks everything read.
- **Page titles**: root metadata uses a `template` ("%s · WorldStreet
  Social"). Server pages export `metadata`; client pages (bookmarks,
  notifications) get it via tiny `layout.tsx` files; profile uses
  `generateMetadata` for `@username`.
- **Composer drafts** persist to localStorage (`ws-social-draft`) and restore
  on mount. The clear branch is gated on a "had content" ref — do NOT
  "simplify" that; a bare clear-on-empty effect deletes the draft in
  StrictMode before the restore lands (found empirically).
- **Paste-to-attach**: pasting an image into the composer attaches it (same
  4-slot pipeline as the picker).
- **Feed infinite scroll**: IntersectionObserver sentinel (600px rootMargin)
  around the "Show more posts" button auto-loads the next page; the button
  remains as fallback, with an inline brand spinner while fetching.
- **`formatTimeAgo` in `lib/utils.ts`** is THE post timestamp everywhere
  (feed, explore, post detail, profile): s/m/h/d, then "Aug 2", then
  "Aug 2, 2025". No more raw `toLocaleDateString` on posts.
- **A11y/platform**: skip-to-content link in root layout targeting
  `#main-content` (set on both column layouts); `viewport.themeColor`
  `#0B0B0F`; `disableTransitionOnChange` was removed from ThemeProvider so
  the theme cross-fade fallback can work.
- The dead `animate-in`/`zoom-in`/`slide-in-*` classes (tailwindcss-animate
  was never installed) are gone from the sidebar More panel and badges —
  replaced with `animate-rise`. Don't reintroduce that plugin's classes.

## Local dev = real Clerk, real gateway

There is no mock/fixture mode. The former `MOCK_AUTH` machinery (Turbopack
`resolveAlias` Clerk shims in `src/mocks/`, `NEXT_PUBLIC_MOCK_AUTH`, and the
per-action fixture guards) was **removed 2026-08-03** — don't resurrect it
from git history. Local dev requires real Clerk keys for the instance the
gateway trusts (see `.env.example`); without them every route 404s, by design.

One survivor worth knowing: `x-user-data` is an HTTP header, so it must be
**ASCII** — non-ASCII in a profile would throw `Cannot convert argument to a
ByteString` when `proxy.ts` sets it.

## Gotchas

**Backend URL is unified through `src/const.ts`.** `BACKEND_URL` is
`process.env.NEXT_PUBLIC_API_URL ?? <Render gateway>`, and every API module
resolves through it (the actions import `BACKEND_URL`; conversation actions,
RealtimeProvider, CallProvider, useCloudflareCalls and MessageBox read
`NEXT_PUBLIC_API_URL` with `BACKEND_URL` as fallback — same value either way).
Repoint the whole app by setting `NEXT_PUBLIC_API_URL` in `.env.local`; never
hardcode a URL in `const.ts` again.

**The gateway is a free Render instance** (`worldstreetsocialmedia-gateway-f55k.onrender.com`).
It spins down when idle — the first request after a cold start takes ~20-30s.
A "hung" first load is usually this, not a bug.

**Ably auth is token-based, not key-based.** `RealtimeProvider` uses an
`authCallback` that pulls `window.Clerk.session.getToken()` and hits
`/api/messages/auth/token`. There is no `ABLY_API_KEY` in this app.

**`/explore` `searchParams` violation — fixed 2026-08-02.**
`app/explore/page.tsx` now awaits `searchParams` (Next 15+ makes it a
Promise). Keep the `await` if the page is touched again.

**Stale `.bak` files — deleted 2026-08-03** (`MessageBox.tsx.bak`/`.bak2`,
`Explore.dac`, unused `theme-toggle.tsx`). Don't resurrect them from git history.

**`console.log` in `proxy.ts` — stripped 2026-08-03.** It used to print the user
id and full JWT on every request; don't add request-level logging back.

## Conventions

- Server actions in `src/lib/*.actions.ts`, one file per domain, `"use server"` at top.
- Actions return `{ success: boolean, data?, message? }` rather than throwing.
- `axios` for actions, `fetch` for middleware/provider calls — both are in use.
- **`npm run lint` is currently red on pre-existing files.** `biome.json` declares
  `indentStyle: "space"`, `indentWidth: 2`, but almost all of `src/` is written
  with tabs, so every file fails the format check. Running `npm run format` would
  reformat the entire codebase in one commit — decide deliberately, don't do it
  as a drive-by. Newer files (e.g. `CommandPalette.tsx`) follow the config: 2-space.
- `src/const.ts` uses 4-space indent (inconsistent with both); leave it.
