"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { CaretDown, Check, Globe, UsersThree } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";

export interface AudienceCommunity {
  id: string;
  name: string;
  slug: string;
  avatar?: string;
}

/**
 * Who a post goes to: everyone, or one community you belong to.
 *
 * Membership was collected long before there was anywhere for it to lead.
 * This is the control that makes joining mean something.
 */
export function AudiencePicker({
  communities,
  value,
  onChange,
  locked = false,
}: {
  communities: AudienceCommunity[];
  /** null = everyone */
  value: AudienceCommunity | null;
  onChange: (next: AudienceCommunity | null) => void;
  /** Inside a community page the audience is fixed, so show it and don't open. */
  locked?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Nothing to choose between: one destination is not a picker.
  if (locked && !value) return null;
  if (!locked && communities.length === 0) return null;

  const label = value ? value.name : t("community.audience.everyone");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={locked}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup={locked ? undefined : "listbox"}
        aria-expanded={locked ? undefined : open}
        aria-label={t("community.audience.label")}
        className={clsx(
          "flex h-7 max-w-[220px] items-center gap-1.5 rounded-pill px-2.5 font-sans text-[12.5px] font-semibold transition-colors",
          value ? "bg-brand/15 text-gold" : "bg-raised text-muted",
          !locked && "cursor-pointer hover:text-primary",
        )}
      >
        {value ? (
          <span className="relative h-4 w-4 shrink-0 overflow-hidden rounded-pill bg-page">
            {value.avatar ? (
              <Image src={value.avatar} alt="" fill sizes="16px" className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[9px] font-bold text-gold">
                {value.name.charAt(0).toUpperCase()}
              </span>
            )}
          </span>
        ) : (
          <Globe size={13} weight="bold" />
        )}
        <span className="truncate">{label}</span>
        {!locked && <CaretDown size={11} weight="bold" className="shrink-0 opacity-70" />}
      </button>

      {open && !locked && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-dropdown mt-1.5 max-h-64 w-[248px] overflow-y-auto rounded-xl border border-hairline bg-surface py-1.5 shadow-nav"
        >
          <Option
            selected={!value}
            onSelect={() => {
              onChange(null);
              setOpen(false);
            }}
            icon={
              <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-raised text-muted">
                <Globe size={14} weight="bold" />
              </span>
            }
            label={t("community.audience.everyone")}
          />

          {communities.length > 0 && <div className="my-1.5 h-px bg-hairline" />}

          {communities.map((c) => (
            <Option
              key={c.id}
              selected={value?.id === c.id}
              onSelect={() => {
                onChange(c);
                setOpen(false);
              }}
              icon={
                <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-lg bg-raised">
                  {c.avatar ? (
                    <Image src={c.avatar} alt="" fill sizes="28px" className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-display text-[12px] font-semibold text-gold">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
              }
              label={c.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Option({
  selected,
  onSelect,
  icon,
  label,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-raised"
    >
      {icon}
      <span className="min-w-0 flex-1 truncate font-sans text-[13.5px] text-primary">
        {label}
      </span>
      {selected && <Check size={14} weight="bold" className="shrink-0 text-gold" />}
    </button>
  );
}

/** Static "Posting in <community>" line for a locked composer. */
export function AudienceLock({ community }: { community: AudienceCommunity }) {
  const t = useT();
  return (
    <span className="flex items-center gap-1.5 font-sans text-[12.5px] text-muted">
      <UsersThree size={13} weight="duotone" className="text-gold" />
      {t("community.postingIn")}{" "}
      <span className="font-semibold text-primary">{community.name}</span>
    </span>
  );
}
