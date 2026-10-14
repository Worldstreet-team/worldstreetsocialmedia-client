/**
 * The geometry under the morphing line art (driver: ./driver.ts). Ported
 * from the morphing-svg-art skill and the approved "Signal" prototype.
 *
 * Every part of a drawing is ONE closed outline of exactly N cubic
 * segments, in every scene. Because the structure never changes, turning
 * one scene into the next is plain point-wise interpolation: a flat line
 * can travel, coil and become a clock face without a cut.
 *
 * - Shapes are drawn with a tiny `Pen` (lines, cubics, elliptical arcs),
 *   then resampled to N, splitting the longest pieces first so the points
 *   sit evenly along the edge.
 * - Open lines go out and back over themselves (`stroke`): a closed
 *   outline with no area, so a line can become a ring and back. The two
 *   halves are coincident, which is what lets the driver give both the same
 *   sweep delay so the line never splits open mid-move.
 * - Every closed shape runs clockwise on screen; `alignK` picks the start
 *   segment that travels least, so shapes don't twist on the way.
 * - Numbers only: no DOM, no React.
 */

export type Pt = readonly [number, number];
/** N cubic segments, flattened as `c1x c1y c2x c2y x y` each; the path starts at the last segment's end. */
export type Outline = Float64Array;
/** One cubic: start, two handles, end. */
export type Cubic = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export const rad = (d: number) => (d * Math.PI) / 180;
export const deg = (r: number) => (r * 180) / Math.PI;

/* ---- the pen ------------------------------------------------------------- */

export class Pen {
  readonly cubics: Cubic[] = [];
  private x: number;
  private y: number;
  private readonly sx: number;
  private readonly sy: number;

  constructor(x: number, y: number) {
    this.x = this.sx = x;
    this.y = this.sy = y;
  }

  /** A straight line, handles at thirds so it resamples evenly. Zero-length lines are skipped. */
  to(x: number, y: number) {
    if (Math.hypot(x - this.x, y - this.y) < 1e-6) return this;
    const x0 = this.x;
    const y0 = this.y;
    this.cubics.push([
      x0,
      y0,
      x0 + (x - x0) / 3,
      y0 + (y - y0) / 3,
      x0 + ((x - x0) * 2) / 3,
      y0 + ((y - y0) * 2) / 3,
      x,
      y,
    ]);
    this.x = x;
    this.y = y;
    return this;
  }

  /** A cubic from where the pen is. */
  cu(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
    this.cubics.push([this.x, this.y, c1x, c1y, c2x, c2y, x, y]);
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * An elliptical arc around (cx, cy) from a0 to a1 degrees (0 is 3 o'clock,
   * increasing runs clockwise on screen). Joins with a line if the pen is not
   * at the arc's start. Pieces of at most 90 degrees.
   */
  arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number) {
    if (rx < 1e-6 || ry < 1e-6 || Math.abs(a1 - a0) < 1e-6) return this;
    this.to(cx + rx * Math.cos(rad(a0)), cy + ry * Math.sin(rad(a0)));
    const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 90 - 1e-9));
    const step = rad((a1 - a0) / n);
    const k = (4 / 3) * Math.tan(step / 4);
    for (let i = 0; i < n; i++) {
      const t0 = rad(a0) + i * step;
      const t1 = t0 + step;
      const x1 = cx + rx * Math.cos(t1);
      const y1 = cy + ry * Math.sin(t1);
      this.cu(
        this.x - k * rx * Math.sin(t0),
        this.y + k * ry * Math.cos(t0),
        x1 + k * rx * Math.sin(t1),
        y1 - k * ry * Math.cos(t1),
        x1,
        y1,
      );
    }
    return this;
  }

  /** Close back to the start and hand over the cubics. */
  close() {
    this.to(this.sx, this.sy);
    return this.cubics;
  }

  /** Leave it open (for `stroke`). */
  open() {
    return this.cubics;
  }
}

/* ---- resampling ------------------------------------------------------------ */

function cubicAt(c: Cubic, t: number): [number, number] {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const d = 3 * u * t * t;
  const e = t * t * t;
  return [
    a * c[0] + b * c[2] + d * c[4] + e * c[6],
    a * c[1] + b * c[3] + d * c[5] + e * c[7],
  ];
}

