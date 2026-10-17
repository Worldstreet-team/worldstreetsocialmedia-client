"use client";

import { usePostLayerOpen } from "@/components/feed/PostLayer";

import { mainScroller, mainScrollTop } from "@/lib/utils";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppPathname } from "@/i18n/useAppPathname";
import { AnimatePresence, motion, useReducedMotionConfig } from "framer-motion";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  Broadcast,
  Camera,
  Waveform,
  NotePencil,
  PencilSimple,
  Plus,
  CaretRight,
} from "@phosphor-icons/react";
import { HaloChip, HaloChips, HaloRow, haloGlass, haloPanel } from "@/components/ui/Halo";
import { VividOrb } from "@/components/vivid/VividOrb";
import {
  GoLiveSheet,
  type GoLivePreset,
} from "@/components/feed/GoLiveSheet";
import { OverlayScrim, useOverlayDismiss } from "@/components/ui/Overlay";
import { listPresetsAction } from "@/lib/creator.actions";
import { liveSessionAtom } from "@/store/live.atom";
import { DraftsSheet } from "@/components/ui/DraftsSheet";
import { draftsAtom, draftsOpenAtom } from "@/store/drafts.atom";
import {
  composeOpenAtom,
  goLiveOpenAtom,
  storyStudioSignalAtom,
} from "@/store/ui.atom";
import { useT } from "@/i18n/client";
import { press } from "@/lib/motion-presets";
import clsx from "clsx";

/**
 * The create FAB — one floating entry point for everything you can make:
 * post, story, live, space, drafts. Replaces the Go Live pill that used to
 * sit on the tab bar and the live/media icons in the composer toolbar.
 *
 * Mounted in the root layout, OUTSIDE app/template.tsx: a fixed element
 * inside the template's transient transform gets trapped by it.
 */
