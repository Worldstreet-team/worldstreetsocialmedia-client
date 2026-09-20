"use client";

import { useCallback } from "react";
import { useAtom, useSetAtom } from "jotai";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { NotePencil, Trash } from "@phosphor-icons/react";
import { draftsAtom, draftsOpenAtom, pendingDraftAtom } from "@/store/drafts.atom";
import {
  OverlayHeader,
  OverlayPanel,
  OverlayScrim,
  useOverlayDismiss,
} from "@/components/ui/Overlay";
import { useT } from "@/i18n/client";
import {
  collapse,
  reveal,
  staggerItem,
  staggerParentFast,
} from "@/lib/motion-presets";
import { formatTimeAgo } from "@/lib/utils";

// Rows past this are below the fold when the sheet opens; they skip the
// cascade so a long list is never still arriving after the panel has landed.
const CASCADE_ROWS = 8;

/** Saved drafts. Continue drops one back into the composer (and routes home
 *  first if you're somewhere else); the trash removes it for good. */
export function DraftsSheet() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useAtom(draftsOpenAtom);
  const [drafts, setDrafts] = useAtom(draftsAtom);
  const setPending = useSetAtom(pendingDraftAtom);

  const close = useCallback(() => setOpen(false), [setOpen]);
  useOverlayDismiss(open, close);

  const resume = (id: string, content: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    setPending(content);
    setOpen(false);
    if (pathname !== "/") router.push("/");
  };

  return (
    <AnimatePresence>
      {open && (
        <OverlayScrim
          key="drafts-scrim"
          onClose={close}
          label={t("drafts.title")}
        />
      )}
      {open && (
        <OverlayPanel
          key="drafts-panel"
          variant="center"
          label={t("drafts.title")}
          className="max-w-[440px]"
        >
          <OverlayHeader
            title={t("drafts.title")}
            count={drafts.length}
            onClose={close}
          />

          <div className="flex-1 min-h-0 overflow-y-auto">
            {drafts.length === 0 ? (
              <motion.div
                {...reveal()}
                className="flex flex-col items-center gap-2 px-6 py-12 text-center"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-raised text-subtle">
                  <NotePencil size={22} />
                </span>
                <p className="font-sans text-sm text-muted">
                  {t("drafts.empty")}
                </p>
                <p className="font-sans text-[calc(12px*var(--ws-fs))] text-subtle">
                  {t("drafts.emptyHint")}
                </p>
              </motion.div>
            ) : (
              // The cascade belongs to the list MOUNTING, which is the sheet
              // opening. Deleting a draft re-renders and replays nothing.
              <motion.ul
                variants={staggerParentFast}
                initial="hidden"
                animate="show"
                className="flex flex-col"
              >
                {/* No `initial={false}` here: a presence that blocks its
                    first render blocks every motion child under it, and
                    the cascade above would never play. */}
                <AnimatePresence>
                  {drafts.map((draft, i) => (
                    // A deleted or resumed draft folds shut and the rows
                    // below close the gap, where it used to blink out. The
                    // padding sits on the inner row: a padded box cannot
                    // reach height 0.
                    <motion.li
                      key={draft.id}
                      exit={collapse.exit}
                      className="overflow-hidden border-b border-hairline/60 last:border-0"
                    >
                      <motion.div
                        variants={i < CASCADE_ROWS ? staggerItem : undefined}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-raised/40 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => resume(draft.id, draft.content)}
                          className="flex-1 min-w-0 text-left cursor-pointer"
                        >
                          <p className="font-sans text-[calc(14px*var(--ws-fs))] text-primary line-clamp-2 whitespace-pre-wrap">
                            {draft.content}
                          </p>
                          <span className="font-sans text-[calc(12px*var(--ws-fs))] text-subtle tabular-nums">
                            {formatTimeAgo(
                              new Date(draft.updatedAt).toISOString(),
                            )}
                            {" · "}
                            {draft.content.length}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDrafts((prev) =>
                              prev.filter((d) => d.id !== draft.id),
                            )
                          }
                          aria-label={t("drafts.delete")}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-subtle hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                        >
                          <Trash size={16} />
                        </button>
                      </motion.div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </motion.ul>
            )}
          </div>
        </OverlayPanel>
      )}
    </AnimatePresence>
  );
}
