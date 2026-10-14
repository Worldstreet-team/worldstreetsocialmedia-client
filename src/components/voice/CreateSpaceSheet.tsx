"use client";

import {
  ArrowCounterClockwise,
  ArrowLeft,
  Check,
  FloppyDisk,
  ImageSquare,
  Microphone,
  MicrophoneSlash,
  Spinner,
  TextAlignLeft,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useAtomValue } from "jotai";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import { useOverlayDismiss } from "@/components/ui/Overlay";
import { spaceBackground } from "@/components/voice/SpaceCard";
import {
  AudienceStep,
  type AudienceProblem,
  type ChosenCommunity,
} from "@/components/voice/setup/AudienceStep";
import s from "@/components/voice/setup/setup.module.css";
import { chip, fmt, note, soft } from "@/components/voice/setup/styles";
import { TimingStep } from "@/components/voice/setup/TimingStep";
import {
  defaultWhen,
  LEAD_MS,
  localDate,
  nearestSlot,
  splitWhen,
  whenSentence,
} from "@/components/voice/setup/time";
import { suggestVerticals } from "@/components/voice/setup/topics";
import { useMicCheck } from "@/components/voice/setup/useMicCheck";
import { useMyCommunities } from "@/components/voice/setup/useMyCommunities";
import { SignalArt, type SignalSceneId } from "@/components/voice/signal/SignalArt";
import { useT } from "@/i18n/client";
import { useMotionReduced } from "@/lib/motion";
import { collapse, DUR, EASE, MORPH, press, swap } from "@/lib/motion-presets";
import { sendFormDirect } from "@/lib/upload-direct";
import { userAtom } from "@/store/user.atom";

/** The scheduled space being edited, when the sheet opens in edit mode. */
export interface EditableSpace {
  id: string;
  title: string;
  description?: string;
  cover?: string;
  coverImage?: string;
  /** ISO string from the gateway. */
  scheduledFor?: string;
  /** Its topic (a vertical id), shown read-only: the gateway can't change it. */
  category?: string;
  /** Who it goes to, shown read-only: fixed once a room exists. */
  communities?: { id: string; name: string }[];
}

export interface SpacePatch {
  title?: string;
  description?: string;
  cover?: string;
  coverImage?: string;
  scheduledFor?: string;
}

/** Everything a new room is made of, as the sheet hands it to the page. */
export interface SpaceDraft {
  title: string;
  /** ISO instant; absent means live now. */
  scheduledFor?: string;
  /** Up to three, the host a member of each. */
  communityIds: string[];
  description?: string;
  coverImage?: string;
  /** A vertical id from src/data/categories.ts. */
  category?: string;
}

/** The page's answer to a create, with the gateway's words when it refuses. */
export interface SpaceCreateResult {
  success: boolean;
  message?: string;
  code?: string;
  communityId?: string;
}

interface CreateSpaceSheetProps {
  busy: boolean;
  /** Present when editing an existing scheduled space rather than creating. */
  editing?: EditableSpace | null;
  onClose: () => void;
  /**
   * Make the room. Live: the page opens it and closes the sheet. Scheduled:
   * the page leaves the sheet up, which ends on the clock with a
   * confirmation and closes itself.
   */
  onCreate: (draft: SpaceDraft) => Promise<SpaceCreateResult>;
  onSave?: (patch: SpacePatch) => void;
}

/** Cap matches the gateway's multer limit, so a reject happens before upload. */
const MAX_COVER_BYTES = 8 * 1024 * 1024;

