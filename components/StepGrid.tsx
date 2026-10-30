"use client";
import React, { useEffect, useRef } from 'react';
import type { TrackParams } from '../lib/engine';

type Props = {
  labels: string[];
  pattern: number[][]; // rows x steps, values: 0 off, 1 on, 2 accent
  steps: number;
  tracks: TrackParams[];
  playingStep: number;
  ledRefs: React.MutableRefObject<(HTMLSpanElement | null)[]>;
  onSet: (row: number, col: number, value: number) => void;
  onAudition: (row: number) => void;
  onMute: (row: number) => void;
  onSolo: (row: number) => void;
};

export default function StepGrid({ labels, pattern, steps, tracks, playingStep, ledRefs, onSet, onAudition, onMute, onSolo }: Props) {
  // value being painted while the pointer is down (drag across cells to paint)
  const paint = useRef<number | null>(null);
  const anySolo = tracks.some(t => t.solo);

  useEffect(() => {
    const end = () => { paint.current = null; };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => { window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
  }, []);

  const cellAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el?.dataset.cell) return null;
    const [r, c] = el.dataset.cell.split(':').map(Number);
    return { r, c };
  };

  const onPointerDown = (e: React.PointerEvent, r: number, c: number) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    const curr = pattern[r]?.[c] ?? 0;
    const accent = e.button === 2 || e.shiftKey || e.altKey;
    const next = accent ? (curr === 2 ? 1 : 2) : curr ? 0 : 1;
    paint.current = next;
    onSet(r, c, next);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (paint.current == null) return;
    const hit = cellAt(e.clientX, e.clientY);
    if (hit && (pattern[hit.r]?.[hit.c] ?? 0) !== paint.current) onSet(hit.r, hit.c, paint.current);
  };

  return (
    <div className="grid" style={{ ['--steps' as any]: steps }} onPointerMove={onPointerMove} onContextMenu={e => e.preventDefault()}>
      <div className="grid-corner" />
      {Array.from({ length: steps }, (_, c) => (
        <div key={c} className={`step-num ${c % 4 === 0 ? 'beat' : ''} ${playingStep === c ? 'now' : ''}`}>{c + 1}</div>
      ))}

      {labels.map((label, r) => {
        const t = tracks[r];
        const silent = anySolo ? !t?.solo : t?.mute;
        return (
          <div className={`grid-row ${silent ? 'silent' : ''}`} key={r}>
            <div className="track">
              <span className="led" ref={el => { ledRefs.current[r] = el; }} />
              <button className="track-name" onClick={() => onAudition(r)} title={`play ${label} (key ${r + 1})`}>
                <span className="track-key">{r + 1}</span>{label}
              </button>
              <button className={`ms ${t?.mute ? 'mute-on' : ''}`} onClick={() => onMute(r)} aria-pressed={!!t?.mute} title="mute">m</button>
              <button className={`ms ${t?.solo ? 'solo-on' : ''}`} onClick={() => onSolo(r)} aria-pressed={!!t?.solo} title="solo">s</button>
            </div>
            {Array.from({ length: steps }, (_, c) => {
              const v = pattern[r]?.[c] ?? 0;
              return (
                <button
                  key={c}
                  data-cell={`${r}:${c}`}
                  className={`cell ${Math.floor(c / 4) % 2 ? 'alt' : ''} ${v ? 'on' : ''} ${v === 2 ? 'acc' : ''} ${playingStep === c ? 'now' : ''}`}
                  aria-label={`${label} step ${c + 1}${v === 2 ? ' accent' : v ? ' on' : ''}`}
                  aria-pressed={v > 0}
                  onPointerDown={e => onPointerDown(e, r, c)}
                  // keyboard activation only (pointer is handled above)
                  onClick={e => { if (e.detail === 0) onSet(r, c, v ? 0 : 1); }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
