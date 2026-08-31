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
- **LiveKit** (`livekit-client`) — WebRTC audio/video for DM calls
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
  providers/      CallProvider (calls: signalling + LiveKit media)
  hooks/          useCallTones, useChatSignals
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
- **TWO glass families, and they are not interchangeable.**
  1. **Creator glass** (owner ruling 2026-08-25) — MediaEditor/VideoEditor/
     Story Studio use the `glass-*` utilities (heavy backdrop-blur, white
     CTAs, Phosphor icons). It is **fixed-dark in BOTH themes on purpose**:
     it floats over photo and video, where a light pane blows out the media.
     Don't retoken the editors back.
  2. **Adaptive glass** (owner ruling 2026-08-26) — app chrome the reader
     looks at for minutes: `.glass-nav` (floating mobile tab bar),
     `.glass-card` / `.glass-tile` / `.glass-tile-on` (onboarding). These
     **follow the theme** — dark pane on stone, light pane on paper, ink from
     the normal text tokens. Do NOT use the fixed-dark `glass-*` set here; it
     produces a dark bar on a white page.
  Both need their own `backdrop-blur-*` at the usage site, and glass only
  reads as glass over something: `.ambient-field` is the brand-tinted radial
  ground built for that. Over flat page colour a blurred pane is a grey box.
- **No backdrop-blur beyond those two families** (ecosystem ruling
  2026-08-03): sticky headers are solid `bg-page` + hairline, drawer/modal
  backdrops are flat `bg-scrim`. The mobile bottom nav is now the sanctioned
  exception — it floats (inset, `rounded-pill`, `--ws-nav-float`) and blurs.
- **No film grain in Social** (owner ruling 2026-08-26). `ws-tokens.css`
  ships an app-wide turbulence overlay on `body::before` at 2% opacity
  ("house atmosphere"); it reads as texture over the page here and is killed
  in `globals.css` with `[data-ws-theme="platform"] body::before {
  content: none }`. That override lives in globals.css — NOT edited out of
  the vendored token file — so it survives the next `cp` re-sync. If texture
  reappears, check that rule first.
- **NextTopLoader is gold** (`var(--ws-brand-primary)`, 2px, no spinner) —
  don't revert to the default blue or a raw hex.
- Bookmarks/notifications/profile pages are on-token (no zinc/raw palette).
  Notification icon colors map to tokens: like=danger, follow=primary,
  reply=muted, repost=success, mention=gold.

## Full retoken sweep (2026-08-03) — the whole app is on-token now

Every remaining raw-palette surface was converted to semantic classes:
**Messages** (MessageBox, NewConversationModal, CallModal, VoiceMessage,
MediaModal, `app/messages/layout.tsx`), **Explore** (ExploreClient),
**Onboarding** (since rebuilt again — see "Onboarding" below), **post detail**
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

## Calls and chat realtime (rebuilt 2026-08-26)

**Calls were theatre before this.** `call-manager.sendSignal()` had an empty
body, so an invite never left the browser; `acceptCall()` faked a connection
with a 1.5s `setTimeout` and flipped the UI to "connected" with no media
anywhere. `useCloudflareCalls` was the same story a layer down (`peerConnection`
declared and never assigned, `handleSignal` empty). Both are deleted. Don't
resurrect them from git history.

The media plane is **LiveKit**, not Cloudflare Calls, because it owns
offer/answer, ICE and renegotiation, which is exactly the part that was never
written. Same LiveKit project as Xstream; the gateway needs `LIVEKIT_URL`,
`LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`. Rooms are namespaced `dm-<convId>`
so calls and broadcasts can't collide.

Two planes, and it matters which is which:

| Plane | Carrier | What rides it |
| --- | --- | --- |
| Signalling | Ably, via the gateway | ring / accept / decline / end / busy / cancel |
| Media | LiveKit room per conversation | the actual audio and video |

- `lib/call-manager.ts` is framework-free: CallProvider injects auth and
  transport. Mic is enabled **before** the camera so a voice call survives a
  busy or refused camera. On accept it syncs from the room's *existing*
  participants, not just the connect event, because the caller is already in
  the room and the event never fires for them. 45s ring timeout.
- `CallSurface.tsx` is one component with two states, maximized and minimized.
  Minimizing repaints the tracks; it never tears down media.
- **Remote audio must be attached to a real `<audio>` element.** LiveKit does
  not play it for you and the call is silent otherwise.
- `useCallTones` synthesizes ring/ringback with Web Audio rather than shipping
  audio files, so nothing has to load while a call is being negotiated.
- Finished calls are logged into the thread as `type: "call"` messages via
  `POST /api/calls/log`, by the **caller only** (both sides logging would
  double every row).

