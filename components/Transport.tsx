"use client";
import React, { useRef } from 'react';
import Knob from './Knob';

export const BPM_MIN = 50;
export const BPM_MAX = 220;

type Props = {
  playing: boolean; onPlayToggle: () => void;
  bpm: number; onBpm: (v: number) => void;
  swing: number; onSwing: (v: number) => void;
  volume: number; onVolume: (v: number) => void;
  position: { bar: number; beat: number; sixteenth: number } | null;
};

export default function Transport({ playing, onPlayToggle, bpm, onBpm, swing, onSwing, volume, onVolume, position }: Props) {
  const taps = useRef<number[]>([]);
  const clampBpm = (v: number) => Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(v)));

  const tap = () => {
    const now = performance.now();
    const prev = taps.current;
    taps.current = prev.length && now - prev[prev.length - 1] > 2000 ? [now] : [...prev, now].slice(-5);
    const t = taps.current;
    if (t.length < 2) return;
    const avg = (t[t.length - 1] - t[0]) / (t.length - 1);
    onBpm(clampBpm(60000 / avg));
  };

  return (
    <div className="transport">
      <button className={`play ${playing ? 'is-playing' : ''}`} onClick={onPlayToggle} aria-label={playing ? 'stop' : 'play'} title="space">
        {playing
          ? <svg viewBox="0 0 24 24" width="22" height="22"><rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" /></svg>
          : <svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>}
      </button>

      <div className="lcd">
        <div className="lcd-label">position</div>
        <div className="lcd-value">
          {position
            ? `${String(position.bar).padStart(3, '0')}.${position.beat}.${position.sixteenth}`
            : '---.-.-'}
        </div>
      </div>

      <div className="bpm">
        <div className="lcd">
          <div className="lcd-label">tempo</div>
          <div className="lcd-value">{bpm}<small> bpm</small></div>
        </div>
        <div className="bpm-buttons">
          <button className="btn sm" onClick={() => onBpm(clampBpm(bpm - 1))} aria-label="tempo down">−</button>
          <button className="btn sm" onClick={() => onBpm(clampBpm(bpm + 1))} aria-label="tempo up">+</button>
          <button className="btn sm" onClick={tap}>tap</button>
        </div>
      </div>

      <div className="transport-knobs">
        <Knob label="swing" value={swing} min={0} max={100} step={1} defaultValue={0} onChange={onSwing} format={v => `${v}%`} />
        <Knob label="master" value={volume} min={0} max={1} step={0.01} defaultValue={0.8} onChange={onVolume} format={v => `${Math.round(v * 100)}%`} />
      </div>
    </div>
  );
}
