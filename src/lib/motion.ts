"use client";

import { useSyncExternalStore } from "react";

/**
 * Is motion reduced? The ONE answer for the whole app.
 *
 * Reduce motion has two triggers: the OS (`prefers-reduced-motion`) and the
 * app's own Settings > Accessibility toggle. `applyPrefsToDocument` already
 * folds both into `html[data-ws-motion="reduce"]` (the setting "on", or
 * "auto" while the OS asks), and the CSS keys off that attribute. JS used to
 * ask `matchMedia("(prefers-reduced-motion: reduce)")` directly, which only
 * hears the OS: with the in-app setting on, the image lightbox still
 * morphed, sheets still followed the finger and the theme still
 * cross-faded (audit 2026-09-11). Ask this instead.
 */
export function motionReduced(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.dataset.wsMotion === "reduce"
  );
}

function subscribe(onChange: () => void): () => void {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-ws-motion"],
  });
  return () => mo.disconnect();
}

/** The same answer as state, for render paths. False on the server. */
export function useMotionReduced(): boolean {
  return useSyncExternalStore(subscribe, motionReduced, () => false);
}
