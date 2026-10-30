import type { Kit } from './kits';
import { Synth, MAX_TAIL, hitVelocity, swingOffset, type TrackParams } from './engine';
import { STEPS } from './patterns';

export type LoopOptions = {
  kit: Kit;
  tracks: TrackParams[];
  bars: number[][][]; // one pattern per bar, played in order
  bpm: number;
  swing: number;
  volume: number;
  sampleRate: number;
};

/**
 * Renders the bars offline as a seamless loop. The sequence is rendered
 * several times in a row and only the last pass is kept, so decays that ring
 * over the loop end are already present at its start (and the compressor and
 * open-hat choke are in their steady state) — the file loops without a click.
 */
export async function renderLoop(o: LoopOptions): Promise<AudioBuffer> {
  const sr = o.sampleRate;
  const totalSteps = o.bars.length * STEPS;
  // whole-sample loop length; the step grid is derived from it so every pass is identical
  const loopFrames = Math.round(((60 / o.bpm / 4) * totalSteps) * sr);
  const loopSec = loopFrames / sr;
  const sixteenth = loopSec / totalSteps;
  const warmup = Math.ceil(MAX_TAIL / loopSec);
  const passes = warmup + 1;

  const ctx = new OfflineAudioContext(2, loopFrames * passes, sr);
  const synth = new Synth(ctx);
  synth.setVolume(o.volume);
  synth.setKit(o.kit);
  synth.setTracks(o.tracks);
  synth.output.connect(ctx.destination);

  const anySolo = o.tracks.some(t => t.solo);
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < totalSteps; i++) {
      const pattern = o.bars[Math.floor(i / STEPS)];
      const step = i % STEPS;
      const time = pass * loopSec + i * sixteenth + swingOffset(step, o.swing, sixteenth);
      pattern.forEach((row, r) => {
        const vel = hitVelocity(row[step], o.tracks[r], anySolo);
        if (vel != null) synth.play(r, time, vel);
      });
    }
  }

  const rendered = await ctx.startRendering();
  const loop = new AudioBuffer({ numberOfChannels: 2, length: loopFrames, sampleRate: sr });
  for (let ch = 0; ch < 2; ch++) {
    loop.copyToChannel(rendered.getChannelData(ch).subarray(warmup * loopFrames, passes * loopFrames), ch);
  }
  return loop;
}

/**
 * PCM WAV with a `smpl` chunk marking the whole file as a forward loop,
 * so samplers (and many DAWs) pick up the loop points automatically.
 */
export function encodeWav(buf: AudioBuffer, bitDepth: 16 | 24): Blob {
  const channels = buf.numberOfChannels;
  const frames = buf.length;
  const bytes = bitDepth / 8;
  const dataSize = frames * channels * bytes;
  const smplSize = 36 + 24;
  const out = new DataView(new ArrayBuffer(12 + 24 + 8 + dataSize + 8 + smplSize));
  let p = 0;
  const str = (s: string) => { for (let i = 0; i < s.length; i++) out.setUint8(p++, s.charCodeAt(i)); };
  const u32 = (v: number) => { out.setUint32(p, v, true); p += 4; };
  const u16 = (v: number) => { out.setUint16(p, v, true); p += 2; };

  str('RIFF'); u32(out.byteLength - 8); str('WAVE');
  str('fmt '); u32(16); u16(1); u16(channels); u32(buf.sampleRate);
  u32(buf.sampleRate * channels * bytes); u16(channels * bytes); u16(bitDepth);

  str('data'); u32(dataSize);
  const data = Array.from({ length: channels }, (_, c) => buf.getChannelData(c));
  const max = bitDepth === 16 ? 0x7fff : 0x7fffff;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const v = Math.round(Math.max(-1, Math.min(1, data[c][i])) * max);
      if (bitDepth === 16) { out.setInt16(p, v, true); p += 2; }
      else { out.setUint8(p++, v & 0xff); out.setUint8(p++, (v >> 8) & 0xff); out.setUint8(p++, (v >> 16) & 0xff); }
    }
  }

  str('smpl'); u32(smplSize);
  u32(0); u32(0);                              // manufacturer, product
  u32(Math.round(1e9 / buf.sampleRate));       // sample period (ns)
  u32(60); u32(0);                             // midi unity note, pitch fraction
  u32(0); u32(0);                              // smpte format, offset
  u32(1); u32(0);                              // one loop, no sampler data
  u32(0); u32(0); u32(0); u32(frames - 1); u32(0); u32(0); // id, forward, start, end, fraction, infinite

  return new Blob([out.buffer], { type: 'audio/wav' });
}
