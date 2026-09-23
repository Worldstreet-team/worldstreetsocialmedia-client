"""Cut the WorldSpace wordmark out of Poppins 700 as per-contour SVG paths.

The wordmark draws itself (BrandWord in src/components/layout/BrandRitual.tsx),
and the draw needs real geometry: every contour is its own path with its own
measured length, so each one can be dashed on from nothing to closed without
guessing a dash length that is too short for the long letters. That guess is
what made the first frame jump: the W's outline is 546 units, the old shared
dash was 430, so a piece of the W was already drawn before the draw began.

Run it again only if the display face changes:

    python3 -m venv /tmp/wm && /tmp/wm/bin/pip install fonttools brotli
    /tmp/wm/bin/python scripts/wordmark-glyphs.py <poppins-700.ttf|woff2> \\
        > src/components/layout/wordmark-glyphs.ts

The font is the Poppins 700 latin file next/font self-hosts (it is in
.next/static/media after a build) or Poppins-Bold.ttf from Google Fonts.
Poppins has no kerning pairs for this word, so advances are the layout.
"""

import math
import sys

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont

TEXT = "WorldSpace."
SIZE = 100  # font size in viewBox units
BASELINE = 74  # the ascender of l and d touches y 0


class SegPen(BasePen):
    """Collects each contour as explicit line / quad / cubic segments."""

    def __init__(self, glyph_set):
        super().__init__(glyph_set)
        self.contours = []
        self.cur = None

    def _moveTo(self, p):
        self.cur = {"start": p, "segs": []}

    def _lineTo(self, p):
        self.cur["segs"].append(("L", [p]))

    def _qCurveToOne(self, p1, p2):
        self.cur["segs"].append(("Q", [p1, p2]))

    def _curveToOne(self, p1, p2, p3):
        self.cur["segs"].append(("C", [p1, p2, p3]))

    def _closePath(self):
        if self._getCurrentPoint() != self.cur["start"]:
            self.cur["segs"].append(("L", [self.cur["start"]]))
        self.contours.append(self.cur)
        self.cur = None

    _endPath = _closePath


def point_at(kind, pts, t):
    if kind == "L":
        (x0, y0), (x1, y1) = pts
        return (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)
    if kind == "Q":
        (x0, y0), (x1, y1), (x2, y2) = pts
        a, b, c = (1 - t) ** 2, 2 * (1 - t) * t, t * t
        return (a * x0 + b * x1 + c * x2, a * y0 + b * y1 + c * y2)
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = pts
    a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t**3
    return (
        a * x0 + b * x1 + c * x2 + d * x3,
        a * y0 + b * y1 + c * y2 + d * y3,
    )


def seg_length(kind, pts, n=400):
    if kind == "L":
        return math.dist(pts[0], pts[1])
    total, prev = 0.0, pts[0]
    for i in range(1, n + 1):
        p = point_at(kind, pts, i / n)
        total += math.dist(prev, p)
        prev = p
    return total


def signed_area(segs):
    pts = [point_at(kind, sp, i / 16) for kind, sp in segs for i in range(16)]
    return sum(
        x0 * y1 - x1 * y0
        for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1], strict=True)
    ) / 2


def num(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def path_d(segs):
    x, y = segs[0][1][0]
    body = "".join(
        kind + " ".join(f"{num(px)} {num(py)}" for px, py in pts[1:])
        for kind, pts in segs
    )
    return f"M{num(x)} {num(y)}{body}Z"


def main():
    font = TTFont(sys.argv[1])
    scale = SIZE / font["head"].unitsPerEm
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]

    pen_x = 0.0
    letters = []
    for ch in TEXT:
        name = cmap[ord(ch)]
        pen = SegPen(glyph_set)
        glyph_set[name].draw(pen)
        contours = []
        for c in pen.contours:

            def tx(p, x0=pen_x):
                return ((x0 + p[0]) * scale, BASELINE - p[1] * scale)

            segs, p0 = [], c["start"]
            for kind, pts in c["segs"]:
                segs.append((kind, [tx(p0), *(tx(p) for p in pts)]))
                p0 = pts[-1]
            segs = [s for s in segs if seg_length(*s) > 1e-6]
            # Every contour draws visually clockwise (positive area with y
            # down) from its topmost point, leftmost on a tie, so the pens
            # all set off the same way. The fill uses evenodd, so the
            # direction a counter is wound in no longer matters to it.
            if signed_area(segs) < 0:
                segs = [(k, pts[::-1]) for k, pts in reversed(segs)]
            first = min(
                range(len(segs)),
                key=lambda i: (round(segs[i][1][0][1], 3), segs[i][1][0][0]),
            )
            segs = segs[first:] + segs[:first]
            length = sum(seg_length(*s) for s in segs)
            contours.append((path_d(segs), round(length, 2)))
        letters.append((ch, contours))
        pen_x += hmtx[name][0]

    out = [
        "/*",
        " * The WorldSpace wordmark, cut from Poppins 700 (the display face) by",
        " * scripts/wordmark-glyphs.py. GENERATED: do not hand-edit; re-run the",
        " * script if the display face changes.",
        " *",
        f" * Units are font size {SIZE} with the baseline at y {BASELINE}, so the box",
        f" * is the word's ink height by its advance ({num(pen_x * scale)}). Each contour",
        " * is its own closed path, drawn clockwise from its topmost point, with",
        " * its measured length: the draw is timed per contour, and the drop at",
        " * the pen tip is sized in real units from that length.",
        " */",
        f"export const WORDMARK_BOX = {{ w: {math.ceil(pen_x * scale)}, h: 101 }} as const;",
        "",
        "export const WORDMARK_GLYPHS: readonly {",
        "\tch: string;",
        "\tcontours: readonly { d: string; len: number }[];",
        "}[] = [",
    ]
    for ch, contours in letters:
        out.append("\t{")
        out.append(f'\t\tch: "{ch}",')
        out.append("\t\tcontours: [")
        for d, length in contours:
            out.append("\t\t\t{")
            out.append(f'\t\t\t\td: "{d}",')
            out.append(f"\t\t\t\tlen: {num(length)},")
            out.append("\t\t\t},")
        out.append("\t\t],")
        out.append("\t},")
    out.append("];")
    sys.stdout.write("\n".join(out) + "\n")


main()
