import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SpaceEmptyArt, type SpaceEmptyKind } from "./SpaceEmptyArt";

export type { SpaceEmptyKind } from "./SpaceEmptyArt";

export type SpaceEmptyStateProps = {
  /** Which picture: no live rooms, nothing scheduled, no matches, or a failed load. */
  kind: SpaceEmptyKind;
  title: string;
  body?: string;
  /** At most one action, like EmptyState (a retry for "offline", clear filters for "search"). */
  action?: ReactNode;
  /** Tighter, for a rail or a section inside a page. */
  compact?: boolean;
};

/**
 * A Space Voice empty state: the components/ui EmptyState column (centred,
 * gap 12, padding 32/24, title then a muted caption capped near 36ch, one
 * action), with the Signal's wire drawn above it instead of an icon chip.
 *
 * The art morphs when `kind` changes, so render ONE of these for a list and
 * change its props (a search that finds nothing, then a load that fails)
 * rather than swapping components; a new instance redraws from scratch.
 */
export function SpaceEmptyState({
  kind,
  title,
  body,
  action,
  compact = false,
}: SpaceEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "gap-2 px-4 py-5" : "gap-3 px-6 py-8",
      )}
    >
      {/* Room around the art: its parts overshoot and grow while morphing. */}
      <div
        className={cn(
          "pointer-events-none px-2 pt-1",
          compact ? "w-[172px]" : "w-[232px]",
        )}
      >
        <SpaceEmptyArt kind={kind} />
      </div>

      <h3 className="font-display text-[calc(15px*var(--ws-fs))] font-semibold text-primary">
        {title}
      </h3>

      {body && (
        <p className="max-w-[36ch] font-sans text-[calc(13px*var(--ws-fs))] leading-relaxed text-muted">
          {body}
        </p>
      )}

      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
