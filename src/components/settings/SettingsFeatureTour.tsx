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
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { DEFAULT_PALETTE, PALETTES } from "@/data/palettes";
import { motionReduced } from "@/lib/motion";
import { staggerParent, staggerPop, thumbSpring } from "@/lib/motion-presets";
import { withThemeTransition } from "@/lib/theme-transition";

const SEEN_KEY = "ws-settings-whats-new-v1";
const WELCOME_SEEN_KEY = "ws-social-welcome-v1";

const EASE = [0.2, 0, 0, 1] as const;
const EASE_IN = [0.5, 0, 0.9, 0.4] as const;
const CAROUSEL = { duration: 0.75, ease: EASE };
const DRIFT = 8;

const SLIDES = [
  {
    key: "palette",
    image: "/images/features/settings/palette-light-v2.webp",
    darkImage: "/images/features/settings/palette-dark-v2.webp",
    lightGround: "#fcf5ea",
    darkGround: "#1c1c1c",
    alt: "Seven colour swatches with matching interface accents",
    title: "Make it yours.",
    body: "Choose from seven colours and WorldSpace follows, from buttons and tabs to links and highlights.",
  },
  {
    key: "search",
    image: "/images/features/settings/search-light-v1.webp",
    darkImage: "/images/features/settings/search-dark-v1.webp",
    lightGround: "#fcf4ec",
    darkGround: "#1a1a1a",
    alt: "A magnifier finding one highlighted settings row",
    title: "Find any setting by name.",
    body: "Search for what you need, like “dark”, “blocked accounts” or “text size”. We’ll take you straight there and highlight it.",
  },
  {
    key: "overview",
    image: "/images/features/settings/glance-light-v1.webp",
    darkImage: "/images/features/settings/glance-dark-v1.webp",
    lightGround: "#fcf7eb",
    darkGround: "#181818",
    alt: "Four settings summary tiles and three value rows",
    title: "Everything at a glance.",
    body: "See what your settings are set to before you open them: Dark. 100%. English. All on.",
  },
  {
    key: "reading",
    image: "/images/features/settings/read-light-v1.webp",
    darkImage: "/images/features/settings/read-dark-v1.webp",
    lightGround: "#fcf7eb",
    darkGround: "#171717",
    alt: "One message bubble shown at three increasing text sizes",
    title: "Read it your way.",
    body: "Set app text from 90% to 175%, size messages separately, or turn on high contrast, bold text, colour-vision support and reduced motion.",
  },
  {
    key: "data",
    image: "/images/features/settings/data-light-v1.webp",
    darkImage: "/images/features/settings/data-dark-v1.webp",
    lightGround: "#fcf6ef",
    darkGround: "#1d1d1d",
    alt: "A paused video and images reducing in upload size",
    title: "Spend less data.",
    body: "Control data saver, video autoplay and photo upload quality in one place. Make WorldSpace as light as your connection needs.",
  },
  {
    key: "sync",
    image: "/images/features/settings/sync-light-v1.webp",
    darkImage: "/images/features/settings/sync-dark-v1.webp",
    lightGround: "#fcf7eb",
    darkGround: "#181818",
    alt: "Matching preferences connected by a synchronisation orbit",
    title: "Set it once. It follows you.",
    body: "Your colour, text, accessibility, privacy and data choices are saved to your account, so WorldSpace feels familiar on every device you sign in to.",
  },
] as const;

const copy = {
  hidden: { opacity: 0, y: 10 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
  leave: { opacity: 0, y: -8, transition: { duration: 0.2, ease: EASE_IN } },
};

const controls = {
  hidden: { opacity: 0, y: 12 },
  enter: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE, delay: 0.3 },
  },
  leave: { opacity: 0, y: 8, transition: { duration: 0.18, ease: EASE_IN } },
};

const roll = {
  from: (direction: number) => ({ y: `${direction * 100}%`, opacity: 0 }),
  to: { y: "0%", opacity: 1, transition: { duration: 0.4, ease: EASE } },
  out: (direction: number) => ({
    y: `${direction * -100}%`,
    opacity: 0,
    transition: { duration: 0.22, ease: EASE_IN },
  }),
};

