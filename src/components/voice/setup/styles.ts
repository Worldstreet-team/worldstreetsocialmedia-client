import clsx from "clsx";

/*
 * The setup sheet's few control shapes, shared by its steps. All of them
 * are tints of the theme's ink over the blurred ground (bg-primary/10 at
 * rest, the ink itself when chosen), never a second blur: the ground is
 * the one blur on screen. 40px tall, the house hit target.
 */

/** A choice chip: topics, days, times. Chosen reads as solid ink. */
export const chip = (on: boolean, extra?: string) =>
  clsx(
    "inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-pill px-4 font-sans text-[calc(13px*var(--ws-fs))] font-medium whitespace-nowrap transition-colors disabled:cursor-default disabled:opacity-40",
    on ? "bg-primary text-page" : "bg-primary/10 text-muted hover:text-primary",
    extra,
  );

/** A quiet action under the line: "Add a description", "Add a cover photo". */
export const soft =
  "inline-flex h-10 cursor-pointer items-center gap-2 rounded-pill bg-primary/10 px-4 font-sans text-[calc(13.5px*var(--ws-fs))] font-medium text-primary transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60";

/** Small print under a control. text-subtle is never under 13px. */
export const note =
  "font-sans text-[calc(13px*var(--ws-fs))] leading-snug text-subtle";

export const fmt = (n: number) => n.toLocaleString();
