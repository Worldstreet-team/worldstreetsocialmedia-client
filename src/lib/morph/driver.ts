/**
 * The morph driver: one living SVG drawing that morphs between scenes.
 * Ported from the morphing-svg-art skill and the approved "Signal"
 * prototype (Space Voice setup, owner 2026-10-14). Geometry: ./geometry.ts.
 *
 * A scene set is a fixed cast of parts. Every part is one outline of N
 * segments in every scene; a scene gives each part a pose (a shape and a
 * paint) or folds it to a point. `go(id)` turns the drawing into that
 * scene, following the signed-off motion rules:
 *
 * 1. Propagation. A swept scene has a direction (x, angle or radius). Each
 *    point of a wire waits for the sweep to reach its TARGET position, then
 *    takes `MORPH.point`. Coincident points (the out and back halves of a
 *    stroke) share a target, so they share a delay and the line never
 *    splits open. Wires may only align their start to segment 0 or N / 2.
 * 2. Other parts in a swept scene start when the sweep reaches their
 *    centre; small parts land with the settle overshoot.
 * 3. Polar parts (clock hands) turn about their centre the short way
 *    round, at once, with the turn ease.
 * 4. Live carriers: a pose may be a function of (elapsedMs, level). At rest
 *    one rAF loop redraws only those parts, with the start rotation the
 *    morph chose; it does nothing off screen or in a hidden tab, and a new
 *    morph begins from the current live frame.
 * 5. Paint is CSS classes on theme tokens. During a morph fill, stroke,
 *    width and dash blend in JS from values read off hidden probe paths, and
 *    at rest the class takes over again, so light and dark both work, even
 *    when the theme switches mid-morph.
 * 6. Idle beats are CSS keyframes on a wrapper <g>, never the path, homed
 *    smoothly when a morph starts. A beat marked `carry` is folded into the
 *    outline instead, so the morph leaves from wherever the beat had taken
 *    the part (a turn or a lift never plays backwards first).
 * 7. Reduced motion (both triggers, via motionReduced): a short crossfade
 *    between still scenes, no carriers, no idle beats.
 *
 * Framework-free on purpose: the React components own one driver each for
 * their whole life and call `go` when a prop changes. Remounting replays
 * the entrance, which is the most common mistake with this engine.
 */

import { motionReduced } from "@/lib/motion";
import {
  EASE_MORPH,
  EASE_MORPH_HOME,
  EASE_MORPH_SETTLE,
  EASE_MORPH_TURN,
  MORPH,
} from "@/lib/motion-presets";
import {
  alignK,
  bounds,
  center,
  deg,
  easing,
  type Outline,
  type Pt,
  point,
  rotate,
  toPath,
} from "./geometry";

/* ---- the scene data ---------------------------------------------------------- */

/** Where a change starts and which way it travels. */
export type Sweep =
  | { kind: "x"; a: number; b: number }
  /** Clockwise from `start` degrees (-90 is 12 o'clock). */
  | { kind: "angle"; c: Pt; start: number }
  | { kind: "radius"; c: Pt; max: number };

/**
 * A CSS loop on the part's wrapper at rest. `origin` is a pivot in user
 * units (default: the part's own centre). `carry`: when a morph starts, the
 * beat's transform is baked into the outline rather than eased home.
 */
export type Idle = { kind: string; offset?: number; origin?: Pt; carry?: boolean };

/** A shape that moves at rest: elapsed milliseconds (scaled by tempo) and a 0 to 1 level. */
export type LiveShape = (elapsedMs: number, level: number) => Outline;

type PoseBase = {
  paint: string;
  /** The wire: swept point by point, start aligned only at 0 or N / 2. */
  wire?: boolean;
  /** Lands with the settle overshoot. */
  small?: boolean;
  /** Turns about this centre instead of travelling straight. */
  polar?: Pt;
  idle?: Idle;
};
export type Pose = PoseBase &
  ({ d: Outline; live?: undefined } | { live: LiveShape; d?: undefined });
/** Not in this scene: shrink to this point (default: the scene's focus) and fade. */
export type Fold = { fold: Pt };
export type PartSpec = Pose | Fold;

export type Scene = {
  /** Where unlisted parts fold to, and where the entrance gathers from. */
  focus: Pt;
  sweep?: Sweep;
  parts: Readonly<Partial<Record<string, PartSpec>>>;
};

