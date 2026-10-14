"use client";

import { useLayoutEffect, useRef } from "react";
import {
  type Fold,
  MorphDriver,
  type Pose,
  type SceneSet,
} from "@/lib/morph/driver";
import { type Pt, rad, shapes } from "@/lib/morph/geometry";
import { cn } from "@/lib/utils";
import { morphClasses } from "./SignalArt";
import s from "./signal.module.css";

export const SPACE_EMPTY_KINDS = [
  "live",
  "upcoming",
  "search",
  "offline",
] as const;
export type SpaceEmptyKind = (typeof SPACE_EMPTY_KINDS)[number];

export const SPACE_EMPTY_VIEWBOX = "0 0 240 140";

/*
 * The Space Voice empty states in the Signal's language: the same wire,
 * smaller, waiting. Designed together so each part has a sensible job in
 * every neighbour (the morphing-svg-art skill's "Making new scenes"):
 *
 *   part    live              upcoming           search             offline
 *   wire    the flat line     the clock face     lens and handle    left half, bent up at the cut
 *   s1      an empty seat     9 o'clock tick     (folded)           (folded)
 *   s2      an empty seat     3 o'clock tick     dashed ring        right half, bent down
 *   t3      (on the line)     12 o'clock tick    a speck            a spark at the cut
 *   t4      (on the line)     6 o'clock tick     (folded)           a spark at the cut
 *   hand1   (at the centre)   long hand at 12    the grip           (at the centre)
 *   hand2   (at the centre)   short hand at 12   the lens glint     (at the centre)
 *   dot     brand, breathing  brand pin, ticks   (folded)           grey: the signal stops short
 *
 * One idle beat per scene: the dot breathes, the clock ticks, the dashed
 * ring turns, the sparks flicker.
 */

/** 96 segments: the wire is 48 out and 48 back, plenty at this size. */
const N = 96;
const CAST = ["wire", "s1", "s2", "t3", "t4", "hand1", "hand2", "dot"] as const;
const PAINTS = [
  "wire",
  "wireThick",
  "grip",
  "hi",
  "mute",
  "soft",
  "seat",
] as const;

const Y = 84;
const X0 = 26;
const X1 = 204;
/** The clock's centre, where the hands wait in every other scene. */
const C: Pt = [120, 70];
/** The magnifier's lens. */
const M: Pt = [96, 64];
const LENS = 28;

const F = (p: Pt): Fold => ({ fold: p });

let cached: SceneSet | null = null;

