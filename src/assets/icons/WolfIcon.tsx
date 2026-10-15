"use client";

import { useId } from "react";
import m from "./mark-motion.module.css";

/**
 * Wolf of WorldStreet.
 *
 * A faceted mascot rather than a flat glyph, the way MetaMask's fox reads as a
 * character instead of an icon. Planes are cut so the light side and shadow
 * side stay legible at 14px, where a detailed illustration would turn to mush.
 *
 * Gold is used here even though gold is normally reserved: this is a brand
 * moment by definition, and it is capped at badge size so it never becomes a
 * large fill.
 */
export function WolfIcon({
  size = 16,
  tier,
  title = "Wolf of WorldStreet",
  shine = false,
}: {
  size?: number;
  tier?: "champion" | "finalist" | "contender";
  title?: string;
  /** A glint that crosses the facets every six seconds. Only the rail's
   *  Wolf card; still under reduced motion. (Ear twitches and a blink were
   *  tried on 2026-10-15 and read as fidgeting, owner: "annoying".) */
  shine?: boolean;
}) {
  // Champion is the full gold pelt; the lower tiers desaturate toward stone.
  //
  // NOT readable without a second glyph, despite what this comment used to
  // claim: champion and finalist sit 2.5:1 apart in luminance and finalist
  // and contender 1.6:1, both under the 3:1 floor for non-text, and all
  // three are one hue family. Three tiers cannot all separate by luminance
  // in a range that stays visible on the dark ground, so the real fix is
  // 1/2/3 pips under the mark, revealed by html[data-ws-cues] - which
  // changes the mark's footprint everywhere it is used and so is a layout
  // decision, not a colour one. Until then a leaderboard row must name the
  // standing in text beside this mark; the <title> below is assistive-only
  // and a sighted colour-blind reader gets nothing from it.
  const light =
    tier === "contender" ? "#A8A29E" : tier === "finalist" ? "#D6B76B" : "#F5CE4E";
  const mid =
    tier === "contender" ? "#78716C" : tier === "finalist" ? "#B08D3C" : "#EAB308";
  const dark =
    tier === "contender" ? "#57534E" : tier === "finalist" ? "#7A5F22" : "#A9770A";
  // Per-instance ids, as in VerifiedIcon.
  const uid = useId();
  const clip = `wc-${uid}`;
  const band = `wb-${uid}`;

  // Every plane once: drawn in its fill, and (with shine) unioned into the
  // clip the glint is cut to.
  const planes: [string, string][] = [
    // ears
    ["M4.4 2.6 L8.9 6.2 L6.2 9.9 L3.3 6.6 Z", mid],
    ["M19.6 2.6 L15.1 6.2 L17.8 9.9 L20.7 6.6 Z", dark],
    ["M5.3 4.6 L7.9 6.7 L6.5 8.6 Z", light],
    ["M18.7 4.6 L16.1 6.7 L17.5 8.6 Z", mid],
    // skull, split down the centre so the two planes catch light differently
    ["M12 4.9 L18.4 8.4 L19.4 14.1 L12 16.6 Z", dark],
    ["M12 4.9 L5.6 8.4 L4.6 14.1 L12 16.6 Z", mid],
    // brow highlight
    ["M12 6.4 L16.8 9.1 L12 10.7 Z", mid],
    ["M12 6.4 L7.2 9.1 L12 10.7 Z", light],
    // muzzle
    ["M12 16.6 L15.9 14.4 L14.6 19.3 L12 21.4 Z", mid],
    ["M12 16.6 L8.1 14.4 L9.4 19.3 L12 21.4 Z", light],
    ["M12 18.2 L13.6 19.5 L12 21.4 L10.4 19.5 Z", dark],
    // eyes, cut as negative wedges so they read at small sizes
    ["M8.4 10.6 L10.6 11.5 L8.9 12.6 L7.7 11.6 Z", "#1C1917"],
    ["M15.6 10.6 L13.4 11.5 L15.1 12.6 L16.3 11.6 Z", "#1C1917"],
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label={title}
      className="shrink-0"
    >
      <title>{title}</title>
      {shine && (
        <defs>
          <clipPath id={clip}>
            {planes.map(([d]) => (
              <path key={d} d={d} />
            ))}
          </clipPath>
          <linearGradient id={band} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>
      )}

      {planes.map(([d, fill]) => (
        <path key={d} d={d} fill={fill} />
      ))}

      {shine && (
        // A slanted band parked off the left edge; the loop carries it
        // across and off the right, so at rest there is nothing to see.
        <g clipPath={`url(#${clip})`}>
          <g transform="rotate(20 12 12)">
            <rect className={m.wolfGlint} x="-14" y="-8" width="7" height="40" fill={`url(#${band})`} />
          </g>
        </g>
      )}
    </svg>
  );
}

export default WolfIcon;
