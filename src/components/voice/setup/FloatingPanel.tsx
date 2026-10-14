"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { menu } from "@/lib/motion-presets";

type Place = {
  left: number;
  width?: number;
  right?: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
  above: boolean;
};

/** Phones get a panel that spans the screen bar a 12px gutter. */
const PHONE = 640;
/** Never under the top bar. */
const TOP_LIMIT = 64;
/** Below this much room above the anchor, the panel opens under it instead. */
const MIN_ABOVE = 180;

function place(
  anchor: HTMLElement,
  width: number,
  maxHeight: number,
  gap: number,
): Place {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const r = anchor.getBoundingClientRect();
  const roomAbove = r.top - gap - TOP_LIMIT;
  const above = roomAbove >= Math.min(MIN_ABOVE, maxHeight);
  const vertical = above
    ? { bottom: vh - r.top + gap, maxHeight: Math.min(maxHeight, roomAbove) }
    : {
        top: r.bottom + gap,
        maxHeight: Math.min(maxHeight, vh - r.bottom - gap - 12),
      };
  if (vw < PHONE) return { left: 12, right: 12, above, ...vertical };
  const w = Math.min(width, vw - 32);
  const left = Math.min(
    Math.max(16, r.left + r.width / 2 - w / 2),
    vw - 16 - w,
  );
  return { left, width: w, above, ...vertical };
}

/**
 * A panel that opens off a control in the setup sheet: the community
 * results over the "To" field, the date grid over its chip. Fixed to the
 * viewport and portalled into the sheet's own layer (`host`), so a step's
 * enter transform never becomes its containing block, and it follows the
 * anchor through scrolls, resizes and the phone keyboard.
 *
 * Opens UPWARD when there is room, so the field and the chips stay where
 * the hand is. An opaque `bg-surface` card with the pop shadow: the
 * sheet's background is the one blur on screen.
 *
 * A press outside the panel and outside `keepOpen` (the anchor, usually)
 * calls `onDismiss`.
 */
export function FloatingPanel({
  open,
  host,
  anchor,
  keepOpen = [],
  onDismiss,
  width = 620,
  maxHeight = 360,
  gap = 8,
  label,
  role = "dialog",
  id,
  className,
  children,
}: {
  open: boolean;
  host: HTMLElement | null;
  anchor: RefObject<HTMLElement | null>;
  keepOpen?: RefObject<HTMLElement | null>[];
  onDismiss: () => void;
  width?: number;
  maxHeight?: number;
  gap?: number;
  label: string;
  role?: "dialog" | "listbox" | "presentation";
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<Place | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const keep = useRef(keepOpen);
  keep.current = keepOpen;

  useLayoutEffect(() => {
    if (!open) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = anchor.current;
        if (el) setPos(place(el, width, maxHeight, gap));
      });
    };
    const el = anchor.current;
    if (el) setPos(place(el, width, maxHeight, gap));
    window.addEventListener("resize", measure);
    // Capture: any scroller in the sheet moves the anchor.
    window.addEventListener("scroll", measure, true);
    window.visualViewport?.addEventListener("resize", measure);
    const ro =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (el) ro?.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.visualViewport?.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [open, anchor, width, maxHeight, gap]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (panel.current?.contains(t)) return;
      if (anchor.current?.contains(t)) return;
      if (keep.current.some((r) => r.current?.contains(t))) return;
      dismiss.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, anchor]);

  if (!host) return null;
  const m = menu(pos?.above === false ? "top" : "bottom");
  return createPortal(
    <AnimatePresence>
      {open && pos && (
        <motion.div
          ref={panel}
          key="panel"
          id={id}
          role={role === "presentation" ? undefined : role}
          aria-label={label}
          initial={m.initial}
          animate={m.animate}
          exit={m.exit}
          style={{
            ...m.style,
            position: "fixed",
            left: pos.left,
            width: pos.width,
            right: pos.right,
            top: pos.top,
            bottom: pos.bottom,
            maxHeight: pos.maxHeight,
          }}
          className={cn(
            "flex flex-col overflow-hidden rounded-xl bg-surface text-primary shadow-pop ring-1 ring-hairline",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    host,
  );
}