/** One-time release carousel for the rebuilt Settings experience. */
export function SettingsFeatureTour() {
  const { resolvedTheme } = useTheme();
  const { prefs, setPrefs } = usePreferences();
  const palette = prefs.appearance.palette;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);

  useEffect(() => {
    let timer = 0;
    const reveal = () => {
      if (window.localStorage.getItem(SEEN_KEY)) return;
      if (
        !window.localStorage.getItem(WELCOME_SEEN_KEY) ||
        document.querySelector('[role="dialog"]')
      ) {
        timer = window.setTimeout(reveal, 900);
        return;
      }
      setOpen(true);
    };

    timer = window.setTimeout(reveal, 700);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setDirection(1);
    setLeaving(false);
    leavingRef.current = false;
  }, [open]);

  const close = useCallback(() => {
    window.localStorage.setItem(SEEN_KEY, "1");
    setOpen(false);
  }, []);

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
            label="What's new in Settings"
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
              {/* The artwork runs 28px further down than its 16:9, under the
                  text section's curved top (owner 2026-09-21): corners that
                  opened onto bare ground looked scanty. The two spacers give
                  the box its height; the track fills it. */}
              <motion.div
                className="relative shrink-0 touch-pan-y overflow-hidden bg-inherit"
                initial={{ opacity: 0, scale: 1.05 }}
                animate={
                  leaving
                    ? { opacity: 0, scale: 1.02 }
                    : { opacity: 1, scale: 1 }
                }
                transition={{ duration: leaving ? 0.3 : 0.8, ease: EASE }}
                onPanEnd={onPanEnd}
              >
                <div aria-hidden className="aspect-[16/9]" />
                <div aria-hidden className="h-7" />
                <motion.div
                  className="absolute inset-y-0 left-0 flex"
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
                        {/* The art wears the chosen colour (owner
                            2026-09-21). It is paper-cut greys with ONE
                            saturated accent, so a `hue` blend moves only
                            that accent to the brand's hue: a grey has no
                            saturation for the blend to act on. Skipped on
                            the default, where the art is already right;
                            under Mono the accent goes grey, which is the
                            honest picture of Mono. */}
                        {/* Not on the colour slide: its fan IS seven different
                            colours, and one hue over it turned the whole fan
                            gold, which is the opposite of its point. */}
                        {palette !== DEFAULT_PALETTE && slide.key !== "palette" && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 mix-blend-hue"
                            style={{ background: "var(--ws-brand-primary)" }}
                          />
                        )}
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
                className="relative -mt-7 min-h-[196px] rounded-t-[28px] bg-surface px-5 pb-6 pt-7 sm:px-8 sm:pt-8"
                aria-live="polite"
              >
                <AnimatePresence mode="wait" initial>
                  <motion.div
                    key={current.key}
                    variants={copy}
                    initial="hidden"
                    animate={phase}
                    exit="leave"
                  >
                    <h2 className="max-w-[20ch] font-display text-[calc(28px*var(--ws-fs))] font-semibold leading-[1.15] tracking-[-0.035em] text-primary sm:text-[calc(32px*var(--ws-fs))]">
                      {current.title}
                    </h2>
                    <p className="mt-3 max-w-[54ch] font-sans text-[calc(14px*var(--ws-fs))] leading-relaxed text-muted">
                      {current.body}
                    </p>
                    {/* Try it here (owner 2026-09-21): the seven colours, live.
                        Picking one recolours the app behind the card, the
                        button below and the artwork above, which is the whole
                        pitch of this slide made true on the spot. */}
                    {current.key === "palette" && (
                      <motion.div
                        role="radiogroup"
                        aria-label="App colour"
                        variants={staggerParent}
                        initial="hidden"
                        animate="show"
                        className="-ml-2 mt-4 flex"
                      >
                        {PALETTES.map((p) => {
                          const on = p.id === palette;
                          const sw = p[resolvedTheme === "light" ? "light" : "dark"];
                          return (
                            <motion.button
                              key={p.id}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              aria-label={p.label}
                              title={p.label}
                              variants={staggerPop}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => {
                                if (on) return;
                                withThemeTransition(() =>
                                  setPrefs({ appearance: { palette: p.id } }),
                                );
                              }}
                              className="relative flex size-10 cursor-pointer items-center justify-center rounded-pill"
                            >
                              {on && (
                                <motion.span
                                  layoutId="tour-palette-ring"
                                  transition={thumbSpring}
                                  className="absolute inset-[4px] rounded-pill border-2 border-primary"
                                />
                              )}
                              <span
                                className={`block size-6 rounded-pill ${p.id === "mono" ? "border border-hairline" : ""}`}
                                style={{ background: sw.fill }}
                              />
                            </motion.button>
                          );
                        })}
                      </motion.div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <motion.div
              className="flex shrink-0 items-center gap-3 bg-surface px-5 pb-6 pt-2 sm:px-8"
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

              <output
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
                <span aria-hidden>
                  {String(SLIDES.length).padStart(2, "0")}
                </span>
              </output>

              <motion.button
                layout
                type="button"
                onClick={() => (isLast ? requestClose() : goTo(step + 1))}
                transition={{ layout: { duration: 0.4, ease: EASE } }}
                className="group flex h-11 min-w-32 cursor-pointer items-center justify-center gap-3 overflow-hidden rounded-pill bg-brand px-5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-brand-on transition-colors hover:bg-brand-active"
              >
                <span>{isLast ? "Let's go" : "Continue"}</span>
                {!isLast && (
                  <RiArrowRightLine
                    size={17}
                    className="transition-transform duration-[320ms] group-hover:translate-x-0.5"
                  />
                )}
              </motion.button>
            </motion.div>
          </OverlayPanel>
        </>
      )}
    </AnimatePresence>
  );
}
