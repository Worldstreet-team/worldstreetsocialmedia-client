"use client";

import clsx from "clsx";

export type BadgeTone = "brand" | "danger" | "neutral";

export interface BadgeProps {
  /** Count mode. Renders nothing at 0 unless `dot` is set. */
  count?: number;
  /** Dot mode: presence only, no number. Wins over `count`. */
  dot?: boolean;
  /** Above this, renders `${max}+`. */
  max?: number;
  tone?: BadgeTone;
  /** Page-coloured halo so the pill separates from the glyph beneath. */
  ring?: boolean;
  /** Screen-reader text. */
  label?: string;
  /** Positioning only. The badge never positions itself. */
  className?: string;
}

const BASE_COUNT =
  "pointer-events-none inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-pill font-sans text-[9px] font-bold leading-none tabular-nums";

const BASE_DOT = "pointer-events-none inline-block h-2 w-2 rounded-pill";

const TONE: Record<BadgeTone, string> = {
  brand: "bg-brand text-brand-on",
  danger: "bg-danger text-page",
  neutral: "bg-raised text-primary",
};

/**
 * The one count/presence badge. Four hand-rolled variants used to drift across
 * the navs with different sizes, radii, offsets and caps.
 *
 * `ring-*` rather than `border-*`: the box is border-box, so a border eats the
 * dot's 8px instead of haloing it.
 *
 * Cap is 99, not 9. `min-w-4 px-1` already fits "99+", and every active account
 * sat permanently at "9+" before.
 */
export function Badge({
  count,
  dot = false,
  max = 99,
  tone = "brand",
  ring = true,
  label,
  className,
}: BadgeProps) {
  const n = count ?? 0;
  if (!dot && n <= 0) return null;

  if (dot) {
    return (
      <span
        role="status"
        className={clsx(BASE_DOT, TONE[tone], ring && "ring-2 ring-page", className)}
      >
        <span className="sr-only">{label ?? "unread"}</span>
      </span>
    );
  }

  return (
    <span
      role="status"
      aria-label={label ?? `${n} unread`}
      className={clsx(BASE_COUNT, TONE[tone], ring && "ring-1 ring-page", className)}
    >
      {n > max ? `${max}+` : n}
    </span>
  );
}

/**
 * Icon with a badge pinned to it. One canonical anchor so the pill sits inside
 * the hit target instead of overhanging its corner.
 */
export function BadgedIcon({
  children,
  size = 22,
  className,
  ...badge
}: BadgeProps & { children: React.ReactNode; size?: number }) {
  return (
    <span
      className={clsx("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {children}
      <Badge {...badge} className="absolute -top-1 -right-1.5" />
    </span>
  );
}
