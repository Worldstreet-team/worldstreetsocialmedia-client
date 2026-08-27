"use client";

import {
  Broadcast,
  CalendarPlus,
  Check,
  FloppyDisk,
  ImageSquare,
  Spinner,
  X,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import CalendarField from "@/components/ui/CalendarField";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import GlassSelect from "@/components/ui/GlassSelect";
import { useT } from "@/i18n/client";
import {
  STORY_BACKGROUNDS,
  storyCanvasCss,
} from "@/lib/editor/storyBackgrounds";
import { uploadSpaceCoverAction } from "@/lib/space.actions";

const EASE = [0.2, 0, 0, 1] as const;

/** The scheduled space being edited, when the sheet opens in edit mode. */
export interface EditableSpace {
  id: string;
  title: string;
  description?: string;
  cover?: string;
  coverImage?: string;
  /** ISO string from the gateway. */
  scheduledFor?: string;
}

export interface SpacePatch {
  title?: string;
  description?: string;
  cover?: string;
  coverImage?: string;
  scheduledFor?: string;
}

interface CreateSpaceSheetProps {
  communities: { id: string; name: string }[];
  busy: boolean;
  /** Present when editing an existing scheduled space rather than creating. */
  editing?: EditableSpace | null;
  onClose: () => void;
  onCreate: (
    title: string,
    when?: string,
    communityId?: string,
    description?: string,
    cover?: string,
    coverImage?: string,
  ) => void;
  onSave?: (patch: SpacePatch) => void;
}

/** Cap matches the gateway's multer limit, so a reject happens before upload. */
const MAX_COVER_BYTES = 8 * 1024 * 1024;

/**
 * The gateway wants an ISO instant; CalendarField speaks local
 * "YYYY-MM-DDTHH:mm". Converting here keeps both of them honest about
 * timezone instead of passing a naive string through.
 *
 * The minute is snapped to the half hour because the picker only offers
 * :00 and :30 — an exact 12:58 matched no option and the field rendered
 * "Pick a time" over a space that very much had one. The snapped value is
 * only ever used for display and comparison: an untouched time is never
 * written back, so nobody's room silently moves by 28 minutes.
 */
function isoToLocalInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const snapped = d.getMinutes() < 15 ? 0 : d.getMinutes() < 45 ? 30 : 0;
  // Rounding 45+ up lands in the next hour.
  const hour = d.getMinutes() >= 45 ? d.getHours() + 1 : d.getHours();
  const rolled = new Date(d);
  rolled.setHours(hour, snapped, 0, 0);
  return `${rolled.getFullYear()}-${pad(rolled.getMonth() + 1)}-${pad(
    rolled.getDate(),
  )}T${pad(rolled.getHours())}:${pad(rolled.getMinutes())}`;
}

/**
 * Start or schedule a room — the same frosted sheet grammar as the story
 * entry point, so creating anything on WorldStreet feels like one product.
 */
