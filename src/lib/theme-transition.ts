"use client";

import { flushSync } from "react-dom";

/**
 * Wraps a theme change so light <-> dark cross-fades instead of snapping.
 *
 * Preferred path: the View Transitions API — the browser snapshots the old
 * frame and cross-fades to the new one (duration/easing styled on
 * `::view-transition-*(root)` in globals.css). `flushSync` forces next-themes
 * to swap the `html` class inside the snapshot callback.
 *
 * Fallback: a `.theme-switching` class on <html> that turns on color
 * transitions for one motion-slow beat (see globals.css), then detaches.
 *
 * Under prefers-reduced-motion both paths are skipped and the swap is instant.
 */
export function withThemeTransition(apply: () => void) {
  if (typeof document === "undefined") {
    apply();
    return;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    apply();
    return;
  }

  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => unknown;
  };

  if (typeof doc.startViewTransition === "function") {
    doc.startViewTransition(() => {
      flushSync(apply);
    });
    return;
  }

  const root = document.documentElement;
  root.classList.add("theme-switching");
  apply();
  // motion-slow is 320ms; a small buffer avoids clipping the tail.
  window.setTimeout(() => root.classList.remove("theme-switching"), 360);
}
