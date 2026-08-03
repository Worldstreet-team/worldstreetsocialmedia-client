"use client";

import { SealCheck } from "@phosphor-icons/react";
import type { IconProps } from "@/app/types";

/**
 * Verified badge — Phosphor SealCheck (filled), always brand gold. The scalloped
 * seal reads as "verified" instantly; gold keeps it a brand moment per the
 * design system. `color` is accepted for old call sites but ignored — verified
 * is gold on every theme, never blue.
 */
const VerifiedIcon = ({ size }: IconProps) => {
  const px = size?.width ? Number.parseInt(size.width, 10) : 18;
  return (
    <SealCheck
      size={px}
      weight="fill"
      className="text-gold shrink-0"
      aria-label="Verified"
    />
  );
};

export default VerifiedIcon;
