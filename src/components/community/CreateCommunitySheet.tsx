"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ImageSquare, X } from "@phosphor-icons/react";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import {
  OverlayPanel,
  OverlayScrim,
  useOverlayDismiss,
} from "@/components/ui/Overlay";
import { CATEGORIES, VERTICALS, type VerticalId } from "@/data/categories";
import { checkSlugAction } from "@/lib/community.actions";
import { useT } from "@/i18n/client";
import {
  pop,
  press,
  staggerItem,
  staggerParentFast,
  swap,
} from "@/lib/motion-presets";

const MAX_NAME = 48;
const MAX_DESC = 280;

/**
 * Create a community.
 *
 * The old flow was an inline form that shoved the page down: no labels, no
 * cancel, a single-line input holding 280 characters, five hardcoded
 * categories, and a slug you only discovered after a 409. This is the same
 * sheet grammar as CreateSpaceSheet so creating anything here feels like one
 * product.
 */
export default function CreateCommunitySheet({
  busy,
  onClose,
  onCreate,
}: {
  busy: boolean;
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    description: string;
    category: string;
    avatar: File | null;
  }) => void;
}) {
  const t = useT();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [vertical, setVertical] = useState<VerticalId>(VERTICALS[0].id);
  const [category, setCategory] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [slug, setSlug] = useState<{ slug: string | null; available: boolean } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const trimmed = name.trim();
  const nameValid = trimmed.length >= 3;
  const valid = nameValid && !busy;

  // Esc + the body scroll lock come from the overlay grammar now.
  useOverlayDismiss(true, onClose);

  // Object URLs are revoked on replace and on unmount, or every icon you try
  // leaks for the life of the tab.
  useEffect(() => {
    return () => {
      if (avatarUrl) URL.revokeObjectURL(avatarUrl);
    };
  }, [avatarUrl]);

  // What address this name actually gets, checked while you type rather than
  // sprung on you as a 409 after submit.
  useEffect(() => {
    if (!nameValid) {
      setSlug(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      void checkSlugAction(trimmed).then((res) => {
        if (cancelled || !res.success) return;
        setSlug({ slug: res.slug, available: res.available });
      });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trimmed, nameValid]);

  const categoriesInVertical = useMemo(
    () => CATEGORIES.filter((c) => c.vertical === vertical && !c.sensitive),
    [vertical],
  );

  const pickAvatar = (file: File | undefined) => {
    if (!file) return;
    if (avatarUrl) URL.revokeObjectURL(avatarUrl);
    setAvatar(file);
    setAvatarUrl(URL.createObjectURL(file));
  };

  const field =
    "font-sans text-[calc(11px*var(--ws-fs))] font-semibold uppercase tracking-[0.14em] text-muted";
  // Soft fills from the theme tokens, no rules (Communities v2 "Start one").
  const input =
    "w-full rounded-[16px] bg-primary/[0.06] px-4 py-3 font-sans text-base text-primary outline-none transition-colors placeholder:text-subtle focus:bg-primary/[0.09] sm:text-[calc(15px*var(--ws-fs))]";
  const chip = (on: boolean) =>
    clsx(
      "flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-pill px-3.5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold transition-colors",
      on ? "bg-primary text-page" : "bg-primary/[0.06] text-muted hover:text-primary",
    );

  return (
    <ConfirmModalPortal>
      <OverlayScrim onClose={onClose} label={t("common.cancel")} />
      <OverlayPanel
        dragClose={onClose}
        variant="sheet"
        ground="solid"
        label={t("community.new.title")}
      >
        {/* Communities v2, "Start one" (owner 2026-10-16: the old sheet was
            "rubbish"): one screen, a big title, a cover, three fields and
            one button. */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-5">
          <h2 className="truncate font-display text-[calc(20px*var(--ws-fs))] font-semibold text-primary">
            {t("community.new.title")}
          </h2>
          <motion.button
            type="button"
            onClick={onClose}
            aria-label={t("common.cancel")}
            {...press}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-primary/[0.08] text-primary transition-colors hover:bg-primary/[0.13]"
          >
            <X size={15} weight="bold" />
          </motion.button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-2">
          <div className="flex flex-col gap-5">
            {/* cover */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label={t("community.field.avatarAdd")}
                className="relative h-[72px] w-[72px] shrink-0 cursor-pointer overflow-hidden rounded-[20px] bg-primary/[0.06] transition-colors hover:bg-primary/[0.09]"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {avatarUrl ? (
                    <motion.img key={avatarUrl} {...swap} src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <motion.span key="empty" {...swap} className="flex h-full w-full items-center justify-center text-muted">
                      <ImageSquare size={24} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
              <div className="flex min-w-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-fit cursor-pointer font-sans text-[calc(15px*var(--ws-fs))] font-semibold text-primary hover:underline"
                >
                  {avatarUrl ? t("community.field.avatarChange") : t("community.field.coverAdd")}
                </button>
                <span className="font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">
                  {t("community.field.coverHint")}
                </span>
                <AnimatePresence initial={false}>
                  {avatarUrl && (
                    <motion.button
                      key="remove"
                      type="button"
                      {...pop}
                      onClick={() => {
                        URL.revokeObjectURL(avatarUrl);
                        setAvatar(null);
                        setAvatarUrl(null);
                      }}
                      className="w-fit cursor-pointer font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold text-danger"
                    >
                      {t("community.field.avatarRemove")}
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickAvatar(e.target.files?.[0])}
              />
            </div>

            {/* name */}
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <label htmlFor="community-name" className={field}>
                  {t("community.field.name")}
                </label>
                <span className="font-sans text-[calc(11.5px*var(--ws-fs))] tabular-nums text-subtle">
                  {name.length} / {MAX_NAME}
                </span>
              </div>
              <input
                id="community-name"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
                placeholder={t("community.field.namePlaceholder")}
                className={input}
                autoFocus
              />
              <p className="mt-1.5 min-h-[18px] font-sans text-[calc(12px*var(--ws-fs))] text-subtle">
                {!nameValid && name.length > 0 ? (
                  t("community.field.nameHint")
                ) : slug?.slug ? (
                  <>
                    {!slug.available && `${t("community.field.nameTaken")} `}
                    <span className="text-muted">
                      /communities/<span className="font-semibold">{slug.slug}</span>
                    </span>
                  </>
                ) : null}
              </p>
            </div>

            {/* about */}
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <label htmlFor="community-desc" className={field}>
                  {t("community.field.description")}
                </label>
                <span className="font-sans text-[calc(11.5px*var(--ws-fs))] text-subtle">
                  {description.length > 0 ? `${description.length} / ${MAX_DESC}` : t("community.field.optional")}
                </span>
              </div>
              <textarea
                id="community-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC))}
                placeholder={t("community.field.descriptionPlaceholder")}
                rows={3}
                className={clsx(input, "resize-none")}
              />
            </div>

            {/* topic: the area, then its categories, each one chip row */}
            <div>
              <span className={clsx(field, "mb-2 block")}>{t("community.field.topic")}</span>
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {VERTICALS.map((v) => (
                  <motion.button
                    key={v.id}
                    type="button"
                    {...press}
                    aria-pressed={vertical === v.id}
                    onClick={() => {
                      setVertical(v.id as VerticalId);
                      setCategory("");
                    }}
                    className={chip(vertical === v.id)}
                  >
                    {v.label}
                  </motion.button>
                ))}
              </div>
              <motion.div
                key={vertical}
                variants={staggerParentFast}
                initial="hidden"
                animate="show"
                className="-mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {categoriesInVertical.map((c) => {
                  const on = category === c.id;
                  return (
                    <motion.button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(on ? "" : c.id)}
                      aria-pressed={on}
                      variants={staggerItem}
                      className={clsx(
                        "flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-pill px-3 font-sans text-[calc(12.5px*var(--ws-fs))] font-medium transition-colors",
                        on ? "bg-brand text-brand-on" : "text-muted hover:text-primary",
                      )}
                    >
                      {on && (
                        <motion.span {...pop} className="flex">
                          <Check size={11} weight="bold" />
                        </motion.span>
                      )}
                      {c.label}
                    </motion.button>
                  );
                })}
              </motion.div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-[calc(16px+var(--ws-safe-bottom))] pt-3">
          <span className="font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">
            {t("community.new.admin")}
          </span>
          <motion.button
            type="button"
            disabled={!valid}
            {...press}
            onClick={() =>
              onCreate({
                name: trimmed,
                description: description.trim(),
                category: category || "general",
                avatar,
              })
            }
            className={clsx(
              "flex h-11 items-center gap-2 rounded-pill px-6 font-sans text-[calc(14px*var(--ws-fs))] font-semibold transition-colors",
              valid
                ? "cursor-pointer bg-brand text-brand-on hover:bg-brand-active"
                : "cursor-not-allowed bg-primary/[0.08] text-muted",
            )}
          >
            {busy && (
              <span className="h-3.5 w-3.5 animate-spin rounded-pill border-2 border-current/30 border-t-current" />
            )}
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={busy ? "busy" : "idle"} {...swap} className="block">
                {busy ? t("community.creating") : t("community.new.submit")}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
      </OverlayPanel>
    </ConfirmModalPortal>
  );
}
