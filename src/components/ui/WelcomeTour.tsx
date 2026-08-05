"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useAtom } from "jotai";
import {
  CandlestickChart,
  Clapperboard,
  GraduationCap,
  ShoppingBag,
  Wallet,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { welcomeTourOpenAtom } from "@/store/ui.atom";

/**
 * First-run tour — four steps that place Social inside the WorldStreet
 * ecosystem. Auto-opens once (localStorage), replayable from the command
 * palette. z-modal + scrim; steps slide 8px at motion-base per 06-motion.
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
  <kbd className="inline-flex items-center rounded-sm border border-hairline bg-raised px-2 h-6 font-sans text-[11px] font-medium text-primary">
    {children}
  </kbd>
);

const STEPS = [
  {
    key: "welcome",
    title: "Welcome to WorldStreet Social",
    body: "This is the social side of the WorldStreet ecosystem — share ideas, follow traders and creators, and talk markets with the people trading them.",
    hero: (
      <div className="flex flex-col items-center gap-3">
        <Image
          src="/images/logo.png"
          alt="WorldStreet"
          width={56}
          height={56}
          className="object-contain"
        />
        <span className="font-sans text-[10px] font-semibold uppercase tracking-[2px] text-gold">
          Socials
        </span>
      </div>
    ),
  },
  {
    key: "markets",
    title: "Built for market talk",
    body: "Tag tickers with $cashtags and topics with #hashtags — they link straight to search, so every conversation is one tap from the posts behind it.",
    hero: (
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-convert/10">
          <CandlestickChart className="h-7 w-7 text-gold" strokeWidth={2} />
        </span>
        <span className="flex items-baseline gap-2 font-sans">
          <span className="rounded-sm bg-convert/10 px-1.5 py-0.5 text-[13px] font-medium text-gold">
            $WST
          </span>
          <span className="rounded-sm bg-raised px-1.5 py-0.5 text-[13px] font-medium text-primary">
            #gold
          </span>
        </span>
      </div>
    ),
  },
  {
    key: "ecosystem",
    title: "One account, every platform",
    body: "Your WorldStreet account works across Academy, Xstream, Shop and your Dashboard wallet. Jump between them any time from the More menu.",
    hero: (
      <div className="flex items-center gap-3">
        {ECOSYSTEM_CHIPS.map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-1.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-raised border border-hairline">
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

  // Lock page scroll behind the overlay.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const finish = (thenFocusComposer = false) => {
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
  };

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-modal flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="absolute inset-0 bg-scrim"
            onClick={() => finish()}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Welcome to WorldStreet Social"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="relative w-full max-w-[440px] max-h-[90dvh] overflow-y-auto overscroll-contain bg-surface border border-hairline rounded-xl shadow-nav"
          >
            <button
              type="button"
              aria-label="Skip tour"
              onClick={() => finish()}
              className="absolute top-1 right-1 z-10 flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-pill text-subtle hover:text-primary hover:bg-raised transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Hero band */}
            <div className="h-[120px] sm:h-[150px] bg-sunken border-b border-hairline flex items-center justify-center overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current.key}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.2, ease: EASE }}
                >
                  {current.hero}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Copy */}
            <div className="px-5 sm:px-6 pt-5 pb-4 min-h-[128px]">
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
            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pb-5">
              <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
                {STEPS.map((s, i) => (
                  <span
                    key={s.key}
                    className={`h-1.5 rounded-pill transition-[width,background-color] ${
                      i === step ? "w-5 bg-brand" : "w-1.5 bg-track"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    className="h-11 sm:h-9 px-4 rounded-pill font-sans text-[13px] font-semibold text-primary border border-hairline hover:bg-raised transition-colors cursor-pointer"
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