/**
 * Downscale a cover before upload. The art paints a 168px card behind a
 * blur; an 8MB original buys nothing but transfer time and R2 bytes. Falls
 * back to the original whenever the canvas path fails (odd formats, iOS
 * quirks): a full-size upload is a worse outcome than a failed one.
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
 * The gateway wants an ISO instant; the picker speaks local
 * "YYYY-MM-DDTHH:mm". Converting here keeps both of them honest about
 * timezone instead of passing a naive string through.
 *
 * The minute is snapped to the half hour because the picker only offers
 * :00 and :30. An exact 12:58 matched no option and the field rendered
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

/** Who hears about the room, in words, with the reach when we know it. */
function audienceLine(
  chosen: ChosenCommunity[],
  followers: number | undefined,
  tense: "will" | "does",
) {
  const names = chosen.map((c) => c.name);
  const who =
    names.length === 0
      ? "Your followers"
      : names.length === 1
        ? `Your followers and ${names[0]}`
        : names.length === 2
          ? `Your followers, ${names[0]} and ${names[1]}`
          : `Your followers and ${names.length} communities`;
  if (tense === "does") return `${who} hear about it.`;
  // No follower count, no number: the names still say who.
  if (typeof followers !== "number") return who;
  const reach = followers + chosen.reduce((n, c) => n + (c.membersCount ?? 0), 0);
  if (reach <= 0) return who;
  return `${who} · about ${fmt(reach)} ${reach === 1 ? "person" : "people"} will be told`;
}

/** The band's crop on a phone: the middle 600 of the 1000, edge to edge. */
const PHONE_VIEWBOX = "200 0 600 260";
const NARROW = "(max-width: 639px)";
function useNarrow() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(NARROW);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Step = 1 | 2 | 3 | 4;
type Phase = "steps" | "launching" | "scheduled";

/**
 * Start or schedule a room: "The Signal" (owner pick 2026-10-14, replacing
 * setup flow v2). One line runs across the screen and morphs with every
 * step (`SignalArt`, mounted ONCE for the whole sheet; only its props
 * change). The question sits centred above the line, the step's controls
 * under it, Back and Next at the foot, over the room's own picture blurred
 * under the mode's veil.
 *
 *   1  Room      the title typed ON the line; a description and a cover
 *                photo, both optional. No colour themes: a room without a
 *                photo wears the house look. A photo becomes the ground at
 *                once, from the device, while it uploads.
 *   2  Audience  a topic suggested from the title, and a "To" field: your
 *                followers plus up to three of your communities, searched
 *                on the gateway. Each one takes a seat on the line.
 *   3  Timing    now (the spiral) or later (the clock, its hands on the
 *                picked time).
 *   4  Mic       now only: the real input level drives the line.
 *
 * Going live: the line goes quiet, closes into the live ring, then the
 * page makes the room and opens it. Scheduling ends on the clock with a
 * confirmation. Editing a scheduled room is the same sheet, prefilled;
 * its audience shows but cannot change.
 *
 * Follows the theme. The one blur is the ground; everything on it is a
 * tint of the theme's ink, and the panels that open off controls are
 * opaque surfaces.
 */
