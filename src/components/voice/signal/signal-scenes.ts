import type { Fold, Pose, Scene, SceneSet, Sweep } from "@/lib/morph/driver";
import { type Pt, rad, type ShapeKit, shapes } from "@/lib/morph/geometry";

/**
 * "The Signal" (owner pick 2026-10-14): one wire carries the whole Space
 * setup and morphs between scenes. Ported from the approved prototype
 * (signal.html), scene for scene, in its 1000 x 260 band.
 *
 *   quiet   the flat line, a brand dot at its end
 *   name    the line carries a travelling wave while the room is named
 *   people  one seat per audience: your followers (brand), then a card per
 *           community; the line arches under each seat
 *   spiral  going live now: the wire coils into a turning broadcast spiral
 *   clock   scheduled: the wire is the face, the hands point at the time
 *   voice   the mic check: the wave's height follows the input level
 *   heard   the mic was heard: a calm brand wave
 *   live    the wire closes into a ring that ripples with the room
 *
 * The cast is fixed (ring, wire, six seats, two hands, the dot), so every
 * change is a morph. The counts and the time are inputs to
 * `createSignalScenes`, never module state.
 */

export const SIGNAL_SCENES = [
  "quiet",
  "name",
  "people",
  "spiral",
  "clock",
  "voice",
  "heard",
  "live",
] as const;
export type SignalSceneId = (typeof SIGNAL_SCENES)[number];

export const SIGNAL_VIEWBOX = "0 0 1000 260";
/** Communities a room can go to; each takes a seat beside your followers'. */
export const SIGNAL_MAX_AUDIENCE = 3;

const CAST = [
  "ring",
  "wire",
  "n1",
  "n2",
  "n3",
  "n4",
  "n5",
  "n6",
  "hand1",
  "hand2",
  "dot",
] as const;
const PAINTS = [
  "wire",
  "wireHi",
  "wireLive",
  "wireThick",
  "hi",
  "card",
  "mute",
  "soft",
  "liveLine",
  "live",
] as const;
/** 160 segments per part: the wire is 80 out and 80 back. */
const N = 160;

/* The band's geometry. */
const Y = 150;
const X0 = 60;
const X1 = 940;
const C: Pt = [500, 140];
/** Points along a traced line: N / 2 + 1, so Catmull-Rom gives exactly N / 2 pieces. */
const P = N / 2 + 1;
const TAU = Math.PI * 2;

const F = (x: number, y: number): Fold => ({ fold: [x, y] });
const X: Sweep = { kind: "x", a: X0, b: X1 };
const ANG: Sweep = { kind: "angle", c: C, start: -90 };
const RAD: Sweep = { kind: "radius", c: C, max: 140 };
/**
 * The hands wait folded at the clock's centre in every scene. Folded at a
 * line scene's focus (the prototype's default) they would turn in from the
 * far left, because a polar part travels round its centre, not straight.
 */
const HANDS_HOME = { hand1: F(C[0], C[1]), hand2: F(C[0], C[1]) };

type StaticId = Exclude<SignalSceneId, "people" | "clock">;
type Base = { S: ShapeKit; scenes: Record<StaticId, Scene> };

let base: Base | null = null;
const peopleCache = new Map<number, Scene>();
const clockCache = new Map<string, Scene>();