**Ably capabilities are the load-bearing detail.** The token used to grant
`user:*`, `post:*`, feed, live and spaces, but *not* `calls:*` — so a client
subscribing to its own call channel was rejected and calls could never have
rung even with working media. It now grants `calls:<profileId>` (subscribe
only; the gateway publishes after checking conversation membership) and
`conversation:*` (subscribe/publish/presence).

Typing, presence and delivery receipts (`hooks/useChatSignals.ts`) are
**client-to-client** on `conversation:<id>` on purpose: a round trip through
the gateway would make a typing indicator slower than the typing it reports,
and there is nothing to persist. Real messages still fan out server-side on
`user:*`, so a forged publish there can at worst show a spurious typing
bubble, never a fake message. Read is the one receipt that is persisted
(`POST /api/messages/:id/read` — which the client had been calling all along
against an endpoint that didn't exist, so every mark-read 404'd).

Voice notes and media attachments were **not** broken — `POST
/api/messages/upload` → R2 works; verified end to end.

## Creator Studio (rebuilt 2026-08-26, second pass)

The first rewrite (glass panels, ambient radials, bordered cards) was
rejected in owner review — references were Dribbble-grade analytics
dashboards. The standing rules for this surface, and for any future
dashboard work here:

- **Flat professional dark, fixed in both themes.** Page `#0F0E0D`, cards
  `#171614`. **No card borders** — depth is fill contrast only; hairlines
  only *inside* content where they separate rows. **No gradients, no
  ambient decoration, no backdrop blur.** The data is the visual.
- **Every count carries an honest comparison where one exists.** The
  overview fetches the window *and* double-window; previous period =
  difference; `DeltaChip` renders the change. No baseline (90d clamps, or
  prev window empty) → no chip. Never fabricate a delta.
- Detail lives *inside* cards: icon chips on stat cards, `MiniBars` pulses,
  the countries **DonutChart** (ring + centre total + legend), the top-posts
  table with real columns, smoothed trend curves (Catmull-Rom in
  `charts.tsx`) with flat fills. All hand-rolled SVG — no chart lib.
- **A drilldown is a modal, not a page.** The posts list opens `PostStats`
  in an overlay; `/studio/posts/[id]` stays only as the deep-link host.
  Prefer this pattern over new routes for any "see more" surface.
- **Creator-gated**: LeftSidebar and MobileNavigation hide the Studio entry
  unless `user.role === "creator"` (`role` rides `x-user-data`). Deep links
  get the become-a-creator pitch; the gateway still 403s non-creators.
- /studio/apps is a redirect; the ecosystem links are three quiet rows on
  the overview and must mirror the ratified platform list (no "Wallet").
- **The rail carries its own fill** (`#141312` vs page `#0F0E0D`). Removing
  its border was right; leaving it the same ink as the page made it dissolve
  — contrast is what makes it read as a rail.
- **Live presets hold what the Go Live sheet asks and forgets**: category
  (the 100-item taxonomy, same vocabulary the sheet picks from), capture
  source (camera/OBS) and notifyFollowers. `title` is legacy and no longer
  surfaced — the sheet deliberately never prefills a title. Don't add preset
  fields the go-live payload can't consume.
- **Never show an empty state while a request is in flight.** Top posts had
  its own `postsLoading` flag added for exactly this: server actions
  serialise, so it resolves after the stats calls and briefly claimed the
  creator had never posted.
- Country rows carry flag emoji (`countryFlag`). The emoji-as-icon ban is
  about UI glyphs; a flag is the datum, there's no flag set in the icon
  library, and platforms without flag glyphs fall back to the ISO letters.
- Brand accent always via `var(--ws-brand-primary)` — the Worldspace
  rebrand moves it, and the Studio must follow. The shell's identity card
  renders after mount only (the user atom hydrates client-side; rendering
  it during SSR causes a hydration mismatch that throws the shell away).

## Overlays: one grammar (ratified 2026-08-27)

`src/components/ui/Overlay.tsx` is THE shape of every popover, sheet, select
and modal. It was extracted from the home search window after an audit found
forty-odd overlays each with its own scrim opacity, radius, easing and close
affordance. Do not hand-roll a `fixed inset-0` again.

- `OverlayScrim` — flat wash, never blurred. `dim={false}` for a desktop
  popover: a popover is not a modal, and dimming the thing you are acting on
  is backwards. It still dims on phones, where the panel owns the screen.
- `OverlayPanel` — `variant`: `center` (plate from the top: search, palette),
  `anchored` (bottom sheet on a phone, floating card on desktop: comments,
  chat, menus), `sheet` (forms and flows). Pass `role="alertdialog"` for a
  destructive confirm.
- `OverlayHeader` — title + the standard close chip, or your own control via
  `children`.
