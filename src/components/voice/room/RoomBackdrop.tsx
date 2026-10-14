"use client";

import clsx from "clsx";
import {
  type SpaceRow,
  spaceArt,
  spaceBackground,
} from "@/components/voice/SpaceCard";

/**
 * The room is a stage over its own art, dark in both themes, the way the
 * creator surfaces are: it sits over a picture, and a light pane over a
 * picture blows it out.
 *
 * The house background swaps its night and day pictures with the theme
 * (`--ws-space-house` in styles/spaces.css). The room always wants the
 * night one, so the room's root re-points that property to it, and
 * `spaceBackground()` keeps working unchanged underneath. Same file the
 * `:root` default names; keep the two together.
 */
export const ROOM_HOUSE_NIGHT =
  'url("/images/spaces/house-dark.webp") center / cover no-repeat #0c0f16';

/**
 * The art, blurred into colour and light, under a deep veil, so the stage
 * reads as one place and the ink on it holds on any photo. A CSS filter on
 * a painted layer, not a backdrop-filter: it is the ground, and the menus
 * that float over it keep the stack's one backdrop blur.
 *
 * A photo can be anything, so it gets the deepest veil; a legacy swatch is
 * already a dark mesh; the house picture is lit for the night and shows a
 * little more of itself.
 */
export function RoomBackdrop({
  row,
}: {
  row: Pick<SpaceRow, "cover" | "coverImage">;
}) {
  const kind = spaceArt(row);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#05070a]"
    >
      {/* Past the edges: a blur samples beyond its own box and would leave
          a soft dark rim otherwise. */}
      <div
        className={clsx(
          "absolute -inset-24",
          kind === "house" ? "blur-[40px]" : "blur-[72px]",
        )}
        style={{ background: spaceBackground(row) }}
      />
      <div
        className={clsx(
          "absolute inset-0",
          kind === "photo"
            ? "bg-[#05070a]/86"
            : kind === "swatch"
              ? "bg-[#05070a]/80"
              : "bg-[#05070a]/72",
        )}
      />
    </div>
  );
}
