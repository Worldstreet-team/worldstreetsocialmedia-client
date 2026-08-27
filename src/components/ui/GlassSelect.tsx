"use client";

import { CaretDown, Check } from "@phosphor-icons/react";
import clsx from "clsx";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

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
        <span
          className={clsx(
            "min-w-0 flex-1 truncate font-sans text-[13px] font-medium",
            current ? "text-primary" : "text-subtle",
          )}
        >
          {current?.label ?? placeholder ?? ""}
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

      {open &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={label}
            style={{
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
            {options.map((option) => {
              const active = option.id === value;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className={clsx(
                    "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors cursor-pointer",
                    active ? "bg-[#fafaf9]/10" : "hover:bg-[#fafaf9]/[0.06]",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-sans text-[13px] font-medium text-primary">
                      {option.label}
                    </span>
                    {option.hint && (
                      <span className="block truncate font-sans text-[11px] text-muted">
                        {option.hint}
                      </span>
                    )}
                  </span>
                  {active && (
                    <Check
                      size={13}
                      weight="bold"
                      className="shrink-0 text-gold"
                    />
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