export type SceneSet = {
  /** Segments per part; even. */
  N: number;
  /** Part ids, bottom to top. */
  cast: readonly string[];
  /** Every paint any scene uses (one probe each). */
  paints: readonly string[];
  scenes: Readonly<Record<string, Scene>>;
  /** Unknown scene ids fall back to this one. */
  first: string;
  viewBox?: string;
};

export const isPose = (spec: PartSpec | undefined): spec is Pose =>
  !!spec && "paint" in spec;

/** Class names the driver writes; a CSS module passes its hashed names here. */
export type MorphClasses = {
  /** On every part and probe path (line caps). */
  path: string;
  /** On each part's middle <g>, the one idle beats animate. */
  beat: string;
  paint: (name: string) => string;
  idle: (kind: string) => string;
};

export type MorphOptions = {
  /** The live input level, 0 to 1, read every frame by live shapes. */
  level?: () => number;
  /** Stretch every morph and carrier (2 = half speed). 1 in the product. */
  tempo?: number;
  /** The scene to start in (default: the set's first). */
  initial?: string;
  /** Draw the first scene in from its focus (default true). False shows it still. */
  enter?: boolean;
  classes?: Partial<MorphClasses>;
};

const DEFAULT_CLASSES: MorphClasses = {
  path: "p",
  beat: "beat",
  paint: (name) => `pt-${name}`,
  idle: (kind) => `i-${kind}`,
};

/* ---- paint ------------------------------------------------------------------ */

type RGBA = [number, number, number, number];
type Look = { fill: RGBA; stroke: RGBA; width: number; dash: [number, number] };

const CLEAR: RGBA = [0, 0, 0, 0];
const SOLID: Look = { fill: CLEAR, stroke: CLEAR, width: 0, dash: [1, 0] };

let paintCtx: CanvasRenderingContext2D | null | undefined;

/**
 * Any colour the browser resolved, as RGBA. rgb() and color(srgb) are read
 * directly; anything else (the app's tokens include oklch, and grounds may
 * add more) is painted onto a 1px canvas and read back, so a token in any
 * colour space still blends instead of dropping to transparent.
 */
function parseColor(v: string): RGBA {
  const s = v.trim();
  if (!s || s === "none" || s === "transparent") return CLEAR;
  const m = /^(rgba?|color)\(([^)]*)\)$/.exec(s);
  if (m && (m[1] !== "color" || /^\s*srgb\s/.test(m[2]))) {
    const srgb = m[1] === "color";
    const parts = m[2]
      .replace(/^\s*srgb\s+/, "")
      .split(/[\s,/]+/)
      .filter(Boolean);
    const n = (x: string | undefined, max: number) =>
      x === undefined
        ? 1
        : x.endsWith("%")
          ? Number.parseFloat(x) / 100
          : Number.parseFloat(x) / max;
    const out: RGBA = [
      n(parts[0], srgb ? 1 : 255),
      n(parts[1], srgb ? 1 : 255),
      n(parts[2], srgb ? 1 : 255),
      parts[3] === undefined ? 1 : n(parts[3], 1),
    ];
    if (out.every(Number.isFinite)) return out;
  }
  if (paintCtx === undefined) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    paintCtx = c.getContext("2d", { willReadFrequently: true });
  }
  if (!paintCtx) return CLEAR;
  paintCtx.clearRect(0, 0, 1, 1);
  paintCtx.fillStyle = "rgba(0, 0, 0, 0)";
  paintCtx.fillStyle = s;
  paintCtx.fillRect(0, 0, 1, 1);
  const d = paintCtx.getImageData(0, 0, 1, 1).data;
  return [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255];
}

/** Premultiplied, so fading into transparent doesn't pass through black. */
function mixColor(a: RGBA, b: RGBA, t: number): RGBA {
  const al = a[3] + (b[3] - a[3]) * t;
  if (al < 1e-4) return CLEAR;
  const ch = (i: number) =>
    (a[i] * a[3] + (b[i] * b[3] - a[i] * a[3]) * t) / al;
  return [ch(0), ch(1), ch(2), al];
}

const cssColor = (c: RGBA) =>
  `rgb(${(c[0] * 255).toFixed(1)} ${(c[1] * 255).toFixed(1)} ${(c[2] * 255).toFixed(1)} / ${c[3].toFixed(3)})`;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

