"use client";

import {
  DotsThree,
  PencilSimple,
  ProhibitInset,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";
import type { SpaceRow } from "@/components/voice/SpaceCard";

/**
 * The host's escape hatches on a scheduled room.
 *
 * Before this the only thing a host could do with a space they'd booked was
 * start it. If plans changed there was no way to move it, rename it, or call
 * it off, so the room sat there until its slot passed and it quietly vanished
 * on the people who had signed up.
 *
 * Deliberately tucked behind an overflow button: Start is the action a host
 * wants 95% of the time, and it should not have to compete with two
 * destructive-looking siblings for attention.
 */
export default function HostSpaceMenu({
  row,
  onEdit,
  onCancel,
  tone = "light",
}: {
  row: SpaceRow;
  onEdit: (row: SpaceRow) => void;
  onCancel: (row: SpaceRow) => void;
  /** "light" sits on cover art, "dark" on a plain surface. */
  tone?: "light" | "dark";
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Click-away and Escape, so the menu never strands itself open behind a
  // sheet the host opened from it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = [
    {
      id: "edit",
      label: t("voice.editSpace"),
      icon: PencilSimple,
      danger: false,
      run: () => onEdit(row),
    },
    {
      id: "cancel",
      label: t("voice.cancelSpace"),
      icon: ProhibitInset,
      danger: true,
      run: () => onCancel(row),
    },
  ];

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("voice.hostOptions")}
        aria-haspopup="menu"
        aria-expanded={open}
        className={clsx(
          "flex h-10 w-10 items-center justify-center rounded-pill transition-colors cursor-pointer",
          tone === "light"
            ? "bg-[#fafaf9]/14 text-[#fafaf9] hover:bg-[#fafaf9]/24"
            : "text-muted hover:bg-raised hover:text-primary",
        )}
      >
        <DotsThree size={20} weight="bold" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 bottom-full z-dropdown mb-2 w-[184px] overflow-hidden rounded-xl border border-hairline bg-surface py-1 shadow-nav"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.run();
              }}
              className={clsx(
                "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left font-sans text-[13px] font-medium transition-colors cursor-pointer",
                item.danger
                  ? "text-danger hover:bg-raised"
                  : "text-primary hover:bg-raised",
              )}
            >
              <item.icon size={15} weight="bold" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
