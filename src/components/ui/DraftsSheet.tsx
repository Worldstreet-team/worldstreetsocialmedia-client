"use client";

import { useAtom, useSetAtom } from "jotai";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { NotePencil, Trash } from "@phosphor-icons/react";
import { draftsAtom, draftsOpenAtom, pendingDraftAtom } from "@/store/drafts.atom";
import { useT } from "@/i18n/client";
import { formatTimeAgo } from "@/lib/utils";

/** Saved drafts. Continue drops one back into the composer (and routes home
 *  first if you're somewhere else); the trash removes it for good. */
export function DraftsSheet() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useAtom(draftsOpenAtom);
  const [drafts, setDrafts] = useAtom(draftsAtom);
  const setPending = useSetAtom(pendingDraftAtom);

  const resume = (id: string, content: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    setPending(content);
    setOpen(false);
    if (pathname !== "/") router.push("/");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="drafts-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-modal bg-scrim flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t("drafts.title")}
            className="w-full max-w-[440px] max-h-[70dvh] flex flex-col bg-surface border border-hairline rounded-xl shadow-nav overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-hairline shrink-0">
              <h2 className="font-display text-[17px] font-semibold text-primary">
                {t("drafts.title")}
              </h2>
              <span className="font-sans text-[12px] text-subtle tabular-nums">
                {drafts.length}
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {drafts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-raised text-subtle">
                    <NotePencil size={22} />
                  </span>
                  <p className="font-sans text-sm text-muted">
                    {t("drafts.empty")}
                  </p>
                  <p className="font-sans text-[12px] text-subtle">
                    {t("drafts.emptyHint")}
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col">
                  {drafts.map((draft) => (
                    <li
                      key={draft.id}
                      className="flex items-start gap-3 px-4 py-3 border-b border-hairline/60 last:border-0 hover:bg-raised/40 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => resume(draft.id, draft.content)}
                        className="flex-1 min-w-0 text-left cursor-pointer"
                      >
                        <p className="font-sans text-[14px] text-primary line-clamp-2 whitespace-pre-wrap">
                          {draft.content}
                        </p>
                        <span className="font-sans text-[12px] text-subtle tabular-nums">
                          {formatTimeAgo(new Date(draft.updatedAt).toISOString())}
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
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
