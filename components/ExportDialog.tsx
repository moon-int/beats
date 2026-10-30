"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Kit } from '../lib/kits';
import type { TrackParams } from '../lib/engine';
import { renderLoop, encodeWav } from '../lib/exportLoop';

type Props = {
  open: boolean;
  onClose: () => void;
  kit: Kit;
  tracks: TrackParams[];
  patterns: number[][][];
  slot: number;
  slotNames: string[];
  bpm: number;
  swing: number;
  volume: number;
};

const BAR_OPTIONS = [1, 2, 4, 8, 16];
const QUALITY = {
  '44': { sampleRate: 44100, bitDepth: 16 as const, label: '44.1 khz · 16-bit' },
  '48': { sampleRate: 48000, bitDepth: 24 as const, label: '48 khz · 24-bit' },
};

export default function ExportDialog({ open, onClose, kit, tracks, patterns, slot, slotNames, bpm, swing, volume }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [source, setSource] = useState<'current' | 'chain'>('current');
  const [bars, setBars] = useState(1);
  const [quality, setQuality] = useState<keyof typeof QUALITY>('44');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { setError(null); d.showModal(); }
    if (!open && d.open) d.close();
  }, [open]);

  // the slots that make up one pass of the loop
  const filled = patterns.map((p, i) => (p.some(r => r.some(Boolean)) ? i : -1)).filter(i => i >= 0);
  const chain = source === 'chain' && filled.length ? filled : [slot];
  // cycle the chain to fill the requested length (a b → a b a b)
  const sequence = useMemo(() => Array.from({ length: bars }, (_, i) => chain[i % chain.length]), [bars, chain.join()]);
  const seconds = (60 / bpm / 4) * 16 * bars;

  const pickSource = (s: 'current' | 'chain') => {
    setSource(s);
    if (s === 'chain') setBars(b => Math.max(b, BAR_OPTIONS.find(n => n >= filled.length) ?? 16));
  };

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const q = QUALITY[quality];
      const buffer = await renderLoop({
        kit, tracks, bpm, swing, volume,
        bars: sequence.map(i => patterns[i]),
        sampleRate: q.sampleRate,
      });
      const blob = encodeWav(buffer, q.bitDepth);
      const parts = source === 'chain' ? chain.map(i => slotNames[i]).join('') : slotNames[slot];
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `beats-${kit.id}-${bpm}bpm-${bars}bar-${parts}.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'rendering failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onClick={e => { if (e.target === ref.current && !busy) onClose(); }}>
      <div className="dialog-body">
        <div className="dialog-head">
          <h2>download loop</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="close" disabled={busy}>✕</button>
        </div>
        <p className="dialog-text">renders a seamless, sample-accurate wav loop: decays from the end wrap around to the start, so it loops cleanly in any daw or sampler.</p>

        <div className="field">
          <span className="field-label">source</span>
          <div className="segmented">
            <button className={source === 'current' ? 'active' : ''} onClick={() => pickSource('current')}>pattern {slotNames[slot]}</button>
            <button className={source === 'chain' ? 'active' : ''} onClick={() => pickSource('chain')} disabled={filled.length < 2}>
              chain {filled.length ? filled.map(i => slotNames[i]).join('→') : ''}
            </button>
          </div>
        </div>

        <div className="field">
          <span className="field-label">length</span>
          <div className="segmented">
            {BAR_OPTIONS.map(n => (
              <button key={n} className={bars === n ? 'active' : ''} onClick={() => setBars(n)}>{n} bar{n > 1 ? 's' : ''}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">quality</span>
          <div className="segmented">
            {(Object.keys(QUALITY) as (keyof typeof QUALITY)[]).map(k => (
              <button key={k} className={quality === k ? 'active' : ''} onClick={() => setQuality(k)}>{QUALITY[k].label}</button>
            ))}
          </div>
        </div>

        <div className="export-summary">
          <div className="sequence">
            {sequence.map((i, n) => <span key={n} className="sequence-bar">{slotNames[i]}</span>)}
          </div>
          <div className="lcd-small">{bpm} bpm · {kit.name} · {seconds.toFixed(2)} s</div>
        </div>

        {error && <p className="dialog-error">{error}</p>}

        <button className="btn primary wide" onClick={download} disabled={busy}>
          {busy ? 'rendering…' : 'download .wav'}
        </button>
      </div>
    </dialog>
  );
}