export default function CreateSpaceSheet({
  communities,
  busy,
  editing = null,
  onClose,
  onCreate,
  onSave,
}: CreateSpaceSheetProps) {
  const t = useT();
  const reduce = useReducedMotion();
  const isEdit = Boolean(editing);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  // A scheduled space stays scheduled while you edit it; only a new space
  // gets to choose between starting now and booking a slot.
  const [mode, setMode] = useState<"now" | "later">(isEdit ? "later" : "now");
  // Snapshot of what the sheet opened with, so an untouched time can be left
  // out of the patch entirely rather than rewritten from a rounded display.
  const initialWhen = isoToLocalInput(editing?.scheduledFor);
  const [when, setWhen] = useState(initialWhen);
  const [communityId, setCommunityId] = useState("");
  // Cover art: the story canvases double as room art, so a host picks a look
  // instead of hunting for an image, but can bring their own.
  const [cover, setCover] = useState(
    editing?.cover || STORY_BACKGROUNDS[0].id,
  );
  const [coverImage, setCoverImage] = useState(editing?.coverImage ?? "");
  const [uploading, setUploading] = useState(false);
  const [coverError, setCoverError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const valid = title.trim().length >= 3 && (mode === "now" || when.length > 0);

  const pickCover = async (file: File) => {
    setCoverError("");
    if (!file.type.startsWith("image/")) {
      setCoverError(t("voice.coverNotImage"));
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      setCoverError(t("voice.coverTooBig"));
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("cover", file);
      const res = await uploadSpaceCoverAction(form);
      if (res.success && res.url) setCoverImage(res.url);
      else setCoverError(res.message || t("voice.coverNotImage"));
    } finally {
      setUploading(false);
      // Let the same file be re-picked after a failure.
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <ConfirmModalPortal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: EASE }}
        className="fixed inset-0 z-modal flex items-end sm:items-center justify-center glass-veil-sheer backdrop-blur-md backdrop-saturate-150 sm:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={
            reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.985 }
          }
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.32, ease: EASE }}
          role="dialog"
          aria-modal="true"
          aria-label={isEdit ? t("voice.editSpace") : t("voice.create")}
          className="w-full sm:max-w-[440px] glass-dock backdrop-blur-xl backdrop-saturate-150 glass-ink rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 pb-safe"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="glass-eyebrow font-sans block">
                {t("voice.eyebrow")}
              </span>
              <h2 className="mt-2 font-display text-[22px] font-semibold leading-tight tracking-tight">
                {isEdit ? t("voice.editSpace") : t("voice.create")}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill glass-chip backdrop-blur-md transition-colors cursor-pointer"
            >
              <X size={16} weight="bold" />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="space-title"
                className="glass-eyebrow font-sans block"
              >
                {t("voice.titleLabel")}
              </label>
              <div className="mt-2 rounded-xl glass-input px-3.5 py-3">
                <input
                  id="space-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={96}
                  placeholder={t("voice.placeholder")}
                  className="w-full bg-transparent font-sans text-[15px] font-medium outline-none placeholder:text-[#fafaf9]/32"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="space-description"
                className="glass-eyebrow font-sans block"
              >
                {t("voice.descriptionLabel")}
              </label>
              <div className="mt-2 rounded-xl glass-input px-3.5 py-3">
                <textarea
                  id="space-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={280}
                  rows={2}
                  placeholder={t("voice.descriptionPlaceholder")}
                  className="w-full resize-none bg-transparent font-sans text-[13px] leading-relaxed outline-none placeholder:text-[#fafaf9]/32"
                />
              </div>
            </div>

            <div>
              <span className="glass-eyebrow font-sans block">
                {t("voice.coverLabel")}
              </span>
              <div className="mt-2 grid grid-cols-7 gap-2">
                {STORY_BACKGROUNDS.slice(0, 6).map((option) => {
                  // A preset only reads as chosen when no upload is overriding
                  // it, since the image is what would actually be shown.
                  const active = !coverImage && cover === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setCover(option.id);
                        // Picking a preset means abandoning the upload,
                        // otherwise the image would silently keep winning.
                        setCoverImage("");
                        setCoverError("");
                      }}
                      aria-label={option.label}
                      aria-pressed={active}
                      className={clsx(
                        "relative h-11 rounded-[10px] overflow-hidden transition-opacity cursor-pointer",
                        active ? "opacity-100" : "opacity-55 hover:opacity-85",
                      )}
                      style={{ background: storyCanvasCss(option) }}
                    >
                      {active && (
                        <span className="absolute inset-0 flex items-center justify-center text-[#fafaf9]">
                          <Check size={13} weight="bold" />
                        </span>
                      )}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  aria-label={
                    coverImage ? t("voice.removeCover") : t("voice.customCover")
                  }
                  aria-pressed={Boolean(coverImage)}
                  title={t("voice.customCover")}
                  className={clsx(
                    "relative h-11 rounded-[10px] overflow-hidden transition-opacity cursor-pointer",
                    coverImage
                      ? "opacity-100"
                      : "border border-dashed border-[#fafaf9]/25 opacity-70 hover:opacity-100",
                    uploading && "cursor-wait",
                  )}
                  style={
                    coverImage
                      ? {
                          backgroundImage: `url(${coverImage})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                >
                  <span className="absolute inset-0 flex items-center justify-center text-[#fafaf9]">
                    {uploading ? (
                      <Spinner size={14} weight="bold" className="animate-spin" />
                    ) : coverImage ? (
                      <Check size={13} weight="bold" />
                    ) : (
                      <ImageSquare size={15} weight="bold" />
                    )}
                  </span>
                </button>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void pickCover(file);
                  }}
                />
              </div>

              {coverImage && !uploading && (
                <button
                  type="button"
                  onClick={() => {
                    setCoverImage("");
                    setCoverError("");
                  }}
                  className="mt-2 font-sans text-[12px] text-[#fafaf9]/55 underline underline-offset-2 transition-colors hover:text-[#fafaf9] cursor-pointer"
                >
                  {t("voice.removeCover")}
                </button>
              )}
              {coverError && (
                <p className="mt-2 font-sans text-[12px] text-[#f87171]">
                  {coverError}
                </p>
              )}
            </div>

            <div>
              <span className="glass-eyebrow font-sans block">
                {isEdit ? t("voice.reschedule") : t("voice.when")}
              </span>
              {/* Editing never converts a scheduled space into a live one —
                  that is what Start is for — so the choice isn't offered. */}
              <div className={clsx("mt-2 grid grid-cols-2 gap-2", isEdit && "hidden")}>
                {(
                  [
                    { id: "now", label: t("voice.goLiveNow"), icon: Broadcast },
                    {
                      id: "later",
                      label: t("voice.schedule"),
                      icon: CalendarPlus,
                    },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMode(id)}
                    aria-pressed={mode === id}
                    className={clsx(
                      "flex items-center justify-center gap-2 rounded-xl px-3 py-3 font-sans text-[13px] font-semibold transition-colors cursor-pointer",
                      mode === id
                        ? "glass-chip-active"
                        : "bg-[#fafaf9]/[0.05] hover:bg-[#fafaf9]/[0.1]",
                    )}
                  >
                    <Icon size={15} weight="bold" />
                    {label}
                  </button>
                ))}
              </div>
              {(mode === "later" || isEdit) && (
                <div className="mt-2">
                  <CalendarField value={when} onChange={setWhen} />
                </div>
              )}
            </div>

            {communities.length > 0 && !isEdit && (
              <div>
                <span className="glass-eyebrow font-sans block">
                  {t("voice.communityLabel")}
                </span>
                <GlassSelect
                  className="mt-2"
                  label={t("voice.communityLabel")}
                  value={communityId}
                  options={[
                    { id: "", label: t("voice.standalone") },
                    ...communities.map((c) => ({ id: c.id, label: c.name })),
                  ]}
                  onChange={setCommunityId}
                />
              </div>
            )}

            <button
              type="button"
              disabled={busy || uploading || !valid}
              onClick={() => {
                if (isEdit) {
                  // Send the whole editable surface: the sheet is the source
                  // of truth for these fields while it's open, and "" is a
                  // real value for coverImage (it clears back to the preset).
                  onSave?.({
                    title: title.trim(),
                    description: description.trim(),
                    cover,
                    coverImage,
                    ...(when && when !== initialWhen
                      ? { scheduledFor: new Date(when).toISOString() }
                      : {}),
                  });
                  return;
                }
                onCreate(
                  title.trim(),
                  // ISO, not the raw local "YYYY-MM-DDTHH:mm": the gateway
                  // parses in *its* timezone, so the raw string booked the
                  // wrong instant for any non-UTC host. Edit already did
                  // this — and silently "corrected" the create-time error,
                  // which is what kept the bug hidden.
                  mode === "later" && when
                    ? new Date(when).toISOString()
                    : undefined,
                  communityId || undefined,
                  description.trim() || undefined,
                  cover,
                  coverImage || undefined,
                );
              }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-pill glass-cta font-sans text-[14px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:brightness-95"
            >
              {busy ? (
                <span className="h-4 w-4 animate-spin rounded-pill border-2 border-[#0c0a09]/25 border-t-[#0c0a09]" />
              ) : isEdit ? (
                <FloppyDisk size={16} weight="bold" />
              ) : (
                <Broadcast size={16} weight="bold" />
              )}
              {isEdit
                ? t("voice.saveChanges")
                : mode === "later"
                  ? t("voice.schedule")
                  : t("voice.goLiveNow")}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </ConfirmModalPortal>
  );
}