function cubicLength(c: Cubic) {
  let len = 0;
  let px = c[0];
  let py = c[1];
  for (let i = 1; i <= 12; i++) {
    const [x, y] = cubicAt(c, i / 12);
    len += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return len;
}

/** The piece of a cubic between t0 and t1 (de Casteljau, twice). */
function subCubic(c: Cubic, t0: number, t1: number): Cubic {
  const split = (q: Cubic, t: number): [Cubic, Cubic] => {
    const l = (a: number, b: number) => a + (b - a) * t;
    const ax = l(q[0], q[2]);
    const ay = l(q[1], q[3]);
    const bx = l(q[2], q[4]);
    const by = l(q[3], q[5]);
    const cx = l(q[4], q[6]);
    const cy = l(q[5], q[7]);
    const dx = l(ax, bx);
    const dy = l(ay, by);
    const ex = l(bx, cx);
    const ey = l(by, cy);
    const fx = l(dx, ex);
    const fy = l(dy, ey);
    return [
      [q[0], q[1], ax, ay, dx, dy, fx, fy],
      [fx, fy, ex, ey, cx, cy, q[6], q[7]],
    ];
  };
  let q = c;
  if (t0 > 0) q = split(q, t0)[1];
  if (t1 < 1) q = split(q, (t1 - t0) / (1 - t0))[0];
  return q;
}

/** Split cubics into exactly n, giving each extra cut to whichever piece is longest per cut. */
export function resample(cubics: Cubic[], n: number): Cubic[] {
  if (cubics.length === 0) throw new Error("morph: empty shape");
  if (cubics.length > n)
    throw new Error(`morph: shape has ${cubics.length} pieces, more than ${n}`);
  if (cubics.length === n) return cubics;
  const len = cubics.map(cubicLength);
  const count = cubics.map(() => 1);
  for (let left = n - cubics.length; left > 0; left--) {
    let best = 0;
    for (let i = 1; i < cubics.length; i++)
      if (len[i] / count[i] > len[best] / count[best]) best = i;
    count[best]++;
  }
  const out: Cubic[] = [];
  cubics.forEach((c, i) => {
    const k = count[i];
    for (let j = 0; j < k; j++)
      out.push(k === 1 ? c : subCubic(c, j / k, (j + 1) / k));
  });
  return out;
}

/** Flatten cubics into an outline (each keeps its handles and end; the start is the previous end). */
export function pack(cubics: Cubic[]): Outline {
  const o = new Float64Array(cubics.length * 6);
  for (let i = 0; i < cubics.length; i++) {
    const c = cubics[i];
    o.set([c[2], c[3], c[4], c[5], c[6], c[7]], i * 6);
  }
  return o;
}

/** Every point at one place: a part folded away. `n` is the segment count. */
export function point(n: number, x: number, y: number): Outline {
  const o = new Float64Array(n * 6);
  for (let i = 0; i < o.length; i += 2) {
    o[i] = x;
    o[i + 1] = y;
  }
  return o;
}

/* ---- measuring -------------------------------------------------------------- */

/** The average of a shape's anchor points: where it is, for sweeps and folding. */
export function center(o: Outline): Pt {
  let x = 0;
  let y = 0;
  const n = o.length / 6;
  for (let i = 0; i < n; i++) {
    x += o[i * 6 + 4];
    y += o[i * 6 + 5];
  }
  return [x / n, y / n];
}

/** The box around every point (handles included), as [x0, y0, x1, y1]. */
export function bounds(o: Outline): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < o.length; i += 2) {
    x0 = Math.min(x0, o[i]);
    x1 = Math.max(x1, o[i]);
    y0 = Math.min(y0, o[i + 1]);
    y1 = Math.max(y1, o[i + 1]);
  }
  return [x0, y0, x1, y1];
}

/* ---- morphing ---------------------------------------------------------------- */

/**
 * Which start segment of `to` makes the least travel from `from`. Same
 * shape, same winding; only where its outline "begins" moves. A wire, or a
 * dashed paint (which counts its pattern from the start), may only start
 * at either end: pass `starts` = [0, N / 2].
 */
export function alignK(
  from: Outline,
  to: Outline,
  starts?: readonly number[],
): number {
  const n = to.length / 6;
  let best = 0;
  let bestCost = Infinity;
  const ks = starts ?? Array.from({ length: n }, (_, i) => i);
  for (const k of ks) {
    let cost = 0;
    for (let i = 0; i < n && cost < bestCost; i++) {
      const a = i * 6 + 4;
      const b = ((i + k) % n) * 6 + 4;
      const dx = from[a] - to[b];
      const dy = from[a + 1] - to[b + 1];
      cost += dx * dx + dy * dy;
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = k;
    }
  }
  return best;
}

/** `to` restarted at segment k (the shape is unchanged, only its first segment moves). */
export function rotate(to: Outline, k: number): Outline {
  if (!k) return to;
  const n = to.length / 6;
  const out = new Float64Array(to.length);
  for (let i = 0; i < n; i++) {
    const j = ((i + k) % n) * 6;
    out.set(to.subarray(j, j + 6), i * 6);
  }
  return out;
}

const num = (v: number) => String(Math.round(v * 100) / 100);

