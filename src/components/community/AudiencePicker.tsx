"use client";

import { useCallback, useState } from "react";
import clsx from "clsx";
import { AnimatePresence } from "framer-motion";
import { CaretDown, Check, Globe, UsersThree } from "@phosphor-icons/react";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import {
  OverlayHeader,
  OverlayPanel,
  OverlayScrim,
  useOverlayDismiss,
} from "@/components/ui/Overlay";
import { useT } from "@/i18n/client";
import { SafeAvatar } from "@/components/ui/SafeAvatar";

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
  // Esc, the body scroll lock and the click-catcher are the overlay grammar's
  // job now — the scrim closes what the outside-mousedown listener used to.
  const close = useCallback(() => setOpen(false), []);
  useOverlayDismiss(open, close);

  // Nothing to choose between: one destination is not a picker.
  if (locked && !value) return null;
  if (!locked && communities.length === 0) return null;

  const label = value ? value.name : t("community.audience.everyone");

  return (
    <>
      <button
        type="button"
        disabled={locked}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup={locked ? undefined : "dialog"}
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
              <SafeAvatar src={value.avatar} className="object-cover" sizes="16px" />
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

      <ConfirmModalPortal>
        <AnimatePresence>
          {open && !locked && (
            <>
              {/* A picker is not a modal: the composer you are addressing
                  stays visible behind it on desktop. */}
              <OverlayScrim onClose={close} dim={false} label={t("common.close")} />
              <OverlayPanel dragClose={close} variant="anchored" label={t("community.audience.label")}>
                <OverlayHeader
                  title={t("community.audience.label")}
                  onClose={close}
                  closeLabel={t("common.close")}
                />
                <div
                  role="listbox"
                  aria-label={t("community.audience.label")}
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[calc(8px+var(--ws-safe-bottom))]"
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
                            <SafeAvatar src={c.avatar} className="object-cover" sizes="28px" />
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
              </OverlayPanel>
            </>
          )}
        </AnimatePresence>
      </ConfirmModalPortal>
    </>
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
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-raised"
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
