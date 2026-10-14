"use client";

import { useLayoutEffect, useRef } from "react";
import { type MorphClasses, MorphDriver } from "@/lib/morph/driver";
import { cn } from "@/lib/utils";
import s from "./signal.module.css";
import {
  createSignalScenes,
  normalizeAudience,
  normalizeClockTime,
  SIGNAL_VIEWBOX,
  type SignalSceneId,
} from "./signal-scenes";

export {
  SIGNAL_MAX_AUDIENCE,
  SIGNAL_SCENES,
  type SignalSceneId,
} from "./signal-scenes";

/** The module's hashed names, in the shape the driver writes them. Shared by SpaceEmptyArt. */
export const morphClasses: MorphClasses = {
  path: s.path,
  beat: s.beat,
  paint: (name) => s[name] ?? "",
  // Idle kinds are camel-cased with an "i" so they never collide with a paint name.
  idle: (kind) => s[`i${kind.charAt(0).toUpperCase()}${kind.slice(1)}`] ?? "",
};

export type SignalArtProps = {
  scene: SignalSceneId;
  /** Communities the room goes to, 0 to 3. Your followers always take the first seat. */
  audience?: number;
  /** "HH:MM": where the clock scene's hands point. */
  clockTime?: string;
  /** The live input level, 0 to 1, read every frame (the mic check, the room once live). */
  level?: () => number;
  /** Defaults to the full band, "0 0 1000 260"; a phone can crop it, e.g. "200 0 600 260". */
  viewBox?: string;
  className?: string;
};

/**
 * The Signal: one wire that carries the whole Space setup and morphs
 * between scenes (see ./signal-scenes.ts for the story, and
 * src/lib/morph/driver.ts for the motion rules).
 *
 * Keep ONE mounted for the whole flow and change `scene`. Keying it per
 * step, or rendering it conditionally per step, remounts the driver and
 * replays the entrance instead of morphing.
 *
 * - A change to `audience` re-runs the people scene and a change to
 *   `clockTime` re-runs the clock, so seats slide and hands turn in place.
 * - Decorative: aria-hidden, the words around it carry the meaning.
 * - Never clipped: parts overshoot and grow mid-morph, so give it padding
 *   and a box with the viewBox's aspect, and keep that box's height stable.
 */
export function SignalArt({
  scene,
  audience = 0,
  clockTime = "20:00",
  level,
  viewBox,
  className,
}: SignalArtProps) {
  const svg = useRef<SVGSVGElement>(null);
  const driver = useRef<MorphDriver | null>(null);
  const aud = normalizeAudience(audience);
  const time = normalizeClockTime(clockTime);

  // The newest props, for the mount effect (which also re-runs on Fast Refresh).
  const latest = useRef({ scene, aud, time, level });
  useLayoutEffect(() => {
    latest.current = { scene, aud, time, level };
  });
  // The inputs the driver's scene set was built from.
  const built = useRef({ aud, time });

  useLayoutEffect(() => {
    const el = svg.current;
    if (!el) return;
    const now = latest.current;
    built.current = { aud: now.aud, time: now.time };
    const d = new MorphDriver(
      el,
      createSignalScenes({ audience: now.aud, clockTime: now.time }),
      {
        level: () => latest.current.level?.() ?? 0,
        initial: now.scene,
        classes: morphClasses,
      },
    );
    driver.current = d;
    return () => {
      d.destroy();
      driver.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    driver.current?.go(scene);
  }, [scene]);

  useLayoutEffect(() => {
    const d = driver.current;
    if (!d) return;
    const was = built.current;
    if (was.aud === aud && was.time === time) return;
    built.current = { aud, time };
    d.setScenes(createSignalScenes({ audience: aud, clockTime: time }));
    // Re-run the scene that shows the input; any other picks it up when it is next shown.
    if (
      (d.scene === "people" && was.aud !== aud) ||
      (d.scene === "clock" && was.time !== time)
    )
      d.go(d.scene, true);
  }, [aud, time]);

  return (
    <svg
      ref={svg}
      viewBox={viewBox ?? SIGNAL_VIEWBOX}
      aria-hidden="true"
      focusable="false"
      overflow="visible"
      data-scene={scene}
      className={cn(s.art, "block h-auto w-full overflow-visible", className)}
    />
  );
}