const EASE = easing(EASE_MORPH);
const SETTLE = easing(EASE_MORPH_SETTLE);
const TURN = easing(EASE_MORPH_TURN);
const HOME_EASE = `cubic-bezier(${EASE_MORPH_HOME.join(", ")})`;

/** Theme attributes on <html> that can change a token mid-morph. */
const THEME_ATTRS = [
  "data-ws-theme",
  "data-ws-palette",
  "data-ws-ground",
  "data-ws-contrast",
  "data-ws-cv",
  "style",
  "data-ws-motion",
];

/** Where along a sweep a point sits, 0 (moves first) to 1 (moves last). */
function sweepFrac(sw: Sweep, x: number, y: number) {
  if (sw.kind === "x") return clamp01((x - sw.a) / (sw.b - sw.a));
  if (sw.kind === "radius")
    return clamp01(Math.hypot(x - sw.c[0], y - sw.c[1]) / sw.max);
  if (Math.hypot(x - sw.c[0], y - sw.c[1]) < 2) return 0;
  let a = deg(Math.atan2(y - sw.c[1], x - sw.c[0])) - sw.start;
  a = ((a % 360) + 360) % 360;
  return a / 360;
}

/* ---- the driver --------------------------------------------------------------- */

const SVGNS = "http://www.w3.org/2000/svg";

type Part = {
  id: string;
  wrap: SVGGElement;
  beat: SVGGElement;
  path: SVGPathElement;
  cur: Outline;
  from: Outline;
  to: Outline;
  /** The start rotation the last morph chose; live frames reuse it. */
  k: number;
  paint: string;
  /** The paint the morph left from, when it left from rest (for a mid-morph theme switch). */
  paintFrom: string | null;
  look: Look;
  lookFrom: Look;
  lookTo: Look;
  op: number;
  opFrom: number;
  opTo: number;
  shown: boolean;
  pose: Pose | null;
  done: boolean;
  delay: number;
  dur: number;
  ease: (t: number) => number;
  polar: Pt | null;
  /** Per-point delays for a swept wire, one per coordinate pair. */
  pd: Float64Array | null;
  pdMid: number;
  pdMin: number;
  idle: string | null;
};

export class MorphDriver {
  private set: SceneSet;
  private readonly svg: SVGSVGElement;
  private readonly cls: MorphClasses;
  private readonly level: () => number;
  private tempo: number;
  private readonly layer: SVGGElement;
  private probes: SVGGElement;
  private looks: Record<string, Look> = {};
  private readonly parts: Part[];
  private sceneId: string;
  private raf = 0;
  private liveRaf = 0;
  private restTimer = 0;
  private t0 = 0;
  private lives: Part[] = [];
  private liveClock = 0;
  private liveLast = 0;
  private resting = false;
  private reduced: boolean;
  private offscreen = false;
  private dead = false;
  private readonly ghosts = new Set<Element>();
  private readonly io: IntersectionObserver | null;
  private readonly mo: MutationObserver | null;