/** Built on first use, never at import: the server never needs the outlines. */
function getBase(): Base {
  if (base) return base;
  const S = shapes(N);

  /** Ends pinned, so a carrier never drags the line off its ends. */
  const pin = (t: number) => Math.min(1, t * 9, (1 - t) * 9);
  const bell = (t: number) => Math.sin(Math.PI * t) ** 1.3;
  const trace = (fn: (t: number, x: number) => number) =>
    S.smoothOpen(
      Array.from({ length: P }, (_, i): Pt => {
        const t = i / (P - 1);
        const x = X0 + (X1 - X0) * t;
        return [x, Y + fn(t, x)];
      }),
    );
  /** A carrier travelling left to right, one wavelength per period. */
  const carrier = (amp: number, len: number, period: number) => (e: number) =>
    trace(
      (t, x) =>
        amp * pin(t) * Math.sin((TAU * (x - X0)) / len - (TAU * e) / period),
    );
  /** Height follows the level; two travelling frequencies keep it reading as speech, not a loop. */
  const voice = (e: number, l: number) => {
    const amp = 6 + 74 * l;
    return trace(
      (t, x) =>
        amp *
        bell(t) *
        (0.62 * Math.sin((TAU * x) / 64 - (TAU * e) / 520) +
          0.38 * Math.sin((TAU * x) / 37 + (TAU * e) / 830)),
    );
  };
  /** The live ring ripples with the room. */
  const liveRing = (e: number, l: number) =>
    S.smoothLoop(
      S.ringPoints(
        C[0],
        C[1],
        (th) =>
          70 +
          (2 + 9 * l) * Math.sin(5 * th - (TAU * e) / 1400) +
          (1 + 3 * l) * Math.sin(9 * th + (TAU * e) / 900),
      ),
    );
  /** The spiral turns so its arms flow outward. */
  const spiral = (e: number) =>
    S.smoothOpen(
      Array.from({ length: P }, (_, i): Pt => {
        const u = i / (P - 1);
        const th = u * 3.4 * TAU - Math.PI / 2 - (TAU * e) / 4200;
        const r = 9 + u * 76;
        return [C[0] + r * Math.cos(th), C[1] + r * Math.sin(th)];
      }),
    );

  const archCx = [290, 374, 458, 542, 626, 710];
  /** The seats wait folded on the line, so they rise out of it. */
  const onLine = Object.fromEntries(
    archCx.map((x, i) => [`n${i + 1}`, F(x, Y)]),
  );
  const endDot: Pose = {
    d: S.circle(X1 + 6, Y, 5),
    paint: "hi",
    idle: { kind: "blink" },
    small: true,
  };
  const ringOf = (
    count: number,
    r: (a: number) => Pt,
    pose: (i: number, at: Pt) => Pose,
  ) =>
    Object.fromEntries(
      Array.from({ length: count }, (_, i) => [`n${i + 1}`, pose(i, r(i))]),
    );

  const scenes: Record<StaticId, Scene> = {
    quiet: {
      focus: [X0, Y],
      sweep: X,
      parts: {
        wire: { d: S.line([X0, Y], [X1, Y]), paint: "wire", wire: true },
        dot: endDot,
        ...onLine,
        ...HANDS_HOME,
      },
    },
    name: {
      focus: [X0, Y],
      sweep: X,
      parts: {
        wire: { live: carrier(7, 170, 2400), paint: "wire", wire: true },
        dot: endDot,
        ...onLine,
        ...HANDS_HOME,
      },
    },
    spiral: {
      focus: C,
      sweep: RAD,
      parts: {
        wire: { live: spiral, paint: "wireHi", wire: true },
        dot: {
          d: S.circle(C[0], C[1], 8),
          paint: "hi",
          idle: { kind: "pulse" },
          small: true,
        },
        ...ringOf(
          6,
          (i) => {
            const a = rad(-150 + i * 60);
            return [C[0] + 188 * Math.cos(a), C[1] + 106 * Math.sin(a)];
          },
          (i, at) => ({
            d: S.circle(at[0], at[1], 4),
            paint: "mute",
            idle: { kind: "blink", offset: i * 0.2 },
            small: true,
          }),
        ),
      },
    },
    voice: {
      focus: [X0, Y],
      sweep: X,
      parts: {
        wire: { live: voice, paint: "wire", wire: true },
        ...onLine,
        ...HANDS_HOME,
      },
    },
    heard: {
      focus: [X0, Y],
      sweep: X,
      parts: {
        wire: { live: carrier(10, 140, 2000), paint: "wireHi", wire: true },
        dot: {
          d: S.circle(X1 + 6, Y, 6),
          paint: "hi",
          idle: { kind: "pulse" },
          small: true,
        },
        ...onLine,
        ...HANDS_HOME,
      },
    },
    live: {
      focus: C,
      sweep: ANG,
      parts: {
        wire: { live: liveRing, paint: "wireLive", wire: true },
        ring: {
          d: S.circle(C[0], C[1], 100),
          paint: "liveLine",
          idle: { kind: "pulse" },
        },
        dot: {
          d: S.circle(C[0], C[1], 11),
          paint: "live",
          idle: { kind: "pulse" },
          small: true,
        },
        ...ringOf(
          6,
          (i) => {
            const a = rad(-90 + i * 60);
            return [C[0] + 124 * Math.cos(a), C[1] + 124 * Math.sin(a)];
          },
          (i, at) => ({
            d: S.circle(at[0], at[1], 3.2),
            paint: "live",
            idle: { kind: "blink", offset: i * 0.2 },
            small: true,
          }),
        ),
      },
    },
  };
  base = { S, scenes };
  return base;
}

