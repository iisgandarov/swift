"use client";

/**
 * Re-encodes a recording (webm/opus on Android, mp4/aac on iOS) as 16 kHz mono 16-bit WAV,
 * a format every speech model accepts. 60 s ≈ 1.9 MB. Returns null if the browser can't decode it.
 */
export async function toWav16k(blob: Blob): Promise<Blob | null> {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    await ctx.close().catch(() => undefined);
    const rate = 16_000;
    const length = Math.max(1, Math.ceil(decoded.duration * rate));
    const offline = new OfflineAudioContext(1, length, rate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination); // down-mixes to mono
    src.start();
    const pcm = trimSilence((await offline.startRendering()).getChannelData(0), rate);

    const buf = new ArrayBuffer(44 + pcm.length * 2);
    const v = new DataView(buf);
    const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, "RIFF");
    v.setUint32(4, 36 + pcm.length * 2, true);
    str(8, "WAVE");
    str(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); // PCM
    v.setUint16(22, 1, true); // mono
    v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    str(36, "data");
    v.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) {
      const x = Math.max(-1, Math.min(1, pcm[i]));
      v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
    }
    return new Blob([buf], { type: "audio/wav" });
  } catch {
    return null;
  }
}

/**
 * Cuts the silence before the first and after the last speech (the pause while the phone
 * starts listening and before tapping stop), keeping 300 ms of padding. Smaller upload and
 * fewer audio tokens for the model; the spoken part is untouched. Never trims to nothing.
 */
export function trimSilence(pcm: Float32Array, rate: number, threshold = 0.02, padMs = 300): Float32Array {
  const win = Math.max(1, Math.round(rate * 0.02)); // 20 ms windows
  const loud = (start: number) => {
    let sum = 0;
    const end = Math.min(pcm.length, start + win);
    for (let i = start; i < end; i++) sum += pcm[i] * pcm[i];
    return Math.sqrt(sum / Math.max(1, end - start)) >= threshold;
  };
  let first = -1;
  for (let i = 0; i < pcm.length; i += win) if (loud(i)) { first = i; break; }
  if (first === -1) return pcm; // no speech detected: leave as is, the model decides
  let last = first;
  for (let i = Math.floor((pcm.length - 1) / win) * win; i >= first; i -= win) if (loud(i)) { last = i + win; break; }
  const pad = Math.round((rate * padMs) / 1000);
  return pcm.subarray(Math.max(0, first - pad), Math.min(pcm.length, last + pad));
}
