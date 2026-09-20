"use client";

import { CaretDown, Check } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  menuStagger,
  staggerItem,
  staggerParentFast,
  staggerPop,
  swap,
} from "@/lib/motion-presets";

// Only the rows a person can see on open take part in the cascade. The time
// list has 48 rows: staggering all of them would still be fading the bottom
// in most of a second after the menu opened. The rest are simply there.
const CASCADE_ROWS = 8;
// The list pace, read off the preset so there is no private number here.
const LIST_PACE = staggerParentFast.show.transition.staggerChildren;

export interface GlassOption {
  id: string;
  label: string;
  hint?: string;
}

interface GlassSelectProps {
  value: string;
  options: GlassOption[];
  onChange: (id: string) => void;
  label?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * The designed replacement for a native <select> on glass surfaces.
 *
 * The menu is PORTALLED to <body> and positioned from the trigger's rect.
 * That is load-bearing, not tidiness: `backdrop-filter` filters whatever is
 * painted behind an element, and an ancestor that has its own
 * backdrop-filter becomes a backdrop root — so a menu rendered inside a
 * blurred sheet can only "blur" that sheet's flat fill and comes out looking
 * like dead grey card. Portalling puts the page back behind it. It also
 * stops the menu being clipped by the sheet's scroll box.
 */
export default function GlassSelect({
  value,
  options,
  onChange,
  label,
  placeholder,
  icon,
  className,
}: GlassSelectProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options.find((o) => o.id === value) ?? null;

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (el) setRect(el.getBoundingClientRect());
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  // Flip above the trigger when the menu would run off the bottom.
  const MENU_MAX = 240;
  const below = rect ? window.innerHeight - rect.bottom : 0;
  const flip = rect
    ? below < Math.min(MENU_MAX, options.length * 44 + 12)
    : false;
  // Unfolds from the edge that touches the trigger.
  const menuMotion = menuStagger(flip ? "bottom" : "top", LIST_PACE);

  return (
    <div className={clsx("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        className="flex w-full cursor-pointer items-center gap-2 rounded-xl bg-sunken px-3.5 py-3 text-left transition-colors"
      >
        {icon && <span className="shrink-0 opacity-75">{icon}</span>}
        {/* The value rolls when it changes. The inner span truncates for
            itself: an inline-block inside a truncating parent is replaced
            whole by the ellipsis. */}
        <span className="relative min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={current?.id ?? ""}
              {...swap}
              className={clsx(
                "block truncate font-sans text-[calc(13px*var(--ws-fs))] font-medium",
                current ? "text-primary" : "text-subtle",
              )}
            >
              {current?.label ?? placeholder ?? ""}
            </motion.span>
          </AnimatePresence>
        </span>
        <CaretDown
          size={12}
          weight="bold"
          className={clsx(
            "shrink-0 opacity-60 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {/* The portal stays once the trigger has been measured, and the
          presence inside it decides whether the menu is there: an exit can
          only play if the AnimatePresence outlives the menu. */}
      {rect &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                key="menu"
                ref={menuRef}
                id={listId}
                role="listbox"
                aria-label={label}
                {...menuMotion}
                style={{
                  ...menuMotion.style,
                  position: "fixed",
                  left: rect.left,
                  width: rect.width,
                  ...(flip
                    ? { bottom: window.innerHeight - rect.top + 6 }
                    : { top: rect.bottom + 6 }),
                  maxHeight: MENU_MAX,
                }}
                /* Theme-following now: this menu opens inside sheets that turn
                   white in light mode, where fixed-dark creator glass read as a
                   black slab with invisible ink. */
                className="z-toast overflow-y-auto no-scrollbar rounded-xl glass-frost backdrop-blur-2xl backdrop-saturate-150 py-1.5"
              >
                {options.map((option, i) => {
                  const active = option.id === value;
                  return (
                    <motion.button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      variants={i < CASCADE_ROWS ? staggerItem : undefined}
                      onClick={() => {
                        onChange(option.id);
                        setOpen(false);
                      }}
                      className={clsx(
                        "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors cursor-pointer",
                        // Theme washes: the frost behind this follows the
                        // theme, so an off-white tint vanished on paper.
                        active ? "bg-primary/10" : "hover:bg-primary/5",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-sans text-[calc(13px*var(--ws-fs))] font-medium text-primary">
                          {option.label}
                        </span>
                        {option.hint && (
                          <span className="block truncate font-sans text-[calc(11px*var(--ws-fs))] text-muted">
                            {option.hint}
                          </span>
                        )}
                      </span>
                      {active && (
                        <motion.span
                          variants={staggerPop}
                          className="flex shrink-0 text-gold"
                        >
                          <Check size={13} weight="bold" />
                        </motion.span>
                      )}
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
