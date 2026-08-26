/**
 * Voice stories: capture, visualise, render.
 *
 * The recorder captures AUDIO ONLY. That is what makes the take reviewable —
 * you can play it back, scrub it, and swap the canvas behind it as many times
 * as you like, because the picture is not baked in until you post. At share
 * time `renderVoiceVideo` plays the take once through a canvas + MediaRecorder
 * to produce the story video.
 *
 * `drawVoiceFrame` is the single painter used by BOTH the live preview and
 * that final render, so the exported video is the preview, frame for frame.
 */

import {
  drawImageCover,
  paintStoryCanvasSync,
  type StoryCanvas,
} from "@/lib/editor/storyBackgrounds";

export const VOICE_W = 1080;
export const VOICE_H = 1920;
export const VOICE_MAX_SECONDS = 60;
/** Bars drawn across the waveform. */
export const VOICE_BARS = 56;

export interface VoiceTake {
  blob: Blob;
  /** Object URL for the <audio> element. Revoked by the owner. */
  url: string;
  duration: number;
  /** Normalized 0..1 loudness, one entry per bar. */
  envelope: number[];
}

/** Pick a container both MediaRecorder and this browser's decoder handle. */
export function pickAudioMime(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

export function pickVideoMime(): string {
  // webm first: Chrome reports mp4 support but stalls demuxing its own
  // canvas-stream mp4. Safari has no webm recording and falls through.
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

/**
 * Decode the take and reduce it to one RMS value per bar. Doing this once up
 * front makes the waveform deterministic — the preview and the render draw
 * from the same numbers instead of two live analysers that would never agree.
 */
export async function analyseTake(blob: Blob): Promise<{
  duration: number;
  envelope: number[];
}> {
  const bytes = await blob.arrayBuffer();
  const AudioCtor: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AudioCtor();
  try {
    const buffer = await ctx.decodeAudioData(bytes);
    const channel = buffer.getChannelData(0);
    const per = Math.max(1, Math.floor(channel.length / VOICE_BARS));
    const envelope: number[] = [];
    let peak = 0;
    for (let i = 0; i < VOICE_BARS; i++) {
      let sum = 0;
      const start = i * per;
      const end = Math.min(channel.length, start + per);
      for (let j = start; j < end; j++) sum += channel[j] * channel[j];
      const rms = Math.sqrt(sum / Math.max(1, end - start));
      peak = Math.max(peak, rms);
      envelope.push(rms);
    }
    // Normalize so a quiet take still draws a full-height waveform.
    const scale = peak > 0 ? 1 / peak : 0;
    return {
      duration: buffer.duration,
      envelope: envelope.map((v) => Math.min(1, v * scale)),
    };
  } finally {
    void ctx.close().catch(() => {});
  }
}

/** One frame of the voice story: canvas, waveform, played/unplayed split. */
export function drawVoiceFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  canvas: StoryCanvas,
  photo: HTMLImageElement | null,
  envelope: number[],
  progress: number,
  label: string,
) {
  if (canvas.kind === "photo" && photo) {
    drawImageCover(ctx, photo, w, h);
    // Photographs need a scrim or white type on a bright sky disappears.
    ctx.fillStyle = "rgba(12, 10, 9, 0.42)";
    ctx.fillRect(0, 0, w, h);
  } else {
    paintStoryCanvasSync(ctx, w, h, canvas, photo);
  }

  const bars = envelope.length || VOICE_BARS;
  const span = w * 0.74;
  const left = (w - span) / 2;
  const slot = span / bars;
  const barW = slot * 0.5;
  const maxH = h * 0.15;
  const midY = h / 2;
  const played = progress * bars;

  for (let i = 0; i < bars; i++) {
    const value = envelope[i] ?? 0;
    const barH = Math.max(w * 0.007, value * maxH);
    const x = left + i * slot + (slot - barW) / 2;
    ctx.fillStyle =
      i <= played ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.34)";
    ctx.beginPath();
    ctx.roundRect(x, midY - barH / 2, barW, barH, barW / 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = `600 ${w * 0.028}px ui-monospace, "SF Mono", Menlo, monospace`;
  ctx.textAlign = "center";
  ctx.letterSpacing = `${w * 0.006}px`;
  ctx.fillText(label, w / 2, midY + maxH / 2 + w * 0.08);
  ctx.letterSpacing = "0px";
}

export const formatClock = (seconds: number) => {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, "0")}`;
};

/**
 * Play the take once through a canvas and capture both into a video file.
 * MediaRecorder is realtime-only, so this takes as long as the note itself —
 * hence `onProgress`, which drives a determinate bar rather than a spinner.
 */
export function renderVoiceVideo({
  take,
  canvas,
  photo,
  onProgress,
}: {
  take: VoiceTake;
  canvas: StoryCanvas;
  photo: HTMLImageElement | null;
  onProgress: (fraction: number) => void;
}): Promise<File> {
  return new Promise((resolve, reject) => {
    const surface = document.createElement("canvas");
    surface.width = VOICE_W;
    surface.height = VOICE_H;
    const ctx = surface.getContext("2d");
    if (!ctx) {
      reject(new Error("Canvas 2D unavailable"));
      return;
    }

    const AudioCtor: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const audioCtx = new AudioCtor();
    const audio = new Audio();
    audio.src = take.url;
    audio.crossOrigin = "anonymous";
    // Routed to the recorder only — rendering must be silent for the user.
    const source = audioCtx.createMediaElementSource(audio);
    const destination = audioCtx.createMediaStreamDestination();
    source.connect(destination);

    const stream = surface.captureStream(30);
    const mime = pickVideoMime();
    const recorder = new MediaRecorder(
      new MediaStream([
        ...stream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]),
      { mimeType: mime || undefined, videoBitsPerSecond: 2_500_000 },
    );

    const chunks: BlobPart[] = [];
    let raf = 0;
    let ticker: ReturnType<typeof setInterval> | null = null;

    const paint = () => {
      const elapsed = audio.currentTime;
      const fraction = take.duration > 0 ? elapsed / take.duration : 0;
      drawVoiceFrame(
        ctx,
        VOICE_W,
        VOICE_H,
        canvas,
        photo,
        take.envelope,
        fraction,
        `${formatClock(elapsed)} / ${formatClock(take.duration)}`,
      );
      onProgress(Math.min(1, fraction));
    };

    const loop = () => {
      paint();
      raf = requestAnimationFrame(loop);
    };

    const cleanup = () => {
      cancelAnimationFrame(raf);
      if (ticker) clearInterval(ticker);
      for (const track of stream.getTracks()) track.stop();
      void audioCtx.close().catch(() => {});
    };

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = () => {
      cleanup();
      reject(new Error("Recorder failed"));
    };
    recorder.onstop = () => {
      cleanup();
      const type = mime.startsWith("video/mp4") ? "video/mp4" : "video/webm";
      const blob = new Blob(chunks, { type });
      if (blob.size === 0) {
        reject(new Error("Empty render"));
        return;
      }
      const ext = type === "video/mp4" ? "mp4" : "webm";
      resolve(new File([blob], `voice-note.${ext}`, { type }));
    };

    audio.onended = () => {
      paint();
      // Let the last frame land in the muxer before closing the file.
      setTimeout(() => recorder.state !== "inactive" && recorder.stop(), 120);
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error("Take failed to play"));
    };

    void audioCtx
      .resume()
      .catch(() => {})
      .then(() => {
        recorder.start();
        raf = requestAnimationFrame(loop);
        // rAF halts in a hidden tab, which would starve captureStream and
        // hang the render; a timer keeps frames flowing either way.
        ticker = setInterval(() => {
          if (document.hidden) paint();
        }, 200);
        return audio.play();
      })
      .catch((error) => {
        cleanup();
        reject(error instanceof Error ? error : new Error("Render failed"));
      });
  });
}
