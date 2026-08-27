"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Camera, Check } from "@phosphor-icons/react";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import {
  OverlayHeader,
  OverlayPanel,
  OverlayScrim,
  useOverlayDismiss,
} from "@/components/ui/Overlay";
import GlassSelect from "@/components/ui/GlassSelect";
import { CATEGORIES, VERTICALS, type VerticalId } from "@/data/categories";
import { checkSlugAction } from "@/lib/community.actions";
import { useT } from "@/i18n/client";

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
    "block font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-subtle";
  // The panel follows the theme, so the field fills come from tokens — a
  // fixed-white glass-input is a white block on the light frost.
  const input =
    "w-full rounded-xl bg-sunken px-3.5 py-3 font-sans text-[15px] text-primary outline-none transition-colors placeholder:text-subtle focus:bg-raised";

  return (
    <ConfirmModalPortal>
      <OverlayScrim onClose={onClose} label={t("common.cancel")} />
      <OverlayPanel variant="sheet" label={t("community.new.title")}>
        <OverlayHeader onClose={onClose} closeLabel={t("common.cancel")}>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-sans text-[14px] font-semibold text-primary">
              {t("community.new.title")}
            </h2>
            <p className="truncate font-sans text-[11.5px] text-subtle">
              {t("community.new.subtitle")}
            </p>
          </div>
        </OverlayHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5">
          <div className="flex flex-col gap-4">
            {/* icon */}
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label={t("community.field.avatarAdd")}
                className="relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-xl bg-sunken transition-opacity hover:opacity-90"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-subtle">
                    <Camera size={20} weight="duotone" />
                  </span>
                )}
              </button>
              <div className="min-w-0">
                <span className={field}>{t("community.field.avatar")}</span>
                <div className="mt-1.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="h-7 cursor-pointer rounded-pill bg-chip px-3 font-sans text-[12px] font-semibold text-primary transition-colors hover:bg-raised"
                  >
                    {avatarUrl
                      ? t("community.field.avatarChange")
                      : t("community.field.avatarAdd")}
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(avatarUrl);
                        setAvatar(null);
                        setAvatarUrl(null);
                      }}
                      className="h-7 cursor-pointer rounded-pill px-3 font-sans text-[12px] font-semibold text-muted transition-colors hover:text-primary"
                    >
                      {t("community.field.avatarRemove")}
                    </button>
                  )}
                </div>
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
              <label htmlFor="community-name" className={field}>
                {t("community.field.name")}
              </label>
              <input
                id="community-name"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
                placeholder={t("community.field.namePlaceholder")}
                // text-base on mobile or iOS Safari zooms the page on focus.
                className={clsx(input, "mt-1.5 text-base sm:text-[15px]")}
                autoFocus
              />
              <p className="mt-1.5 min-h-[18px] font-sans text-[12px] text-subtle">
                {!nameValid ? (
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

            {/* description */}
            <div>
              <label htmlFor="community-desc" className={field}>
                {t("community.field.description")}
              </label>
              <textarea
                id="community-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC))}
                placeholder={t("community.field.descriptionPlaceholder")}
                rows={3}
                className={clsx(input, "mt-1.5 resize-none text-base sm:text-[15px]")}
              />
              <p className="mt-1 text-right font-sans text-[11px] tabular-nums text-subtle">
                {description.length}/{MAX_DESC}
              </p>
            </div>

            {/* topic, from the 100-category taxonomy */}
            <div>
              <span className={field}>{t("community.field.topic")}</span>
              <div className="mt-1.5">
                <GlassSelect
                  value={vertical}
                  onChange={(id) => {
                    setVertical(id as VerticalId);
                    setCategory("");
                  }}
                  options={VERTICALS.map((v) => ({ id: v.id, label: v.label }))}
                />
              </div>
              <div className="mt-2.5 flex max-h-[132px] flex-wrap gap-1.5 overflow-y-auto">
                {categoriesInVertical.map((c) => {
                  const on = category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(on ? "" : c.id)}
                      aria-pressed={on}
                      className={clsx(
                        "flex h-8 cursor-pointer items-center gap-1 rounded-pill px-3 font-sans text-[12px] font-medium transition-colors",
                        on
                          ? "bg-primary text-page"
                          : "bg-chip text-muted hover:text-primary",
                      )}
                    >
                      {on && <Check size={11} weight="bold" />}
                      {c.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 font-sans text-[12px] text-subtle">
                {t("community.field.topicHint")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 px-4 pb-[calc(16px+var(--ws-safe-bottom))] pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 cursor-pointer rounded-pill px-4 font-sans text-[13px] font-semibold text-muted transition-colors hover:text-primary"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() =>
              onCreate({
                name: trimmed,
                description: description.trim(),
                category: category || "general",
                avatar,
              })
            }
            className={clsx(
              "flex h-10 items-center gap-2 rounded-pill px-5 font-sans text-[13px] font-semibold transition-colors",
              valid
                ? "cursor-pointer bg-brand text-brand-on hover:bg-brand-active"
                : "cursor-not-allowed bg-chip text-muted opacity-60",
            )}
          >
            {busy && (
              <span className="h-3.5 w-3.5 animate-spin rounded-pill border-2 border-current/30 border-t-current" />
            )}
            {busy ? t("community.creating") : t("community.new.submit")}
          </button>
        </div>
      </OverlayPanel>
    </ConfirmModalPortal>
  );
}
