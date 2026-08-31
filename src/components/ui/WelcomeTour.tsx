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

const ALL_STEPS = [
  {
    key: "welcome",
    title: "Welcome to WorldSpace",
    body:
      "This is the social side of the WorldStreet ecosystem. Share ideas, follow traders and creators, and talk markets with the people trading them.",
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
 body: "Tag tickers with $cashtags and pick topics as you post — the feed ranks by topic now, and each one links straight to the posts behind it.",
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

/**
 * How many of the authored steps the tour actually shows.
 *
 * One, deliberately. The other three are kept above rather than deleted —
 * they are written, retoned to the current brand and working — so restoring
 * the full walkthrough is this number, not a rewrite. A first run should not
 * hold someone behind three taps before they reach the thing they came for.
 *
 * Everything downstream reads STEPS, so at one the footer already resolves
 * correctly on its own: no Back button, and the CTA is the finish action
 * rather than "Next".
 */
const SHOWN_STEPS = 1;
const STEPS = ALL_STEPS.slice(0, SHOWN_STEPS);

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
              cuts swapped on the theme attribute, and the picture runs to the
              panel's own top edge — no band, no hairline. */}
          <div className="relative flex h-[210px] shrink-0 items-end justify-center overflow-hidden pb-6 sm:h-[240px]">
            {/* BLENDED, not veiled. This used to be a `surface` gradient laid
                OVER the artwork, which is a different thing: it greyed the
                picture from the very first pixel (25% at the top) and the band
                still ended on a visible edge. Masking fades the artwork's own
                alpha instead, so it reads at full strength up top and genuinely
                dissolves into whatever the panel is painted with — there is no
                film in front of it and no seam where it stops.

                The stops ease rather than ramping linearly: a straight alpha
                ramp across a photograph bands visibly in the mid-tones. The
                brand wash shares the wrapper so the tint fades WITH the
                picture instead of outliving it as a rectangle. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 [-webkit-mask-image:linear-gradient(to_bottom,#000_0%,#000_34%,rgb(0_0_0/0.62)_58%,rgb(0_0_0/0.24)_78%,transparent_100%)] [mask-image:linear-gradient(to_bottom,#000_0%,#000_34%,rgb(0_0_0/0.62)_58%,rgb(0_0_0/0.24)_78%,transparent_100%)]"
            >
              <span className="absolute inset-0 bg-cover bg-center bg-[url('/images/onboarding/backdrop-dark.webp')] [[data-ws-theme='platform-light']_&]:bg-[url('/images/onboarding/backdrop-light.webp')]" />
              <span className="absolute inset-0 bg-brand/10" />
            </span>
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
            {/* No AnimatePresence around the step swap. Its exits never
                resolved here, so instead of replacing the step it ACCUMULATED
                them — all four headings live in the DOM at once and slide one
                sits on top forever, which is why Next moved the indicator and
                the Back button while the copy never changed. A keyed element
                already remounts and replays initial → animate on every step,
                so presence was buying nothing but the leak. */}
            <motion.div
              key={current.key}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="relative flex flex-col items-center gap-3"
            >
              {current.hero}
            </motion.div>
          </div>

          {/* Copy */}
          <div className="min-h-[128px] flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 pt-5 pb-4">
            {/* Keyed, not presence-wrapped — see the hero above. */}
            <motion.div
              key={current.key}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              <h2 className="font-display font-semibold text-xl text-primary mb-2">
                {current.title}
              </h2>
              <p className="font-sans text-[15px] leading-relaxed text-muted">
                {current.body}
              </p>
            </motion.div>
          </div>

          {/* Footer: dots + controls */}
          <div
            className={`flex shrink-0 items-center gap-3 px-5 sm:px-6 pb-5 ${
              STEPS.length > 1 ? "justify-between" : "justify-end"
            }`}
          >
            {/* The onboarding's segment rail, not a growing dot. Equal
                segments show how far through you are AND how much is left —
                a single wide pill among small dots shows only where you are.
                Same control, same grammar, one flow.

                Hidden at a single step: one segment is a bar that is always
                full, which measures nothing and only reads as progress that
                is somehow already over. */}
            {STEPS.length > 1 && (
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
            )}

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
