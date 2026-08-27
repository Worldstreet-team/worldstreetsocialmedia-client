"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppPathname } from "@/i18n/useAppPathname";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  Broadcast,
  Camera,
  Microphone,
  NotePencil,
  PencilSimple,
  Plus,
} from "@phosphor-icons/react";
import {
  GoLiveSheet,
  type GoLivePreset,
} from "@/components/feed/GoLiveSheet";
import { listPresetsAction } from "@/lib/creator.actions";
import { liveSessionAtom } from "@/store/live.atom";
import { DraftsSheet } from "@/components/ui/DraftsSheet";
import { draftsAtom, draftsOpenAtom } from "@/store/drafts.atom";
import { goLiveOpenAtom, storyStudioSignalAtom } from "@/store/ui.atom";
import { useT } from "@/i18n/client";
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
  const reduced = useReducedMotion();

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
  const setStorySignal = useSetAtom(storyStudioSignalAtom);
  const drafts = useAtomValue(draftsAtom);

  // Routes that bring their own full-screen chrome — no floating create.
  const immersive =
    pathname === "/live" ||
    pathname.startsWith("/live/") ||
    (pathname.startsWith("/messages/") && pathname.split("/").length > 2) ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/onboarding");

  useEffect(() => {
    const update = () => {
      const past = window.scrollY > 500;
      // Below md the FAB is THE create entry point (the bottom-nav duplicate
      // FAB is gone and the header's Go Live pill is sm+ only), so it is
      // always on; desktop keeps the scroll-reveal behavior.
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      const show = past || mobile;
      setVisible(show);
      if (!show) setOpen(false);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [pathname]);

  // Escape closes the fan before anything else reacts to it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const goHomeThen = (after: () => void) => {
    if (pathname !== "/") router.push("/");
    after();
  };

  const focusComposer = () => {
    const el = document.querySelector<HTMLTextAreaElement>(
      "#post-composer-input",
    );
    if (el) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      el.focus();
    }
  };

  const actions = [
    {
      key: "post",
      label: t("fab.post"),
      icon: PencilSimple,
      onClick: () => goHomeThen(() => setTimeout(focusComposer, 60)),
    },
    {
      key: "story",
      label: t("fab.story"),
      icon: Camera,
      onClick: () => goHomeThen(() => setStorySignal((n) => n + 1)),
    },
    {
      key: "live",
      label: t("fab.live"),
      icon: Broadcast,
      tone: "danger" as const,
      onClick: () => setGoLive(true),
    },
    {
      key: "space",
      label: t("fab.space"),
      icon: Microphone,
      onClick: () => router.push("/voice?create=1"),
    },
    {
      key: "drafts",
      label: t("fab.drafts"),
      icon: NotePencil,
      badge: drafts.length || undefined,
      onClick: () => setDraftsOpen(true),
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
          <motion.button
            key="fab-scrim"
            type="button"
            aria-label={t("fab.close")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-dropdown glass-scrim backdrop-blur-xl backdrop-saturate-150 cursor-default"
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
        className="fixed bottom-nav right-4 md:bottom-6 md:right-6 z-dropdown flex flex-col items-end gap-3"
      >
        <AnimatePresence>
          {open &&
            actions.map((action, i) => (
              <motion.button
                key={action.key}
                type="button"
                onClick={() => run(action.onClick)}
                initial={
                  reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.9 }
                }
                animate={
                  reduced
                    ? { opacity: 1 }
                    : {
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        transition: {
                          delay: (actions.length - 1 - i) * 0.04,
                          type: "spring",
                          stiffness: 520,
                          damping: 30,
                        },
                      }
                }
                exit={{
                  opacity: 0,
                  y: reduced ? 0 : 8,
                  scale: reduced ? 1 : 0.95,
                  transition: { duration: 0.12, ease: [0.2, 0, 0, 1] },
                }}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <span className="rounded-pill glass-chip px-3 h-8 flex items-center font-sans text-[13px] font-semibold whitespace-nowrap">
                  {action.label}
                  {action.badge ? (
                    <span className="ml-1.5 glass-ink-faint tabular-nums font-medium">
                      {action.badge}
                    </span>
                  ) : null}
                </span>
                <span
                  className={clsx(
                    "flex h-11 w-11 items-center justify-center rounded-pill backdrop-blur-md backdrop-saturate-150 transition-colors",
                    action.tone === "danger"
                      ? "glass-chip !text-danger group-hover:!bg-danger group-hover:!text-white"
                      : "glass-chip",
                  )}
                >
                  <action.icon size={19} weight="fill" />
                </span>
              </motion.button>
            ))}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? t("fab.close") : t("fab.create")}
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
        </button>
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
