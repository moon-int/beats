"use client";
import React from 'react';
import Knob from './Knob';
import type { TrackParams } from '../lib/engine';

type Props = {
  labels: string[];
  tracks: TrackParams[];
  onChange: (index: number, patch: Partial<TrackParams>) => void;
};

const fmtPan = (v: number) => (Math.abs(v) < 0.02 ? 'c' : `${v < 0 ? 'l' : 'r'}${Math.round(Math.abs(v) * 100)}`);
const fmtTune = (v: number) => `${v > 0 ? '+' : ''}${v} st`;

export default function Mixer({ labels, tracks, onChange }: Props) {
  return (
    <div className="mixer">
      {labels.map((label, i) => {
        const t = tracks[i];
        if (!t) return null;
        return (
          <div className="strip" key={i}>
            <div className="strip-label" title={label}>{label}</div>
            <div className="strip-ms">
              <button className={`ms ${t.mute ? 'mute-on' : ''}`} onClick={() => onChange(i, { mute: !t.mute })} aria-pressed={t.mute} aria-label={`mute ${label}`}>m</button>
              <button className={`ms ${t.solo ? 'solo-on' : ''}`} onClick={() => onChange(i, { solo: !t.solo })} aria-pressed={t.solo} aria-label={`solo ${label}`}>s</button>
            </div>
            <Knob label="level" value={t.gain} min={0} max={1} defaultValue={0.8} onChange={v => onChange(i, { gain: v })} format={v => `${Math.round(v * 100)}`} size={40} />
            <Knob label="pan" value={t.pan} min={-1} max={1} defaultValue={0} onChange={v => onChange(i, { pan: v })} format={fmtPan} bipolar size={40} />
            <Knob label="tune" value={t.tune} min={-12} max={12} step={1} defaultValue={0} onChange={v => onChange(i, { tune: v })} format={fmtTune} bipolar size={40} />
            <Knob label="decay" value={t.decay} min={0.25} max={2} defaultValue={1} onChange={v => onChange(i, { decay: v })} format={v => `${v.toFixed(2)}×`} size={40} />
          </div>
        );
      })}
    </div>
  );
}