/** One seat for your followers (brand), one card per community; the wave raises each seat as it passes. */
function people(audience: number): Scene {
  const hit = peopleCache.get(audience);
  if (hit) return hit;
  const { S } = getBase();
  const n = 1 + audience;
  const xs = Array.from({ length: n }, (_, i) => 500 + (i - (n - 1) / 2) * 96);
  const pen = new S.Pen(X0, Y);
  for (const cx of xs) {
    pen.to(cx - 30, Y);
    pen.arc(cx, Y, 30, 30, 180, 360);
  }
  pen.to(X1, Y);
  const parts: Scene["parts"] = {
    wire: { d: S.stroke(pen.open()), paint: "wire", wire: true },
  };
  const seats: Record<string, Pose | Fold> = {};
  for (let i = 0; i < 6; i++) {
    seats[`n${i + 1}`] =
      i < n
        ? {
            d: S.circle(xs[i], Y - 49, 14),
            paint: i === 0 ? "hi" : "card",
            idle: { kind: "bob", offset: i * 0.18 },
            small: true,
          }
        : F(500, Y);
  }
  const scene: Scene = {
    focus: [X0, Y],
    sweep: X,
    parts: { ...parts, ...seats, ...HANDS_HOME },
  };
  peopleCache.set(audience, scene);
  return scene;
}

/** The wire is the face; the hands point at the time and turn the short way when it changes. */
function clock(time: string): Scene {
  const hit = clockCache.get(time);
  if (hit) return hit;
  const { S } = getBase();
  const [h, m] = time.split(":").map(Number);
  const hourDeg = ((h % 12) + m / 60) * 30 - 90;
  const minDeg = m * 6 - 90;
  const hand = (a: number, len: number) =>
    S.line(C, [C[0] + len * Math.cos(rad(a)), C[1] + len * Math.sin(rad(a))]);
  const parts: Record<string, Pose> = {
    wire: { d: S.ringLine(C[0], C[1], 84), paint: "wire", wire: true },
    hand1: { d: hand(minDeg, 60), paint: "wireThick", polar: C },
    hand2: { d: hand(hourDeg, 38), paint: "wireThick", polar: C },
    dot: { d: S.circle(C[0], C[1], 6), paint: "hi", small: true },
  };
  for (let i = 0; i < 6; i++) {
    const a = rad(-90 + i * 60);
    parts[`n${i + 1}`] = {
      d: S.circle(C[0] + 70 * Math.cos(a), C[1] + 70 * Math.sin(a), 3.2),
      paint: "mute",
      small: true,
    };
  }
  const scene: Scene = { focus: C, sweep: ANG, parts };
  // A session picks a handful of times; keep the cache from growing without end.
  if (clockCache.size > 48) clockCache.clear();
  clockCache.set(time, scene);
  return scene;
}

/** 0 to SIGNAL_MAX_AUDIENCE communities, whole numbers. */
export function normalizeAudience(n: number | undefined) {
  const v = Math.floor(Number(n) || 0);
  return Math.max(0, Math.min(SIGNAL_MAX_AUDIENCE, v));
}

/** "H:MM" or "HH:MM" on a 24 hour clock; anything else rests the hands at 12. */
export function normalizeClockTime(t: string | undefined) {
  const m = /^\s*(\d{1,2}):(\d{2})/.exec(t ?? "");
  if (!m) return "12:00";
  const h = Number(m[1]) % 24;
  const min = Number(m[2]) % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export type SignalInputs = {
  /** Communities the room goes to (0 to 3); your followers always take the first seat. */
  audience?: number;
  /** "HH:MM", where the clock's hands point. */
  clockTime?: string;
};

/** The Signal's scenes for these inputs. Cheap to call again: the outlines are cached. */
export function createSignalScenes(inputs: SignalInputs = {}): SceneSet {
  const { scenes } = getBase();
  return {
    N,
    cast: CAST,
    paints: PAINTS,
    first: "quiet",
    viewBox: SIGNAL_VIEWBOX,
    scenes: {
      ...scenes,
      people: people(normalizeAudience(inputs.audience)),
      clock: clock(normalizeClockTime(inputs.clockTime)),
    },
  };
}