export function toPath(o: Outline): string {
  const n = o.length / 6;
  let d = `M${num(o[n * 6 - 2])} ${num(o[n * 6 - 1])}`;
  for (let i = 0; i < n; i++) {
    const j = i * 6;
    d += `C${num(o[j])} ${num(o[j + 1])} ${num(o[j + 2])} ${num(o[j + 3])} ${num(o[j + 4])} ${num(o[j + 5])}`;
  }
  return `${d}Z`;
}

/* ---- easing ------------------------------------------------------------------ */

/** A CSS `cubic-bezier(x1, y1, x2, y2)` as a function of progress, the same curve CSS draws. */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-5) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    // Newton stalled: bisect.
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 24; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-5) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

/** One of motion-presets' bezier tuples as an easing function. */
export const easing = (curve: readonly [number, number, number, number]) =>
  cubicBezier(curve[0], curve[1], curve[2], curve[3]);

/* ---- the shape kit --------------------------------------------------------------- */

/**
 * Shape helpers bound to one segment count. Every part of one drawing must
 * share N (the driver folds and interpolates outlines of that length), and
 * N must be even, because a stroke is N / 2 out and N / 2 back.
 */
export function shapes(N: number) {
  if (N % 2 !== 0) throw new Error("morph: N must be even");
  const half = N / 2;

  /** A closed shape. */
  const outline = (c: Cubic[]) => pack(resample(c, N));

  /** An open line: out along it and back over itself. */
  const stroke = (c: Cubic[]) => {
    const out = resample(c, half);
    const back = out
      .slice()
      .reverse()
      .map((q): Cubic => [q[6], q[7], q[4], q[5], q[2], q[3], q[0], q[1]]);
    return pack([...out, ...back]);
  };

  const at = (x: number, y: number) => point(N, x, y);

  /** Clockwise from 12 o'clock. */
  const circle = (cx: number, cy: number, r: number) =>
    outline(new Pen(cx, cy - r).arc(cx, cy, r, r, -90, 270).close());

  const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
    outline(new Pen(cx, cy - ry).arc(cx, cy, rx, ry, -90, 270).close());

  /** A straight line or polyline, there and back. */
  const line = (...pts: Pt[]) => {
    const p = new Pen(pts[0][0], pts[0][1]);
    for (const q of pts.slice(1)) p.to(q[0], q[1]);
    return stroke(p.open());
  };

  /** An open arc, there and back. */
  const arcLine = (cx: number, cy: number, r: number, a0: number, a1: number) =>
    stroke(
      new Pen(cx + r * Math.cos(rad(a0)), cy + r * Math.sin(rad(a0)))
        .arc(cx, cy, r, r, a0, a1)
        .open(),
    );

  /** Catmull-Rom through points, one cubic per gap: smooth, and exactly N / 2 pieces when given N / 2 + 1 points. */
  const smoothOpen = (pts: readonly Pt[]) => {
    const P = pts.length;
    const c: Cubic[] = [];
    for (let i = 0; i < P - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(P - 1, i + 2)];
      c.push([
        p1[0],
        p1[1],
        p1[0] + (p2[0] - p0[0]) / 6,
        p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6,
        p2[1] - (p3[1] - p1[1]) / 6,
        p2[0],
        p2[1],
      ]);
    }
    return stroke(c);
  };

  /** The same through a loop of points, drawn as a stroke (out and back), so a wire can close into a ring. N / 2 points. */
  const smoothLoop = (pts: readonly Pt[]) => {
    const P = pts.length;
    const c: Cubic[] = [];
    for (let i = 0; i < P; i++) {
      const p0 = pts[(i - 1 + P) % P];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % P];
      const p3 = pts[(i + 2) % P];
      c.push([
        p1[0],
        p1[1],
        p1[0] + (p2[0] - p0[0]) / 6,
        p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6,
        p2[1] - (p3[1] - p1[1]) / 6,
        p2[0],
        p2[1],
      ]);
    }
    return stroke(c);
  };

  /**
   * Points around (cx, cy), clockwise from 12 o'clock, at a radius that may
   * vary with the angle (a ripple). N / 2 of them, ready for `smoothLoop`.
   */
  const ringPoints = (
    cx: number,
    cy: number,
    r: number | ((theta: number) => number),
  ) =>
    Array.from({ length: half }, (_, i): Pt => {
      const th = (i / half) * Math.PI * 2 - Math.PI / 2;
      const rr = typeof r === "number" ? r : r(th);
      return [cx + rr * Math.cos(th), cy + rr * Math.sin(th)];
    });

  /** A wire closed into a ring, starting at 12 o'clock. */
  const ringLine = (cx: number, cy: number, r: number) =>
    smoothLoop(ringPoints(cx, cy, r));

  return {
    N,
    outline,
    stroke,
    point: at,
    circle,
    ellipse,
    line,
    arcLine,
    smoothOpen,
    smoothLoop,
    ringPoints,
    ringLine,
    Pen,
  };
}

export type ShapeKit = ReturnType<typeof shapes>;