export default function CreateSpaceSheet({
  busy,
  editing = null,
  onClose,
  onCreate,
  onSave,
}: CreateSpaceSheetProps) {
  const t = useT();
  const isEdit = Boolean(editing);
  const user = useAtomValue(userAtom);
  const reduced = useMotionReduced();
  const narrow = useNarrow();

  const [step, setStep] = useState<Step>(1);
  const [phase, setPhase] = useState<Phase>("steps");
  const [launchScene, setLaunchScene] = useState<"quiet" | "live">("quiet");
  const [submitError, setSubmitError] = useState("");
  const [askClose, setAskClose] = useState(false);
  const [panelHost, setPanelHost] = useState<HTMLDivElement | null>(null);

  /* ---- 1. the room ---- */
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [descOpen, setDescOpen] = useState(Boolean(editing?.description));
  const [coverImage, setCoverImage] = useState(editing?.coverImage ?? "");
  // The picked file, shown from the device at once while it uploads.
  const [coverPreview, setCoverPreview] = useState("");
  const [coverName, setCoverName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [coverError, setCoverError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const uploadSeq = useRef(0);
  const objectUrls = useRef(new Set<string>());

  /* ---- 2. the audience ---- */
  // null: follow the title's best guess until the host picks.
  const [topicPick, setTopicPick] = useState<string | null>(
    isEdit ? (editing?.category ?? "") : null,
  );
  const [chosen, setChosen] = useState<ChosenCommunity[]>(
    () => editing?.communities ?? [],
  );
  const [problem, setProblem] = useState<AudienceProblem | null>(null);
  const search = useMyCommunities(!isEdit);
  const suggestions = useMemo(
    () => suggestVerticals(`${title} ${description}`),
    [title, description],
  );
  const topic = topicPick ?? suggestions.matched[0] ?? "";

  /* ---- 3. timing ---- */
  // A scheduled space stays scheduled while you edit it; only a new space
  // chooses between starting now and booking a slot.
  const [mode, setMode] = useState<"now" | "later">(isEdit ? "later" : "now");
  // What the sheet opened with, so an untouched time can be left out of
  // the patch rather than rewritten from a rounded display.
  const [initialWhen] = useState(() => isoToLocalInput(editing?.scheduledFor));
  const [when, setWhen] = useState(() => initialWhen || defaultWhen());
  const clockTime = splitWhen(when)[1] || "20:00";

  /* ---- 4. the mic ---- */
  const mic = useMicCheck(!isEdit && phase === "steps" && step === 4);

  const titleOk = title.trim().length >= 3;
  const total = isEdit ? 3 : mode === "now" ? 4 : 3;
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    const urls = objectUrls.current;
    return () => {
      live.current = false;
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, []);

  /* ---- the line ---- */
  const scene: SignalSceneId =
    phase === "launching"
      ? launchScene
      : phase === "scheduled"
        ? "clock"
        : step === 1
          ? title.trim()
            ? "name"
            : "quiet"
          : step === 2
            ? "people"
            : step === 3
              ? mode === "now"
                ? "spiral"
                : "clock"
              : mic.state === "listening"
                ? "voice"
                : mic.state === "heard"
                  ? "heard"
                  : "quiet";

  const ground = coverPreview
    ? `url("${coverPreview}") center / cover no-repeat`
    : spaceBackground({ cover: editing?.cover, coverImage });

  /* ---- closing ---- */
  const dirty =
    phase !== "scheduled" &&
    (isEdit && editing
      ? title !== editing.title ||
        description !== (editing.description ?? "") ||
        coverImage !== (editing.coverImage ?? "") ||
        when !== initialWhen
      : Boolean(title.trim() || description.trim() || coverImage || coverPreview || chosen.length));
  const requestClose = () => {
    if (phase === "launching" || busy) return;
    if (dirty) setAskClose(true);
    else onClose();
  };
  // Esc, the back gesture and the scroll lock come from the overlay
  // grammar; it stands down while the confirm is up (that one owns Esc)
  // and while the room is being opened.
  useOverlayDismiss(!askClose && phase !== "launching" && !busy, requestClose);

  // The app's one-key shortcuts ("n" jumps to the composer and away from
  // this page, "/" opens search) listen on window and would fire behind
  // the sheet whenever focus is on a chip or on nothing. Plain keys outside
  // a text field stop at the window's capture phase while the sheet is up;
  // Esc, arrows, Enter and chords go on as normal, and typing is never
  // touched (stopping propagation does not stop the text going in).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el?.isContentEditable
      )
        return;
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  /* ---- focus: the title on step 1, the question on every other ---- */
  const questionRef = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  useEffect(() => {
    if (phase !== "steps") {
      questionRef.current?.focus({ preventScroll: true });
      return;
    }
    if (step === 1) titleRef.current?.focus({ preventScroll: true });
    else if (opened.current) questionRef.current?.focus({ preventScroll: true });
    opened.current = true;
  }, [step, phase]);

  /* ---- the cover ---- */
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
    const seq = ++uploadSeq.current;
    const was = { preview: coverPreview, name: coverName };
    setUploading(true);
    const small = await downscaleCover(file);
    if (seq !== uploadSeq.current || !live.current) return;
    const local = URL.createObjectURL(small);
    objectUrls.current.add(local);
    setCoverPreview(local);
    setCoverName(file.name);
    try {
      const form = new FormData();
      form.append("cover", small);
      const r = await sendFormDirect("/api/spaces/cover", form);
      if (seq !== uploadSeq.current || !live.current) return;
      const url = r.success ? (r.data as { url?: string } | null)?.url : undefined;
      if (url) {
        setCoverImage(url);
      } else {
        setCoverError(r.message || t("voice.coverNotImage"));
        setCoverPreview(was.preview);
        setCoverName(was.name);
      }
    } finally {
      if (seq === uploadSeq.current && live.current) setUploading(false);
      // Let the same file be picked again after a failure.
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const removeCover = () => {
    uploadSeq.current++;
    setUploading(false);
    setCoverImage("");
    setCoverPreview("");
    setCoverName("");
    setCoverError("");
  };

  /* ---- moving through ---- */
  const goto = (n: Step) => {
    setSubmitError("");
    setStep(n);
  };

  const draft = (scheduledFor?: string): SpaceDraft => ({
    title: title.trim(),
    scheduledFor,
    communityIds: chosen.map((c) => c.id),
    description: description.trim() || undefined,
    coverImage: coverImage || undefined,
    category: topic || undefined,
  });

  /** Where a refusal belongs: the audience for anything about communities. */
  const refused = (res: SpaceCreateResult, at: Step) => {
    const message = res.message || "Couldn't make the room. Try again.";
    setPhase("steps");
    if (res.code === "NOT_MEMBER" || res.code === "NO_COMMUNITY" || /communit/i.test(message)) {
      setProblem({ message, communityId: res.communityId });
      goto(2);
      return;
    }
    setStep(at);
    setSubmitError(message);
  };

  const submitting = useRef(false);
  const goLive = async () => {
    if (submitting.current || busy || uploading) return;
    submitting.current = true;
    setSubmitError("");
    // The mic check closes as the phase leaves the steps, before the room
    // opens its own connection.
    setPhase("launching");
    setLaunchScene("quiet");
    await sleep(reduced ? MORPH.crossfade : MORPH.sweep.x + MORPH.point);
    if (!live.current) return;
    setLaunchScene("live");
    await sleep(reduced ? MORPH.crossfade : MORPH.sweep.angle + MORPH.point + 240);
    if (!live.current) return;
    let res: SpaceCreateResult;
    try {
      res = await onCreate(draft());
    } catch {
      res = { success: false };
    }
    submitting.current = false;
    // Success: the page closes the sheet and opens the room.
    if (!res.success && live.current) refused(res, 4);
  };

  const schedule = async () => {
    if (submitting.current || busy || uploading) return;
    const at = localDate(when);
    if (Number.isNaN(at.getTime()) || at.getTime() < Date.now() + LEAD_MS) {
      // Left open past the slot: move to the next one and say so.
      const [day, slot] = splitWhen(when);
      const next = nearestSlot(day, slot);
      setWhen(next ? `${day}T${next}` : defaultWhen());
      setSubmitError("That time has passed. Check the new one and schedule again.");
      return;
    }
    submitting.current = true;
    setSubmitError("");
    let res: SpaceCreateResult;
    try {
      res = await onCreate(draft(at.toISOString()));
    } catch {
      res = { success: false };
    }
    submitting.current = false;
    if (!live.current) return;
    if (res.success) setPhase("scheduled");
    else refused(res, 3);
  };

  const save = () => {
    if (!editing || busy || uploading) return;
    onSave?.({
      title: title.trim(),
      description: description.trim(),
      // "" is a real value: it takes the photo off (back to the house look,
      // or the swatch a room made before 2026-10-14 still has).
      coverImage,
      ...(when && when !== initialWhen
        ? { scheduledFor: localDate(when).toISOString() }
        : {}),
    });
  };

  const next = () => {
    if (phase === "scheduled") return onClose();
    if (phase !== "steps") return;
    if (!titleOk) return goto(1);
    if (isEdit) return step < 3 ? goto((step + 1) as Step) : save();
    if (step === 1) return goto(2);
    if (step === 2) return goto(3);
    if (step === 3) return mode === "now" ? goto(4) : void schedule();
    void goLive();
  };
  const back = () => {
    if (step > 1) goto((step - 1) as Step);
  };

  /* ---- words ---- */
  const followers =
    typeof user?.followersCount === "number" ? user.followersCount : undefined;
  let count: string;
  let heading: string;
  let sub: string;
  if (phase === "launching") {
    count = "Going live";
    heading = title.trim();
    sub = "Opening your room. Your mic starts muted.";
  } else if (phase === "scheduled") {
    count = "Scheduled";
    heading = title.trim();
    sub = `${whenSentence(when)}. The card counts down in Space Voice until you open it.`;
  } else {
    count = `${step} of ${total}`;
    if (step === 1) {
      heading = isEdit ? "Edit the room" : "What's the room about?";
      sub = isEdit ? "Change its name, the words under it or the photo." : "Type it on the line.";
    } else if (step === 2) {
      heading = isEdit ? "Who it's for" : "Who should find it?";
      sub = audienceLine(chosen, followers, isEdit ? "does" : "will");
    } else if (step === 3) {
      heading = isEdit ? "When it opens" : "When does it open?";
      sub =
        mode === "now"
          ? "Your room opens right after a quick mic check."
          : `${whenSentence(when)}. People can set a reminder from the card.`;
    } else if (mic.state === "blocked") {
      heading = "No mic yet";
      sub = t("voice.micBlocked");
    } else if (mic.state === "heard") {
      heading = "We can hear you";
      sub = "Sounds good. In the room your mic starts muted.";
    } else if (mic.state === "listening") {
      heading = "Say something";
      sub = "Watch the line move with your voice. Only you can hear this.";
    } else {
      heading = "Check your mic";
      sub = "Allow the microphone when your browser asks.";
    }
  }

  const nextLabel =
    phase === "scheduled"
      ? "Done"
      : isEdit
        ? step < 3
          ? `Next: ${step === 1 ? "audience" : "timing"}`
          : t("voice.saveChanges")
        : step === 1
          ? "Next: audience"
          : step === 2
            ? "Next: timing"
            : step === 3
              ? mode === "now"
                ? "Next: mic check"
                : "Schedule it"
              : t("voice.goLive");
  const finalStep =
    phase === "steps" && (isEdit ? step === 3 : step === 4 || (step === 3 && mode === "later"));
  const disabled =
    phase === "launching" ||
    (phase === "steps" && (busy || !titleOk || (finalStep && uploading)));
  const isGoLive = !isEdit && phase === "steps" && step === 4;

  // The whole steps' content swaps as one piece; under reduced motion it
  // is a plain fade (and the MotionConfig drops the rise anyway).
  const stepSwap = reduced
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: DUR.fast } },
        exit: { opacity: 0, transition: { duration: DUR.fast } },
      }
    : swap;
  // The name and the seats only use the band above the line, so their
  // controls come up under it.
  const lift = phase === "steps" && (step === 1 || step === 2);
  const contentKey = phase === "steps" ? `s${step}` : phase;

  /* ---- step 1's extras: a description and a photo, both optional ---- */
  const roomExtras = (
    <div className="flex flex-col items-center gap-3">
      <AnimatePresence initial={false}>
        {descOpen && (
          <motion.div key="desc" {...collapse} className="w-full max-w-[560px] overflow-hidden">
            <div className="rounded-xl bg-primary/10 px-4 pb-2 pt-3 transition-shadow focus-within:ring-2 focus-within:ring-gold">
              <textarea
                ref={descRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={280}
                rows={2}
                aria-label="Description"
                placeholder={t("voice.descriptionPlaceholder")}
                className="block w-full resize-none bg-transparent font-sans text-base leading-relaxed text-primary caret-gold outline-none placeholder:text-subtle sm:text-[calc(14px*var(--ws-fs))]"
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setDescription("");
                    setDescOpen(false);
                  }}
                  className="-ml-2 flex h-10 cursor-pointer items-center px-2 font-sans text-[calc(13px*var(--ws-fs))] text-muted transition-colors hover:text-primary"
                >
                  Remove
                </button>
                <span className={clsx(note, "tabular-nums")}>{description.length} / 280</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {!descOpen && (
          <button
            type="button"
            onClick={() => {
              setDescOpen(true);
              requestAnimationFrame(() => descRef.current?.focus());
            }}
            className={soft}
          >
            <TextAlignLeft size={16} />
            Add a description
          </button>
        )}
        {coverPreview || coverImage ? (
          <span className="flex flex-wrap items-center justify-center gap-2">
            <span
              aria-hidden
              className="h-11 w-11 shrink-0 rounded-lg bg-cover bg-center ring-1 ring-hairline"
              style={{ backgroundImage: `url("${coverPreview || coverImage}")` }}
            />
            <span className="flex max-w-[12rem] items-center gap-1.5 truncate font-sans text-[calc(13.5px*var(--ws-fs))] text-muted">
              {uploading && <Spinner size={13} weight="bold" className="shrink-0 animate-spin" />}
              <span className="truncate">
                {uploading ? t("voice.coverUploading") : coverName || "Your cover photo"}
              </span>
            </span>
            <button type="button" onClick={() => fileRef.current?.click()} className={chip(false)}>
              Change
            </button>
            <button type="button" onClick={removeCover} className={chip(false)}>
              Remove
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className={soft}
          >
            {uploading ? (
              <Spinner size={16} weight="bold" className="animate-spin" />
            ) : (
              <ImageSquare size={16} />
            )}
            Add a cover photo
          </button>
        )}
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
      {coverError ? (
        <p role="alert" className="flex items-center gap-1.5 font-sans text-[calc(13px*var(--ws-fs))] text-danger">
          <WarningCircle size={15} weight="fill" className="shrink-0" />
          {coverError}
        </p>
      ) : (
        !coverPreview &&
        !coverImage && (
          <p className={clsx(note, "text-center")}>
            Both optional. Without a photo, the room wears the WorldSpace look.
          </p>
        )
      )}
    </div>
  );

  const micStep = (
    <div className="flex flex-col items-center gap-3 text-center">
      {mic.state === "heard" ? (
        <span className="flex flex-wrap items-center justify-center gap-3">
          <span className="flex items-center gap-1.5 font-sans text-[calc(14px*var(--ws-fs))] font-medium text-gold">
            <Check size={15} weight="bold" />
            {t("voice.micGood")}
          </span>
          <button type="button" onClick={mic.again} className={soft}>
            <ArrowCounterClockwise size={15} weight="bold" />
            Test again
          </button>
        </span>
      ) : mic.state === "listening" ? (
        <span className="flex items-center gap-2 font-sans text-[calc(14px*var(--ws-fs))] text-muted">
          <span className="h-2 w-2 animate-pulse rounded-pill bg-gold" />
          Listening
        </span>
      ) : mic.state === "asking" ? (
        <span className="flex items-center gap-2 font-sans text-[calc(14px*var(--ws-fs))] text-muted">
          <Spinner size={14} weight="bold" className="animate-spin" />
          Waiting for the microphone
        </span>
      ) : null}
      {mic.state !== "blocked" && mic.device && (
        <p className={clsx(note, "flex max-w-full items-center gap-1.5")}>
          <Microphone size={14} weight="fill" className="shrink-0" />
          <span className="truncate">{mic.device}</span>
        </p>
      )}
      <p className={clsx(note, "flex items-center gap-1.5")}>
        <MicrophoneSlash size={14} weight="fill" className="shrink-0" />
        {t("voice.micMutedNote")}
      </p>
    </div>
  );

  let content: React.ReactNode = null;
  if (phase === "scheduled") {
    content = (
      <p className={clsx(note, "text-center")}>
        {audienceLine(chosen, undefined, "will")} can see it now.
      </p>
    );
  } else if (phase === "steps") {
    content =
      step === 1 ? (
        roomExtras
      ) : step === 2 ? (
        <AudienceStep
          host={panelHost}
          topic={topic}
          topics={suggestions.shown}
          onTopic={setTopicPick}
          chosen={chosen}
          onChosen={(list) => {
            setProblem(null);
            setChosen(list);
          }}
          search={search}
          readOnly={isEdit}
          problem={problem}
        />
      ) : step === 3 ? (
        <TimingStep
          host={panelHost}
          mode={mode}
          onMode={(m) => {
            setSubmitError("");
            setMode(m);
          }}
          value={when}
          onChange={(v) => {
            setSubmitError("");
            setWhen(v);
          }}
          canGoNow={!isEdit}
        />
      ) : (
        micStep
      );
  }

  const showTitle = phase === "steps" && step === 1;

  return (
    <ConfirmModalPortal>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? t("voice.editSpace") : t("voice.create")}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: reduced ? 0 : DUR.base, ease: EASE } }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-modal isolate flex flex-col overflow-hidden bg-page text-primary"
      >
        {/* The room's picture, blurred deep under the mode's veil: the one
            blur on this screen. A new photo crossfades in. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <AnimatePresence initial={false}>
            <motion.div
              key={ground}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: reduced ? 0 : DUR.travel, ease: EASE } }}
              exit={{ opacity: 0, transition: { duration: reduced ? 0 : DUR.travel } }}
              className={s.ground}
              style={{ background: ground }}
            />
          </AnimatePresence>
          <div className={s.veil} />
        </div>

        <header className="relative shrink-0 pt-[var(--ws-safe-top)]">
          <div className="flex h-14 items-center gap-2 px-4 sm:h-[60px] sm:px-7">
            <span className="hidden font-sans text-[calc(13px*var(--ws-fs))] text-subtle sm:inline">
              {t("voice.eyebrow")}
            </span>
            <span aria-hidden className="hidden font-sans text-[calc(13px*var(--ws-fs))] text-subtle sm:inline">
              /
            </span>
            <span className="font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
              {isEdit ? t("voice.editSpace") : t("voice.create")}
            </span>
            <span className="flex-1" />
            {phase !== "launching" && (
              <button
                type="button"
                onClick={phase === "scheduled" ? onClose : requestClose}
                aria-label={t("common.close")}
                className="-mr-2 flex h-10 min-w-10 cursor-pointer items-center justify-center gap-1.5 rounded-pill px-2 font-sans text-[calc(13.5px*var(--ws-fs))] text-muted transition-colors hover:text-primary"
              >
                <X size={16} weight="bold" className="sm:hidden" />
                <span className="hidden sm:inline">
                  {phase === "scheduled" ? t("common.close") : t("common.cancel")}
                </span>
              </button>
            )}
          </div>
        </header>

        <main
          className={clsx(
            s.stage,
            "relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto overflow-x-hidden overscroll-contain",
          )}
        >
          <div aria-hidden className="h-[clamp(4px,3dvh,40px)] shrink-0" />

          {/* The question. A fixed height that grows upward, so the line
              below never moves when a subtitle wraps. */}
          <div
            ref={questionRef}
            tabIndex={-1}
            className="flex h-[118px] w-full max-w-[900px] shrink-0 flex-col items-center justify-end gap-1.5 px-5 text-center outline-none sm:h-[140px] sm:gap-2.5"
          >
            <span
              className={clsx(
                "font-mono text-[calc(13px*var(--ws-fs))] tabular-nums",
                phase === "launching" ? "text-danger" : phase === "scheduled" ? "text-gold" : "text-subtle",
              )}
            >
              {count}
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2
                key={`${phase}-${heading}`}
                {...stepSwap}
                className="line-clamp-2 max-w-[22ch] text-balance font-display text-[calc(25px*var(--ws-fs))] font-semibold leading-[1.1] tracking-[-0.01em] text-primary sm:max-w-[30ch] sm:text-[calc(34px*var(--ws-fs))] lg:text-[calc(38px*var(--ws-fs))]"
              >
                {heading}
              </motion.h2>
            </AnimatePresence>
            <p className="line-clamp-2 min-h-[1.5em] max-w-[60ch] font-sans text-[calc(14px*var(--ws-fs))] leading-normal text-muted sm:text-[calc(15px*var(--ws-fs))]">
              {sub}
            </p>
          </div>

          {/* The line. ONE SignalArt for the whole sheet: only its props
              change, so every step is a morph and never a remount. */}
          <div className={s.band}>
            <SignalArt
              scene={scene}
              audience={chosen.length}
              clockTime={clockTime}
              level={mic.level}
              viewBox={narrow ? PHONE_VIEWBOX : undefined}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
            <input
              ref={titleRef}
              // The sheet's own mount effect runs before its portal has
              // rendered this, so the first focus rides the mount itself.
              // biome-ignore lint/a11y/noAutofocus: the title is the step's one job.
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (titleOk) next();
                }
              }}
              inert={!showTitle}
              aria-hidden={!showTitle}
              tabIndex={showTitle ? 0 : -1}
              maxLength={96}
              aria-label="Name the room"
              placeholder="Name the room"
              enterKeyHint="next"
              autoComplete="off"
              className={clsx(
                s.onLine,
                "bg-transparent text-center font-display text-[calc(23px*var(--ws-fs))] font-semibold leading-tight tracking-[-0.01em] text-primary caret-gold outline-none transition-opacity duration-300 placeholder:text-subtle sm:text-[calc(32px*var(--ws-fs))] lg:text-[calc(36px*var(--ws-fs))]",
                showTitle ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            />
          </div>

          {/* Positioned, so it paints over the band it is pulled up into. */}
          <div className="relative w-full max-w-[820px] shrink-0 px-4 pb-6 sm:px-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={contentKey}
                {...stepSwap}
                className={clsx("w-full", lift && s.lift)}
              >
                {content}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {submitError && (
          <p
            role="alert"
            className="relative flex shrink-0 items-center justify-center gap-1.5 px-5 pt-2 text-center font-sans text-[calc(13.5px*var(--ws-fs))] text-danger"
          >
            <WarningCircle size={15} weight="fill" className="shrink-0" />
            {submitError}
          </p>
        )}

        <footer
          className={clsx(
            "relative flex shrink-0 items-center gap-2 px-4 pb-[calc(16px+var(--ws-safe-bottom))] pt-3 transition-opacity sm:px-10 sm:pb-7",
            phase === "launching" && "pointer-events-none opacity-0",
          )}
        >
          <div className="flex flex-1 justify-start">
            {phase === "steps" && step > 1 && (
              <button
                type="button"
                onClick={back}
                className="-ml-2 flex h-11 cursor-pointer items-center gap-1.5 rounded-pill px-3 font-sans text-[calc(14px*var(--ws-fs))] font-medium text-muted transition-colors hover:text-primary"
              >
                <ArrowLeft size={14} weight="bold" />
                {t("voice.back")}
              </button>
            )}
          </div>
          <div className="hidden flex-1 justify-center sm:flex">
            {phase === "steps" && step === 1 && (
              <span className="font-mono text-[calc(13px*var(--ws-fs))] text-subtle">
                Enter to continue
              </span>
            )}
          </div>
          <div className="flex flex-1 items-center justify-end gap-1">
            {isEdit && phase === "steps" && step < 3 && (
              <button
                type="button"
                onClick={save}
                disabled={busy || !titleOk || uploading}
                className="flex h-11 cursor-pointer items-center rounded-pill px-3 font-sans text-[calc(14px*var(--ws-fs))] font-medium text-muted transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("voice.saveChanges")}
              </button>
            )}
            <motion.button
              {...press}
              type="button"
              onClick={next}
              disabled={disabled}
              className={clsx(
                "flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-pill px-5 font-sans text-[calc(14px*var(--ws-fs))] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                isGoLive
                  ? "bg-danger text-white hover:bg-danger/90"
                  : "bg-brand text-brand-on hover:bg-brand-active",
              )}
            >
              {busy && finalStep ? (
                <Spinner size={15} weight="bold" className="animate-spin" />
              ) : isGoLive ? (
                <span aria-hidden className="h-2 w-2 animate-pulse rounded-pill bg-white" />
              ) : isEdit && finalStep ? (
                <FloppyDisk size={15} weight="bold" />
              ) : null}
              {nextLabel}
            </motion.button>
          </div>
        </footer>

        {/* Panels that open off a control (communities, topics, dates)
            render here: fixed to the viewport, above everything in the
            sheet, below the confirm. */}
        <div ref={setPanelHost} />

        <ConfirmModal
          isOpen={askClose}
          onClose={() => setAskClose(false)}
          onConfirm={onClose}
          title={isEdit ? "Discard your changes?" : "Discard this room?"}
          message={
            isEdit
              ? "The room stays as it was before you opened this."
              : "What you've typed so far will be lost."
          }
          confirmText="Discard"
          cancelText="Keep editing"
          isDestructive
        />
      </motion.div>
    </ConfirmModalPortal>
  );
}
