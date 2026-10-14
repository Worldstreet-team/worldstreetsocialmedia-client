"use client";

import {
  ArrowLeft,
  ArrowRight,
  Broadcast,
  CalendarPlus,
  Check,
  FloppyDisk,
  ImageSquare,
  Microphone,
  MicrophoneSlash,
  Spinner,
  WarningCircle as PhWarningCircle,
  X,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import CalendarField from "@/components/ui/CalendarField";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import { useOverlayDismiss } from "@/components/ui/Overlay";
import { VERTICALS } from "@/data/categories";
import { useT } from "@/i18n/client";
import {
  STORY_BACKGROUNDS,
  storyCanvasCss,
} from "@/lib/editor/storyBackgrounds";
import { collapse, pop, press, swap, thumbSpring } from "@/lib/motion-presets";
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

/** Small caps label, the room's eyebrow voice. */
const EYEBROW =
  "font-sans text-[calc(10.5px*var(--ws-fs))] font-semibold uppercase tracking-[0.16em]";

/**
 * The last step before going live (owner 2026-10-12): a real level meter
 * from the browser's own mic, so the host hears they're working before a
 * room full of people does. The stream is closed the moment the step
 * unmounts; the room opens its own connection, muted, as before.
 */
function MicCheck() {
  const t = useT();
  const [levels, setLevels] = useState<number[]>(() => Array(28).fill(0));
  const [device, setDevice] = useState("");
  const [state, setState] = useState<"asking" | "ok" | "blocked">("asking");
  const [heard, setHeard] = useState(false);
  useEffect(() => {
    let raf = 0;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let alive = true;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!alive) return;
        setDevice(stream.getAudioTracks()[0]?.label ?? "");
        ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        setState("ok");
        const loop = () => {
          analyser.getByteFrequencyData(data);
          // Mirrored about the middle, so speech reads as a waveform.
          const half = Array.from({ length: 14 }, (_, i) => data[i + 1] / 255);
          const bars = [...[...half].reverse(), ...half];
          setLevels(bars);
          if (half.some((v) => v > 0.35)) setHeard(true);
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        if (alive) setState("blocked");
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      for (const tr of stream?.getTracks() ?? []) tr.stop();
      void ctx?.close();
    };
  }, []);
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-[22px] bg-white/[0.05] px-5 py-6">
        <span className="flex h-14 items-center justify-center gap-[3px]">
          {levels.map((v, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed bar positions
              key={i}
              className={clsx(
                "w-[4px] rounded-pill transition-[height] duration-75",
                v > 0.08 ? "bg-[#eef2f6]" : "bg-white/15",
              )}
              style={{ height: `${Math.max(4, v * 56)}px` }}
            />
          ))}
        </span>
        <span
          className={clsx(
            "flex items-center justify-center gap-1.5 text-center font-sans text-[calc(13px*var(--ws-fs))] font-medium",
            state === "blocked" ? "text-warning" : heard ? "text-success" : "text-muted",
          )}
        >
          {state === "blocked" ? (
            t("voice.micBlocked")
          ) : heard ? (
            <>
              <Check size={14} weight="bold" />
              {t("voice.micGood")}
            </>
          ) : (
            t("voice.micSay")
          )}
        </span>
      </div>
      {device && (
        <div>
          <span className={clsx(EYEBROW, "block text-muted")}>{t("voice.micInput")}</span>
          <span className="mt-2 flex min-h-12 items-center gap-2.5 rounded-[16px] bg-white/[0.07] px-4 font-sans text-[calc(13.5px*var(--ws-fs))] text-primary">
            <Microphone size={16} weight="fill" className="shrink-0 text-muted" />
            <span className="min-w-0 truncate">{device}</span>
          </span>
        </div>
      )}
      <div className="flex items-start gap-3 rounded-[16px] bg-white/[0.04] px-4 py-3.5">
        <MicrophoneSlash size={16} weight="fill" className="mt-0.5 shrink-0 text-muted" />
        <p className="font-sans text-[calc(12.5px*var(--ws-fs))] leading-relaxed text-muted">
          {t("voice.micMutedNote")}
        </p>
      </div>
    </div>
  );
}

