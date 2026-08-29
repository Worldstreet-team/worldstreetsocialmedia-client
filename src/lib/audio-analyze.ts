"use client";

/**
 * Decode an audio file once in the browser and reduce it to what a voice
 * post ships with: duration and 64 amplitude peaks (0-127, the WhatsApp
 * shape). Computed at attach time so the card can draw its waveform before
 * any audio downloads — for every reader, forever.
 */
export async function analyzeAudioFile(
	file: File,
): Promise<{ durationSec: number; peaks: number[] } | null> {
	try {
		const buf = await file.arrayBuffer();
		const Ctx =
			window.AudioContext ?? (window as any).webkitAudioContext;
		const ctx = new Ctx();
		const decoded = await ctx.decodeAudioData(buf);
		void ctx.close();

		const data = decoded.getChannelData(0);
		const buckets = 64;
		const step = Math.max(1, Math.floor(data.length / buckets));
		const peaks: number[] = [];
		for (let b = 0; b < buckets; b++) {
			let max = 0;
			const start = b * step;
			// Sample within the bucket rather than scanning every frame — a
			// 5-minute take is 13M samples and this runs on attach.
			for (let i = start; i < start + step; i += 32) {
				const v = Math.abs(data[i] ?? 0);
				if (v > max) max = v;
			}
			peaks.push(Math.round(max * 127));
		}
		// Normalise the tallest bar to full height so quiet takes still read
		// as waveforms rather than flat lines.
		const top = Math.max(...peaks, 1);
		return {
			durationSec: Math.round(decoded.duration),
			peaks: peaks.map((p) => Math.round((p / top) * 127)),
		};
	} catch {
		return null;
	}
}