- `useOverlayDismiss(open, onClose)` — Esc and body scroll lock. Most overlays
  were missing one or both.

**One blur per stack.** The panel carries `backdrop-blur`; the scrim never
does. **`glass-frost` follows the theme**, so ink inside comes from theme
tokens (`text-primary`/`text-muted`/`text-subtle`) and fills from
`bg-brand`/`bg-primary`/`bg-chip`/`bg-sunken` — NEVER `glass-ink` or
`glass-cta`, which are fixed-white and vanish on the light panel. The
fixed-white glass family stays only where a control sits **on artwork or
video** (story canvases, the media editors, the live surface).

Deliberately NOT migrated, and they must stay that way: `MediaEditor`,
`VideoEditor`, `StoryStudio`, `StoryViewer`, `CallSurface`, `PremiumSheet`
and `app/live/page.tsx`. Those are the sanctioned fixed-dark creator glass
(see the 2026-08-25 owner ruling above) — they sit over media in both themes.
The two lightboxes (`ImageModal`, `MediaModal`) take the header and the
dismiss hook but keep their own opaque ground: no variant models full-bleed
media, and a viewer wants black behind it, not a 50% wash.

## Presence: who is online (added 2026-08-27)

One global Ably channel, `presence`, entered once on connect by
`components/providers/PresenceSync.tsx`. The token mints `clientId` as the
profile id, so the presence set IS the set of online profiles — no payload.
Read it anywhere through `onlineIdsAtom` (a `Set<string>`).

Presence on `conversation:<id>` still exists and still answers a different,
narrower question: is this person in THIS thread right now. It is not a
substitute — using it alone is why the chat header said "offline" about
someone plainly using the app in another tab.

One global set is right at this size and will not stay right: every client
holds every online member. Shard on a hash of the profile id when it hurts.

## Onboarding (rebuilt 2026-08-26)

Five steps: identity → **region** → interests → **"The Space has a new look"**
→ follow. Built on adaptive glass over `.ambient-field` (see the glass rules
above), so it follows light/dark.

- **Region is its own step and its own axis.** Ten ids from `REGIONS`
  (`src/data/categories.ts`), posted as `region`. Geography is deliberately
  orthogonal to interests — a post is `football-soccer` + `africa`, never
  "African football". That separation is what keeps 100 categories
  worldwide-viable instead of exploding into region-specific buckets.
- **Interests use the real taxonomy**, via
  `components/onboarding/InterestPicker.tsx`: 100 categories grouped under the
  14 `VERTICALS`, with search matching BOTH label and classifier `keywords`
  (so "afro" finds Afrobeats). `MIN_INTERESTS` 3 / `MAX_INTERESTS` 20, and
  **ids cross the wire, never labels** — they are permanent algorithm keys.
  The old flat `src/data/onboarding.ts` INTERESTS list is deleted; don't
  resurrect it.
- The picker's list cap is a **height budget, not taste**: the card also
  carries lockup, progress, heading, caption, search, count and two buttons.
  Above ~32dvh the CTA the step exists to reach falls below the fold.
- **You cannot preview this while signed in.** `proxy.ts` redirects anyone
  with a profile away from `/onboarding`, decided from the DB sync result and
  not the cookie. To eyeball it, add a throwaway route under a name that does
  NOT start with `/onboarding`, and never click "Create profile" there — it
  POSTs to the real `/api/users/onboard` and overwrites the live profile.
- `isOnboardingPath` in `proxy.ts` is an **exact match** plus `/onboarding/`.
  It used to be `startsWith("/onboarding")`, which silently swallowed any
  sibling route. Same bug class as the `/live` vs `/live-now` nav guard.
- Copy is only **partly translated** — `useT` is wired but most strings
  (headings, the WHATS_NEW blurbs) are still English literals.

## Local dev = real Clerk, real gateway

There is no mock/fixture mode. The former `MOCK_AUTH` machinery (Turbopack
`resolveAlias` Clerk shims in `src/mocks/`, `NEXT_PUBLIC_MOCK_AUTH`, and the
per-action fixture guards) was **removed 2026-08-03** — don't resurrect it
from git history. Local dev requires real Clerk keys for the instance the
gateway trusts (see `.env.example`); without them every route 404s, by design.

One survivor worth knowing: `x-user-data` is an HTTP header, so it must be
**ASCII** — non-ASCII in a profile would throw `Cannot convert argument to a
ByteString` when `proxy.ts` sets it.

## Content taxonomy (added 2026-08-25)

`src/data/categories.ts` is the shared vocabulary between the client and the
ranking algorithm: **100 categories across 14 verticals**, plus a separate
`REGIONS` axis (10 regions). `src/lib/categories.ts` holds the pure helpers.