function emptyScenes(): SceneSet {
  if (cached) return cached;
  const S = shapes(N);
  const hands = { hand1: F(C), hand2: F(C) };

  const live: Record<string, Pose | Fold> = {
    wire: { d: S.line([X0, Y], [X1, Y]), paint: "wire", wire: true },
    s1: { d: S.circle(102, Y - 17, 14), paint: "seat" },
    s2: { d: S.circle(140, Y - 17, 14), paint: "seat" },
    t3: F([121, Y]),
    t4: F([121, Y]),
    dot: {
      d: S.circle(X1 + 10, Y, 4.5),
      paint: "hi",
      idle: { kind: "breathe" },
      small: true,
    },
    ...hands,
  };

  const tick = (a: number): Pose => ({
    d: S.circle(
      C[0] + 32 * Math.cos(rad(a)),
      C[1] + 32 * Math.sin(rad(a)),
      2.2,
    ),
    paint: "mute",
    small: true,
  });
  const upcoming: Record<string, Pose | Fold> = {
    wire: { d: S.ringLine(C[0], C[1], 40), paint: "wire", wire: true },
    s1: tick(180),
    s2: tick(0),
    t3: tick(-90),
    t4: tick(90),
    hand1: {
      d: S.line(C, [C[0], C[1] - 24]),
      paint: "wireThick",
      polar: C,
      idle: { kind: "nudge", origin: C },
    },
    hand2: { d: S.line(C, [C[0], C[1] - 15]), paint: "wireThick", polar: C },
    dot: {
      d: S.circle(C[0], C[1], 3.6),
      paint: "hi",
      small: true,
      idle: { kind: "tick" },
    },
  };

  // The lens and its handle as one stroke: from the handle's end, up to the
  // rim, then once round the lens clockwise back to the same point.
  const along = (r: number): Pt => [
    M[0] + r * Math.cos(rad(45)),
    M[1] + r * Math.sin(rad(45)),
  ];
  const rim = along(LENS);
  const end = along(LENS + 34);
  const lens = new S.Pen(end[0], end[1])
    .to(rim[0], rim[1])
    .arc(M[0], M[1], LENS, LENS, 45, 405);
  const search: Record<string, Pose | Fold> = {
    wire: { d: S.stroke(lens.open()), paint: "wire", wire: true },
    // Polar about the lens, so the clock's long hand swings down into the grip
    // instead of sliding across the face.
    hand1: { d: S.line(along(LENS + 15), end), paint: "grip", polar: M },
    hand2: { d: S.arcLine(M[0], M[1], 18, 198, 244), paint: "soft" },
    s1: F(M),
    s2: { d: S.circle(160, 40, 11), paint: "seat", idle: { kind: "spin" } },
    t3: { d: S.circle(178, 60, 2), paint: "mute", small: true },
    t4: F(M),
    dot: F(M),
  };

  // Broken: the halves bend away from each other at the cut.
  const left = new S.Pen(X0, Y).to(102, Y).cu(106, Y, 109, Y - 1.5, 112, Y - 5);
  const right = new S.Pen(128, Y + 5)
    .cu(131, Y + 1.5, 134, Y, 138, Y)
    .to(X1, Y);
  const offline: Record<string, Pose | Fold> = {
    wire: { d: S.stroke(left.open()), paint: "wire", wire: true },
    s2: { d: S.stroke(right.open()), paint: "wire" },
    s1: F([120, Y]),
    t3: {
      d: S.circle(117, Y - 11, 1.7),
      paint: "mute",
      small: true,
      idle: { kind: "blink" },
    },
    t4: {
      d: S.circle(123, Y + 10, 1.7),
      paint: "mute",
      small: true,
      idle: { kind: "blink", offset: 0.7 },
    },
    dot: { d: S.circle(X1 + 10, Y, 4.5), paint: "mute", small: true },
    ...hands,
  };

  cached = {
    N,
    cast: CAST,
    paints: PAINTS,
    first: "live",
    viewBox: SPACE_EMPTY_VIEWBOX,
    scenes: {
      live: { focus: [X0, Y], sweep: { kind: "x", a: X0, b: X1 }, parts: live },
      upcoming: {
        focus: C,
        sweep: { kind: "angle", c: C, start: -90 },
        parts: upcoming,
      },
      // The change runs from the handle round the lens, clockwise.
      search: {
        focus: M,
        sweep: { kind: "angle", c: M, start: 45 },
        parts: search,
      },
      offline: {
        focus: [X0, Y],
        sweep: { kind: "x", a: X0, b: X1 },
        parts: offline,
      },
    },
  };
  return cached;
}

/**
 * The art for a Space Voice empty state. One driver for the component's
 * life: when `kind` changes (a search that finds nothing, then a load that
 * fails) the wire morphs into the next picture instead of swapping it.
 * Keep it mounted across kinds; keying it replays the entrance.
 */
export function SpaceEmptyArt({
  kind,
  className,
}: {
  kind: SpaceEmptyKind;
  className?: string;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const driver = useRef<MorphDriver | null>(null);
  const latest = useRef(kind);
  useLayoutEffect(() => {
    latest.current = kind;
  });

  useLayoutEffect(() => {
    const el = svg.current;
    if (!el) return;
    const d = new MorphDriver(el, emptyScenes(), {
      initial: latest.current,
      classes: morphClasses,
    });
    driver.current = d;
    return () => {
      d.destroy();
      driver.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    driver.current?.go(kind);
  }, [kind]);

  return (
    <svg
      ref={svg}
      viewBox={SPACE_EMPTY_VIEWBOX}
      aria-hidden="true"
      focusable="false"
      overflow="visible"
      data-kind={kind}
      className={cn(s.art, "block h-auto w-full overflow-visible", className)}
    />
  );
}