  constructor(svg: SVGSVGElement, set: SceneSet, options: MorphOptions = {}) {
    if (set.N % 2 !== 0) throw new Error("morph: N must be even");
    this.svg = svg;
    this.set = set;
    this.cls = { ...DEFAULT_CLASSES, ...options.classes };
    const level = options.level;
    this.level = level ? () => clamp01(Number(level()) || 0) : () => 0;
    this.tempo = options.tempo && options.tempo > 0 ? options.tempo : 1;
    this.reduced = motionReduced();

    this.layer = document.createElementNS(SVGNS, "g");
    svg.appendChild(this.layer);
    this.probes = this.makeProbes();
    this.readLooks();

    this.sceneId =
      options.initial && set.scenes[options.initial]
        ? options.initial
        : set.first;
    const first = this.sceneOf(this.sceneId);
    this.parts = set.cast.map((id) => {
      const wrap = document.createElementNS(SVGNS, "g");
      const beat = document.createElementNS(SVGNS, "g");
      const path = document.createElementNS(SVGNS, "path");
      wrap.setAttribute("data-part", id);
      beat.setAttribute("class", this.cls.beat);
      const spec = first.parts[id];
      const pose = isPose(spec) ? spec : null;
      const at = spec && "fold" in spec ? spec.fold : first.focus;
      const d = pose ? this.shapeOf(pose, 0) : point(set.N, at[0], at[1]);
      const paint = pose ? pose.paint : set.paints[0];
      path.setAttribute("class", `${this.cls.path} ${this.cls.paint(paint)}`);
      path.setAttribute("d", toPath(d));
      beat.appendChild(path);
      wrap.appendChild(beat);
      this.layer.appendChild(wrap);
      const op = pose ? 1 : 0;
      wrap.style.opacity = String(op);
      const look = this.looks[paint] ?? SOLID;
      return {
        id,
        wrap,
        beat,
        path,
        cur: d.slice(),
        from: d,
        to: d,
        k: 0,
        paint,
        paintFrom: paint,
        look,
        lookFrom: look,
        lookTo: look,
        op,
        opFrom: op,
        opTo: op,
        shown: Boolean(pose),
        pose,
        done: true,
        delay: 0,
        dur: 0,
        ease: EASE,
        polar: null,
        pd: null,
        pdMid: 0,
        pdMin: 0,
        idle: null,
      };
    });

    document.addEventListener("visibilitychange", this.onVisibility);
    this.io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            const entry = entries[entries.length - 1];
            this.offscreen = entry ? !entry.isIntersecting : false;
            this.onVisibility();
          });
    this.io?.observe(svg);
    this.mo =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(this.onDocument);
    this.mo?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: THEME_ATTRS,
    });
    this.onVisibility();

    if (options.enter === false) this.startRest();
    else this.enter();
  }

  /** The scene shown now, or being morphed to. */
  get scene() {
    return this.sceneId;
  }

  /** Turn the drawing into scene `id`. `force` re-runs the current scene (its inputs changed). */
  go(id: string, force = false) {
    if (this.dead) return;
    const sid = this.set.scenes[id] ? id : this.set.first;
    if (sid === this.sceneId && !force) return;
    this.sceneId = sid;
    const next = this.sceneOf(sid);
    const N = this.set.N;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.clearTimeout(this.restTimer);
    this.stopLive();
    this.readLooks();
    this.reduced = motionReduced();
    if (this.reduced) {
      this.homeIdles(true);
      this.cut(next, true);
      return;
    }
    this.homeIdles(false);

    const T = this.tempo;
    const sw = next.sweep;
    let order = 0;
    for (const p of this.parts) {
      const spec = next.parts[p.id];
      p.paintFrom = p.done ? p.paint : null;
      p.from = p.cur.slice();
      p.lookFrom = p.look;
      p.opFrom = p.op;
      p.done = false;
      p.pd = null;
      p.polar = null;
      p.pose = isPose(spec) ? spec : null;
      if (!p.pose) {
        // Not in this scene: fold into its pocket and fade.
        const at = spec && "fold" in spec ? spec.fold : next.focus;
        p.to = point(N, at[0], at[1]);
        p.k = 0;
        p.lookTo = p.look;
        p.opTo = 0;
        p.delay = 0;
        p.dur = MORPH.point * MORPH.foldShare * T;
        p.ease = EASE;
        if (!p.shown && p.op < 0.01) {
          // Already hidden: move the fold at once, nobody sees it.
          p.cur = p.to.slice();
          p.from = p.to;
          p.path.setAttribute("d", toPath(p.cur));
          p.done = true;
        }
        p.shown = false;
        continue;
      }
      const target = this.shapeOf(p.pose, 0);
      const look = this.looks[p.pose.paint] ?? SOLID;
      if (p.op < 0.05) {
        // Arriving unseen: it grows out of a point where it was, already in its new paint.
        const [x, y] = center(p.cur);
        p.from = point(N, x, y);
        p.lookFrom = p.look = look;
        p.paintFrom = p.pose.paint;
      }
      p.k = alignK(
        p.from,
        target,
        p.pose.wire || look.dash[1] > 0 ? [0, N / 2] : undefined,
      );
      p.to = rotate(target, p.k);
      p.lookTo = look;
      this.setPaint(p, p.pose.paint);
      // The class just changed; hold the old look inline until the first frame paints.
      this.writeLook(p, p.lookFrom);
      p.opTo = 1;
      p.shown = true;
      p.polar = p.pose.polar ?? null;
      p.dur = MORPH.point * T;
      p.ease = p.pose.wire
        ? EASE
        : p.polar
          ? TURN
          : p.pose.small
            ? SETTLE
            : EASE;
      if (p.pose.wire && sw) {
        // Rule 1: every point waits for the sweep to reach its target. The two
        // halves of the stroke share targets, so they share delays.
        const n = p.to.length / 2;
        const span = MORPH.sweep[sw.kind] * T;
        p.pd = new Float64Array(n);
        let sum = 0;
        let min = Infinity;
        for (let i = 0; i < n; i++) {
          const v = sweepFrac(sw, p.to[i * 2], p.to[i * 2 + 1]) * span;
          p.pd[i] = v;
          sum += v;
          if (v < min) min = v;
        }
        p.pdMid = sum / n;
        p.pdMin = min;
        p.delay = 0;
      } else if (p.polar) {
        // A new time turns the hands at once; they don't wait for the sweep.
        p.delay = 0;
      } else if (sw) {
        const [cx, cy] = center(p.to);
        p.delay = sweepFrac(sw, cx, cy) * MORPH.sweep[sw.kind] * T;
      } else {
        p.delay = order++ * MORPH.stagger * T;
      }
    }
    this.t0 = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  /** Stretch every morph and carrier from now on (2 = half speed). */
  setTempo(n: number) {
    this.tempo = n > 0 && Number.isFinite(n) ? n : 1;
  }

  /**
   * Swap in a scene set with new inputs (a count, a time). The cast and N
   * must match; nothing moves until the next `go` (use force to re-run).
   */
  setScenes(set: SceneSet) {
    if (this.dead) return;
    if (
      set.N !== this.set.N ||
      set.cast.length !== this.set.cast.length ||
      set.cast.some((id, i) => id !== this.set.cast[i])
    ) {
      throw new Error("morph: a new scene set must keep the same cast and N");
    }
    const paintsChanged =
      set.paints.length !== this.set.paints.length ||
      set.paints.some((p, i) => p !== this.set.paints[i]);
    this.set = set;
    if (paintsChanged) {
      this.probes.remove();
      this.probes = this.makeProbes();
      this.readLooks();
    }
  }

  /** Stop everything and take the drawing back out of the svg. */
  destroy() {
    if (this.dead) return;
    this.dead = true;
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.liveRaf);
    this.raf = this.liveRaf = 0;
    window.clearTimeout(this.restTimer);
    this.lives = [];
    this.io?.disconnect();
    this.mo?.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibility);
    for (const g of this.ghosts) g.remove();
    this.ghosts.clear();
    for (const a of this.layer.getAnimations?.() ?? []) a.cancel();
    this.layer.remove();
    this.probes.remove();
    this.svg.removeAttribute("data-paused");
  }

  /* ---- internals ---- */

  private sceneOf(id: string): Scene {
    return this.set.scenes[id] ?? this.set.scenes[this.set.first];
  }

  /** A pose's shape; a live one at `e` ms. Reduced motion always gets the still frame at rest level. */
  private shapeOf(pose: Pose, e: number): Outline {
    if (pose.live)
      return this.reduced ? pose.live(0, 0) : pose.live(e, this.level());
    return pose.d;
  }

  private makeProbes() {
    const g = document.createElementNS(SVGNS, "g");
    g.style.display = "none";
    for (const name of this.set.paints) {
      const p = document.createElementNS(SVGNS, "path");
      p.setAttribute("d", "M0 0");
      p.setAttribute("class", `${this.cls.path} ${this.cls.paint(name)}`);
      p.setAttribute("data-paint", name);
      g.appendChild(p);
    }
    this.svg.appendChild(g);
    return g;
  }

  /** Every paint's resolved values, read fresh (the theme may have changed). */
  private readLooks() {
    for (const el of Array.from(this.probes.children) as SVGPathElement[]) {
      const cs = getComputedStyle(el);
      const raw = cs.strokeDasharray;
      const dash =
        !raw || raw === "none"
          ? [1, 0]
          : raw.split(/[\s,]+/).map((v) => Number.parseFloat(v) || 0);
      const name = el.getAttribute("data-paint") ?? "";
      this.looks[name] = {
        fill: parseColor(cs.fill),
        stroke: parseColor(cs.stroke),
        width: Number.parseFloat(cs.strokeWidth) || 0,
        dash: [dash[0] ?? 1, dash[1] ?? 0],
      };
    }
  }

  /** The entrance: every part gathers out of the scene's focus. */
  private enter() {
    const [fx, fy] = this.sceneOf(this.sceneId).focus;
    for (const p of this.parts) {
      p.cur = point(this.set.N, fx, fy);
      p.op = 0;
      p.shown = false;
      p.wrap.style.opacity = "0";
      p.path.setAttribute("d", toPath(p.cur));
    }
    this.go(this.sceneId, true);
  }

  private tick = (now: number) => {
    this.raf = 0;
    if (this.dead) return;
    let running = false;
    const el0 = now - this.t0;
    for (const p of this.parts) {
      if (p.done) continue;
      let tPart: number;
      let tOp: number;
      let landed: boolean;
      if (p.pd) {
        // Per point: its own clock, the same ease.
        let any = false;
        for (let i = 0, n = p.pd.length; i < n; i++) {
          const t = clamp01((el0 - p.pd[i]) / p.dur);
          if (t < 1) any = true;
          const e = p.ease(t);
          const j = i * 2;
          p.cur[j] = p.from[j] + (p.to[j] - p.from[j]) * e;
          p.cur[j + 1] = p.from[j + 1] + (p.to[j + 1] - p.from[j + 1]) * e;
        }
        landed = !any;
        tPart = landed ? 1 : clamp01((el0 - p.pdMid) / p.dur);
        // An arriving wire shows from its first point's move, not the middle one's.
        tOp = landed
          ? 1
          : clamp01((el0 - (p.opTo > p.opFrom ? p.pdMin : p.pdMid)) / p.dur);
      } else {
        tPart = clamp01((el0 - p.delay) / p.dur);
        const e = p.ease(tPart);
        if (p.polar) this.lerpPolar(p, p.polar, e);
        else
          for (let i = 0; i < p.cur.length; i++)
            p.cur[i] = p.from[i] + (p.to[i] - p.from[i]) * e;
        tOp = tPart;
        landed = tPart >= 1;
      }
      p.path.setAttribute("d", toPath(p.cur));
      const c = EASE(tPart);
      const a = p.lookFrom;
      const b = p.lookTo;
      p.look = {
        fill: mixColor(a.fill, b.fill, c),
        stroke: mixColor(a.stroke, b.stroke, c),
        width: a.width + (b.width - a.width) * c,
        dash: [
          a.dash[0] + (b.dash[0] - a.dash[0]) * c,
          a.dash[1] + (b.dash[1] - a.dash[1]) * c,
        ],
      };
      this.writeLook(p, p.look);
      // Arrivals fade in over the first part of their trip, departures fade out sooner.
      const o =
        p.opTo > p.opFrom
          ? EASE(clamp01(tOp / MORPH.fadeIn))
          : EASE(clamp01(tOp / MORPH.fadeOut));
      p.op = p.opFrom + (p.opTo - p.opFrom) * o;
      p.wrap.style.opacity = String(Math.round(p.op * 1000) / 1000);
      if (landed) this.settle(p);
      else running = true;
    }
    if (running) this.raf = requestAnimationFrame(this.tick);
    else this.restTimer = window.setTimeout(() => this.startRest(), MORPH.rest);
  };

  /** Hands turn about the centre the short way; they never slide across the face. */
  private lerpPolar(p: Part, c: Pt, e: number) {
    const [cx, cy] = c;
    for (let i = 0; i < p.cur.length; i += 2) {
      const fx = p.from[i] - cx;
      const fy = p.from[i + 1] - cy;
      const tx = p.to[i] - cx;
      const ty = p.to[i + 1] - cy;
      const rf = Math.hypot(fx, fy);
      const rt = Math.hypot(tx, ty);
      if (rf < 0.5 || rt < 0.5) {
        p.cur[i] = p.from[i] + (p.to[i] - p.from[i]) * e;
        p.cur[i + 1] = p.from[i + 1] + (p.to[i + 1] - p.from[i + 1]) * e;
        continue;
      }
      const af = Math.atan2(fy, fx);
      let da = Math.atan2(ty, tx) - af;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da <= -Math.PI) da += 2 * Math.PI;
      const r = rf + (rt - rf) * e;
      const ang = af + da * e;
      p.cur[i] = cx + r * Math.cos(ang);
      p.cur[i + 1] = cy + r * Math.sin(ang);
    }
  }

  /** Land exactly, and hand the paint back to its class. */
  private settle(p: Part) {
    p.done = true;
    p.cur = p.to.slice();
    p.path.setAttribute("d", toPath(p.cur));
    p.look = p.lookTo;
    p.paintFrom = p.paint;
    p.op = p.opTo;
    p.wrap.style.opacity = String(p.opTo);
    this.clearLook(p);
  }

  /** Reduced motion: the new scene, still, crossfaded over the old. */
  private cut(next: Scene, fade: boolean) {
    if (fade && typeof this.layer.animate === "function") {
      const ghost = this.layer.cloneNode(true) as SVGGElement;
      this.layer.after(ghost);
      this.ghosts.add(ghost);
      ghost.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: MORPH.crossfade,
        easing: "linear",
      }).onfinish = () => {
        ghost.remove();
        this.ghosts.delete(ghost);
      };
      this.layer.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: MORPH.crossfade,
        easing: "linear",
      });
    }
    const N = this.set.N;
    for (const p of this.parts) {
      const spec = next.parts[p.id];
      p.pose = isPose(spec) ? spec : null;
      const at = spec && "fold" in spec ? spec.fold : next.focus;
      p.cur = p.pose ? this.shapeOf(p.pose, 0) : point(N, at[0], at[1]);
      p.to = p.cur;
      p.k = 0;
      p.path.setAttribute("d", toPath(p.cur));
      if (p.pose) {
        this.setPaint(p, p.pose.paint);
        p.look = p.lookTo = this.looks[p.pose.paint] ?? SOLID;
      }
      p.paintFrom = p.paint;
      p.shown = Boolean(p.pose);
      p.done = true;
      p.pd = null;
      p.op = p.opTo = p.pose ? 1 : 0;
      p.wrap.style.opacity = String(p.op);
      this.clearLook(p);
    }
  }

  private setPaint(p: Part, paint: string) {
    if (p.paint === paint) return;
    const from = this.cls.paint(p.paint);
    const to = this.cls.paint(paint);
    if (from) p.path.classList.remove(from);
    if (to) p.path.classList.add(to);
    p.paint = paint;
  }

  private writeLook(p: Part, look: Look) {
    const st = p.path.style;
    st.fill = cssColor(look.fill);
    st.stroke = cssColor(look.stroke);
    st.strokeWidth = String(look.width);
    st.strokeDasharray = `${look.dash[0].toFixed(2)} ${look.dash[1].toFixed(2)}`;
  }

  private clearLook(p: Part) {
    const st = p.path.style;
    st.fill = st.stroke = st.strokeWidth = st.strokeDasharray = "";
  }

  /* ---- rest: idle beats and live carriers ---- */

  private startRest() {
    if (this.dead || this.reduced) return;
    this.resting = true;
    for (const p of this.parts) {
      const idle = p.pose?.idle;
      if (!idle || !p.shown) continue;
      const cls = this.cls.idle(idle.kind);
      if (!cls) continue;
      if (p.idle) p.beat.classList.remove(p.idle);
      p.beat.style.transition = "";
      p.beat.style.transform = "";
      p.beat.style.opacity = "";
      p.beat.style.transformOrigin = this.originFor(p, idle);
      p.beat.style.animationDelay = `${(idle.offset ?? 0).toFixed(2)}s`;
      // Re-adding the class restarts the loop, so parts that share one stay in step.
      void p.beat.getBoundingClientRect();
      p.beat.classList.add(cls);
      p.idle = cls;
    }
    this.lives = this.parts.filter((p) => p.pose?.live && p.done && p.shown);
    this.liveClock = 0;
    this.liveLast = performance.now();
    this.runLive();
  }

  /** A shared pivot, measured in the part's own box (beats transform by fill-box). */
  private originFor(p: Part, idle: { origin?: Pt }) {
    if (!idle.origin) return "";
    let x0: number;
    let y0: number;
    try {
      const box = p.path.getBBox();
      x0 = box.x;
      y0 = box.y;
    } catch {
      [x0, y0] = bounds(p.cur);
    }
    return `${(idle.origin[0] - x0).toFixed(2)}px ${(idle.origin[1] - y0).toFixed(2)}px`;
  }

  private runLive() {
    if (
      this.dead ||
      this.liveRaf ||
      !this.lives.length ||
      this.offscreen ||
      document.hidden
    )
      return;
    this.liveRaf = requestAnimationFrame(this.liveFrame);
  }

  private liveFrame = (now: number) => {
    this.liveRaf = 0;
    if (this.dead || this.offscreen || document.hidden) return;
    // Accumulated, so a tempo change or a pause never jumps the phase.
    this.liveClock +=
      Math.min(64, Math.max(0, now - this.liveLast)) / this.tempo;
    this.liveLast = now;
    const lvl = this.level();
    for (const p of this.lives) {
      const live = p.pose?.live;
      if (!live) continue;
      p.cur = rotate(live(this.liveClock, lvl), p.k);
      p.to = p.cur;
      p.path.setAttribute("d", toPath(p.cur));
    }
    this.liveRaf = requestAnimationFrame(this.liveFrame);
  };

  private stopLive() {
    cancelAnimationFrame(this.liveRaf);
    this.liveRaf = 0;
    this.lives = [];
    this.resting = false;
  }

  /**
   * Stop the old scene's loops. A part caught mid-beat eases home from
   * where it was rather than jumping; `instant` just drops them.
   */
  private homeIdles(instant: boolean) {
    const caught: [Part, string, string][] = [];
    for (const p of this.parts) {
      if (!p.idle) continue;
      if (!instant) {
        const cs = getComputedStyle(p.beat);
        const idle = p.pose?.idle;
        let transform = cs.transform;
        if (idle?.carry && transform && transform !== "none") {
          this.carryBeat(p, idle, transform);
          transform = "none";
        }
        caught.push([p, transform, cs.opacity]);
      }
      p.beat.classList.remove(p.idle);
      p.beat.style.animationDelay = "";
      p.idle = null;
    }
    for (const [p, transform, opacity] of caught) {
      p.beat.style.transition = "none";
      p.beat.style.transform = transform === "none" ? "" : transform;
      p.beat.style.opacity = opacity;
    }
    if (caught.length) void this.svg.getBoundingClientRect();
    for (const [p] of caught) {
      p.beat.style.transition = `transform ${MORPH.home}ms ${HOME_EASE}, opacity ${MORPH.home}ms linear`;
      p.beat.style.transform = "";
      p.beat.style.opacity = "";
    }
  }

  /** Bake a beat's current transform into the outline (an Idle with `carry`). */
  private carryBeat(p: Part, idle: Idle, transform: string) {
    let m: DOMMatrixReadOnly;
    try {
      m = new DOMMatrixReadOnly(transform);
    } catch {
      return;
    }
    // The pivot the beat turned about: the idle's origin, or the box centre.
    let ox: number;
    let oy: number;
    if (idle.origin) [ox, oy] = idle.origin;
    else
      try {
        const box = p.path.getBBox();
        ox = box.x + box.width / 2;
        oy = box.y + box.height / 2;
      } catch {
        [ox, oy] = center(p.cur);
      }
    const c = p.cur;
    for (let i = 0; i < c.length; i += 2) {
      const dx = c[i] - ox;
      const dy = c[i + 1] - oy;
      c[i] = ox + m.a * dx + m.c * dy + m.e;
      c[i + 1] = oy + m.b * dx + m.d * dy + m.f;
    }
    p.path.setAttribute("d", toPath(c));
  }

  private onVisibility = () => {
    if (this.dead) return;
    const paused = this.offscreen || document.hidden;
    this.svg.setAttribute("data-paused", String(paused));
    if (!paused && this.resting) {
      this.liveLast = performance.now();
      this.runLive();
    }
  };

  /** The theme or the motion setting moved on <html>. */
  private onDocument = (records: MutationRecord[]) => {
    if (this.dead) return;
    let motion = false;
    let theme = false;
    for (const r of records) {
      if (r.attributeName === "data-ws-motion") motion = true;
      else theme = true;
    }
    if (motion) {
      const reduced = motionReduced();
      if (reduced !== this.reduced) {
        this.reduced = reduced;
        cancelAnimationFrame(this.raf);
        this.raf = 0;
        window.clearTimeout(this.restTimer);
        this.stopLive();
        this.homeIdles(true);
        // Land the current scene still; carriers and beats come back with motion.
        this.readLooks();
        this.cut(this.sceneOf(this.sceneId), false);
        this.startRest();
      }
    }
    // At rest the classes follow the theme on their own; mid-morph the blend
    // must aim at the new values, or it would land on the old theme and snap.
    if (theme && this.raf) {
      this.readLooks();
      for (const p of this.parts) {
        if (p.done) continue;
        const toPaint = p.pose ? p.pose.paint : p.paintFrom;
        if (toPaint && this.looks[toPaint]) p.lookTo = this.looks[toPaint];
        if (p.paintFrom && this.looks[p.paintFrom])
          p.lookFrom = this.looks[p.paintFrom];
      }
    }
  };
}
