"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "@phosphor-icons/react";
import { useAtom } from "jotai";
import {
  CandlestickChart,
  Clapperboard,
  GraduationCap,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  OverlayPanel,
  OverlayScrim,
  useOverlayDismiss,
} from "@/components/ui/Overlay";
import { welcomeTourOpenAtom } from "@/store/ui.atom";

/**
 * First-run tour — four steps that place Social inside the WorldStreet
 * ecosystem. Auto-opens once (localStorage), replayable from the command
 * palette. On the standard overlay grammar (`center` — a centred dialog);
 * steps still slide 8px at motion-base per 06-motion.
 */

const SEEN_KEY = "ws-social-welcome-v1";
const EASE: [number, number, number, number] = [0.2, 0, 0, 1];

const ECOSYSTEM_CHIPS = [
  { icon: GraduationCap, label: "Academy" },
  { icon: Clapperboard, label: "Xstream" },
  { icon: ShoppingBag, label: "Shop" },
  { icon: Wallet, label: "Dashboard" },
];

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-flex h-7 items-center rounded-md bg-primary/10 px-2 font-sans text-[11px] font-semibold text-primary">
    {children}
  </kbd>
);

const STEPS = [
  {
    key: "welcome",
    title: "Welcome to WorldSpace",
 body: "This is the social side of the WorldStreet ecosystem share ideas, follow traders and creators, and talk markets with the people trading them.",
    // The cloud, in both cuts. This was /images/logo.png — the retired gold W —
    // under a "Socials" eyebrow, so the first thing a new account ever saw was
    // the OLD brand and the OLD product name.
    hero: (
      <>
        <Image
          src="/images/worldspace-mark-dark.png"
          alt=""
          width={72}
          height={72}
          aria-hidden
          unoptimized
          className="object-contain [[data-ws-theme='platform-light']_&]:hidden"
        />
        <Image
          src="/images/worldspace-mark-light.png"
          alt=""
          width={72}
          height={72}
          aria-hidden
          unoptimized
          className="hidden object-contain [[data-ws-theme='platform-light']_&]:block"
        />
      </>
    ),
  },
  {
    key: "markets",
    title: "Built for market talk",
 body: "Tag tickers with $cashtags and topics with #hashtags they link straight to search, so every conversation is one tap from the posts behind it.",
    hero: (
      // The entities themselves, at the size you would actually read them —
      // a chart glyph in a gold-era `bg-convert` tile said nothing the copy
      // did not. `text-gold` IS the brand ink token, so this follows the cyan.
      <span className="flex items-center gap-2 font-sans text-[15px] font-semibold">
        <span className="rounded-md bg-brand/15 px-2.5 py-1 text-gold">
          $WST
        </span>
        <span className="rounded-md bg-primary/10 px-2.5 py-1 text-primary">
          #gold
        </span>
      </span>
    ),
  },
  {
    key: "ecosystem",
    title: "One account, every platform",
    body: "Your WorldStreet account works across Academy, Xstream, Shop and your Dashboard wallet. Jump between them any time from the More menu.",
    hero: (
      // Borderless: the fill is the chip. A hairline box around each icon was
      // four more edges on a panel whose whole grammar is fill and shadow.
      <div className="flex items-center gap-2.5">
        {ECOSYSTEM_CHIPS.map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-1.5">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="h-5 w-5 text-primary" strokeWidth={2} />
            </span>
            <span className="font-sans text-[10px] text-muted">{label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    key: "shortcuts",
    title: "Move like a pro",
    body: "The command palette reaches every page and action. Start a post or search without touching the mouse.",
    hero: (
      <div className="flex flex-col items-center gap-2.5 font-sans text-[13px] text-muted">
        <span className="flex items-center gap-2">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
          <span>command palette</span>
        </span>
        <span className="flex items-center gap-2">
          <Kbd>N</Kbd>
          <span>new post</span>
        </span>
        <span className="flex items-center gap-2">
          <Kbd>/</Kbd>
          <span>search</span>
        </span>
      </div>
    ),
  },
];

export function WelcomeTour() {
  const [open, setOpen] = useAtom(welcomeTourOpenAtom);
  const [step, setStep] = useState(0);

  // First visit: open once, after the page intro has settled.
  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY)) return;
    const timer = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(timer);
  }, [setOpen]);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const finish = useCallback(
    (thenFocusComposer = false) => {
      localStorage.setItem(SEEN_KEY, "1");
      setOpen(false);
      if (thenFocusComposer) {
        const el = document.querySelector<HTMLTextAreaElement>(
          "#post-composer-input",
        );
        if (el) {
          window.scrollTo({ top: 0, behavior: "smooth" });
          el.focus();
        }
      }
    },
    [setOpen],
  );

  // Esc + the page scroll lock behind the overlay. Skipping the tour with
  // Escape counts as seeing it, exactly like the scrim and the close chip.
  const dismiss = useCallback(() => finish(), [finish]);
  useOverlayDismiss(open, dismiss);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <AnimatePresence>
      {open && (
        <OverlayScrim key="tour-scrim" onClose={dismiss} label="Skip tour" />
      )}
      {open && (
        <OverlayPanel
          key="tour-panel"
          variant="center"
          label="Welcome to WorldSpace"
          className="max-w-[440px]"
        >

          {/* Hero band */}
          {/* The same artwork the onboarding flow stands on, so the tour reads
              as the end of that journey rather than a different product. Two
              cuts swapped on the theme attribute; the overlay dissolves it into
              the panel and carries a wash of brand so the picture belongs to
              this palette instead of sitting on top of it. No border — depth is
              the fade, per the overlay grammar. */}
          <div className="relative flex h-[210px] shrink-0 items-end justify-center overflow-hidden bg-sunken bg-cover bg-center bg-[url('/images/onboarding/backdrop-dark.webp')] pb-6 [[data-ws-theme='platform-light']_&]:bg-[url('/images/onboarding/backdrop-light.webp')] sm:h-[240px]">
            {/* The picture runs to the panel's own top edge — no band, no
                hairline — and dissolves downward into the surface so the copy
                below reads as the same object rather than a caption under a
                photo. The brand wash is what stops it looking like stock art
                dropped into our palette. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-surface/25 via-surface/55 to-surface"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-brand/10"
            />
            {/* The close control rides ON the artwork, so the header no longer
                costs a strip of panel above the picture. */}
            <button
              type="button"
              onClick={dismiss}
              aria-label="Skip tour"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-pill bg-page/50 text-primary backdrop-blur-md transition-colors hover:bg-page/70"
            >
              <X size={16} weight="bold" />
            </button>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={current.key}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={{ duration: 0.2, ease: EASE }}
                className="relative flex flex-col items-center gap-3"
              >
                {current.hero}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Copy */}
          <div className="min-h-[128px] flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 pt-5 pb-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={current.key}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={{ duration: 0.2, ease: EASE }}
              >
                <h2 className="font-display font-semibold text-xl text-primary mb-2">
                  {current.title}
                </h2>
                <p className="font-sans text-[15px] leading-relaxed text-muted">
                  {current.body}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer: dots + controls */}
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 sm:px-6 pb-5">
            {/* The onboarding's segment rail, not a growing dot. Equal
                segments show how far through you are AND how much is left —
                a single wide pill among small dots shows only where you are.
                Same control, same grammar, one flow. */}
            <div
              className="flex w-[124px] shrink-0 items-center gap-1.5"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
              aria-valuenow={step + 1}
              aria-label={`Step ${step + 1} of ${STEPS.length}`}
            >
              {STEPS.map((s, i) => (
                <span
                  key={s.key}
                  className={`h-1 flex-1 rounded-pill transition-colors ${
                    i <= step ? "bg-brand" : "bg-primary/12"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="h-11 sm:h-9 cursor-pointer rounded-pill bg-primary/10 px-4 font-sans text-[13px] font-semibold text-primary transition-colors hover:bg-primary/[0.16]"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  isLast ? finish(true) : setStep((s) => s + 1)
                }
                className="h-11 sm:h-9 px-[18px] rounded-pill font-sans text-[13px] font-semibold bg-brand text-brand-on hover:bg-brand-active transition-colors cursor-pointer whitespace-nowrap"
              >
                {isLast ? "Start posting" : "Next"}
              </button>
            </div>
          </div>
        </OverlayPanel>
      )}
    </AnimatePresence>
  );
}
