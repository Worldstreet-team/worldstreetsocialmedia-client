"use client";

import {
  Broadcast,
  CalendarPlus,
  Check,
  FloppyDisk,
  ImageSquare,
  Spinner,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { useRef, useState } from "react";
import CalendarField from "@/components/ui/CalendarField";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import {
  OverlayHeader,
  OverlayPanel,
  OverlayScrim,
  useOverlayDismiss,
} from "@/components/ui/Overlay";
import GlassSelect from "@/components/ui/GlassSelect";
import { VERTICALS } from "@/data/categories";
import { useT } from "@/i18n/client";
import {
  STORY_BACKGROUNDS,
  storyCanvasCss,
} from "@/lib/editor/storyBackgrounds";
import { sendFormDirect } from "@/lib/upload-direct";

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
    category?: string,
  ) => void;
  onSave?: (patch: SpacePatch) => void;
}

/** Cap matches the gateway's multer limit, so a reject happens before upload. */
const MAX_COVER_BYTES = 8 * 1024 * 1024;

/**
 * Downscale a cover before upload. The art paints a 168px card behind a
 * blur; an 8MB original buys nothing but transfer time and R2 bytes. Falls
 * back to the original whenever the canvas path fails (odd formats, iOS
 * quirks) — a full-size upload is a worse outcome than a failed one.
 */
async function downscaleCover(file: File): Promise<File> {
  try {
    const MAX_EDGE = 1600;
    const bitmap = await createImageBitmap(file);
    if (Math.max(bitmap.width, bitmap.height) <= MAX_EDGE) {
      bitmap.close();
      return file;
    }
    const scale = MAX_EDGE / Math.max(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

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
  const isEdit = Boolean(editing);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [category, setCategory] = useState("");
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

  // Esc + the body scroll lock come from the overlay grammar now.
  useOverlayDismiss(true, onClose);

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
      form.append("cover", await downscaleCover(file));
      const r = await sendFormDirect("/api/spaces/cover", form);
      const res = r.success
        ? { success: true as const, url: (r.data as any)?.url as string }
        : { success: false as const, url: undefined, message: r.message };
      if (res.success && res.url) setCoverImage(res.url);
      else setCoverError(res.message || t("voice.coverNotImage"));
    } finally {
      setUploading(false);
      // Let the same file be re-picked after a failure.
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <ConfirmModalPortal>
      <OverlayScrim onClose={onClose} label={t("common.close")} />
      <OverlayPanel
        dragClose={onClose} variant="sheet"
        label={isEdit ? t("voice.editSpace") : t("voice.create")}
      >
        <OverlayHeader onClose={onClose} closeLabel={t("common.close")}>
          <div className="min-w-0 flex-1">
            <span className="block font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
              {t("voice.eyebrow")}
            </span>
            <h2 className="truncate font-sans text-[14px] font-semibold leading-tight text-primary">
              {isEdit ? t("voice.editSpace") : t("voice.create")}
            </h2>
          </div>
        </OverlayHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="space-title"
                className="block font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-subtle"
              >
                {t("voice.titleLabel")}
              </label>
              <div className="mt-2 rounded-xl bg-sunken px-3.5 py-3 transition-colors focus-within:bg-raised">
                <input
                  id="space-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={96}
                  placeholder={t("voice.placeholder")}
                  className="w-full bg-transparent font-sans text-base font-medium text-primary outline-none placeholder:text-subtle sm:text-[15px]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="space-description"
                className="block font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-subtle"
              >
                {t("voice.descriptionLabel")}
              </label>
              <div className="mt-2 rounded-xl bg-sunken px-3.5 py-3 transition-colors focus-within:bg-raised">
                <textarea
                  id="space-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={280}
                  rows={2}
                  placeholder={t("voice.descriptionPlaceholder")}
                  className="w-full resize-none bg-transparent font-sans text-base leading-relaxed text-primary outline-none placeholder:text-subtle sm:text-[13px]"
                />
              </div>
            </div>

            <div>
              <span className="block font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
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
                      : "border border-dashed border-hairline opacity-70 hover:opacity-100",
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
                  <span
                    className={clsx(
                      "absolute inset-0 flex items-center justify-center",
                      // White only when it sits on the uploaded art; on the
                      // bare panel it needs theme ink to be visible at all.
                      coverImage ? "text-[#fafaf9]" : "text-muted",
                    )}
                  >
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
                  className="mt-2 cursor-pointer font-sans text-[12px] text-muted underline underline-offset-2 transition-colors hover:text-primary"
                >
                  {t("voice.removeCover")}
                </button>
              )}
              {coverError && (
                <p className="mt-2 font-sans text-[12px] text-danger">
                  {coverError}
                </p>
              )}
            </div>

            <div>
              <span className="block font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
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
                        ? "bg-primary text-page"
                        : "bg-chip text-muted hover:text-primary",
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

            {!isEdit && (
              <div>
                <span className="block font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
                  Topic
                </span>
                {/* A vertical, not the 100-item taxonomy: a room is broader
                    than a post, and the hub's chips are the 14 verticals —
                    this is the field those chips filter on. */}
                <GlassSelect
                  className="mt-2"
                  label="Topic"
                  value={category}
                  options={[
                    { id: "", label: "General" },
                    ...VERTICALS.map((v) => ({ id: v.id, label: v.label })),
                  ]}
                  onChange={setCategory}
                />
              </div>
            )}

            {communities.length > 0 && !isEdit && (
              <div>
                <span className="block font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
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
          </div>
        </div>

        <div className="shrink-0 px-4 pb-[calc(16px+var(--ws-safe-bottom))] pt-2">
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
                category || undefined,
              );
            }}
            className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-brand font-sans text-[14px] font-semibold text-brand-on transition-colors hover:bg-brand-active active:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <span className="h-4 w-4 animate-spin rounded-pill border-2 border-current/30 border-t-current" />
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
      </OverlayPanel>
    </ConfirmModalPortal>
  );
}