- **`ContentCategory.id` is a permanent algorithm key.** User interest vectors,
  post tags and engagement counters on the gateway are stored against it. Never
  rename or reuse an id — retire a category by deleting the entry and adding a
  row to `LEGACY_CATEGORY_ALIASES`. `label` is display-only and free to reword.
- **Geography is orthogonal.** A post is `football-soccer` + `africa`, never
  "African football" — that is what keeps 100 categories worldwide-viable
  instead of exploding into region-specific buckets.
- **`sensitive: true`** (politics, law-justice, religion-faith, sports-betting,
  mental-health, medical-health) means opt-in: `defaultCategoryIds(interests)`
  excludes them unless the user explicitly selected them.
- **`videoFirst`** (47 of the 100) is a video-feed ordering hint only — every
  category is valid for both posts and videos.
- `classifyText()` is best-effort client-side pre-tagging (hashtags, cashtags,
  phrases, keywords) with a confidence floor of 3, so one generic word does not
  produce a tag. It seeds suggestions; the ranking service stays authoritative.
- **Ids, never labels, cross the wire.** The old flat 10-string
  `src/data/onboarding.ts` `INTERESTS` list is deleted. Old profiles are
  migrated on read by `normalizeCategoryIds()`.

Where it is wired (every category surface in the app):

| Surface | What it does |
| --- | --- |
| `components/ui/CategoryPicker.tsx` | THE topic picker — grouped chips + search, shared by the two places interests are edited. Don't fork it. |
| Onboarding step 2 | `CategoryPicker`; requires `MIN_INTERESTS` (3), caps at `MAX_INTERESTS` (20); posts ids to `/api/users/onboard`. |
| EditProfileModal → Topics | Same picker, so interests are editable after signup instead of a one-shot; appends `interests` (JSON ids) to the profile FormData. |
| PostComposer | `suggestCategories()` on a 250ms-debounced draft; matches render as removable chips and ride along as `categories` (JSON ids). Suggestions are DERIVED — `removedTopics` is the only state, so a dismissed topic never re-appears while typing. |
| StoryStudio publish | `classifyText(caption)` → `categories`, no chip UI (one-line caption). |
| Explore → Browse topics | Vertical selector + category chips; a chip sets the search query, so browse and search share one path. |
| Explore + RightSidebar trends | `resolveCategoryLabel(trend.category)` renders gateway strings as taxonomy labels, unknown values passing through unchanged. |

`categories`/`interests` are sent as JSON strings on existing FormData payloads
— the same forward-compatible seam as `imageAlts`: the gateway ignores unknown
body fields today, so the transport is ready before the post model grows the
column.

## Gotchas

**Backend URL is unified through `src/const.ts`.** `BACKEND_URL` is
`process.env.NEXT_PUBLIC_API_URL ?? <Render gateway>`, and every API module
resolves through it (the actions import `BACKEND_URL`; conversation actions,
RealtimeProvider, CallProvider and MessageBox read
`NEXT_PUBLIC_API_URL` with `BACKEND_URL` as fallback — same value either way).
Repoint the whole app by setting `NEXT_PUBLIC_API_URL` in `.env.local`; never
hardcode a URL in `const.ts` again.

**Deploys are Coolify on a VPS, not Vercel/Render (moved 2026-08-30).**
The client serves at `social.worldstreetgold.com`, the gateway at
`social-api.worldstreetgold.com` — both auto-deploy from `main` via Coolify.
The old Render instance (`worldstreetsocialmedia-gateway-f55k.onrender.com`)
still answers against the SAME Atlas DB, so a probe there mutates prod data —
always target `social-api`. `src/const.ts` falls back to the VPS host.

**Media NEVER rides a server action** (root-caused 2026-08-30). A file
through an action travels twice (browser → Next container → gateway) and the
whole trip must fit one invocation — big mobile uploads died app-wide as
bare "Server error". Every file upload goes browser → gateway via
`src/lib/upload-direct.ts` (`sendFormDirect`, fresh Clerk token, action-shaped
return): posts with media, stories, avatar/banner, community avatars, space
covers, DM attachments, BM creatives. Text-only writes stay on actions. If a
new surface uploads a file, wire it through `sendFormDirect` — never a new
`"use server"` multipart hop. The direct profile update must also set the
`profile_stale=1` cookie itself (non-httpOnly by design).

**Deployment skew kills open tabs** (2,499 errors in one Coolify log,
2026-08-31): each push replaces the Next container and every open tab's
server-action ids die ("Failed to find Server Action"). Two defenses, keep
both: `DeploymentSkewRecovery` in the root layout reloads a stale tab once
when it trips, and MONEY paths (post unlock via `postJsonDirect`) call the
gateway directly so they work even from a stale tab. Put any new
must-not-fail write on `postJsonDirect`, not a server action.

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
