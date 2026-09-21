"use client";

import { X } from "@phosphor-icons/react";
import { RiArrowLeftLine, RiArrowRightLine } from "@remixicon/react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  OverlayPanel,
  OverlayScrim,
  useOverlayDismiss,
} from "@/components/ui/Overlay";
import { motionReduced } from "@/lib/motion";
import { useTourSeen } from "@/lib/use-tour-seen";

const SEEN_KEY = "ws-messages-whats-new-v10";
const WELCOME_SEEN_KEY = "ws-social-welcome-v1";

/**
 * The motion here is a set piece, so it keeps the house ease but steps
 * outside the three house durations on purpose (owner 2026-09-19: a
 * curated, high-tier sequence). Everything is transform and opacity.
 */
const EASE = [0.2, 0, 0, 1] as const;
const EASE_IN = [0.5, 0, 0.9, 0.4] as const;
const CAROUSEL = { duration: 0.75, ease: EASE };
/** Parallax: the image drifts this far against its slide, and carries the
 *  same margin as zoom, so its edge can never show mid-travel. */
const DRIFT = 8;

const SLIDES = [
  {
    key: "themes",
    image: "/images/features/messages-themes-light-v2.webp",
    darkImage: "/images/features/messages-themes-dark-v2.webp",
    lightGround: "#fbf4e6",
    darkGround: "#1e1e1e",
    alt: "A fan of colour palettes beside two differently themed chat bubbles",
    title: "Make every conversation yours",
    body: "Choose a look for one chat or set a theme across every conversation. Your messages stay familiar, but the room feels personal.",
  },
  {
    key: "groups",
    image: "/images/features/messages-groups-light-v2.webp",
    darkImage: "/images/features/messages-groups-dark-v2.webp",
    lightGround: "#faf5ec",
    darkGround: "#151515",
    alt: "Multiple member conversations connected to one shared group chat",
    title: "Your people, all in one place",
    body: "Create groups, share media, manage members and move into a voice or video call without leaving the conversation.",
  },
  {
    key: "calls",
    image: "/images/features/messages-calls-light-v2.webp",
    darkImage: "/images/features/messages-calls-dark-v2.webp",
    lightGround: "#fbf4e8",
    darkGround: "#131313",
    alt: "A cyan telephone handset beside video-camera and microphone symbols",
    title: "Take the conversation live",
    body: "Go from messages to a voice or video call, right inside your conversation.",
  },
  {
    key: "voice",
    image: "/images/features/messages-voice-light-collage.webp",
    darkImage: "/images/features/messages-voice-dark-collage.webp",
    lightGround: "#f9f2e4",
    darkGround: "#141414",
    alt: "A paper voice-note card with a cyan waveform and play symbol",
    title: "Speak when typing is not enough",
    body: "Record, pause, preview and send expressive voice notes from the composer, with clear playback inside the thread.",
  },
];

/* ── choreography ─────────────────────────────────────────────────────── */

// The text block: words first, copy a beat later; on the way out the
// order reverses and everything is quicker than it arrived.
const block = {
  hidden: {},
  enter: { transition: { staggerChildren: 0.045, delayChildren: 0.12 } },
  leave: { transition: { staggerChildren: 0.018, staggerDirection: -1 } },
};
// Each word rises out of its own mask.
const word = {
  hidden: { y: "115%" },
  enter: { y: "0%", transition: { duration: 0.6, ease: EASE } },
  leave: { y: "-115%", transition: { duration: 0.24, ease: EASE_IN } },
};
const copy = {
  hidden: { opacity: 0, y: 12 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
  leave: { opacity: 0, y: -8, transition: { duration: 0.2, ease: EASE_IN } },
};
const controls = {
  hidden: { opacity: 0, y: 14 },
  enter: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE, delay: 0.42 },
  },
  leave: { opacity: 0, y: 10, transition: { duration: 0.18, ease: EASE_IN } },
};
// Digits and the button label roll in the direction of travel.
const roll = {
  from: (d: number) => ({ y: `${d * 100}%`, opacity: 0 }),
  to: { y: "0%", opacity: 1, transition: { duration: 0.4, ease: EASE } },
  out: (d: number) => ({
    y: `${d * -100}%`,
    opacity: 0,
    transition: { duration: 0.22, ease: EASE_IN },
  }),
};

/**
 * One-time messaging release slider. It waits for the global welcome tour and
 * any other dialog to clear, so first-run surfaces never stack on each other.
 */