/**
 * Start or schedule a room (owner 2026-10-13, "Setup flow v2"): one dark,
 * full-screen desk over the room's own cover, blurred under the same deep
 * wash as the room itself. The form sits in a frosted panel on the left,
 * four quiet steps; on wide screens a live preview shows the card as it
 * will appear on Explore. Editing a scheduled space keeps one page.
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
  // Per instance, so two sheets could never share one sliding thumb.
  const thumbId = useId();

  const valid = title.trim().length >= 3 && (mode === "now" || when.length > 0);
  // Four steps for a new space: the room, who it's for, when, and a mic
  // check when it starts now. Editing keeps the single page.
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const show = (n: 1 | 2 | 3 | 4) => (isEdit ? n === 1 || n === 3 : step === n);
  const whenLabel = when
    ? new Date(when).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })
    : "";
  const preset = STORY_BACKGROUNDS.find((b) => b.id === cover) ?? STORY_BACKGROUNDS[0];
  const coverCss = coverImage ? `center / cover no-repeat url(${coverImage})` : storyCanvasCss(preset);
  const vertical = VERTICALS.find((v) => v.id === category);
  const community = communities.find((c) => c.id === communityId);
  const steps = [
    t("voice.stepRoom"),
    t("voice.stepWho"),
    t("voice.stepWhen"),
    t("voice.micCheck"),
  ];
  const heads: Record<number, [string, string]> = {
    1: [t("voice.titleLabel"), t("voice.roomSub")],
    2: [t("voice.whoTitle"), t("voice.whoSub")],
    3: [t("voice.whenTitle"), t("voice.whenSub")],
    4: [t("voice.micCheck"), t("voice.micSub")],
  };
  const [heading, sub] = isEdit ? [t("voice.editSpace"), ""] : heads[step];
  const connecting = busy && !isEdit && step === 4;

  // Esc + the body scroll lock come from the overlay grammar.
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

  const submit = () => {
    if (isEdit) {
      // Send the whole editable surface: the sheet is the source of truth
      // for these fields while it's open, and "" is a real value for
      // coverImage (it clears back to the preset).
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
      // ISO, not the raw local "YYYY-MM-DDTHH:mm": the gateway parses in
      // *its* timezone, so the raw string booked the wrong instant for any
      // non-UTC host.
      mode === "later" && when ? new Date(when).toISOString() : undefined,
      communityId || undefined,
      description.trim() || undefined,
      cover,
      coverImage || undefined,
      category || undefined,
    );
  };

  // The button always says what happens next.
  const next = () => {
    if (isEdit) return submit();
    if (step === 1) return setStep(2);
    if (step === 2) return setStep(3);
    if (step === 3 && mode === "now") return setStep(4);
    submit();
  };
  const nextLabel = isEdit
    ? t("voice.saveChanges")
    : step === 1
      ? `${t("voice.next")}: ${t("voice.stepWho").toLowerCase()}`
      : step === 2
        ? `${t("voice.next")}: ${t("voice.stepWhen").toLowerCase()}`
        : step === 3 && mode === "now"
          ? `${t("voice.next")}: ${t("voice.micCheck").toLowerCase()}`
          : step === 3
            ? whenLabel
              ? `${t("voice.schedule")} · ${whenLabel}`
              : t("voice.schedule")
            : t("voice.goLive");
  const disabled =
    busy ||
    uploading ||
    (step === 1 && !isEdit ? title.trim().length < 3 : (step >= 3 || isEdit) && !valid);
  const hint = isEdit
    ? ""
    : step === 1
      ? t("voice.onlyTitle")
      : step === 2
        ? t("voice.canSkip")
        : "";

  const field =
    "rounded-[16px] bg-white/[0.07] px-4 py-3.5 transition-colors focus-within:bg-white/[0.1]";
  const chip = (on: boolean) =>
    clsx(
      "h-9 cursor-pointer rounded-pill px-3.5 font-sans text-[calc(13px*var(--ws-fs))] font-medium transition-colors",
      on ? "bg-[#eef2f6] text-[#05070a]" : "bg-white/[0.07] text-muted hover:text-primary",
    );

  return (
    <ConfirmModalPortal>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? t("voice.editSpace") : t("voice.create")}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="ws-on-dark fixed inset-0 z-modal flex flex-col overflow-hidden bg-[#05070a]"
      >
        {/* The room's own cover, blurred under the room's deep wash: the
            same dark blur as the live room and its collapsed bar. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute -inset-24 scale-110 blur-[90px] transition-[background] duration-500"
            style={{ background: coverCss }}
          />
          <div className="absolute inset-0 bg-[#04060a]/85" />
        </div>

        <header className="relative flex h-14 shrink-0 items-center gap-2 px-5 sm:px-7">
          <span className={clsx(EYEBROW, "text-muted")}>{t("voice.eyebrow")}</span>
          <span className="text-subtle">·</span>
          <span className={clsx(EYEBROW, "text-primary")}>
            {connecting ? t("voice.goingLive") : isEdit ? t("voice.editSpace") : t("voice.create")}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="flex h-9 cursor-pointer items-center gap-1.5 rounded-pill px-3 font-sans text-[calc(13px*var(--ws-fs))] text-muted transition-colors hover:text-primary"
          >
            <X size={14} weight="bold" className="sm:hidden" />
            <span className="hidden sm:inline">{t("common.cancel")}</span>
          </button>
        </header>

        {connecting ? (
          <div className="relative flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
            <span className="relative flex h-32 w-32 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-pill bg-white/[0.06]" />
              <span className="absolute inset-3 rounded-pill bg-white/[0.06]" />
              <span
                className="relative h-20 w-20 overflow-hidden rounded-pill"
                style={{ background: coverCss }}
              />
            </span>
            <div>
              {(community || vertical) && (
                <span className={clsx(EYEBROW, "block text-muted")}>
                  {[community?.name, vertical?.label].filter(Boolean).join("  ·  ")}
                </span>
              )}
              <h2 className="mt-3 font-display text-[calc(30px*var(--ws-fs))] font-medium tracking-[-0.01em] text-primary">
                {t("voice.openingRoom")}
              </h2>
              <p className="mx-auto mt-2 max-w-md font-sans text-[calc(14px*var(--ws-fs))] text-muted">
                {title}
              </p>
            </div>
            <span className="flex items-center gap-2 font-sans text-[calc(13px*var(--ws-fs))] text-muted">
              <Spinner size={14} weight="bold" className="animate-spin" />
              {t("voice.micMutedShort")}
            </span>
          </div>
        ) : (
          <div className="relative flex min-h-0 flex-1 items-stretch justify-center gap-10 px-3 pb-3 sm:px-7 sm:pb-7 lg:gap-16">
            {/* The form, in frosted glass. */}
            <section className="flex min-h-0 w-full max-w-[520px] flex-col rounded-[28px] bg-[#04060a]/60 shadow-[0_24px_64px_rgb(0_0_0/0.5)] backdrop-blur-2xl backdrop-saturate-150">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-6 sm:px-9 sm:pt-8">
                {!isEdit && (
                  <div aria-hidden className="mb-6">
                    <div className="flex gap-1.5">
                      {steps.slice(0, mode === "now" ? 4 : 3).map((label, i) => (
                        <span
                          key={label}
                          className={clsx(
                            "h-[3px] flex-1 rounded-pill transition-colors duration-300",
                            i + 1 <= step ? "bg-brand" : "bg-white/[0.08]",
                          )}
                        />
                      ))}
                    </div>
                    <span className="mt-3 flex items-center gap-2">
                      <span className={clsx(EYEBROW, "text-primary")}>
                        {t("voice.stepOf")
                          .replace("{n}", String(step))
                          .replace("{total}", String(mode === "now" ? 4 : 3))}
                      </span>
                      <span className={clsx(EYEBROW, "text-subtle")}>{steps[step - 1]}</span>
                    </span>
                  </div>
                )}

                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={isEdit ? "edit" : step} {...swap} className="space-y-6 pb-6">
                    <div>
                      <h2 className="font-display text-[calc(28px*var(--ws-fs))] font-medium leading-tight tracking-[-0.01em] text-primary">
                        {heading}
                      </h2>
                      {sub && (
                        <p className="mt-2 font-sans text-[calc(14px*var(--ws-fs))] leading-relaxed text-muted">
                          {sub}
                        </p>
                      )}
                    </div>

                    {show(1) && (
                      <>
                        <div>
                          <span className="flex items-center">
                            <span className={clsx(EYEBROW, "text-muted")}>{t("voice.coverLabel")}</span>
                            <span className="flex-1" />
                            <span className="font-sans text-[calc(12px*var(--ws-fs))] text-subtle">
                              {coverImage ? t("voice.customCover") : preset.label}
                            </span>
                          </span>
                          <div className="mt-2.5 grid grid-cols-7 gap-2">
                            {STORY_BACKGROUNDS.slice(0, 6).map((option) => {
                              // A preset only reads as chosen when no upload
                              // is overriding it.
                              const active = !coverImage && cover === option.id;
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => {
                                    setCover(option.id);
                                    setCoverImage("");
                                    setCoverError("");
                                  }}
                                  aria-label={option.label}
                                  aria-pressed={active}
                                  className={clsx(
                                    "relative h-16 cursor-pointer overflow-hidden rounded-[14px] transition-opacity",
                                    active ? "opacity-100 ring-2 ring-[#eef2f6] ring-offset-2 ring-offset-[#0b0f15]" : "opacity-60 hover:opacity-90",
                                  )}
                                  style={{ background: storyCanvasCss(option) }}
                                >
                                  <AnimatePresence initial={false}>
                                    {active && (
                                      <motion.span
                                        key="check"
                                        {...pop}
                                        className="absolute inset-0 flex items-center justify-center text-[#fafaf9]"
                                      >
                                        <Check size={14} weight="bold" />
                                      </motion.span>
                                    )}
                                  </AnimatePresence>
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => fileRef.current?.click()}
                              disabled={uploading}
                              aria-label={coverImage ? t("voice.removeCover") : t("voice.customCover")}
                              aria-pressed={Boolean(coverImage)}
                              title={t("voice.customCover")}
                              className={clsx(
                                "relative h-16 cursor-pointer overflow-hidden rounded-[14px] transition-colors",
                                coverImage
                                  ? "ring-2 ring-[#eef2f6] ring-offset-2 ring-offset-[#0b0f15]"
                                  : "bg-white/[0.06] hover:bg-white/[0.1]",
                                uploading && "cursor-wait",
                              )}
                              style={
                                coverImage
                                  ? { backgroundImage: `url(${coverImage})`, backgroundSize: "cover", backgroundPosition: "center" }
                                  : undefined
                              }
                            >
                              <span className="absolute inset-0 flex items-center justify-center text-[#eef2f6]">
                                {uploading ? (
                                  <Spinner size={15} weight="bold" className="animate-spin" />
                                ) : coverImage ? (
                                  <Check size={14} weight="bold" />
                                ) : (
                                  <ImageSquare size={17} />
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
                          <AnimatePresence initial={false}>
                            {coverImage && !uploading && (
                              <motion.div key="remove-cover" {...collapse} className="overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCoverImage("");
                                    setCoverError("");
                                  }}
                                  className="mt-2 cursor-pointer font-sans text-[calc(12px*var(--ws-fs))] text-muted underline underline-offset-2 transition-colors hover:text-primary"
                                >
                                  {t("voice.removeCover")}
                                </button>
                              </motion.div>
                            )}
                            {coverError && (
                              <motion.div key="cover-error" {...collapse} className="overflow-hidden">
                                <p
                                  role="alert"
                                  className="mt-2 flex items-center gap-1 font-sans text-[calc(12px*var(--ws-fs))] text-danger"
                                >
                                  <PhWarningCircle weight="fill" size={13} className="shrink-0" />
                                  {coverError}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <div>
                          <span className="flex items-center">
                            <label htmlFor="space-title" className={clsx(EYEBROW, "text-muted")}>
                              {t("voice.titleShort")}
                            </label>
                            <span className="flex-1" />
                            <span className="font-sans text-[calc(12px*var(--ws-fs))] tabular-nums text-subtle">
                              {title.length} / 96
                            </span>
                          </span>
                          <div className={clsx("mt-2.5", field)}>
                            <input
                              id="space-title"
                              value={title}
                              onChange={(e) => setTitle(e.target.value)}
                              maxLength={96}
                              placeholder={t("voice.placeholder")}
                              className="w-full bg-transparent font-sans text-base font-medium text-primary caret-brand outline-none placeholder:text-subtle sm:text-[calc(15px*var(--ws-fs))]"
                            />
                          </div>
                        </div>

                        <div>
                          <span className="flex items-center">
                            <label htmlFor="space-description" className={clsx(EYEBROW, "text-muted")}>
                              {t("voice.descriptionShort")}
                            </label>
                            <span className="flex-1" />
                            <span className="font-sans text-[calc(12px*var(--ws-fs))] text-subtle">
                              {t("voice.optional")}
                            </span>
                          </span>
                          <div className={clsx("mt-2.5", field)}>
                            <textarea
                              id="space-description"
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              maxLength={280}
                              rows={3}
                              placeholder={t("voice.descriptionPlaceholder")}
                              className="w-full resize-none bg-transparent font-sans text-base leading-relaxed text-primary caret-brand outline-none placeholder:text-subtle sm:text-[calc(14px*var(--ws-fs))]"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {show(2) && (
                      <>
                        <div>
                          <span className={clsx(EYEBROW, "block text-muted")}>{t("voice.topic")}</span>
                          {/* The 14 verticals, the field the hub's chips
                              filter on; a room is broader than a post. */}
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {[{ id: "", label: t("voice.general") }, ...VERTICALS].map((v) => (
                              <button
                                key={v.id || "general"}
                                type="button"
                                aria-pressed={category === v.id}
                                onClick={() => setCategory(v.id)}
                                className={chip(category === v.id)}
                              >
                                {v.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {communities.length > 0 && (
                          <div>
                            <span className={clsx(EYEBROW, "block text-muted")}>
                              {t("voice.communityLabel")}
                            </span>
                            <div className="mt-2.5 space-y-1.5">
                              {[{ id: "", name: t("voice.standalone") }, ...communities].map((c) => {
                                const on = communityId === c.id;
                                return (
                                  <button
                                    key={c.id || "none"}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => setCommunityId(c.id)}
                                    className={clsx(
                                      "flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-[16px] px-4 text-left transition-colors",
                                      on ? "bg-white/[0.1]" : "bg-white/[0.04] hover:bg-white/[0.07]",
                                    )}
                                  >
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-white/[0.08] font-sans text-[calc(12px*var(--ws-fs))] font-semibold text-primary">
                                      {c.name.slice(0, 1).toUpperCase()}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary">
                                      {c.name}
                                    </span>
                                    {on && <Check size={15} weight="bold" className="shrink-0 text-primary" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {show(3) && (
                      <div>
                        {isEdit && (
                          <span className={clsx(EYEBROW, "block text-muted")}>{t("voice.reschedule")}</span>
                        )}
                        {/* Editing never converts a scheduled space into a
                            live one — that is what Start is for. */}
                        <div className={clsx("grid grid-cols-2 gap-1 rounded-pill bg-white/[0.06] p-1", isEdit && "hidden")}>
                          {(
                            [
                              { id: "now", label: t("voice.goLiveNow"), icon: Broadcast },
                              { id: "later", label: t("voice.schedule"), icon: CalendarPlus },
                            ] as const
                          ).map(({ id, label, icon: Icon }) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setMode(id)}
                              aria-pressed={mode === id}
                              className={clsx(
                                "relative flex h-11 cursor-pointer items-center justify-center gap-2 rounded-pill font-sans text-[calc(13.5px*var(--ws-fs))] font-medium transition-colors",
                                mode === id ? "text-[#05070a]" : "text-muted hover:text-primary",
                              )}
                            >
                              {mode === id && (
                                <motion.span
                                  layoutId={`${thumbId}-when`}
                                  transition={thumbSpring}
                                  aria-hidden
                                  className="absolute inset-0 rounded-pill bg-[#eef2f6]"
                                />
                              )}
                              <Icon size={15} weight="bold" className="relative" />
                              <span className="relative">{label}</span>
                            </button>
                          ))}
                        </div>
                        <AnimatePresence initial={false}>
                          {(mode === "later" || isEdit) && (
                            <motion.div key="when" {...collapse} className="overflow-hidden">
                              <div className="mt-3">
                                <CalendarField value={when} onChange={setWhen} />
                              </div>
                            </motion.div>
                          )}
                          {mode === "now" && !isEdit && (
                            <motion.p
                              key="now-note"
                              {...collapse}
                              className="mt-3 overflow-hidden font-sans text-[calc(13px*var(--ws-fs))] leading-relaxed text-muted"
                            >
                              {t("voice.nowNote")}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {show(4) && <MicCheck />}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex shrink-0 items-center gap-3 px-6 pb-[calc(20px+var(--ws-safe-bottom))] pt-3 sm:px-9 sm:pb-8">
                {!isEdit && step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep((step - 1) as 1 | 2 | 3)}
                    className="flex h-12 shrink-0 cursor-pointer items-center gap-1.5 rounded-pill px-2 font-sans text-[calc(14px*var(--ws-fs))] font-medium text-muted transition-colors hover:text-primary"
                  >
                    <ArrowLeft size={14} weight="bold" />
                    {t("voice.back")}
                  </button>
                ) : (
                  <span className="min-w-0 truncate font-sans text-[calc(12.5px*var(--ws-fs))] text-subtle">
                    {hint}
                  </span>
                )}
                <span className="flex-1" />
                <motion.button
                  {...press}
                  type="button"
                  disabled={disabled}
                  onClick={next}
                  className={clsx(
                    "flex h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-pill px-6 font-sans text-[calc(14px*var(--ws-fs))] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    !isEdit && step === 4
                      ? "bg-danger text-white hover:bg-danger/90"
                      : "bg-brand text-brand-on hover:bg-brand-active",
                  )}
                >
                  {busy ? (
                    <span className="h-4 w-4 animate-spin rounded-pill border-2 border-current/30 border-t-current" />
                  ) : isEdit ? (
                    <FloppyDisk size={16} weight="bold" />
                  ) : step === 4 ? (
                    <span className="h-2 w-2 animate-pulse rounded-pill bg-white" />
                  ) : null}
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span key={nextLabel} {...swap} className="inline-block">
                      {nextLabel}
                    </motion.span>
                  </AnimatePresence>
                  {!isEdit && step < 3 && <ArrowRight size={15} weight="bold" />}
                  {!isEdit && step === 3 && mode === "later" && <CalendarPlus size={15} weight="bold" />}
                </motion.button>
              </div>
            </section>

            {/* How it will show on Explore, updating as you type. */}
            <aside className="hidden w-[520px] shrink-0 flex-col justify-center gap-4 lg:flex">
              <span className={clsx(EYEBROW, "text-subtle")}>{t("voice.livePreview")}</span>
              <div className="overflow-hidden rounded-[28px] bg-[#0b0f15]/90 shadow-[0_24px_64px_rgb(0_0_0/0.55)]">
                <div className="relative h-[200px]" style={{ background: coverCss }}>
                  <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-pill bg-[#05070a]/70 px-3 py-1.5 font-sans text-[calc(10.5px*var(--ws-fs))] font-semibold uppercase tracking-[0.14em] text-[#eef2f6] backdrop-blur-md">
                    {mode === "now" ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-pill bg-[#e5484d]" />
                        {t("voice.live")}
                      </>
                    ) : (
                      <>
                        <CalendarPlus size={11} weight="bold" />
                        {whenLabel || t("voice.schedule")}
                      </>
                    )}
                  </span>
                </div>
                <div className="space-y-3 p-6">
                  {community || vertical ? (
                    <span className={clsx(EYEBROW, "block text-muted")}>
                      {[community?.name, vertical?.label].filter(Boolean).join("  ·  ")}
                    </span>
                  ) : (
                    <span className="block h-2 w-36 rounded-pill bg-white/[0.07]" />
                  )}
                  {title.trim() ? (
                    <h3 className="font-display text-[calc(24px*var(--ws-fs))] font-medium leading-snug tracking-[-0.01em] text-primary">
                      {title}
                    </h3>
                  ) : (
                    <span className="block space-y-2">
                      <span className="block h-5 w-4/5 rounded-pill bg-white/[0.08]" />
                      <span className="block h-5 w-1/2 rounded-pill bg-white/[0.08]" />
                    </span>
                  )}
                  {description.trim() ? (
                    <p className="line-clamp-2 font-sans text-[calc(13.5px*var(--ws-fs))] leading-relaxed text-muted">
                      {description}
                    </p>
                  ) : (
                    <span className="block h-2 w-3/4 rounded-pill bg-white/[0.05]" />
                  )}
                </div>
              </div>
              <span className="text-center font-sans text-[calc(12px*var(--ws-fs))] text-subtle">
                {t("voice.previewNote")}
              </span>
            </aside>
          </div>
        )}
      </motion.div>
    </ConfirmModalPortal>
  );
}
