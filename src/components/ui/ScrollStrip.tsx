"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";

interface ScrollStripProps {
  children: React.ReactNode;
  ariaLabel: string;
  /** Extra classes for the scrolling row itself. */
  className?: string;
  /**
   * Which surface the strip sits on. "canvas" is the fixed-dark editor
   * chrome; "page" follows the theme, for app surfaces where a hardcoded
   * dark fade would smear across the paper light mode.
   */
  variant?: "canvas" | "page";
}

/**
 * A horizontal strip that ADMITS it scrolls.
 *
 * The editor rails hide their scrollbars, which meant a rail of seven filters
 * looked like a rail of four — there was no way to know the rest existed.
 * This adds the two affordances that fix that: an edge fade that appears only
 * on the side with more content, and a nudge button on pointer devices.
 */
export default function ScrollStrip({
  children,
  ariaLabel,
  className,
  variant = "canvas",
}: ScrollStripProps) {
  const fadeFrom = variant === "page" ? "from-page" : "from-[#100e0d]";
  const nudgeSkin =
    variant === "page"
      ? "bg-raised text-primary hover:bg-chip ring-1 ring-hairline"
      : "glass-chip-canvas backdrop-blur-md";
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({
      start: el.scrollLeft > 2,
      // 2px slack: sub-pixel layout leaves a phantom remainder at the end.
      end: max > 2 && el.scrollLeft < max - 2,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [sync]);

  const nudge = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <section
        ref={ref}
        onScroll={sync}
        aria-label={ariaLabel}
        className={clsx(
          "flex gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth",
          className,
        )}
      >
        {children}
      </section>

      {/* Fades mark the direction with more content. */}
      <span
        aria-hidden="true"
        className={clsx(
          "pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r to-transparent transition-opacity",
          fadeFrom,
          edges.start ? "opacity-90" : "opacity-0",
        )}
      />
      <span
        aria-hidden="true"
        className={clsx(
          "pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l to-transparent transition-opacity",
          fadeFrom,
          edges.end ? "opacity-90" : "opacity-0",
        )}
      />

      {edges.start && (
        <button
          type="button"
          onClick={() => nudge(-1)}
          aria-label={`Scroll ${ariaLabel} left`}
          tabIndex={-1}
          className={clsx(
            "absolute left-0 top-1/2 hidden -translate-y-1/2 h-7 w-7 items-center justify-center rounded-pill transition-colors cursor-pointer sm:flex",
            nudgeSkin,
          )}
        >
          <CaretLeft size={12} weight="bold" />
        </button>
      )}
      {edges.end && (
        <button
          type="button"
          onClick={() => nudge(1)}
          aria-label={`Scroll ${ariaLabel} right`}
          tabIndex={-1}
          className={clsx(
            "absolute right-0 top-1/2 hidden -translate-y-1/2 h-7 w-7 items-center justify-center rounded-pill transition-colors cursor-pointer sm:flex",
            nudgeSkin,
          )}
        >
          <CaretRight size={12} weight="bold" />
        </button>
      )}
    </div>
  );
}