export function MessagesFeatureTour() {
  const { resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  // Closing is a sequence, not a cut: the words and controls leave, then
  // the card does.
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);

  // Seen once per ACCOUNT, not once per browser (owner 2026-09-21): the
  // answer lives on the profile, so nothing opens until it has loaded.
  const tour = useTourSeen(SEEN_KEY);
  const welcome = useTourSeen(WELCOME_SEEN_KEY);
  const { ready, seen } = tour;
  const welcomed = welcome.seen;
  useEffect(() => {
    if (!ready || seen) return;
    let timer = 0;
    const reveal = () => {
      if (!welcomed || document.querySelector('[role="dialog"]')) {
        timer = window.setTimeout(reveal, 900);
        return;
      }
      setOpen(true);
    };
    timer = window.setTimeout(reveal, 700);
    return () => window.clearTimeout(timer);
  }, [ready, seen, welcomed]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setDirection(1);
    setLeaving(false);
    leavingRef.current = false;
  }, [open]);

  const markSeen = tour.markSeen;
  const close = useCallback(() => {
    markSeen();
    setOpen(false);
  }, [markSeen]);

  const requestClose = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    window.setTimeout(close, motionReduced() ? 0 : 320);
  }, [close]);

  const goTo = useCallback((next: number) => {
    setStep((current) => {
      const bounded = Math.max(0, Math.min(SLIDES.length - 1, next));
      if (bounded !== current) setDirection(bounded > current ? 1 : -1);
      return bounded;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") goTo(step + 1);
      if (event.key === "ArrowLeft") goTo(step - 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, open, step]);

  useOverlayDismiss(open, requestClose);

  // A flick or a decent drag across the artwork turns the page.
  const onPanEnd = (_: unknown, info: PanInfo) => {
    const far = Math.abs(info.offset.x) > 56;
    const fast = Math.abs(info.velocity.x) > 420;
    if (!far && !fast) return;
    goTo(step + (info.offset.x < 0 ? 1 : -1));
  };

  const current = SLIDES[step];
  const isLast = step === SLIDES.length - 1;
  const phase = leaving ? "leave" : "enter";

  return (
    <AnimatePresence>
      {open && (
        <>
          <OverlayScrim onClose={requestClose} label="Close what's new" />
          <OverlayPanel
            variant="sheet"
            label="What's new in Messages"
            ground="none"
            className="transition-colors duration-[600ms] sm:w-[min(600px,94vw)]"
            dragClose={close}
            style={{
              backgroundColor:
                resolvedTheme === "light"
                  ? current.lightGround
                  : current.darkGround,
            }}
          >
            <div className="min-h-0 overflow-y-auto">
              {/* The carousel: one track, full bleed. The track slides; each
                  image drifts against its slide and settles out of a slight
                  zoom, so a page turn has depth instead of being a wipe. */}
              <motion.div
                className="relative aspect-[16/9] shrink-0 touch-pan-y overflow-hidden bg-inherit"
                initial={{ opacity: 0, scale: 1.06 }}
                animate={
                  leaving
                    ? { opacity: 0, scale: 1.03 }
                    : { opacity: 1, scale: 1 }
                }
                transition={{ duration: leaving ? 0.3 : 0.9, ease: EASE }}
                onPanEnd={onPanEnd}
              >
                <motion.div
                  className="flex h-full"
                  style={{ width: `${SLIDES.length * 100}%` }}
                  initial={false}
                  animate={{ x: `${(-step * 100) / SLIDES.length}%` }}
                  transition={CAROUSEL}
                >
                  {SLIDES.map((slide, index) => (
                    <div
                      key={slide.key}
                      className="relative h-full overflow-hidden"
                      style={{ width: `${100 / SLIDES.length}%` }}
                      aria-hidden={index !== step}
                    >
                      <motion.div
                        className="absolute inset-0"
                        initial={false}
                        animate={{
                          x: `${(index - step) * -DRIFT}%`,
                          scale: 1 + (Math.abs(index - step) * DRIFT * 2) / 100,
                        }}
                        transition={CAROUSEL}
                      >
                        <Image
                          src={
                            resolvedTheme === "light"
                              ? slide.image
                              : slide.darkImage
                          }
                          alt={slide.alt}
                          fill
                          sizes="(max-width: 640px) 94vw, 600px"
                          className="pointer-events-none select-none object-cover object-center"
                          draggable={false}
                          priority={index === 0}
                        />
                      </motion.div>
                    </div>
                  ))}
                </motion.div>

                <button
                  type="button"
                  onClick={requestClose}
                  aria-label="Close what's new"
                  className="absolute right-3 top-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill bg-page/80 text-primary shadow-nav transition-colors hover:bg-page"
                >
                  <X size={17} weight="bold" />
                </button>
              </motion.div>

              <div
                className="min-h-[196px] px-5 pb-6 pt-7 sm:px-8 sm:pt-8"
                aria-live="polite"
              >
                <AnimatePresence mode="wait" initial>
                  <motion.div
                    key={current.key}
                    variants={block}
                    initial="hidden"
                    animate={phase}
                    exit="leave"
                  >
                    <h2
                      aria-label={current.title}
                      className="max-w-[18ch] font-display text-[calc(28px*var(--ws-fs))] font-semibold leading-[1.15] tracking-[-0.035em] text-primary sm:text-[calc(32px*var(--ws-fs))]"
                    >
                      {current.title.split(" ").map((w, i) => (
                        <span
                          // biome-ignore lint/suspicious/noArrayIndexKey: words are positional
                          key={i}
                          aria-hidden
                          // The mask. Padding keeps descenders inside it; the
                          // negative margin gives the line height back.
                          className="-mb-[0.14em] mr-[0.26em] inline-block overflow-hidden pb-[0.14em] align-bottom"
                        >
                          <motion.span className="inline-block" variants={word}>
                            {w}
                          </motion.span>
                        </span>
                      ))}
                    </h2>
                    <motion.p
                      variants={copy}
                      className="mt-3 max-w-[52ch] font-sans text-[calc(14px*var(--ws-fs))] leading-relaxed text-muted"
                    >
                      {current.body}
                    </motion.p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <motion.div
              className="flex shrink-0 items-center gap-3 px-5 pb-6 pt-2 sm:px-8"
              variants={controls}
              initial="hidden"
              animate={phase}
            >
              <button
                type="button"
                onClick={() => goTo(step - 1)}
                disabled={step === 0}
                aria-label="Previous feature"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-pill bg-primary/[0.045] text-muted transition-[background-color,color,opacity] duration-[320ms] hover:bg-primary/[0.08] hover:text-primary disabled:cursor-default disabled:opacity-30"
              >
                <RiArrowLeftLine size={17} />
              </button>

              <span
                className="flex flex-1 items-center font-sans text-[13px] tabular-nums text-muted"
                aria-label={`${step + 1} of ${SLIDES.length}`}
              >
                <span
                  aria-hidden
                  className="relative inline-flex h-[1.5em] w-[1.35em] overflow-hidden"
                >
                  <AnimatePresence initial={false} custom={direction}>
                    <motion.span
                      key={step}
                      custom={direction}
                      variants={roll}
                      initial="from"
                      animate="to"
                      exit="out"
                      className="absolute inset-0 flex items-center"
                    >
                      {String(step + 1).padStart(2, "0")}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <span aria-hidden className="mx-1.5 text-subtle">
                  /
                </span>
                <span aria-hidden>{String(SLIDES.length).padStart(2, "0")}</span>
              </span>

              <motion.button
                layout
                type="button"
                onClick={() => (isLast ? requestClose() : goTo(step + 1))}
                transition={{ layout: { duration: 0.4, ease: EASE } }}
                className="group flex h-11 min-w-32 cursor-pointer items-center justify-center gap-3 overflow-hidden rounded-pill bg-brand px-5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-brand-on transition-colors hover:bg-brand-active"
              >
                <span className="relative inline-flex h-[1.5em] items-center overflow-hidden">
                  <AnimatePresence mode="popLayout" initial={false} custom={1}>
                    <motion.span
                      key={isLast ? "go" : "next"}
                      custom={1}
                      variants={roll}
                      initial="from"
                      animate="to"
                      exit="out"
                      className="inline-block whitespace-nowrap"
                    >
                      {isLast ? "Let's go" : "Continue"}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <AnimatePresence initial={false}>
                  {!isLast && (
                    <motion.span
                      key="arrow"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.3, ease: EASE }}
                      className="inline-flex transition-transform duration-[320ms] group-hover:translate-x-0.5"
                    >
                      <RiArrowRightLine size={17} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </motion.div>
          </OverlayPanel>
        </>
      )}
    </AnimatePresence>
  );
}