export function CreateFab() {
  const t = useT();
  const router = useRouter();
  const pathname = useAppPathname();
  const reduced = useReducedMotionConfig();

  const [open, setOpen] = useState(false);
  // The FAB stays out of the way until you've scrolled past the composer —
  // at the top of the feed the composer IS the create surface.
  const [visible, setVisible] = useState(false);
  const [goLive, setGoLive] = useAtom(goLiveOpenAtom);
  const [preset, setPreset] = useState<GoLivePreset | null>(null);
  const liveNow = useAtomValue(liveSessionAtom);

  useEffect(() => {
    (async () => {
      const res = await listPresetsAction();
      if (!res.success) return;
      const def = res.presets.find((p: any) => p.isDefault) ?? res.presets[0];
      if (def)
				setPreset({
					category: def.category,
					source: def.source,
					notifyFollowers: def.notifyFollowers,
				});
    })();
  }, []);
  const setDraftsOpen = useSetAtom(draftsOpenAtom);
  const setComposeOpen = useSetAtom(composeOpenAtom);
  const setStorySignal = useSetAtom(storyStudioSignalAtom);
  const drafts = useAtomValue(draftsAtom);

  // Routes that bring their own full-screen chrome — no floating create.
  // Reading a post, the button steps aside with the bottom bar.
  const postOpen = usePostLayerOpen();
  const immersive =
    postOpen ||
    pathname.startsWith("/post/") ||
    pathname === "/live" ||
    pathname.startsWith("/live/") ||
    // The inbox has its own floating button (new chat); two stacked on the
    // same corner of a phone was the owner's "why is the fab that way".
    pathname === "/messages" ||
    pathname.startsWith("/messages/") ||
    // Settings is for changing things, not posting: the button sat on top
    // of the last rows of the phone hub and of every right-edge control.
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/onboarding");

  useEffect(() => {
    const update = () => {
      const past = mainScrollTop() > 500;
      // Below md the FAB is THE create entry point (the bottom-nav duplicate
      // FAB is gone and the header's Go Live pill is sm+ only), so it is
      // always on; desktop keeps the scroll-reveal behavior.
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      const show = past || mobile;
      setVisible(show);
      if (!show) setOpen(false);
    };
    update();
    // The app scrolls #ws-main-scroll, not the window: listening on the
    // window meant the desktop FAB never saw a scroll and never appeared.
    const scroller = mainScroller();
    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      scroller.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [pathname]);

  // Escape closes the fan before anything else reacts to it, and the page
  // behind the scrim stays put — both from the shared dismiss hook.
  // Phones get a proper bottom drawer (owner 2026-10-16); wider screens keep
  // the Halo panel by the button.
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const closeFan = useCallback(() => setOpen(false), []);
  useOverlayDismiss(open, closeFan);

  const goHomeThen = (after: () => void) => {
    if (pathname !== "/") router.push("/");
    after();
  };

  const actions = [
    {
      key: "post",
      sub: t("fab.postSub"),
      label: t("fab.post"),
      icon: PencilSimple,
      // The compose window, in place (owner ruling 2026-09-03) — never a
      // trip back home to reach the feed composer.
      onClick: () => setComposeOpen(true),
    },
    {
      key: "story",
      sub: t("fab.storySub"),
      label: t("fab.story"),
      icon: Camera,
      tone: "brand" as const,
      onClick: () => goHomeThen(() => setStorySignal((n) => n + 1)),
    },
    {
      key: "live",
      sub: t("fab.liveSub"),
      label: t("fab.live"),
      icon: Broadcast,
      tone: "danger" as const,
      onClick: () => setGoLive(true),
    },
    {
      key: "space",
      sub: t("fab.spaceSub"),
      label: t("fab.space"),
      icon: Waveform,
      onClick: () => router.push("/voice?create=1"),
    },
  ];

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <AnimatePresence>
        {open && visible && (
          <OverlayScrim
            key="fab-scrim"
            onClose={closeFan}
            blur
            label={t("fab.close")}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {visible && !immersive && (
      <motion.div
        key="create-fab"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.9 }}
        animate={
          reduced
            ? { opacity: 1 }
            : {
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { type: "spring", stiffness: 520, damping: 32 },
              }
        }
        exit={{
          opacity: 0,
          y: reduced ? 0 : 8,
          scale: reduced ? 1 : 0.95,
          transition: { duration: 0.12, ease: [0.2, 0, 0, 1] },
        }}
        // bottom-nav = the sanctioned clearance token over the mobile tab bar
        // (64px bar + safe area + 16px), replacing the hardcoded bottom-24 guess.
        // The fan rides at z-modal while open so it clears the shared scrim
        // (also z-modal, but earlier in the DOM); closed, it drops back to
        // z-dropdown so real modals stack over it.
        className={clsx(
          "fixed bottom-nav right-4 md:bottom-6 md:right-6 flex flex-col items-end gap-3",
          open ? "z-modal" : "z-dropdown",
        )}
      >
        {/* The create menu is one Halo panel (owner pick 2026-10-10/11):
            a round chip per thing you can make, Story lit as the usual
            pick, and Drafts on its own row with the count. */}
        <AnimatePresence>
          {open && !phone && (
            <motion.div
              key="create-menu"
              role="menu"
              aria-label={t("fab.create")}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
              animate={
                reduced
                  ? { opacity: 1 }
                  : {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { type: "spring", stiffness: 520, damping: 34 },
                    }
              }
              exit={{
                opacity: 0,
                y: reduced ? 0 : 8,
                scale: reduced ? 1 : 0.97,
                transition: { duration: 0.12, ease: [0.2, 0, 0, 1] },
              }}
              style={{ transformOrigin: "bottom right" }}
              className={clsx(haloPanel, "flex w-[min(358px,calc(100vw-32px))] flex-col gap-4")}
            >
              <div className="px-1">
                <h2 className="font-display text-[calc(18px*var(--ws-fs))] font-semibold leading-tight text-primary">
                  {t("fab.create")}
                </h2>
                <p className="mt-0.5 font-sans text-[calc(13px*var(--ws-fs))] text-muted">
                  {t("fab.prompt")}
                </p>
              </div>
              <HaloChips>
                {actions.map((action) => (
                  <HaloChip
                    key={action.key}
                    icon={<action.icon size={22} weight={action.tone === "brand" ? "fill" : "regular"} />}
                    label={action.label}
                    tone={action.tone}
                    onClick={() => run(action.onClick)}
                  />
                ))}
              </HaloChips>
              <HaloRow
                icon={<NotePencil size={18} weight="fill" className="text-gold" />}
                label={t("fab.drafts")}
                value={
                  drafts.length
                    ? t("fab.draftsSaved").replace("{n}", String(drafts.length))
                    : t("fab.draftsEmpty")
                }
                trailing={<CaretRight size={14} weight="bold" className="shrink-0 text-subtle" />}
                onClick={() => run(() => setDraftsOpen(true))}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? t("fab.close") : t("fab.create")}
          {...press}
          className="flex h-14 w-14 items-center justify-center rounded-pill bg-brand text-brand-on shadow-nav hover:bg-brand-active transition-colors cursor-pointer"
        >
          <motion.span
            animate={{ rotate: open ? 45 : 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : { type: "spring", stiffness: 520, damping: 30 }
            }
            className="flex"
          >
            <Plus size={26} weight="bold" />
          </motion.span>
        </motion.button>
        {/* Vivid's orb turns just below the plus, never inside it, on a
            frosted chip that follows the theme: dark glass on dark, light
            glass on light (owner 2026-10-16). */}
        {!open && pathname !== "/vivid" && (
          <button
            type="button"
            onClick={() => router.push("/vivid")}
            aria-label={t("fab.vivid")}
            title={t("fab.vivid")}
            className="mr-1 flex h-12 w-12 cursor-pointer items-center justify-center rounded-pill glass-frost shadow-nav ring-1 ring-primary/[0.06] backdrop-blur-xl"
          >
            <VividOrb size={30} speed={0.7} />
          </button>
        )}
      </motion.div>
        )}
      </AnimatePresence>

      {/* The phone drawer: a sheet from the bottom, one row per thing you
          can make with a line on what it is, Go Live included, Drafts last. */}
      <AnimatePresence>
        {open && phone && (
          <motion.div
            key="create-drawer"
            role="menu"
            aria-label={t("fab.create")}
            initial={reduced ? { opacity: 0 } : { y: "100%" }}
            animate={reduced ? { opacity: 1 } : { y: 0, transition: { type: "spring", stiffness: 420, damping: 40 } }}
            exit={reduced ? { opacity: 0 } : { y: "100%", transition: { duration: 0.2, ease: [0.2, 0, 0, 1] } }}
            drag={reduced ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 500) closeFan();
            }}
            className={clsx(
              haloGlass,
              "fixed inset-x-0 bottom-0 z-modal rounded-t-[28px] px-4 pt-2.5 pb-[calc(20px+var(--ws-safe-bottom))]",
            )}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-pill bg-primary/20" />
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="font-display text-[calc(20px*var(--ws-fs))] font-medium text-primary">
                {t("fab.create")}
              </h2>
              <button
                type="button"
                onClick={closeFan}
                aria-label={t("fab.close")}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-pill bg-primary/10 text-primary"
              >
                <Plus size={15} weight="bold" className="rotate-45" />
              </button>
            </div>
            <div className="flex flex-col">
              {actions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  role="menuitem"
                  onClick={() => run(action.onClick)}
                  className="flex cursor-pointer items-center gap-3.5 rounded-[18px] px-2 py-2.5 text-left transition-colors active:bg-primary/[0.06]"
                >
                  <span
                    className={clsx(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/[0.07]",
                      action.tone === "brand" ? "text-brand" : action.tone === "danger" ? "text-danger" : "text-primary",
                    )}
                  >
                    <action.icon size={20} weight={action.tone === "brand" ? "fill" : "regular"} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-sans text-[calc(15px*var(--ws-fs))] font-semibold text-primary">{action.label}</span>
                    <span className="truncate font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">{action.sub}</span>
                  </span>
                  <CaretRight size={14} weight="bold" className="shrink-0 text-subtle" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => run(() => setDraftsOpen(true))}
                className="mt-2 flex cursor-pointer items-center gap-2.5 rounded-[16px] bg-primary/[0.05] px-3.5 py-3 text-left"
              >
                <NotePencil size={16} weight="fill" className="text-gold" />
                <span className="font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary">{t("fab.drafts")}</span>
                <span className="font-sans text-[calc(12.5px*var(--ws-fs))] text-subtle">
                  {drafts.length
                    ? t("fab.draftsSaved").replace("{n}", String(drafts.length))
                    : t("fab.draftsEmpty")}
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {goLive && !liveNow && (
        <GoLiveSheet preset={preset} onClose={() => setGoLive(false)} />
      )}
      <DraftsSheet />
    </>
  );
}
